import { AnalyzeMealRequestSchema, type MealMutationResponse } from '@kkilog/contracts';
import { z } from 'zod';
import { attemptOf } from '@/src/meals/attempt';
import { authenticate } from '@/src/server/auth';
import { errorJson, privateJson } from '@/src/server/http';
import { analyzeAndSave, findEntry, latestCorrectionText, toMealResponse } from '@/src/server/meals';

export const maxDuration = 60;

// 재시도 또는 한 줄 보정으로 재분석한다. 결과는 새 분석 행으로 쌓인다(spec 5).
// correction_text가 없으면(재시도) 마지막 분석의 보정을 그대로 쓴다.
export async function POST(request: Request, ctx: RouteContext<'/api/meals/[id]/analyze'>) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const { id } = await ctx.params;
  const entry = z.uuid().safeParse(id).success ? await findEntry(userId, id) : null;
  if (!entry) return errorJson('NOT_FOUND', 404);

  // 본문 없이 보내면(재시도) 빈 객체로 본다.
  const text = await request.text();
  let json: unknown = {};
  try {
    if (text.trim() !== '') json = JSON.parse(text);
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }
  const body = AnalyzeMealRequestSchema.safeParse(json);
  if (!body.success) return errorJson('INVALID_REQUEST', 400);

  const correction = body.data.correction_text ?? (await latestCorrectionText(entry.id));
  const result = await analyzeAndSave(entry, correction);
  return privateJson<MealMutationResponse>({ meal: await toMealResponse(entry), attempt: attemptOf(result) });
}
