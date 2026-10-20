import { MEAL_PHOTO_MAX_BYTES, MEAL_PHOTOS_MAX, MEAL_PHOTOS_MAX_TOTAL_BYTES } from '@kkilog/contracts';
import { describe, expect, it } from 'vitest';
import { parseCreateMealForm } from './form';

const REQUEST_ID = '0b9f3f3e-2f7e-4b8e-9f4f-8f6a8a1c2d3e';
const jpeg = (size = 10, name = 'meal.jpg') => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });

// 같은 키를 여러 번 넣을 수 있게 [키, 값] 목록으로 받는다.
function form(entries: [string, string | File][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const base: [string, string][] = [
  ['meal_type', 'lunch'],
  ['client_request_id', REQUEST_ID],
];
const photos = (n: number, size = 10) => Array.from({ length: n }, (_, i): [string, File] => ['photo', jpeg(size, `${i}.jpg`)]);

describe('parseCreateMealForm', () => {
  it('텍스트만', () => {
    expect(parseCreateMealForm(form([...base, ['text', ' 김밥 한 줄 ']]))).toEqual({
      mealType: 'lunch',
      clientRequestId: REQUEST_ID,
      text: '김밥 한 줄',
      photos: [],
      eatenAt: null,
    });
  });

  it('사진 1장만(예전 앱과 같은 요청, 빈 텍스트는 없는 것으로)', () => {
    const result = parseCreateMealForm(form([...base, ['text', '  '], ['photo', jpeg()]]));
    expect(result).toMatchObject({ text: null });
    expect(result?.photos.map((p) => p.size)).toEqual([10]);
  });

  it('여러 장은 보낸 순서대로, 최대 장수까지', () => {
    const result = parseCreateMealForm(form([...base, ...photos(MEAL_PHOTOS_MAX)]));
    expect(result?.photos.map((p) => p.name)).toEqual(Array.from({ length: MEAL_PHOTOS_MAX }, (_, i) => `${i}.jpg`));
  });

  it('전체 크기 한도까지는 받는다', () => {
    const size = Math.floor(MEAL_PHOTOS_MAX_TOTAL_BYTES / 2);
    expect(parseCreateMealForm(form([...base, ...photos(2, size)]))?.photos).toHaveLength(2);
  });

  it('먹은 시각을 고르면 그 시각(과거, 시간대 포함 ISO)', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const result = parseCreateMealForm(form([...base, ['text', 'x'], ['eaten_at', '2026-10-19T12:30:00+09:00']]), now);
    expect(result?.eatenAt?.toISOString()).toBe('2026-10-19T03:30:00.000Z');
  });

  it.each([
    ['ISO 형식이 아님', '어제 점심'],
    ['미래', '2026-10-20T13:00:00Z'],
    ['너무 오래 전', '2026-09-01T12:00:00Z'],
  ])('먹은 시각이 %s → null', (_name, value) => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(parseCreateMealForm(form([...base, ['text', 'x'], ['eaten_at', value]]), now)).toBeNull();
  });

  it.each([
    ['사진·텍스트 둘 다 없음', base],
    ['끼니 태그 틀림', [['meal_type', 'brunch'], ['client_request_id', REQUEST_ID], ['text', 'x']]],
    ['client_request_id가 UUID가 아님', [['meal_type', 'lunch'], ['client_request_id', 'abc'], ['text', 'x']]],
    ['텍스트가 너무 김', [...base, ['text', '가'.repeat(501)]]],
    ['사진이 파일이 아님', [...base, ['photo', 'not a file']]],
    ['사진이 JPEG가 아님', [...base, ['photo', new File(['x'], 'a.png', { type: 'image/png' })]]],
    ['빈 사진', [...base, ['photo', jpeg(0)]]],
    ['사진 한 장이 너무 큼', [...base, ['photo', jpeg(MEAL_PHOTO_MAX_BYTES + 1)]]],
    ['사진이 너무 많음', [...base, ...photos(MEAL_PHOTOS_MAX + 1)]],
    ['전체 크기가 너무 큼', [...base, ...photos(2, Math.floor(MEAL_PHOTOS_MAX_TOTAL_BYTES / 2) + 1)]],
    ['여러 장 중 하나가 JPEG가 아님', [...base, ...photos(2), ['photo', new File(['x'], 'a.png', { type: 'image/png' })]]],
  ] as [string, [string, string | File][]][])('%s → null', (_name, entries) => {
    expect(parseCreateMealForm(form(entries))).toBeNull();
  });
});
