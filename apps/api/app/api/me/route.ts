import type { MeResponse } from '@kkilog/contracts';
import { authenticate } from '@/src/server/auth';
import { db } from '@/src/server/db';
import { errorJson, privateJson } from '@/src/server/http';

export async function GET(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const rows = await db()`select exists (select 1 from kkilog.profiles where user_id = ${userId}) as has_profile`;
  return privateJson<MeResponse>({ has_profile: rows[0]?.has_profile === true });
}
