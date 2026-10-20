# 식단 기록 앱 — 스펙 v0.6 (안드로이드 APK · Neon)

## 1. 목표와 전제
- 음식 사진(+이름) 또는 텍스트 나열("삶은 계란 3개, 더단백 프로틴음료 1개")을 보내면 칼로리·탄단지를 추정해 **옮겨 적는 과정 없이** 저장한다.
- 매일 체중을 기록하고, 목표 체중 기준으로 추세와 하루 목표 칼로리를 보여준다.
- 추정 오차(±20~30%)는 전제다. 목적은 추세 파악이므로 **일관성 > 절대 정확도**. 같은 입력은 같은 기준(같은 모델·프롬프트)으로 계산되어야 한다. 영양값 추정은 전부 AI에 맡긴다(사용자 고정값 사전 없음).
- 사용자 3~4명(전원 안드로이드), 사용자당 하루 3~5회. 무료 티어 안에서 운용.
- 배포: APK 파일 직접 설치. 스토어 등록 없음.
- 1차 범위 밖: 운동 기록(스키마만 확장 가능하게), 아이폰, 알림, 오프라인 저장 후 전송.

## 2. 화면 흐름
```
첫 실행 ─▶ 접속 코드 입력 ─▶ 프로필 없음? ─▶ 온보딩 ─▶ 홈
재실행  ─▶ (SecureStore 코드 유효) ──────────────────▶ 홈
```

### 2.1 접속 코드 입력
- 운영자에게 받은 접속 코드를 한 번 입력(붙여넣기 가능). 서버가 확인하면 코드를 SecureStore에 저장해서 이후엔 바로 홈으로.
- 코드가 폐기됐거나 틀리면(401) 저장된 코드를 지우고 이 화면으로 돌아온다.
- APK 파일은 쉽게 전달되므로 아무나 설치해서 쓰지 못하게 막는 장치이고, 휴대폰을 바꾸거나 앱을 다시 설치해도 같은 코드로 기록을 되찾는 수단이기도 하다.

### 2.2 온보딩 (프로필이 없을 때 한 번)
| 항목 | 입력 | 저장 | 검증 |
| --- | --- | --- | --- |
| 닉네임 | 텍스트 | `profiles.nickname` | 1~20자 |
| 성별 | 남/여 | `profiles.sex` | 필수 |
| 나이 | 숫자 | `profiles.birth_year` = 올해 − 나이 | 14~100 |
| 키 | cm | `profiles.height_cm` | 100.0~250.0 |
| 현재 몸무게 | kg | 첫 `weight_logs` 행 | 20.0~300.0 |
| 목표 몸무게 | kg | `profiles.target_weight_kg` | 20.0~300.0 |
| 운동 정도 | 1~5 중 선택 | `profiles.activity_level` | 1~5 |
| 목표 기간 | 몇 개월 안에 | `profiles.goal_months` | 1~24 |
- 운동 정도 보기(사용자가 스스로 고른다)
  1. 거의 안 움직임 — 앉아서 일하고 운동 안 함
  2. 가벼움 — 주 1~2회 가벼운 운동
  3. 보통 — 주 3~4회 운동
  4. 활발 — 주 5~6회 운동
  5. 매우 활발 — 매일 고강도 운동 또는 육체노동
- 나이는 해가 바뀌면 달라지므로 출생연도로 바꿔 저장한다(±1세 오차는 감수).
- 하루 목표 칼로리와 탄·단·지 목표는 온보딩 때 Gemini가 정한다(7.1). 순서: Gemini 호출 → 성공하면 프로필·첫 체중·목표 칼로리를 한 트랜잭션으로 저장. Gemini가 실패하면 아무것도 저장하지 않고 재시도 가능한 오류를 돌려준다. 이미 프로필이 있으면 409.
- 목표 기간은 목표 칼로리를 정하는 시점부터 센다.
- 온보딩 직후 결과 화면과 홈에 목표 칼로리와 탄·단·지 목표(g)가 바로 보여야 한다. 하한으로 조정됐다면(7.1) "기간 안에 도달하려면 하한보다 적게 먹어야 해서 하한으로 맞췄다"는 안내와 하한 기준 예상 도달 기간을 함께 보여준다.
- 프로필 수정 화면에서 같은 항목을 고칠 수 있다(몸무게는 제외 — 체중 기록으로 남김). 목표 칼로리에 영향을 주는 항목(성별·나이·키·목표 몸무게·운동 정도·목표 기간)을 바꾸면 그 시점의 최근 체중으로 목표 칼로리를 다시 정한다. 이때 목표 기간은 그 시점부터 다시 센다.

### 2.3 홈 (대시보드)
- 오늘 섭취 kcal / 목표 kcal, 탄·단·지 합계 / 탄·단·지 목표
- 오늘 끼니 목록(끼니 태그, 사진 썸네일, 음식명, kcal) → 탭하면 상세(결과·조언·[다시 분석]·지우기)
- 날짜를 앞뒤로 넘겨 지난 날을 볼 수 있다(체중 기록은 오늘 화면에서만)
- 분석 실패한 끼니도 목록에 [분석 실패 · 재시도] 표시로 보이되, 합계에선 빠진다
- 체중: 오늘 기록 여부, [체중 기록] 버튼
- 하단 큰 버튼: [기록하기]

### 2.4 기록하기
- 끼니 태그(필수): 아침 / 점심 / 저녁 / 야식 / 간식. 현재 시각으로 기본 선택해 두고(5~10시 아침, 10~15시 점심, 15~17시 간식, 17~21시 저녁, 그 외 야식) 사용자가 바꿀 수 있다
- 카메라·앨범 권한을 거부하면 안내를 보이고, 다시 물어볼 수 없게 거부됐으면 [설정에서 켜기]로 앱 설정을 연다
- 먹은 시각: 기본은 기록하는 순간. [바꾸기]로 날짜(오늘·어제·그제)와 시각(HH:mm)을 고를 수 있다(놓친 끼니를 나중에 적는 경우). 그 끼니의 날짜(`local_date`)는 먹은 시각으로 정한다. 끼니 태그를 직접 고르지 않았으면 바꾼 시각에 맞춰 태그도 다시 고른다. 이미 기록한 끼니의 시각은 아직 바꿀 수 없다
- [카메라] / [앨범] 버튼 + 텍스트 칸(선택). 사진 없이 텍스트만도 가능
- 사진은 한 끼에 최대 5장(앨범은 여러 장을 한 번에, 카메라는 한 장씩 추가). 상차림을 나눠 찍었거나 같은 음식을 가까이서 찍은 사진도 같이 올리고, 분석은 겹친 음식을 한 번만 센다(6.1). 첫 장이 대표 사진(홈 목록 썸네일)
- [분석] → 원본 저장 → 분석 → 결과 카드(음식별 추정치 + 합계 + 추정 근거 메모)
- 결과 카드를 먼저 보여주고, 이어서 **영양 조언**을 불러와 카드 아래에 붙인다(6.2). 조언을 못 불러오면 [조언 다시 받기]만 보이고 기록은 그대로 저장돼 있다.
- 결과가 틀리면 [다시 분석]에 한 줄 보정("밥 반 공기만 먹음")을 붙여 재분석한다. 숫자를 직접 고치는 화면은 두지 않는다. 재분석하면 조언도 새 분석 기준으로 다시 받는다.

### 2.5 추세
- 체중 그래프: 실측 점 + 추세선, 목표 체중 기준선
- 목표까지 남은 kg, 최근 14일 추세 기울기(kg/주), 이 속도 유지 시 도달 예상일
- 최근 7일 평균 섭취 vs 목표

## 3. 아키텍처
```
APK (Expo) ──HTTPS + Bearer──▶ apps/api (Next.js Route Handler, Vercel)
                                ├─ 접속 코드 검증 (kkilog.access_codes, 해시 비교)
                                ├─ Neon Postgres — 기존 프로젝트, `kkilog` 스키마 (user_id로 범위 제한)
                                ├─ Vercel Blob private store (사진)
                                └─ Gemini API (구조화 출력)
```
- DB 접근: `@neondatabase/serverless`(HTTP), ORM 없이 SQL. 여러 문장을 묶어야 하는 곳(온보딩)은 드라이버의 트랜잭션 API 사용.
- 마이그레이션: `apps/api/migrations/NNNN_*.sql` 순번 파일 + 적용 스크립트(`pnpm --filter @kkilog/api migrate`는 미적용 목록만 표시, `--apply`를 붙여야 적용). 파일마다 한 트랜잭션. 적용 이력은 `kkilog.schema_migrations`에 기록. 모든 객체 이름은 `kkilog.`으로 한정해서 쓴다(`tests/migrations.test.ts`가 검사).
- DB는 운영·preview·로컬 모두 하나(기존 Neon 프로젝트의 기본 브랜치)를 같이 쓴다. 개발 중 생긴 테스트 데이터는 운영자가 정리한다. 마이그레이션은 임시 Postgres(예: PGlite)에서 먼저 확인한 뒤 적용한다. CI는 DB에 접속하지 않는다.
- 디렉터리
  - `apps/mobile/app/` — expo-router 화면 (`access-code`, `onboarding`, `(main)/`)
  - `apps/mobile/src/api/` — fetch 래퍼(코드를 Bearer로 첨부, 401이면 저장된 코드 삭제 후 코드 입력 화면으로)
  - `apps/api/app/api/` — Route Handler
  - `apps/api/src/server/` — DB·Storage·Gemini 클라이언트, 인증 헬퍼 (`server-only`)
  - `apps/api/src/llm/` — LLM 출력 스키마(zod)·JSON Schema 변환·응답 파싱, 재시도 판단 (`server-only` 없음 — 유닛 테스트 대상)
  - `apps/api/src/server/{gemini,prompts,calorie-target,meal-analysis}.ts` — Gemini 호출, 프롬프트 로드, 분석 실행(`server-only`)
  - `apps/api/prompts/<용도>/v<번호>.md` — 프롬프트 원문(용도별·버전별 파일, 기존 파일 수정 금지 — `tests/prompts.test.ts`가 해시로 검사). 현재: `meal-analysis/v3.md`(v2에 한 끼 사진 여러 장 추가, v1은 반찬을 "반찬 3접시"처럼 묶어 써서 교체), `calorie-target/v2.md`(v1에 탄단지 비율 추가), `meal-advice/v1.md`
  - `apps/api/scripts/access-code.ts` — 접속 코드 발급·폐기·조회(운영자가 직접 실행)
  - `packages/domain/src/v1/` — 순수 함수 + `params.ts`
  - `packages/contracts/src/` — API zod 스키마
- 사진: 앱에서 `expo-image-manipulator`로 **긴 변 1024px JPEG(품질 0.7)로 축소 후** 업로드. 원본 해상도는 보관하지 않는다.
- 분석은 요청 안에서 동기로 처리한다. 원본을 먼저 저장하고 분석이 실패하면 `status='failed'`로 남겨 [재시도] 가능하게 한다(원본은 잃지 않는다). Route Handler의 `maxDuration`은 Vercel Hobby 한도 안에서 지정한다(PR 5에서 확인).
- 날짜 경계: `eaten_at`은 서버가 요청을 받은 시각, `local_date`는 서버에서 사용자 타임존(기본 `Asia/Seoul`)으로 계산. 지난 날짜로 기록하는 기능은 두지 않는다.
- 멱등성: 앱이 기록 요청마다 `client_request_id`(UUID)를 만들어 보내고, 재시도할 땐 같은 값을 쓴다. 이미 처리된 `client_request_id`면 새로 만들지 않고 **기존 리소스를 200으로 그대로 돌려준다**(응답 유실 후 재시도해도 결과를 받을 수 있게).

## 4. 인증 (운영자 발급 접속 코드)
- 외부 인증 서비스·메일 발송 없이, 운영자가 사용자마다 접속 코드를 발급해 직접 전달한다(카톡 등).
- 발급: `apps/api/scripts/access-code.ts`
  - `issue --label "친구A"` — 사용자가 없으면 만들고, 기존 유효 코드는 폐기한 뒤 새 코드를 발급해 **한 번만** 출력한다.
  - `revoke --label "친구A"` — 유효 코드 폐기(기록은 그대로 남는다). `list` — 사용자와 코드 상태 조회.
- 코드 형식: 랜덤 100비트를 Crockford Base32 20자로, 4자씩 하이픈으로 묶는다(예: `7HQ2-K9MD-X4RT-PB3N-W8ZF`). 입력할 때 하이픈·공백·대소문자는 무시한다.
- 코드가 곧 인증 토큰이다. 앱은 코드를 `expo-secure-store`에 저장하고 매 요청 `Authorization: Bearer <코드>`로 보낸다. 만료·갱신은 없고, 유출·분실 시 운영자가 폐기하고 재발급한다.
- DB엔 코드 원문을 저장하지 않고 SHA-256 해시만 저장한다(코드 자체가 고엔트로피라 느린 해시는 불필요).
- 서버는 모든 요청에서 Bearer 코드를 해시해 유효(폐기되지 않은) 코드를 찾고 `user_id`를 얻는다. 없거나 폐기된 코드는 401. 프로필이 필요한 API는 프로필이 없으면 `409 ONBOARDING_REQUIRED`.
- 재설치·기기 변경: 같은 코드를 다시 입력하면 기록을 그대로 쓴다. 코드를 잃어버렸으면 재발급(같은 사용자에 새 코드).

## 5. 데이터 모델
원본: `users`, `access_codes`, `profiles`, `meal_entries`, `meal_photos`, `weight_logs` / 캐시: `meal_analyses`, `meal_advice` / 이력: `calorie_targets`
- 모든 테이블은 `kkilog` 스키마. 기존 서비스의 스키마와 완전히 분리해 운영한다(서로 참조하지 않음, 같은 Neon 프로젝트의 저장 한도만 공유).
- 아래는 최종 형태다. 0001(적용됨)에 있던 `allowed_emails` 삭제, `users`·`access_codes` 추가, `profiles.user_id` FK는 0002(적용됨)에서, `calorie_targets`의 탄단지 목표 컬럼은 0003, `meal_advice`는 0004, `meal_photos`는 0005에서 반영한다.

```sql
create schema if not exists kkilog;
set search_path to kkilog;

create table users (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,             -- 운영자가 알아보는 이름(예: 친구A). 앱엔 노출하지 않음
  created_at timestamptz not null default now()
);

create table access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  code_hash bytea not null unique,        -- sha256(정규화한 코드). 원문은 저장하지 않음
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index on access_codes (user_id) where revoked_at is null;  -- 사용자당 유효 코드 1개

create table profiles (
  user_id uuid primary key references users (id),
  nickname text not null check (char_length(nickname) between 1 and 20),
  sex text not null check (sex in ('male','female')),
  birth_year int not null check (birth_year between 1900 and 2100),  -- 나이 14~100은 API에서 검증
  height_cm numeric(4,1) not null check (height_cm between 100 and 250),
  target_weight_kg numeric(4,1) not null check (target_weight_kg between 20 and 300),
  activity_level smallint not null check (activity_level between 1 and 5),
  goal_months smallint not null check (goal_months between 1 and 24),
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
  photo_path text,                        -- 대표(첫) 사진 Blob pathname (URL 아님). 사진 목록은 meal_photos가 기준(0005)
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (input_text is not null or photo_path is not null),
  unique (user_id, client_request_id)
);
create index on meal_entries (user_id, local_date);

create table meal_photos (                -- 원본. 한 끼 사진 최대 5장(0005)
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references meal_entries on delete cascade,
  position smallint not null check (position between 0 and 4),  -- 0이 대표 사진(= meal_entries.photo_path)
  path text not null unique,              -- Blob pathname
  created_at timestamptz not null default now(),
  unique (entry_id, position)
);

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
  created_at timestamptz not null default now(),
  -- ok면 합산에 쓰는 값이 전부 있어야 하고(items는 JSON 배열), failed면 원인이 있어야 한다.
  -- CHECK는 결과가 NULL이면 통과하므로 jsonb_typeof 앞에 items is not null을 둔다.
  constraint meal_analyses_status_fields_chk check (
    (status = 'ok' and items is not null and jsonb_typeof(items) = 'array' and kcal is not null and carb_g is not null
      and protein_g is not null and fat_g is not null and error is null)
    or (status = 'failed' and error is not null)
  )
);
create index on meal_analyses (entry_id, created_at desc);

create table calorie_targets (            -- 목표 칼로리 이력. 덮어쓰지 않고 누적
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  kcal int not null,                      -- 최종값. 하한 미만이면 하한으로 맞춘 값
  llm_kcal int not null,                  -- Gemini가 준 원래 값
  maintenance_kcal int not null,          -- Gemini가 추정한 유지 칼로리
  clamped boolean not null,               -- 하한으로 맞췄는지
  -- 탄단지 목표(calorie-target/v2부터). v1 행은 전부 null. 비율은 Gemini, 그램은 서버가 최종 kcal로 계산
  carb_pct smallint, protein_pct smallint, fat_pct smallint,   -- 합 100
  carb_g numeric(5,1), protein_g numeric(5,1), fat_g numeric(5,1),
  reason text,                            -- Gemini가 준 근거 한두 줄
  inputs jsonb not null,                  -- 계산에 쓴 성별·나이·키·체중·목표 체중·운동 정도·목표 기간
  model_id text not null,
  prompt_version text not null,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  check ((carb_pct is null) = (protein_pct is null) and (carb_pct is null) = (fat_pct is null)
     and (carb_pct is null) = (carb_g is null) and (carb_pct is null) = (protein_g is null)
     and (carb_pct is null) = (fat_g is null)),
  check (carb_pct is null or carb_pct + protein_pct + fat_pct = 100)
);
create index on calorie_targets (user_id, created_at desc);

create table meal_advice (                -- 캐시. 분석 1건당 조언 1건(재분석하면 새 분석에 새 조언)
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references meal_analyses on delete cascade,
  advice text not null,
  inputs jsonb not null,                  -- 조언에 쓴 오늘 기록·목표 스냅샷
  model_id text not null,
  prompt_version text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
```
- 기록 테이블은 `profiles`를 참조한다 → 온보딩 전에는 기록이 생길 수 없다.
- 끼니 사진은 `meal_photos`(0005, `entry_id`·`position` 0~4·`path`)에 순서대로 둔다. 경로는 `meals/{user_id}/{entry_id}-{position}.jpg`(0005 전 사진은 `meals/{user_id}/{entry_id}.jpg`로 남아 있고 0번으로 옮겨 둠). `meal_entries.photo_path`는 대표 사진으로 같이 저장한다(기존 CHECK와 예전 앱 호환). DB엔 pathname만 저장하고, 응답할 때마다 서명 URL을 새로 만든다. 서명 URL은 그 사진 하나만 읽을 수 있고 10분 뒤 만료된다(`issueSignedToken` + `presignUrl`).
- 끼니의 현재값 = 해당 entry의 가장 최근 `status='ok'` 분석. `ok` 분석이 없는 끼니는 합계에서 뺀다.
- 체중 기록 삭제·수정 API는 두지 않는다. 오입력은 운영자가 DB에서 직접 정리한다.
- `users`·`access_codes`는 `scripts/access-code.ts`로만 관리한다.
- 하루 체중값 = 그날 가장 마지막 기록. 목표 칼로리 계산엔 가장 최근 체중을 쓴다.
- 나이 = 기준일 연도 − `birth_year` (계산은 `packages/domain`).
- 현재 목표 칼로리 = 해당 사용자의 가장 최근 `calorie_targets` 행. 7일 평균 비교처럼 과거 날짜를 볼 땐 그날 기준으로 유효했던 행을 쓴다.
- 운동 기록은 2차에 `activity_entries`(원본) + 분석 캐시 구조로 같은 패턴 추가.

## 6. 분석 파이프라인
끼니마다 Gemini를 **두 번** 부른다: 6.1 분석(숫자 확정) → 6.2 조언(문장). 분석 호출에는 이번 끼니 입력만 넣는다. 오늘의 다른 끼니·목표 같은 맥락이 들어가면 같은 사진에도 추정치가 달라질 수 있어서(일관성 원칙), 맥락은 조언 호출에만 준다.

### 6.1 끼니 분석
1. 입력: 사진(0~5장, 모두 같은 한 끼) + `photo_count` + `input_text`(선택) + `correction_text`(재분석 시). 다른 끼니·목표·프로필은 넣지 않는다
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
4. 응답 검증(`apps/api/src/llm/`, zod) — 실패 → `status='failed'`, `error='INVALID_OUTPUT'`
5. 서버 정규화(`packages/domain`, 순수 함수 — 검증된 값만 받는다)
   - 합계는 item 합으로 서버가 계산 (LLM 합계 안 받음)
   - kcal은 정수, 탄단지는 소수 첫째 자리로 반올림. 합계는 반올림한 항목 값의 합
   - 음수·NaN·상한(항목 수, 항목 kcal·탄단지, 끼니 합계 — `params.ts`) 초과가 하나라도 있으면 분석 전체를 `failed`(error에 사유)로 저장. 부분 저장 안 함
   - 음식이 아니면 `items: []`, 합계 0으로 `ok` 저장
6. `meal_analyses`에 `model_id`, `prompt_version` 채워서 저장
- Gemini 호출 실패: 5xx·타임아웃(18초)은 바로, 429는 응답의 `retryDelay`만큼(최대 20초) 기다렸다가 1회 재시도한다. 그래도 실패하면 끼니 분석은 `failed` 저장 후 앱에 [재시도], 목표 칼로리는 저장 없이 `503 UPSTREAM_UNAVAILABLE`
- 프롬프트·모델을 바꿔도 과거 기록은 소급 재분석하지 않는다. 새 `prompt_version`·`model_id`는 바뀐 뒤의 분석(신규 기록·[다시 분석])부터 적용되고, 과거 분석은 당시 버전 그대로 남는다.

### 6.2 영양 조언
- 언제: 분석이 `ok`로 저장된 뒤, 앱이 `POST /api/meals/:id/advice`를 부르면 그 끼니의 **현재 분석** 기준으로 만든다. 이미 그 분석의 조언이 있으면 Gemini를 다시 부르지 않고 저장된 것을 돌려준다. 재분석으로 현재 분석이 바뀌면 새 조언을 만든다.
- 입력(서버가 DB에서 모은다. 앱이 보낸 값은 쓰지 않음)
  - 이번 끼니: 끼니 태그, 먹은 시각, 음식별 추정치와 합계(서버 계산값)
  - 오늘(같은 `local_date`) 이 끼니 전에 먹은 끼니들: 태그·합계
  - 오늘 합계(이번 끼니 포함)와 하루 목표(kcal·탄·단·지), 목표까지 남은 양(목표 − 오늘 합계, 넘으면 음수)
  - 합계·남은 양은 서버가 `packages/domain`으로 계산해 넣는다(모델에게 계산시키지 않음). 하루 목표는 조언을 만들 때의 현재 목표(가장 최근 `calorie_targets` 행)
  - 조언에 쓴 입력은 `meal_advice.inputs`에 그대로 남긴다
- Gemini 구조화 출력, temperature 0. 프롬프트는 `apps/api/prompts/meal-advice/v*.md`
- LLM 출력 스키마: `{ "advice": "점심에 부족했던 단백질을 이번 끼니로 채웠어요. 남은 하루는 …" }`
- 규칙: 한국어 1~3문장, 200자 이내. 오늘 목표 대비 부족·초과를 근거로 다음 끼니에 할 수 있는 구체적인 제안. 의학적 진단·처방은 하지 않는다.
- 실패해도 분석·기록엔 영향 없다. 저장하지 않고 `503 UPSTREAM_UNAVAILABLE` → 앱은 [조언 다시 받기].
- 탄단지 목표가 없는 사용자(calorie-target/v1로 온보딩)는 칼로리 목표만 넣는다.
- 장기 맥락(meal-advice/v2): 오늘 하루만 보면 조언이 매번 새로 시작하는 느낌이라, 서버가 계산한 최근 기록 요약을 입력에 더한다. Gemini는 호출마다 독립적이므로 "기억"이 아니라 서버가 DB에서 매번 모아 넣는 방식이다.
  - `recent_days`: 이 끼니 날짜의 전날까지 최근 7일 중 끼니를 기록한 날만으로 낸 하루 평균 섭취, 그 날들의 평균 목표 kcal과 차이, 목표 kcal × 1.1을 넘은 날 수, 단백질이 목표 × 0.8보다 적은 날 수, 야식 먹은 날 수(비율은 임시값, `params.ts`)
  - `weight`: 추세 체중·목표까지 남은 kg·기울기·도달 상태·예상일(7.2와 같은 계산, 끼니 날짜 기준)
  - `recent_highlight`: 조언에 덧붙일 흐름 **하나**를 서버가 고른다(모델에게 고르게 하면 매번 우선순위를 지키지 않았다). 순서: 오늘도 단백질 부족 + 최근 3일 이상 반복 → 이번이 야식 + 최근 야식 3일 이상 → 오늘 목표 초과 + 최근 초과 3일 이상 → 체중 정체 + 최근 평균이 목표보다 많음 → 순항 격려 → 없음. 반복 패턴은 기록한 날이 3일 이상일 때만(3일은 임시값)
  - 숫자·패턴은 전부 서버가 `packages/domain`으로 계산한다. Gemini가 기록을 요약해 저장하는 메모 방식은 쓰지 않는다(요약이 틀리면 계속 따라다님 — 기록이 쌓인 뒤 7.2 적응형 목표와 함께 다시 검토)
  - 끼니 분석 호출엔 여전히 맥락을 넣지 않는다
  - 장기 기록이 Gemini 무료 티어로 더 많이 가므로 사용자에게 알린다

## 7. 목표 칼로리와 체중 추세
### 7.1 목표 칼로리·탄단지 목표 (Gemini가 정하고 저장)
- 정하는 시점: 온보딩, 그리고 프로필 수정에서 관련 항목이 바뀌었을 때. 매일 다시 계산하지 않는다(체중 기록만으로는 바뀌지 않음).
- 입력: 성별, 나이, 키, 최근 체중, 목표 체중, 운동 정도(1~5), 목표 기간(개월)
- Gemini 구조화 출력, temperature 0. 프롬프트는 `apps/api/prompts/calorie-target/v*.md`(끼니 분석과 별도 버전 관리)
- LLM 출력 스키마(v2 — 탄단지 비율 추가. v1은 앞의 세 필드만)
  ```json
  { "maintenance_kcal": 2400, "kcal": 1850,
    "carb_pct": 45, "protein_pct": 30, "fat_pct": 25,
    "reason": "유지 칼로리 약 2,400 − (10kg × 7,700 ÷ 140일) ≈ 1,850. 감량 중 근손실을 줄이려고 단백질 비율을 높임" }
  ```
- 탄단지 목표: Gemini는 하루 칼로리 중 **비율(%, 정수, 합 100)**만 정한다. 그램은 서버가 **최종 kcal**(하한 보정 후)로 계산한다 — 탄수화물·단백질 `kcal × pct ÷ 100 ÷ 4`, 지방 `÷ 9`, 소수 첫째 자리. 하한으로 맞춘 경우에도 비율은 그대로 쓰고 그램만 1,200kcal 기준이 된다.
- 비율 검증: 각각 정수 5~80, 합 100. 어기면 응답 이상으로 보고 실패(저장 안 함, 재시도 가능)
- 기준: 목표 기간 안에 목표 체중에 도달하는 하루 섭취량. 유지 칼로리(BMR 공식·활동계수)는 Gemini가 판단하고, 적자·잉여는 체중 차이와 목표 기간으로 정한다(지방 1kg ≈ 7,700kcal). 증량 목표(목표 > 현재)도 같은 방식.
- 서버 처리(`packages/domain`, 순수 함수): zod 검증 후
  - `kcal` < 하한 1,200 → **하한 1,200으로 맞춰 저장**하고 `clamped = true`. 예상 도달 기간은 서버가 `체중 차이 × 7,700 ÷ (maintenance_kcal − 1,200)`로 다시 계산해 응답에 넣는다(`maintenance_kcal`이 하한 이하라 감량이 안 되는 경우엔 기간 없음).
  - `kcal` > 상한 4,000 → Gemini 응답 이상으로 보고 실패 처리(저장 안 함, 재시도 가능)
  - 하한·상한은 `params.ts`
- 저장값은 `calorie_targets`에 `model_id`·`prompt_version`·입력값과 함께 남긴다. 프롬프트가 바뀌어도 기존 목표는 소급하지 않는다.

### 7.2 체중 추세
- 추세: 일별 체중의 지수이동평균(`packages/domain`). 평활 계수 α = 0.1(`params.ts`, 써 보면서 조정)
  - 하루 체중값 = 그날 마지막 기록. 첫 추세값 = 첫 체중. 기록이 있는 날만 `trend += α × (체중 − trend)`, 기록이 없는 날은 전날 추세를 그대로 잇는다. 기록한 날은 직전 기록과의 간격 n일에 대해 α_eff = 1 − (1 − α)^n으로 갱신한다(매일 기록하면 α 그대로)
  - 기울기(kg/주) = 최근 14일 추세 변화 × 7 ÷ 14. 기록 기간이 14일보다 짧으면 있는 만큼으로, 7일보다 짧으면 없음(임시값)
  - 목표까지 남은 kg = 오늘 추세 − 목표 체중. 감량·증량 방향은 첫 체중과 목표로 정한다. 목표 쪽으로 가고 있으면 도달 예상일 = 오늘 + 남은 kg ÷ 하루 변화량(730일 넘으면 없음, 임시값)
  - 7일 평균 섭취 = 오늘을 뺀 최근 7일 중 끼니를 기록한 날의 하루 합계 평균(기록 없는 날은 0kcal로 보지 않고 뺀다). 비교 목표는 그 날들에 유효했던 목표 kcal의 평균
- 2차 후보: 섭취 기록 + 추세 변화로 실제 소비량을 역산하는 적응형 목표 (데이터 3주 이상 쌓인 뒤)

## 8. API (초안 — 형태 확정 시 `packages/contracts`로 고정)
- 오류 응답은 `{ "error": { "code": ... } }` 하나로 통일한다(`packages/contracts`의 `ErrorResponseSchema`). 코드: `UNAUTHORIZED`(401), `ONBOARDING_REQUIRED`(409), `PROFILE_EXISTS`(409), `ANALYSIS_REQUIRED`(409, 조언을 받을 ok 분석이 없음), `NOT_FOUND`(404), `INVALID_REQUEST`(400), `UPSTREAM_UNAVAILABLE`(503, Gemini 실패 — 잠시 후 재시도). 개인 데이터·오류 응답 모두 `Cache-Control: private, no-store`.

| Method | Path | 설명 |
| --- | --- | --- |
| GET | /api/health | 배포 확인용 `{ ok: true }` (인증 없음, 개인 데이터 없음) |
| GET | /api/me | Bearer 코드 확인 → `has_profile`. 없거나 폐기된 코드면 401 |
| POST | /api/onboarding | 프로필(운동 정도·목표 기간 포함) + 첫 체중 → Gemini 목표 칼로리·탄단지 비율(하한 보정, 그램은 서버 계산) → 한 트랜잭션 저장. 응답에 목표 칼로리·탄단지 목표(g)·하한 보정 여부·예상 도달 기간. 이미 있으면 `409 PROFILE_EXISTS`(Gemini 호출 전에 확인), Gemini 실패·응답 이상·상한 초과면 `503 UPSTREAM_UNAVAILABLE` |
| GET/PATCH | /api/profile | 조회 → `{ profile(나이는 오늘 기준, 최근 체중 포함), calorie_target(현재 목표) }`. 수정은 바꾼 항목만(몸무게 제외) → `{ profile, new_calorie_target }`. 목표 칼로리 관련 항목이 실제로 바뀌면 최근 체중으로 Gemini가 목표를 다시 정하고(목표 기간은 지금부터) 프로필과 한 트랜잭션으로 저장, 아니면 `new_calorie_target: null`. Gemini 실패면 `503`(아무것도 저장 안 함) |
| GET | /api/home?date= | 해당일(없으면 오늘) 섭취 합계·목표(그날 유효했던 행)·끼니 목록(먹은 시각 순, 각 끼니는 `GET /api/meals/:id`와 같은 형태)·체중(그날 기록 여부, 그날까지 최근 실측) |
| POST | /api/meals | multipart: `meal_type`, `client_request_id`(UUID), `text?`(500자), `eaten_at?`(ISO 8601 먹은 시각, 없으면 지금. 미래·7일보다 오래 전은 400 — 7일은 임시값), `photo?`(image/jpeg, 같은 이름으로 최대 5번, 장당 3MB·합계 4MB 이하, 보낸 순서가 사진 순서) — 사진과 텍스트 중 하나는 필수. 프로필 없으면 `409 ONBOARDING_REQUIRED`. 사진 업로드 → 원본 저장 → 분석 → `{ meal, attempt }`. 분석이 실패해도 200(`attempt.status = failed`, 실패 행 저장). 같은 `client_request_id`면 새로 만들지 않고 기존 끼니를 200(`attempt: null`) |
| GET | /api/meals/:id | `{ meal }` — 현재 분석(가장 최근 ok, 없으면 가장 최근 실패, 분석 전이면 null) + 사진 서명 URL(`photo_urls` 순서대로, `photo_url`은 첫 장 — 예전 앱 호환) |
| POST | /api/meals/:id/analyze | 재시도·재분석. JSON `{ correction_text? }`(200자). 없으면 마지막 분석의 보정을 그대로 쓴다. 새 분석 행을 쌓고 `{ meal, attempt }` — 재분석이 실패해도 `meal.analysis`는 이전 ok 분석 유지 |
| POST | /api/meals/:id/advice | 현재 분석 기준 영양 조언. 있으면 저장된 것, 없으면 생성(6.2) → `{ advice: { text, analysis_created_at, created_at } }`. 현재 ok 분석이 없으면 `409 ANALYSIS_REQUIRED`, Gemini 실패·응답 이상이면 `503 UPSTREAM_UNAVAILABLE`(저장 안 함) |
| DELETE | /api/meals/:id | soft delete → 204. 지운 끼니는 없는 것으로 본다(이후 조회·재분석·삭제 404). 사진은 보관 기간 정책이 정해질 때까지 남긴다 |
| POST | /api/weights | `{ weight_kg, client_request_id }` → `{ weight }`. 오늘(프로필 타임존) 날짜로 쌓는다. 중복이면 기존 기록 200. 프로필 없으면 `409 ONBOARDING_REQUIRED` |
| GET | /api/trend?days= | 체중 실측 + 추세 + 목표 도달 예상 + 7일 평균 섭취(7.2). `days`는 그래프 기간 7~365, 기본 30. 추세는 전체 기록으로 계산하고 그 기간만 잘라 보낸다 |

## 9. 빌드·배포
- API: Vercel 프로젝트(운영자의 기존 Vercel 계정에 별도 프로젝트, Root Directory `apps/api`). 운영 주소 `https://api-rouge-kappa-59.vercel.app`
  - `main` → 운영(Production), `dev`·feature 브랜치 → preview
  - 릴리스: `dev` → `main` PR을 merge하면 운영에 배포된다. `main`엔 이 PR 말고는 들어가지 않는다
  - preview 배포는 Vercel 배포 보호(로그인 필요)가 걸려 앱에서 직접 부를 수 없다. 앱 개발은 로컬 api 서버(`next dev`)나 운영 주소로 한다
  - 환경변수(`DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `BLOB_READ_WRITE_TOKEN`)는 Vercel 프로젝트 설정에 둔다. DB·Blob이 하나라 Production·Preview 값이 같다
- DB: 운영·preview·로컬 모두 기존 Neon 프로젝트의 기본 브랜치 하나. 같은 `DATABASE_URL`을 쓴다
- Vercel Blob: private store 하나를 운영·preview·로컬이 같이 쓴다(DB와 같은 이유). Hobby 플랜에서 private 업로드·서명 URL(`issueSignedToken` + `presignUrl`, `@vercel/blob` 2.8) 동작 확인함(2026-10-20): 서명 없는 URL·경로 바꾼 URL·만료된 URL은 403
- APK: EAS Build(무료 플랜 월 빌드 횟수 제한), `apps/mobile/eas.json`의 `production` 프로필(APK, 채널 `production`, EAS 환경변수 `production`의 `EXPO_PUBLIC_API_BASE_URL`). 앱 ID `dev.kkilog.app`. 서명 키는 EAS가 보관하고 운영자가 저장소 밖에 백업한다(저장소에 넣지 않음). 절차는 `docs/release.md`, 지인용 설치 안내는 `docs/install.md`
- JS만 바뀐 수정은 EAS Update(OTA, 채널 `production`, `--environment production` — 빌드와 같은 EAS 환경변수를 쓴다)로 배포해 재설치 없이 반영. 앱은 시작할 때 확인해 다음 실행부터 적용한다. 네이티브(모듈·권한·`app.json` 네이티브 설정)가 바뀌면 `version`·`versionCode`를 올려 APK 재배포(`runtimeVersion`이 `version`을 따라 예전 APK엔 새 OTA가 가지 않음)
- Expo 계정은 운영자만 필요하다. 사용자는 APK 설치와 접속 코드만 있으면 된다
- 사이드로딩 제약: 구글 개발자 인증 요구가 2027년 전 세계로 확대 예정. 그 전에 취미 개발자용 인증을 해두거나 ADB 설치로 대응.

## 10. 비용·한도·개인정보
- 모델: `gemini-3.5-flash-lite`(목표 칼로리·끼니 분석·조언 모두 같은 `GEMINI_MODEL`). 2026-10 기준 무료 티어 **분당 15회, 하루 500회**(AI Studio 표시값 — 수시 변경). 사진 분석 2~3초
- 예상 호출: 끼니당 2회(분석 + 조언) × 4명 × 5끼 ≈ 40회/일 + 재분석·재조언. 하루 한도 안. 동시에 여러 명이 기록해 429가 나면 retryDelay 대기 후 1회 재시도로 흡수한다
- (참고) `gemini-3.8-flash`는 무료 분당 5회·하루 20회이고 사진 분석에 70초가 걸려 쓰지 않는다
- Gemini 무료 티어는 입력·출력이 Google 모델 개선에 쓰일 수 있다 — 사용자(지인)에게 고지
- Neon 무료: 프로젝트당 저장 0.5GB, 월 100 CU-시간, 5분 미사용 시 컴퓨트 정지(다음 요청 때 콜드 스타트). **저장 0.5GB를 넘으면 프로젝트가 정지**되므로 같은 프로젝트를 쓰는 다른 서비스와 용량을 같이 본다. 이 앱의 텍스트 데이터는 월 수 MB 수준이고, 가장 큰 건 `raw_response`
- Vercel Blob: Hobby 무료 한도 내. 축소 사진 장당 ~200KB × 하루 20장 ≈ 월 120MB. 한도를 넘으면 Blob 접근이 막히므로, 사진 보관 기간(예: N일 후 삭제) 정책은 미확정 값으로 둔다

## 11. PR 계획
| PR | 내용 |
| --- | --- |
| 0 | 모노레포 스캐폴드: pnpm 워크스페이스, apps/mobile(Expo), apps/api(Next.js), packages/domain·contracts, ESLint·Vitest·CI, 의존성 경계 테스트 |
| 1 | `kkilog` 스키마 마이그레이션(5절, FK 제외) + 마이그레이션 적용 스크립트 + Neon 클라이언트 |
| 2 | 인증: 0002 마이그레이션(`allowed_emails` 삭제, `users`·`access_codes`, `profiles` FK), `scripts/access-code.ts`, Bearer 코드 검증 헬퍼, `GET /api/me` / 앱 코드 입력 화면, SecureStore, fetch 래퍼 |
| 3 | 온보딩: Gemini 클라이언트, 목표 칼로리 프롬프트 v1·출력 스키마·범위 검증 + fixture 테스트, `POST /api/onboarding`(Gemini → 트랜잭션, 409) / 앱 온보딩 화면(운동 정도 1~5), 프로필 없으면 진입 강제 |
| 4 | 분석 코어: 끼니 분석 LLM 출력 스키마, 프롬프트 v1, 정규화 순수 함수(합계·상한) + fixture 테스트 |
| 5 | `POST /api/meals` + 재분석·상세·삭제: 끼니 태그, 사진 업로드, 멱등성(기존 결과 200), 실패 저장·재시도 |
| 6 | 앱 기록하기 화면: 끼니 태그, 카메라·앨범, 사진 축소, 결과 카드, [다시 분석] |
| 7 | 탄단지 목표: 목표 칼로리 프롬프트 v2(탄단지 비율)·출력 스키마, 그램 계산 순수 함수, 0003 마이그레이션(`calorie_targets` 탄단지 컬럼), 온보딩 응답·결과 화면에 탄단지 목표 |
| 8 | 영양 조언: 0004 마이그레이션(`meal_advice`), 조언 프롬프트 v1·출력 스키마 + fixture 테스트, `POST /api/meals/:id/advice` / 결과 카드 아래 조언·[조언 다시 받기] |
| 9 | 체중 기록 + 추세 순수 함수(v1) + 테스트, `/api/trend` |
| 10 | 앱 홈·추세 화면(차트는 `react-native-svg`로 직접 그림), 프로필 수정(목표 칼로리 재계산 포함) |
| 11 | 조언 장기 맥락: 최근 기록 요약 순수 함수(7일 평균·목표 대비·반복 패턴) + 테스트, 조언 프롬프트 v2·입력 확장(6.2) |
| 12 | APK 빌드·서명·EAS Update(`expo-updates`) 설정, 설치 안내 |
| 13 | 한 끼 사진 최대 5장: 0005 마이그레이션(`meal_photos`), 끼니 분석 프롬프트 v3(겹친 음식은 한 번만), 업로드·응답 형태(`photo_urls`) / 앱 여러 장 선택·썸네일·넘겨 보기 |

## 12. 배포 후 확인 목록
- 지인 기기(삼성 등)에서 APK 설치(출처를 알 수 없는 앱 허용), 첫 실행 → 접속 코드 입력 → 온보딩 → 홈
- 앱 재실행·기기 재부팅 후 코드 유지, 재설치 후 같은 코드로 기록 복구, 폐기한 코드로는 401 → 코드 입력 화면
- 카메라·앨범 권한 거부 후 재요청 흐름
- 느린 네트워크에서 [분석] 연타 → 중복 기록 없음(같은 결과 200)
- 무료 한도 초과(429) 시 앱 동작
- OTA 업데이트가 실제로 반영되는지
