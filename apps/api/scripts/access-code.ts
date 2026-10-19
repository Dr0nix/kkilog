// 접속 코드를 발급·폐기·조회한다(운영자 전용). DATABASE_URL이 가리키는 DB에 바로 쓴다.
//   pnpm --filter @kkilog/api access-code issue --label "친구A"   새 코드 발급(기존 유효 코드는 폐기). 코드는 이때 한 번만 보인다
//   pnpm --filter @kkilog/api access-code revoke --label "친구A"  유효 코드 폐기(기록은 남는다)
//   pnpm --filter @kkilog/api access-code list                    사용자와 코드 상태
import { formatAccessCode } from '@kkilog/contracts/access-code';
import { Client } from '@neondatabase/serverless';
import { generateAccessCode, hashAccessCode } from '../src/access-code.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const labelIndex = rest.indexOf('--label');
const label = labelIndex >= 0 ? rest[labelIndex + 1]?.trim() : undefined;

if (command !== 'list' && command !== 'issue' && command !== 'revoke') {
  console.error('사용법: access-code issue|revoke --label "이름" / access-code list');
  process.exit(1);
}
if (command !== 'list' && (!label || label.length > 40)) {
  console.error('--label은 1~40자로 지정해야 합니다.');
  process.exit(1);
}

const client = new Client(url);
await client.connect();
try {
  if (command === 'list') {
    const { rows } = await client.query<{ label: string; active: boolean; issued_at: string | null; revoked: number }>(`
      select u.label,
             bool_or(c.revoked_at is null and c.id is not null) as active,
             max(c.created_at) filter (where c.revoked_at is null)::text as issued_at,
             count(c.id) filter (where c.revoked_at is not null)::int as revoked
      from kkilog.users u left join kkilog.access_codes c on c.user_id = u.id
      group by u.id order by u.created_at`);
    if (rows.length === 0) console.log('사용자가 없습니다.');
    for (const r of rows) {
      console.log(`${r.label}\t${r.active ? `유효 (발급 ${r.issued_at})` : '유효 코드 없음'}\t폐기 ${r.revoked}개`);
    }
  } else if (command === 'issue') {
    const code = generateAccessCode();
    const hash = await hashAccessCode(code);
    await client.query('begin');
    try {
      const { rows } = await client.query<{ id: string; created: boolean }>(
        `insert into kkilog.users (label) values ($1)
         on conflict (label) do update set label = excluded.label
         returning id, (xmax = 0) as created`,
        [label],
      );
      const user = rows[0];
      if (!user) throw new Error('사용자를 만들지 못했습니다.');
      await client.query(
        'update kkilog.access_codes set revoked_at = now() where user_id = $1 and revoked_at is null',
        [user.id],
      );
      await client.query("insert into kkilog.access_codes (user_id, code_hash) values ($1, decode($2, 'hex'))", [
        user.id,
        hash,
      ]);
      await client.query('commit');
      console.log(`${label}: ${user.created ? '새 사용자' : '기존 사용자(이전 코드는 폐기됨)'}`);
      console.log(`접속 코드: ${formatAccessCode(code)}`);
      console.log('이 코드는 다시 볼 수 없습니다. 지금 전달하세요.');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } else {
    const { rowCount } = await client.query(
      `update kkilog.access_codes c set revoked_at = now()
       from kkilog.users u
       where c.user_id = u.id and u.label = $1 and c.revoked_at is null`,
      [label],
    );
    console.log(rowCount ? `${label}: 코드를 폐기했습니다.` : `${label}: 유효한 코드가 없습니다.`);
  }
} finally {
  await client.end();
}
