import { useRef } from 'react';
import { StyleSheet, TextInput, type TextInputInstance, type TextInputProps } from 'react-native';
import { type KeyboardScrollMode, useScrollToInput } from './KeyboardScroll';

// 기기 다크 모드·제조사 테마에 따라 입력 글자와 플레이스홀더가 흰색에 가깝게 나와
// 흰 배경에서 안 보이는 기기가 있어 색을 직접 정한다. 앱의 입력칸은 전부 이걸 쓴다.
const TEXT_COLOR = '#222';
const PLACEHOLDER_COLOR = '#767676'; // 흰 배경 대비 4.5:1

// KeyboardScroll 안에 있으면 포커스될 때 키보드 위로 보이게 스크롤한다.
// 칸 아래 버튼까지 보여야 하는 맨 아래 입력은 keyboardScroll="end".
export function TextField({
  style,
  onFocus,
  keyboardScroll = 'field',
  ...props
}: TextInputProps & { keyboardScroll?: KeyboardScrollMode }) {
  const ref = useRef<TextInputInstance>(null);
  const scrollToInput = useScrollToInput();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={PLACEHOLDER_COLOR}
      {...props}
      onFocus={(e) => {
        if (ref.current) scrollToInput?.(ref.current, keyboardScroll);
        onFocus?.(e);
      }}
      style={[styles.base, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: TEXT_COLOR },
});
