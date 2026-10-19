// 미확정 파라미터(산식 계수, 평활 계수, 상한값 등)는 전부 이 파일에 모은다.
// 임시값을 쓸 때는 해당 줄에 `// TODO: 확정 필요 — 임시값`을 붙인다.

// 목표 칼로리 허용 범위(spec 7.1). 하한 미만은 하한으로 맞추고, 상한 초과는 실패로 본다.
export const CALORIE_TARGET_MIN_KCAL = 1200;
export const CALORIE_TARGET_MAX_KCAL = 4000;

// 체지방 1kg ≈ 7,700kcal (spec 7.1)
export const KCAL_PER_KG = 7700;
