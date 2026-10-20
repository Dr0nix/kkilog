import {
  type AnalyzeMealRequest,
  CREATE_MEAL_FIELDS,
  ErrorResponseSchema,
  MealAdviceResponseSchema,
  MealMutationResponseSchema,
  MeResponseSchema,
  OnboardingResponseSchema,
  type ErrorCode,
  type MealAdviceResponse,
  type MealMutationResponse,
  type MealType,
  type MeResponse,
  type OnboardingRequest,
  type OnboardingResponse,
} from '@kkilog/contracts';
import { clearStoredCode, getStoredCode } from './code-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class UnauthorizedError extends Error {}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;

  constructor(status: number, code: ErrorCode | undefined) {
    super(`API ${status}${code ? ` ${code}` : ''}`);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized: (() => void) | undefined;

// 저장된 코드가 401을 받으면 코드를 지우고 이 함수를 부른다(코드 입력 화면으로 보내는 용도).
export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
  onUnauthorized = handler;
}

// candidateCode를 주면 저장된 코드 대신 그걸로 확인한다(코드 입력 화면에서 저장 전에 검증할 때).
async function request(path: string, init?: RequestInit, candidateCode?: string): Promise<unknown> {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');

  const code = candidateCode ?? (await getStoredCode());
  const headers = new Headers(init?.headers);
  if (code) headers.set('Authorization', `Bearer ${code}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    if (!candidateCode) {
      await clearStoredCode();
      onUnauthorized?.();
    }
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    const body = ErrorResponseSchema.safeParse(await res.json().catch(() => null));
    throw new ApiError(res.status, body.success ? body.data.error.code : undefined);
  }
  return res.json();
}

function postJson(path: string, body: unknown): Promise<unknown> {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getMe(candidateCode?: string): Promise<MeResponse> {
  return MeResponseSchema.parse(await request('/api/me', undefined, candidateCode));
}

export async function submitOnboarding(body: OnboardingRequest): Promise<OnboardingResponse> {
  return OnboardingResponseSchema.parse(await postJson('/api/onboarding', body));
}

export type NewMeal = {
  mealType: MealType;
  clientRequestId: string;
  text: string | null;
  photoUri: string | null;
};

// multipart로 보낸다. Content-Type은 fetch가 boundary와 함께 붙이므로 직접 지정하지 않는다.
export async function createMeal(meal: NewMeal): Promise<MealMutationResponse> {
  const form = new FormData();
  form.append(CREATE_MEAL_FIELDS.mealType, meal.mealType);
  form.append(CREATE_MEAL_FIELDS.clientRequestId, meal.clientRequestId);
  if (meal.text) form.append(CREATE_MEAL_FIELDS.text, meal.text);
  if (meal.photoUri) {
    // React Native의 FormData는 { uri, name, type }으로 파일을 붙인다.
    form.append(CREATE_MEAL_FIELDS.photo, { uri: meal.photoUri, name: 'meal.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return MealMutationResponseSchema.parse(await request('/api/meals', { method: 'POST', body: form }));
}

export async function analyzeMeal(mealId: string, body: AnalyzeMealRequest = {}): Promise<MealMutationResponse> {
  return MealMutationResponseSchema.parse(await postJson(`/api/meals/${mealId}/analyze`, body));
}

// 현재 분석 기준 영양 조언. 이미 있으면 서버가 저장된 것을 돌려준다(spec 6.2).
export async function getMealAdvice(mealId: string): Promise<MealAdviceResponse> {
  return MealAdviceResponseSchema.parse(await request(`/api/meals/${mealId}/advice`, { method: 'POST' }));
}
