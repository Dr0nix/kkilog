# CLAUDE.md

음식 사진·텍스트로 칼로리와 탄단지를 추정해 자동 저장하고, 체중 추세와 하루 목표 칼로리를 보여주는 개인용 안드로이드 앱(APK). 사용자는 초대된 3~4명.
상세 설계는 `docs/spec.md`. 이 파일엔 바뀌지 않는 규칙만 둔다.

## 구조
pnpm 워크스페이스 모노레포
- `apps/mobile` — Expo(React Native, TypeScript). 화면만 담당
- `apps/api` — Next.js Route Handler만 사용하는 API 서버 (Vercel Hobby). 웹 화면 없음
- `packages/domain` — 순수 함수(합계, 추세, LLM 값 범위 검증). `apps/api`만 import
- `packages/contracts` — API 요청·응답 zod 스키마와 타입. 양쪽에서 import

## 스택 (고정 — 새 의존성은 추가 전에 확인받을 것)
- 앱: Expo(최신 안정 SDK), expo-router, expo-image-picker, expo-image-manipulator, expo-secure-store, expo-updates(OTA), react-native-svg(추세 차트 — 차트 라이브러리 없이 직접 그림)
- 서버: Next.js(App Router Route Handler), Gemini API 무료 티어(구조화 출력)
- DB: Neon Postgres(기존 프로젝트) — `@neondatabase/serverless`, ORM 없이 SQL. 이 앱의 테이블은 전부 `meallog` 스키마
- 인증: Neon Auth(Managed Better Auth) 이메일 OTP
- 사진: Vercel Blob private store + 서명 URL
- Gemini 모델 ID는 서버 환경변수 `GEMINI_MODEL`로만 지정
- 테스트: Vitest · lint: ESLint · TypeScript strict

## 절대 규칙
- 앱은 Neon(DB·Auth)·Vercel Blob·Gemini를 직접 호출하지 않는다. 인증·DB·사진·LLM은 전부 `apps/api`를 거친다. `apps/mobile`과 `packages/contracts`는 `@neondatabase/*`, `@vercel/blob`, `@google/genai`, `packages/domain`을 import하면 안 된다 — 의존성 경계 테스트(`tests/dependency-boundary.test.ts`)를 깨지 않는다.
- APK는 디컴파일된다고 가정한다. 비밀 값(`DATABASE_URL`, Neon Auth 키, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`)은 서버 환경변수에만 둔다. 앱에는 `EXPO_PUBLIC_API_BASE_URL` 외의 환경변수를 넣지 않는다.
- 기존 Neon 프로젝트를 같이 쓰되 `meallog` 스키마로 완전히 분리해 운영한다. 마이그레이션은 `meallog` 스키마 안에서만 하고, 기존 서비스의 스키마는 건드리지도 참조하지도 않는다. `neon_auth`는 읽기만 한다.
- 사진·대용량 데이터는 DB에 넣지 않는다(무료 플랜 저장 한도를 넘으면 프로젝트 전체가 정지된다).
- 앱의 인증 토큰은 `expo-secure-store`에만 저장하고 `Authorization: Bearer` 헤더로 보낸다. URL에 토큰을 넣지 않는다.
- 모든 쿼리는 토큰에서 꺼낸 `user_id`로 범위를 제한한다. 요청 body·query로 받은 user_id는 쓰지 않는다.
- 없는 리소스와 남의 리소스는 둘 다 404.
- 칼로리 합계·추세는 서버에서 `packages/domain`으로 계산한다. LLM이 준 합계, 앱이 보낸 계산값은 저장하지 않는다.
- 하루 목표 칼로리는 예외로 Gemini가 정한다(온보딩·프로필 수정 때만). 서버가 허용 범위를 검증한 뒤 `model_id`·`prompt_version`·입력값과 함께 저장하고, 범위를 벗어나면 저장하지 않는다.
- 사진은 Vercel Blob private store에 저장하고, 앱엔 짧게 유효한 서명 URL로만 내려준다.
- 개인 데이터 응답엔 `Cache-Control: private, no-store`.
- 같은 `client_request_id`로 다시 온 기록 요청은 새로 만들지 않고 기존 리소스를 200으로 돌려준다.

## 아직 확정되지 않은 값 — 지어내지 말고 물어볼 것
- `GEMINI_MODEL` 값, 프롬프트 문구(끼니 분석·목표 칼로리)
- Neon Auth 사용자 id 타입과 `neon_auth` 스키마의 사용자 테이블 이름 (PR 2 확인 전까지 FK를 걸지 않는다)
- LLM 응답 정규화 상한값(kcal·탄단지), 사진 보관 기간
불가피하게 임시값을 쓰면 `packages/domain/src/v1/params.ts` 한 곳에 모으고 `// TODO: 확정 필요 — 임시값`을 붙인다.

## 승인이 필요한 변경
- 테이블 스키마, 마이그레이션
- API 요청·응답 형태(`packages/contracts`)
- LLM 출력 스키마와 프롬프트(`apps/api/prompts/*/v*.md`) — 바꾸면 `prompt_version`을 올린다. 기존 버전 파일은 수정하지 않는다.
- 새 Expo 네이티브 모듈·config plugin (APK 재빌드가 필요해짐)
- 화면 UI·스타일·컴포넌트 구조는 자유롭게 판단해도 된다.
- 스펙과 다르게 구현했다면 같은 커밋에서 `docs/spec.md`도 고친다.

## 작업 방식
- feature 브랜치 → `dev` PR. `main` 직접 커밋 금지.
- PR 하나 = `docs/spec.md` 11절 PR 계획의 한 행. PR 안에서는 의미 단위(마이그레이션 하나, 라우트 하나, 화면 하나 등)로 커밋을 나눈다.
- `packages/domain`은 프레임워크·DB 의존 없는 순수 함수 + 유닛 테스트 필수. 테스트는 임시값이 아니라 규칙을 검증한다(파라미터는 `params.ts`에서 읽어서 검사).
- CI(lint → test → typecheck/build)는 DB·외부 API에 접속하지 않고 APK도 빌드하지 않는다. Gemini 호출은 테스트에서 고정 fixture로 대체한다.
