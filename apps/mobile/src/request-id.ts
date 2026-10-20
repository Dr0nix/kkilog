// 기록 요청의 멱등성 키(client_request_id, spec 3). 같은 기록을 다시 보낼 땐 같은 값을 쓴다.
// 보안 용도가 아니라 사용자별 중복 방지용이라 Math.random 기반 UUID v4로 충분하다(새 네이티브 모듈 없이).
export function newRequestId(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
