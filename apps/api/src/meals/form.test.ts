import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, parseCreateMealForm } from './form';

const REQUEST_ID = '0b9f3f3e-2f7e-4b8e-9f4f-8f6a8a1c2d3e';
const jpeg = (size = 10) => new File([new Uint8Array(size)], 'meal.jpg', { type: 'image/jpeg' });

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe('parseCreateMealForm', () => {
  it('텍스트만', () => {
    expect(parseCreateMealForm(form({ meal_type: 'lunch', client_request_id: REQUEST_ID, text: ' 김밥 한 줄 ' }))).toEqual({
      mealType: 'lunch',
      clientRequestId: REQUEST_ID,
      text: '김밥 한 줄',
      photo: null,
    });
  });

  it('사진만(빈 텍스트는 없는 것으로)', () => {
    const result = parseCreateMealForm(form({ meal_type: 'dinner', client_request_id: REQUEST_ID, text: '  ', photo: jpeg() }));
    expect(result).toMatchObject({ text: null });
    expect(result?.photo?.size).toBe(10);
  });

  it.each([
    ['사진·텍스트 둘 다 없음', { meal_type: 'lunch', client_request_id: REQUEST_ID }],
    ['끼니 태그 틀림', { meal_type: 'brunch', client_request_id: REQUEST_ID, text: 'x' }],
    ['client_request_id가 UUID가 아님', { meal_type: 'lunch', client_request_id: 'abc', text: 'x' }],
    ['텍스트가 너무 김', { meal_type: 'lunch', client_request_id: REQUEST_ID, text: '가'.repeat(501) }],
    ['사진이 파일이 아님', { meal_type: 'lunch', client_request_id: REQUEST_ID, photo: 'not a file' }],
    ['사진이 JPEG가 아님', { meal_type: 'lunch', client_request_id: REQUEST_ID, photo: new File(['x'], 'a.png', { type: 'image/png' }) }],
    ['빈 사진', { meal_type: 'lunch', client_request_id: REQUEST_ID, photo: jpeg(0) }],
    ['사진이 너무 큼', { meal_type: 'lunch', client_request_id: REQUEST_ID, photo: jpeg(MAX_PHOTO_BYTES + 1) }],
  ])('%s → null', (_name, fields) => {
    expect(parseCreateMealForm(form(fields as Record<string, string | File>))).toBeNull();
  });
});
