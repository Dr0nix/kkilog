-- 영양 조언(spec 6.2). 캐시: 분석 1건당 조언 1건. 재분석하면 새 분석에 새 조언이 붙는다.
-- 실패한 조언은 저장하지 않는다(앱이 [조언 다시 받기]로 다시 요청).

create table kkilog.meal_advice (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references kkilog.meal_analyses (id) on delete cascade,
  advice text not null,
  inputs jsonb not null, -- 조언에 쓴 오늘 기록·목표 스냅샷
  model_id text not null,
  prompt_version text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
