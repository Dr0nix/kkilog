import type { AnalysisError, MealMutationResponse } from '@kkilog/contracts';

// 이번 요청에서 한 분석의 결과만 앱에 알려준다(저장된 행 전체가 아니라).
export function attemptOf(
  result: { status: 'ok' } | { status: 'failed'; error: AnalysisError },
): MealMutationResponse['attempt'] {
  return result.status === 'ok' ? { status: 'ok' } : { status: 'failed', error: result.error };
}
