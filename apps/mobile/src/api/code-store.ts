import * as SecureStore from 'expo-secure-store';

// 접속 코드는 SecureStore에만 둔다(CLAUDE.md).
const KEY = 'kkilog.access_code';

export function getStoredCode(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export function storeCode(code: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, code);
}

export function clearStoredCode(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY);
}
