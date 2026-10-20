import type { MealResponse } from '@kkilog/contracts';
import { z } from 'zod';
import { authenticate } from '@/src/server/auth';
import { db } from '@/src/server/db';
import { errorJson, noContent, privateJson } from '@/src/server/http';
import { findEntry, toMealResponse } from '@/src/server/meals';

export async function GET(request: Request, ctx: RouteContext<'/api/meals/[id]'>) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const { id } = await ctx.params;
  const entry = z.uuid().safeParse(id).success ? await findEntry(userId, id) : null;
  if (!entry) return errorJson('NOT_FOUND', 404);

  return privateJson<MealResponse>({ meal: await toMealResponse(entry) });
}

// soft delete(spec 8). 사진은 보관 기간 정책이 정해질 때까지 그대로 둔다.
export async function DELETE(request: Request, ctx: RouteContext<'/api/meals/[id]'>) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return errorJson('NOT_FOUND', 404);

  const rows = await db()`
    update kkilog.meal_entries set deleted_at = now()
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning id`;
  return rows.length > 0 ? noContent() : errorJson('NOT_FOUND', 404);
}
