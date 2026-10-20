// DATABASE_URL이 가리키는 DB에 migrations/NNNN_*.sql을 순서대로 적용한다.
// 기본은 미적용 목록만 보여주고(DB에 쓰지 않음), --apply를 붙여야 적용한다.
//   pnpm --filter @kkilog/api migrate
//   pnpm --filter @kkilog/api migrate --apply
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@neondatabase/serverless';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');
const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const invalid = files.filter((name) => !FILE_PATTERN.test(name));
if (invalid.length > 0) {
  console.error(`파일 이름이 NNNN_name.sql 형식이 아닙니다: ${invalid.join(', ')}`);
  process.exit(1);
}

const client = new Client(url);
await client.connect();
try {
  const { host, pathname } = new URL(url);
  console.log(`대상 DB: ${host}${pathname}`);

  const { rows: exists } = await client.query<{ table: string | null }>(
    "select to_regclass('kkilog.schema_migrations')::text as table",
  );
  const applied = new Set<string>();
  if (exists[0]?.table) {
    const { rows } = await client.query<{ version: string }>('select version from kkilog.schema_migrations');
    for (const row of rows) applied.add(row.version);
  }

  const pending = files.filter((name) => !applied.has(name.replace(/\.sql$/, '')));
  if (pending.length === 0) {
    console.log('적용할 마이그레이션이 없습니다.');
  } else if (!apply) {
    console.log(`미적용 ${pending.length}개:`);
    for (const name of pending) console.log(`  ${name}`);
    console.log('적용하려면 --apply를 붙여 다시 실행하세요.');
  } else {
    await client.query('create schema if not exists kkilog');
    await client.query(
      'create table if not exists kkilog.schema_migrations (version text primary key, applied_at timestamptz not null default now())',
    );
    for (const name of pending) {
      const version = name.replace(/\.sql$/, '');
      await client.query('begin');
      try {
        await client.query(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'));
        await client.query('insert into kkilog.schema_migrations (version) values ($1)', [version]);
        await client.query('commit');
        console.log(`적용: ${name}`);
      } catch (error) {
        await client.query('rollback');
        console.error(`실패: ${name} (롤백함)`);
        throw error;
      }
    }
  }
} finally {
  await client.end();
}
