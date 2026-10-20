// 미확정 파라미터(산식 계수, 평활 계수, 상한값 등)는 전부 이 파일에 모은다.
// 임시값을 쓸 때는 해당 줄에 `// TODO: 확정 필요 — 임시값`을 붙인다.

// 목표 칼로리 허용 범위(spec 7.1). 하한 미만은 하한으로 맞추고, 상한 초과는 실패로 본다.
export const CALORIE_TARGET_MIN_KCAL = 1200;
export const CALORIE_TARGET_MAX_KCAL = 4000;

// 체지방 1kg ≈ 7,700kcal (spec 7.1)
export const KCAL_PER_KG = 7700;

// 끼니 분석 정규화 상한(spec 6). 넘으면 비정상 응답으로 보고 분석을 failed로 저장한다.
export const MEAL_MAX_ITEMS = 30; // TODO: 확정 필요 — 임시값
export const MEAL_ITEM_MAX_KCAL = 3000; // TODO: 확정 필요 — 임시값
export const MEAL_ITEM_MAX_MACRO_G = 300; // TODO: 확정 필요 — 임시값 (탄·단·지 각각)
export const MEAL_MAX_KCAL = 6000; // TODO: 확정 필요 — 임시값 (끼니 합계)
