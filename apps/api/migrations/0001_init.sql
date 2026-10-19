-- spec 5절 초안. user_id는 Neon Auth 사용자 id이며, 타입·FK는 PR 2 확인 후 별도 마이그레이션으로 확정한다.
-- 모든 객체는 meallog 스키마로 한정해서 쓴다(search_path에 의존하지 않음).

create table meallog.allowed_emails (
  email text primary key check (email = lower(email))
);

create table meallog.profiles (
  user_id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 20),
  sex text not null check (sex in ('male', 'female')),
  birth_year int not null check (birth_year between 1900 and 2100), -- 나이 14~100은 API에서 검증
  height_cm numeric(4, 1) not null check (height_cm between 100 and 250),
  target_weight_kg numeric(4, 1) not null check (target_weight_kg between 20 and 300),
  activity_level smallint not null check (activity_level between 1 and 5),
  goal_months smallint not null check (goal_months between 1 and 24),
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 덮어쓰지 않고 누적
create table meallog.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references meallog.profiles (user_id),
  client_request_id uuid not null,
  local_date date not null,
  weight_kg numeric(4, 1) not null check (weight_kg between 20 and 300),
  source text not null check (source in ('onboarding', 'daily')),
  measured_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index weight_logs_user_date_idx on meallog.weight_logs (user_id, local_date);

-- 원본
create table meallog.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references meallog.profiles (user_id),
  client_request_id uuid not null,
  local_date date not null,
  eaten_at timestamptz not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'late_night', 'snack')),
  input_text text,
  photo_path text, -- Blob pathname (URL 아님)
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (input_text is not null or photo_path is not null),
  unique (user_id, client_request_id)
);
create index meal_entries_user_date_idx on meallog.meal_entries (user_id, local_date);

-- 캐시. 재분석 시 행 추가
create table meallog.meal_analyses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references meallog.meal_entries (id) on delete cascade,
  status text not null check (status in ('ok', 'failed')),
  model_id text not null,
  prompt_version text not null,
  correction_text text,
  items jsonb,
  kcal int,
  carb_g numeric(6, 1),
  protein_g numeric(6, 1),
  fat_g numeric(6, 1),
  notes text,
  raw_response jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index meal_analyses_entry_created_idx on meallog.meal_analyses (entry_id, created_at desc);

-- 목표 칼로리 이력. 덮어쓰지 않고 누적
create table meallog.calorie_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references meallog.profiles (user_id),
  kcal int not null, -- 최종값. 하한 미만이면 하한으로 맞춘 값
  llm_kcal int not null, -- Gemini가 준 원래 값
  maintenance_kcal int not null, -- Gemini가 추정한 유지 칼로리
  clamped boolean not null, -- 하한으로 맞췄는지
  reason text,
  inputs jsonb not null, -- 계산에 쓴 성별·나이·키·체중·목표 체중·운동 정도·목표 기간
  model_id text not null,
  prompt_version text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index calorie_targets_user_created_idx on meallog.calorie_targets (user_id, created_at desc);
