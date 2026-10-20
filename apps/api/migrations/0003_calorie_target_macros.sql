-- 탄단지 목표(spec 7.1, calorie-target/v2부터). 비율은 Gemini가 정하고, 그램은 서버가 최종 kcal로 계산한다.
-- v1로 만든 기존 행은 전부 null로 둔다(소급 계산하지 않음).

alter table kkilog.calorie_targets
  add column carb_pct smallint,
  add column protein_pct smallint,
  add column fat_pct smallint,
  add column carb_g numeric(5,1),
  add column protein_g numeric(5,1),
  add column fat_g numeric(5,1),
  -- 여섯 칸은 전부 있거나 전부 없다
  add constraint calorie_targets_macros_all_or_none_chk check (
    (carb_pct is null) = (protein_pct is null) and (carb_pct is null) = (fat_pct is null)
    and (carb_pct is null) = (carb_g is null) and (carb_pct is null) = (protein_g is null)
    and (carb_pct is null) = (fat_g is null)
  ),
  add constraint calorie_targets_macro_pct_sum_chk check (carb_pct is null or carb_pct + protein_pct + fat_pct = 100);
