import type { MealAdviceResponse } from '@kkilog/contracts';
import { z } from 'zod';
import { authenticate } from '@/src/server/auth';
import { GeminiError } from '@/src/server/gemini';
import { errorJson, privateJson } from '@/src/server/http';
import { getOrCreateAdvice } from '@/src/server/meal-advice';
import { findEntry } from '@/src/server/meals';

// Gemini 호출(재시도 포함)을 기다린다.
export const maxDuration = 60;

// 현재 분석 기준 영양 조언. 있으면 저장된 것, 없으면 만든다(spec 6.2).
export async function POST(request: Request, ctx: RouteContext<'/api/meals/[id]/advice'>) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const { id } = await ctx.params;
  const entry = z.uuid().safeParse(id).success ? await findEntry(userId, id) : null;
  if (!entry) return errorJson('NOT_FOUND', 404);

  let outcome;
  try {
    outcome = await getOrCreateAdvice(userId, entry);
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    console.error('meal advice: gemini failed', error);
    return errorJson('UPSTREAM_UNAVAILABLE', 503);
  }
  if (outcome.status === 'no_analysis') return errorJson('ANALYSIS_REQUIRED', 409);
  return privateJson<MealAdviceResponse>({ advice: outcome.advice });
}
