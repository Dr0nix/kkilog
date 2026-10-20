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

// 탄단지 목표 비율 허용 범위(spec 7.1). 각각 정수 이 범위 안, 합 100이어야 한다. 어기면 응답 이상으로 보고 실패.
export const MACRO_PCT_MIN = 5;
export const MACRO_PCT_MAX = 80;

// 1g당 kcal (spec 7.1 탄단지 그램 계산)
export const KCAL_PER_G_CARB = 4;
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_FAT = 9;

// 체중 추세(spec 7.2). 일별 체중의 지수이동평균 평활 계수. 써 보면서 조정한다.
export const TREND_ALPHA = 0.1;
// 추세 기울기는 최근 이 기간의 추세 변화로 계산한다(spec 2.5 "최근 14일 추세 기울기").
export const TREND_SLOPE_WINDOW_DAYS = 14;
export const TREND_MIN_SPAN_DAYS = 7; // TODO: 확정 필요 — 임시값 (기록 기간이 이보다 짧으면 기울기·도달 예상 없음)
export const TREND_ETA_MAX_DAYS = 730; // TODO: 확정 필요 — 임시값 (이보다 오래 걸리면 도달 예상일을 내지 않음)

// 평균 섭취는 오늘을 뺀 최근 이 기간(완료된 날)으로 계산한다(spec 8 /api/trend "7일 평균 섭취").
export const INTAKE_AVERAGE_DAYS = 7;

// 조언 장기 맥락(spec 6.2)의 반복 패턴 기준. 기록한 날 중 이 기준을 넘은 날 수를 센다.
export const PATTERN_OVER_KCAL_RATIO = 1.1; // TODO: 확정 필요 — 임시값 (하루 섭취가 목표 kcal × 이 값을 넘으면 "목표 초과한 날")
export const PATTERN_PROTEIN_SHORT_RATIO = 0.8; // TODO: 확정 필요 — 임시값 (단백질이 목표 × 이 값보다 적으면 "단백질 부족한 날")
export const PATTERN_MIN_DAYS = 3; // TODO: 확정 필요 — 임시값 (최근 기록에서 같은 일이 이만큼 반복돼야 조언에서 짚는다. 기록한 날도 이만큼은 있어야 함)

// 끼니 먹은 시각(spec 2.4). 놓친 끼니를 나중에 적을 수 있게 과거 시각을 받되 이 기간까지만.
export const MEAL_EATEN_AT_MAX_PAST_DAYS = 7; // TODO: 확정 필요 — 임시값
// 기기 시계가 조금 빠른 경우를 봐준다.
export const MEAL_EATEN_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
