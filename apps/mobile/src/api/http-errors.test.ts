import { describe, expect, it } from 'vitest';
import { ApiError, NETWORK_ERROR, NetworkError, PARSE_ERROR, ResponseParseError, errorText } from './http-errors';

describe('errorText', () => {
  it('서버 오류엔 상태 코드를 붙인다', () => {
    expect(errorText(new ApiError(400, 'INVALID_REQUEST'))).toBe('서버 오류가 났어요 (코드 400)');
    expect(errorText(new ApiError(500, undefined))).toBe('서버 오류가 났어요 (코드 500)');
  });

  it('응답을 못 읽으면 따로 알린다', () => {
    expect(errorText(new ResponseParseError('bad'))).toBe(PARSE_ERROR);
  });

  it('서버에 닿지 못했거나 알 수 없는 오류는 연결 문구', () => {
    expect(errorText(new NetworkError(new TypeError('Network request failed')))).toBe(NETWORK_ERROR);
    expect(errorText(new Error('x'))).toBe(NETWORK_ERROR);
  });
});
