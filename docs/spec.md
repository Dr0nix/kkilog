# 식단 기록 앱 — 스펙 v0.4 (안드로이드 APK · Neon)

## 1. 목표와 전제
- 음식 사진(+이름) 또는 텍스트 나열("삶은 계란 3개, 더단백 프로틴음료 1개")을 보내면 칼로리·탄단지를 추정해 **옮겨 적는 과정 없이** 저장한다.
- 매일 체중을 기록하고, 목표 체중 기준으로 추세와 하루 목표 칼로리를 보여준다.
- 추정 오차(±20~30%)는 전제다. 목적은 추세 파악이므로 **일관성 > 절대 정확도**. 같은 입력은 같은 기준(같은 모델·프롬프트)으로 계산되어야 한다. 영양값 추정은 전부 AI에 맡긴다(사용자 고정값 사전 없음).
- 사용자 3~4명(전원 안드로이드), 사용자당 하루 3~5회. 무료 티어 안에서 운용.
- 배포: APK 파일 직접 설치. 스토어 등록 없음.
- 1차 범위 밖: 운동 기록(스키마만 확장 가능하게), 아이폰, 알림, 오프라인 저장 후 전송.

## 2. 화면 흐름
```
첫 실행 ─▶ 로그인(이메일 → 6자리 코드) ─▶ 프로필 없음? ─▶ 온보딩 ─▶ 홈
재실행  ─▶ (SecureStore 토큰 유효) ───────────────────────────▶ 홈
```

### 2.1 로그인
- 이메일 입력 → 코드 발송 → 6자리 코드 입력. 한 번 로그인하면 토큰을 SecureStore에 저장해서 이후엔 바로 홈으로.
- 허용된 이메일만 코드가 발송된다. APK 파일은 쉽게 전달되므로 아무나 설치해서 쓰지 못하게 막는 장치이고, 휴대폰을 바꾸거나 앱을 다시 설치해도 같은 이메일로 기록을 되찾는 수단이기도 하다.

### 2.2 온보딩 (프로필이 없을 때 한 번)
| 항목 | 입력 | 저장 | 검증 |
| --- | --- | --- | --- |
| 닉네임 | 텍스트 | `profiles.nickname` | 1~20자 |
| 성별 | 남/여 | `profiles.sex` | 필수 |
| 나이 | 숫자 | `profiles.birth_year` = 올해 − 나이 | 14~100 |
| 키 | cm | `profiles.height_cm` | 100.0~250.0 |
| 현재 몸무게 | kg | 첫 `weight_logs` 행 | 20.0~300.0 |
| 목표 몸무게 | kg | `profiles.target_weight_kg` | 20.0~300.0 |
- 나이는 해가 바뀌면 달라지므로 출생연도로 바꿔 저장한다(±1세 오차는 감수).
- 프로필 생성과 첫 체중 기록은 한 트랜잭션. 이미 프로필이 있으면 409.
- 온보딩 직후 홈에 목표 칼로리가 바로 보여야 한다.
- 프로필 수정 화면에서 같은 항목을 고칠 수 있다(몸무게는 제외 — 체중 기록으로 남김).

### 2.3 홈 (대시보드)
- 오늘 섭취 kcal / 목표 kcal, 탄·단·지 합계
- 오늘 끼니 목록(끼니 태그, 사진 썸네일, 음식명, kcal) → 탭하면 상세
- 분석 실패한 끼니도 목록에 [분석 실패 · 재시도] 표시로 보이되, 합계에선 빠진다
- 체중: 오늘 기록 여부, [체중 기록] 버튼
- 하단 큰 버튼: [기록하기]

### 2.4 기록하기
- 끼니 태그(필수): 아침 / 점심 / 저녁 / 야식 / 간식. 현재 시각으로 기본 선택해 두고 사용자가 바꿀 수 있다
- [카메라] / [앨범] 버튼 + 텍스트 칸(선택). 사진 없이 텍스트만도 가능
- [분석] → 원본 저장 → 분석 → 결과 카드(음식별 추정치 + 합계 + 추정 근거 메모)
- 결과가 틀리면 [다시 분석]에 한 줄 보정("밥 반 공기만 먹음")을 붙여 재분석한다. 숫자를 직접 고치는 화면은 두지 않는다.

### 2.5 추세
- 체중 그래프: 실측 점 + 추세선, 목표 체중 기준선
- 목표까지 남은 kg, 최근 14일 추세 기울기(kg/주), 이 속도 유지 시 도달 예상일
- 최근 7일 평균 섭취 vs 목표

## 3. 아키텍처
```
APK (Expo) ──HTTPS + Bearer──▶ apps/api (Next.js Route Handler, Vercel)
                                ├─ Neon Auth (이메일 OTP, 세션 검증)
                                ├─ Neon Postgres — 기존 프로젝트, `meallog` 스키마 (user_id로 범위 제한)
                                ├─ Vercel Blob private store (사진)
                                └─ Gemini API (구조화 출력)
```
- DB 접근: `@neondatabase/serverless`(HTTP), ORM 없이 SQL. 여러 문장을 묶어야 하는 곳(온보딩)은 드라이버의 트랜잭션 API 사용.
- 마이그레이션: `apps/api/migrations/NNNN_*.sql` 순번 파일 + 적용 스크립트. 적용 이력은 `meallog.schema_migrations`에 기록.
- 리뷰·검증용 DB는 Neon 브랜치로 만든다(운영 데이터 복제 없이 스키마만 적용해서 확인). CI는 DB에 접속하지 않는다.
- 디렉터리
  - `apps/mobile/app/` — expo-router 화면 (`(auth)/`, `onboarding`, `(main)/`)
  - `apps/mobile/src/api/` — fetch 래퍼(토큰 첨부, 401 시 refresh, 실패 시 로그인으로)
  - `apps/api/app/api/` — Route Handler
  - `apps/api/src/server/` — DB·Storage·Gemini 클라이언트, 인증 헬퍼 (`server-only`)
  - `apps/api/src/server/analysis/` — 프롬프트 로드, LLM 출력 스키마(zod), 응답 검증
  - `apps/api/prompts/meal-analysis/v1.md` — 프롬프트 원문 (버전별 파일, 기존 파일 수정 금지)
  - `apps/api/scripts/allow-email.ts` — 허용 이메일 추가·삭제(운영자가 직접 실행)
  - `packages/domain/src/v1/` — 순수 함수 + `params.ts`
  - `packages/contracts/src/` — API zod 스키마
- 사진: 앱에서 `expo-image-manipulator`로 **긴 변 1024px JPEG(품질 0.7)로 축소 후** 업로드. 원본 해상도는 보관하지 않는다.
- 분석은 요청 안에서 동기로 처리한다. 원본을 먼저 저장하고 분석이 실패하면 `status='failed'`로 남겨 [재시도] 가능하게 한다(원본은 잃지 않는다). Route Handler의 `maxDuration`은 Vercel Hobby 한도 안에서 지정한다(PR 5에서 확인).
- 날짜 경계: `eaten_at`은 서버가 요청을 받은 시각, `local_date`는 서버에서 사용자 타임존(기본 `Asia/Seoul`)으로 계산. 지난 날짜로 기록하는 기능은 두지 않는다.
- 멱등성: 앱이 기록 요청마다 `client_request_id`(UUID)를 만들어 보내고, 재시도할 땐 같은 값을 쓴다. 이미 처리된 `client_request_id`면 새로 만들지 않고 **기존 리소스를 200으로 그대로 돌려준다**(응답 유실 후 재시도해도 결과를 받을 수 있게).

## 4. 인증
- Neon Auth(Managed Better Auth)의 이메일 OTP. 코드 메일은 Neon Auth 기본 발송을 쓴다(별도 메일 서비스·도메인 불필요). 사용자는 Neon이 같은 DB의 `neon_auth` 스키마에 저장한다.
- 코드 요청·검증은 `apps/api`가 대신 처리하고, 앱엔 세션 토큰을 돌려준다. 앱은 Neon Auth를 직접 부르지 않는다.
- 허용 목록: `apps/api`가 코드 요청 전에 `meallog.allowed_emails`를 확인한다. 없는 이메일도 응답은 동일하게(존재 여부 노출 금지).
- 서버는 모든 요청에서 Bearer 토큰을 검증해 `user_id`를 얻는다. 프로필이 필요한 API는 프로필이 없으면 `409 ONBOARDING_REQUIRED`.
- **PR 2 선행 확인 항목** (확인 전엔 구현하지 않는다)
  - 서버가 앱 대신 OTP 발송·검증을 호출하고, 앱에 넘길 토큰을 받을 수 있는지(헤드리스 사용 가능 여부)
  - Bearer 토큰으로 서버에서 세션을 검증하는 방법, 만료·갱신 방식
  - 사용자 id 타입과 사용자 테이블 위치 → `meallog` 테이블의 `user_id` 타입·FK 확정
  - 세션 모델이 access/refresh 2토큰인지 단일 세션 토큰(만료 연장)인지 → `/api/auth/refresh` 계약 확정
  - 기본 메일 발송을 운영에서 써도 되는지(발송 한도·개발용 제한 여부)
  - Neon 브랜치(preview·로컬)에서 `neon_auth` 사용자 데이터가 어떻게 분리·복제되는지
  - 위가 안 되면 대안: 자체 OTP 테이블 + 메일 발송 서비스(새 의존성이라 승인 필요)

## 5. 데이터 모델 (초안 — 확정 시 마이그레이션)
원본: `profiles`, `meal_entries`, `weight_logs` / 캐시: `meal_analyses`
- 모든 테이블은 `meallog` 스키마. 기존 서비스의 스키마와 완전히 분리해 운영한다(서로 참조하지 않음, 같은 Neon 프로젝트의 저장 한도만 공유). 아래 `user_id`는 Neon Auth 사용자 id이며, 타입과 FK 대상은 PR 2 확인 후 확정한다(그 전까진 FK 없이 `not null`만).

```sql
create schema if not exists meallog;
set search_path to meallog;

create table allowed_emails (email text primary key check (email = lower(email)));

create table profiles (
  user_id uuid primary key,               -- 타입 확정 필요 (Neon Auth)
  nickname text not null check (char_length(nickname) between 1 and 20),
  sex text not null check (sex in ('male','female')),
  birth_year int not null check (birth_year between 1900 and 2100),  -- 나이 14~100은 API에서 검증
  height_cm numeric(4,1) not null check (height_cm between 100 and 250),
  target_weight_kg numeric(4,1) not null check (target_weight_kg between 20 and 300),
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table weight_logs (                -- 덮어쓰지 않고 누적
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  client_request_id uuid not null,
  local_date date not null,
  weight_kg numeric(4,1) not null check (weight_kg between 20 and 300),
  source text not null check (source in ('onboarding','daily')),
  measured_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index on weight_logs (user_id, local_date);

create table meal_entries (               -- 원본
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  client_request_id uuid not null,
  local_date date not null,
  eaten_at timestamptz not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','late_night','snack')),
  input_text text,
  photo_path text,                        -- Blob pathname (URL 아님)
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (input_text is not null or photo_path is not null),
  unique (user_id, client_request_id)
);
create index on meal_entries (user_id, local_date);

create table meal_analyses (              -- 캐시. 재분석 시 행 추가
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references meal_entries on delete cascade,
  status text not null check (status in ('ok','failed')),
  model_id text not null,
  prompt_version text not null,
  correction_text text,
  items jsonb,
  kcal int, carb_g numeric(6,1), protein_g numeric(6,1), fat_g numeric(6,1),
  notes text,
  raw_response jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index on meal_analyses (entry_id, created_at desc);
```
- 기록 테이블은 `profiles`를 참조한다 → 온보딩 전에는 기록이 생길 수 없다.
- 사진 경로는 `meals/{user_id}/{entry_id}.jpg`. DB엔 pathname만 저장하고, 응답할 때마다 서명 URL을 새로 만든다.
- 끼니의 현재값 = 해당 entry의 가장 최근 `status='ok'` 분석. `ok` 분석이 없는 끼니는 합계에서 뺀다.
- 체중 기록 삭제·수정 API는 두지 않는다. 오입력은 운영자가 DB에서 직접 정리한다.
- `allowed_emails`는 `scripts/allow-email.ts`로만 관리한다.
- 하루 체중값 = 그날 가장 마지막 기록. 목표 칼로리 계산엔 가장 최근 체중을 쓴다.
- 나이 = 기준일 연도 − `birth_year` (계산은 `packages/domain`).
- 운동 기록은 2차에 `activity_entries`(원본) + 분석 캐시 구조로 같은 패턴 추가. 활동계수는 1차에선 프로필에 받지 않고 `params.ts` 값(미확정)을 전원 공통으로 쓴다.

## 6. 분석 파이프라인
1. 입력: 사진(선택) + `input_text`(선택) + `correction_text`(재분석 시)
2. Gemini 구조화 출력(`responseSchema`), temperature 0
3. LLM 출력 스키마
   ```json
   {
     "items": [{
       "name": "삶은 계란",
       "quantity": 3, "unit": "개",
       "estimated_grams": 150,
       "kcal": 234, "carb_g": 1.8, "protein_g": 18.9, "fat_g": 15.9,
       "confidence": "high|medium|low"
     }],
     "notes": "사진상 밥 양을 1공기로 가정"
   }
   ```
4. 응답 검증(`apps/api/src/server/analysis/`, zod) — 실패 → `status='failed'`
5. 서버 정규화(`packages/domain`, 순수 함수 — 검증된 값만 받는다)
   - 합계는 item 합으로 서버가 계산 (LLM 합계 안 받음)
   - 음수·비정상 값 차단 — 상한은 `params.ts`
6. `meal_analyses`에 `model_id`, `prompt_version` 채워서 저장
- 429(무료 한도 초과)·타임아웃: 1회 재시도 후 `failed` 저장, 앱엔 [재시도]
- 프롬프트·모델을 바꿔도 과거 기록은 소급 재분석하지 않는다. 새 `prompt_version`·`model_id`는 바뀐 뒤의 분석(신규 기록·[다시 분석])부터 적용되고, 과거 분석은 당시 버전 그대로 남는다.

## 7. 체중 추세와 목표 칼로리 (v1, 값은 전부 미확정)
- 입력: 성별, 나이, 키, 최근 체중, 목표 체중 (온보딩 항목만으로 계산 가능해야 함)
- 추세: 일별 체중의 지수이동평균. 평활 계수 미확정
- 목표 칼로리: BMR × 활동계수 − 일일 적자, 최저 하한 적용. 공식·계수·적자 폭·하한 미확정
- 2차 후보: 섭취 기록 + 추세 변화로 실제 소비량을 역산하는 적응형 목표 (데이터 3주 이상 쌓인 뒤)

## 8. API (초안 — 형태 확정 시 `packages/contracts`로 고정)
| Method | Path | 설명 |
| --- | --- | --- |
| GET | /api/health | 배포 확인용 `{ ok: true }` (인증 없음, 개인 데이터 없음) |
| POST | /api/auth/otp | 코드 발송 (허용 이메일만, 응답 동일) |
| POST | /api/auth/verify | 코드 검증 → access/refresh 토큰 + `has_profile` |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/onboarding | 프로필 + 첫 체중. 이미 있으면 409 |
| GET/PATCH | /api/profile | 프로필 조회·수정 |
| GET | /api/home?date= | 해당일 섭취 합계·목표·끼니 목록(태그, 서명 사진 URL, 분석 상태)·체중 기록 여부 |
| POST | /api/meals | multipart: meal_type, photo?, text?, client_request_id → 원본 저장 + 분석 → 결과. 중복이면 기존 결과 200 |
| GET | /api/meals/:id | 상세 (현재 분석 + 사진 서명 URL) |
| POST | /api/meals/:id/analyze | 재시도/재분석 (correction_text?) |
| DELETE | /api/meals/:id | soft delete |
| POST | /api/weights | weight_kg, client_request_id. 중복이면 기존 기록 200 |
| GET | /api/trend?days= | 체중 실측 + 추세 + 목표 도달 예상 + 7일 평균 섭취 |

## 9. 빌드·배포
- API: Vercel(`apps/api`), `dev` → preview, `main` → 운영
- DB: 운영은 기존 Neon 프로젝트의 기본 브랜치. preview·로컬은 Neon 브랜치를 따로 만들어 `DATABASE_URL`로 분리
- Vercel Blob: preview·운영 store 분리. Hobby 플랜에서 private store·서명 URL이 되는지 PR 5에서 먼저 확인하고, 안 되면 API가 사진을 대신 내려주는 프록시 라우트로 대체(앱에 Blob URL을 노출하지 않는 원칙은 유지)
- APK: EAS Build(무료 플랜 월 빌드 횟수 제한) 또는 로컬 `expo prebuild` + Gradle 빌드. 서명 키스토어는 저장소에 넣지 않는다.
- JS만 바뀐 수정은 EAS Update(OTA)로 배포해 재설치 없이 반영. 네이티브 모듈이 바뀌면 APK 재배포.
- 사이드로딩 제약: 구글 개발자 인증 요구가 2027년 전 세계로 확대 예정. 그 전에 취미 개발자용 인증을 해두거나 ADB 설치로 대응.

## 10. 비용·한도·개인정보
- 예상 호출: 4명 × 5회 ≈ 20회/일 + 재분석. Flash 계열 무료 한도 안. 한도는 AI Studio에서 확인(수시 변경)
- Gemini 무료 티어는 입력·출력이 Google 모델 개선에 쓰일 수 있다 — 사용자(지인)에게 고지
- Neon 무료: 프로젝트당 저장 0.5GB, 월 100 CU-시간, 5분 미사용 시 컴퓨트 정지(다음 요청 때 콜드 스타트). **저장 0.5GB를 넘으면 프로젝트가 정지**되므로 같은 프로젝트를 쓰는 다른 서비스와 용량을 같이 본다. 이 앱의 텍스트 데이터는 월 수 MB 수준이고, 가장 큰 건 `raw_response`
- Vercel Blob: Hobby 무료 한도 내. 축소 사진 장당 ~200KB × 하루 20장 ≈ 월 120MB. 한도를 넘으면 Blob 접근이 막히므로, 사진 보관 기간(예: N일 후 삭제) 정책은 미확정 값으로 둔다
- Neon Auth: 무료 플랜 MAU 한도가 커서 4명은 문제없음

## 11. PR 계획
| PR | 내용 |
| --- | --- |
| 0 | 모노레포 스캐폴드: pnpm 워크스페이스, apps/mobile(Expo), apps/api(Next.js), packages/domain·contracts, ESLint·Vitest·CI, 의존성 경계 테스트 |
| 1 | `meallog` 스키마 마이그레이션(5절, FK 제외) + 마이그레이션 적용 스크립트 + Neon 클라이언트 |
| 2 | 인증: 4절 선행 확인 결과 정리 → `user_id` 타입·FK 마이그레이션 추가 → OTP·검증·갱신 API, 허용 목록, Bearer 검증 헬퍼 / 앱 로그인 화면, SecureStore, fetch 래퍼 |
| 3 | 온보딩: `POST /api/onboarding`(트랜잭션, 409) / 앱 온보딩 화면, 프로필 없으면 진입 강제 |
| 4 | 분석 코어: LLM 출력 스키마, 프롬프트 v1, 정규화 순수 함수(합계·상한) + fixture 테스트, Gemini 클라이언트 |
| 5 | `POST /api/meals` + 재분석·상세·삭제: 끼니 태그, 사진 업로드, 멱등성(기존 결과 200), 실패 저장·재시도 |
| 6 | 앱 기록하기 화면: 끼니 태그, 카메라·앨범, 사진 축소, 결과 카드, [다시 분석] |
| 7 | 체중 기록 + 추세·목표 칼로리 순수 함수(v1) + 테스트, `/api/trend` |
| 8 | 앱 홈·추세 화면(차트는 `react-native-svg`로 직접 그림), 프로필 수정 |
| 9 | APK 빌드·서명·EAS Update(`expo-updates`) 설정, 설치 안내 |

## 12. 배포 후 확인 목록
- 지인 기기(삼성 등)에서 APK 설치(출처를 알 수 없는 앱 허용), 첫 실행 → 로그인 → 온보딩 → 홈
- 앱 재실행·기기 재부팅 후 로그인 유지, 재설치 후 같은 이메일로 기록 복구
- 카메라·앨범 권한 거부 후 재요청 흐름
- 느린 네트워크에서 [분석] 연타 → 중복 기록 없음(같은 결과 200)
- 무료 한도 초과(429) 시 앱 동작
- OTA 업데이트가 실제로 반영되는지
