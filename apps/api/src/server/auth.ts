import 'server-only';
import { hashAccessCode, parseBearer } from '../access-code';
import { db } from './db';

// Bearer 접속 코드로 user_id를 찾는다. 없거나 폐기된 코드면 null.
export async function authenticate(request: Request): Promise<string | null> {
  const code = parseBearer(request.headers.get('authorization'));
  if (!code) return null;
  const hash = await hashAccessCode(code);
  const rows = await db()`
    select user_id from kkilog.access_codes
    where code_hash = decode(${hash}, 'hex') and revoked_at is null`;
  const userId: unknown = rows[0]?.user_id;
  return typeof userId === 'string' ? userId : null;
}
