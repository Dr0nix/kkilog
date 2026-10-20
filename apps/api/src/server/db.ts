import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false> | undefined;

// 빌드 시점엔 DATABASE_URL이 없을 수 있어서 처음 쓸 때 만든다.
export function db(): NeonQueryFunction<false, false> {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    sql = neon(url);
  }
  return sql;
}
