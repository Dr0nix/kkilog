import {
  type AnalyzeMealRequest,
  type CreateWeightRequest,
  CreateWeightResponseSchema,
  type CreateWeightResponse,
  HomeResponseSchema,
  type HomeResponse,
  MealResponseSchema,
  type MealResponse,
  ProfileResponseSchema,
  type ProfileResponse,
  TrendResponseSchema,
  type TrendResponse,
  type UpdateProfileRequest,
  UpdateProfileResponseSchema,
  type UpdateProfileResponse,
  CREATE_MEAL_FIELDS,
  ErrorResponseSchema,
  MealAdviceResponseSchema,
  MealMutationResponseSchema,
  MeResponseSchema,
  OnboardingResponseSchema,
  type MealAdviceResponse,
  type MealMutationResponse,
  type MealType,
  type MeResponse,
  type OnboardingRequest,
  type OnboardingResponse,
} from '@kkilog/contracts';
import { clearStoredCode, getStoredCode } from './code-store';
import { ApiError, NetworkError, ResponseParseError, UnauthorizedError } from './http-errors';

export { ApiError, NetworkError, ResponseParseError, UnauthorizedError } from './http-errors';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// 사진을 넣은 multipart 업로드가 서버에 닿기까지 넉넉히 기다린다(서버 maxDuration 60초 + 업로드).
const UPLOAD_TIMEOUT_MS = 90_000;

let onUnauthorized: (() => void) | undefined;

// 저장된 코드가 401을 받으면 코드를 지우고 이 함수를 부른다(코드 입력 화면으로 보내는 용도).
export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
  onUnauthorized = handler;
}

type RawResponse = { status: number; text: string };

// Expo가 전역 fetch를 expo/fetch로 바꿔 끼우는데, expo/fetch는 React Native 방식 파일({ uri, name, type })을
// FormData에 담지 못한다("Unsupported FormDataPart implementation" — 요청이 서버에 가기 전에 실패).
// React Native의 XMLHttpRequest는 그대로라 사진 multipart는 XHR로 보낸다. Content-Type(boundary)은 XHR이 붙인다.
function sendMultipart(url: string, method: string, headers: Headers, body: FormData): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('xhr error'));
    xhr.ontimeout = () => reject(new Error('xhr timeout'));
    xhr.send(body);
  });
}

async function send(url: string, init: RequestInit, headers: Headers): Promise<RawResponse> {
  if (init.body instanceof FormData) return sendMultipart(url, init.method ?? 'POST', headers, init.body);
  const res = await fetch(url, { ...init, headers });
  return { status: res.status, text: await res.text() };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// candidateCode를 주면 저장된 코드 대신 그걸로 확인한다(코드 입력 화면에서 저장 전에 검증할 때).
async function request(path: string, init: RequestInit = {}, candidateCode?: string): Promise<unknown> {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');

  const code = candidateCode ?? (await getStoredCode());
  const headers = new Headers(init.headers);
  if (code) headers.set('Authorization', `Bearer ${code}`);

  let res: RawResponse;
  try {
    res = await send(`${BASE_URL}${path}`, init, headers);
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (res.status === 401) {
    if (!candidateCode) {
      await clearStoredCode();
      onUnauthorized?.();
    }
    throw new UnauthorizedError();
  }
  if (res.status < 200 || res.status >= 300) {
    const body = ErrorResponseSchema.safeParse(parseJson(res.text));
    throw new ApiError(res.status, body.success ? body.data.error.code : undefined);
  }
  if (res.status === 204 || res.text === '') return null;
  const json = parseJson(res.text);
  if (json === undefined) throw new ResponseParseError(`invalid JSON from ${path}`);
  return json;
}

// 2xx 응답이 contracts 스키마와 맞지 않으면(서버·앱 버전이 어긋난 경우 등) 연결 실패와 구분되게 던진다.
type SafeParser<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { message: string } };
};

function parse<T>(schema: SafeParser<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ResponseParseError(result.error.message);
  return result.data;
}

function sendJson(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<unknown> {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getMe(candidateCode?: string): Promise<MeResponse> {
  return parse(MeResponseSchema, await request('/api/me', undefined, candidateCode));
}

export async function submitOnboarding(body: OnboardingRequest): Promise<OnboardingResponse> {
  return parse(OnboardingResponseSchema, await sendJson('POST', '/api/onboarding', body));
}

export type NewMeal = {
  mealType: MealType;
  clientRequestId: string;
  text: string | null;
  // 보낸 순서가 사진 순서(첫 장이 대표). 최대 MEAL_PHOTOS_MAX장
  photoUris: readonly string[];
  // 사용자가 고른 먹은 시각. null이면 서버가 지금으로 둔다
  eatenAt: Date | null;
};

// multipart로 보낸다(XHR, sendMultipart 참고). Content-Type은 boundary와 함께 붙으므로 직접 지정하지 않는다.
export async function createMeal(meal: NewMeal): Promise<MealMutationResponse> {
  const form = new FormData();
  form.append(CREATE_MEAL_FIELDS.mealType, meal.mealType);
  form.append(CREATE_MEAL_FIELDS.clientRequestId, meal.clientRequestId);
  if (meal.text) form.append(CREATE_MEAL_FIELDS.text, meal.text);
  if (meal.eatenAt) form.append(CREATE_MEAL_FIELDS.eatenAt, meal.eatenAt.toISOString());
  meal.photoUris.forEach((uri, i) => {
    // React Native의 FormData는 { uri, name, type }으로 파일을 붙인다. 같은 필드 이름으로 여러 번 붙인다.
    form.append(CREATE_MEAL_FIELDS.photo, { uri, name: `meal-${i}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  });
  return parse(MealMutationResponseSchema, await request('/api/meals', { method: 'POST', body: form }));
}

export async function analyzeMeal(mealId: string, body: AnalyzeMealRequest = {}): Promise<MealMutationResponse> {
  return parse(MealMutationResponseSchema, await sendJson('POST', `/api/meals/${mealId}/analyze`, body));
}

// 현재 분석 기준 영양 조언. 이미 있으면 서버가 저장된 것을 돌려준다(spec 6.2).
export async function getMealAdvice(mealId: string): Promise<MealAdviceResponse> {
  return parse(MealAdviceResponseSchema, await request(`/api/meals/${mealId}/advice`, { method: 'POST' }));
}

// date가 없으면 서버가 오늘(프로필 타임존)로 본다.
export async function getHome(date?: string): Promise<HomeResponse> {
  return parse(HomeResponseSchema, await request(`/api/home${date ? `?date=${date}` : ''}`));
}

export async function getMeal(mealId: string): Promise<MealResponse> {
  return parse(MealResponseSchema, await request(`/api/meals/${mealId}`));
}

export async function deleteMeal(mealId: string): Promise<void> {
  await request(`/api/meals/${mealId}`, { method: 'DELETE' });
}

export async function createWeight(body: CreateWeightRequest): Promise<CreateWeightResponse> {
  return parse(CreateWeightResponseSchema, await sendJson('POST', '/api/weights', body));
}

export async function getTrend(days?: number): Promise<TrendResponse> {
  return parse(TrendResponseSchema, await request(`/api/trend${days ? `?days=${days}` : ''}`));
}

export async function getProfile(): Promise<ProfileResponse> {
  return parse(ProfileResponseSchema, await request('/api/profile'));
}

export async function updateProfile(body: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  return parse(UpdateProfileResponseSchema, await sendJson('PATCH', '/api/profile', body));
}
