import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

// 기기 다크 모드·제조사 테마에 따라 입력 글자와 플레이스홀더가 흰색에 가깝게 나와
// 흰 배경에서 안 보이는 기기가 있어 색을 직접 정한다. 앱의 입력칸은 전부 이걸 쓴다.
const TEXT_COLOR = '#222';
const PLACEHOLDER_COLOR = '#767676'; // 흰 배경 대비 4.5:1

export function TextField({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor={PLACEHOLDER_COLOR} {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: { color: TEXT_COLOR },
});
