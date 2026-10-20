import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 입력칸이 있는 화면의 스크롤 영역. 앱이 edge-to-edge로 그려져 안드로이드에서 키보드가 떠도 화면이 줄지 않아서,
// KeyboardAvoidingView로 키보드 높이만큼 줄이고, 포커스된 입력칸(TextField)이 키보드 위에 오게 스크롤한다.

// 'field': 그 칸이 보이게, 'end': 끝까지(칸 아래 버튼까지 보여야 하는 맨 아래 입력)
export type KeyboardScrollMode = 'field' | 'end';
type ScrollToInput = (input: TextInputInstance, mode: KeyboardScrollMode) => void;

const ScrollToInputContext = createContext<ScrollToInput | null>(null);

export function useScrollToInput(): ScrollToInput | null {
  return useContext(ScrollToInputContext);
}

// 칸 아래로 남겨 둘 여유(px)
const FIELD_MARGIN = 24;

export function KeyboardScroll({
  contentContainerStyle,
  paddingTop = 16,
  paddingBottom = 24,
  children,
}: {
  contentContainerStyle?: StyleProp<ViewStyle>;
  paddingTop?: number;
  // 키보드가 없을 때만 하단 내비게이션 바 높이를 더한다(키보드가 그 위를 덮으므로 이중으로 더하지 않음)
  paddingBottom?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const viewportHeight = useRef(0);
  const [keyboardShown, setKeyboardShown] = useState(false);
  // 키보드가 다 올라오고 영역이 줄어든 뒤에 스크롤해야 해서, 포커스 때는 대상만 적어 둔다.
  const pending = useRef<{ input: TextInputInstance; mode: KeyboardScrollMode } | null>(null);

  const scrollNow = useCallback((input: TextInputInstance, mode: KeyboardScrollMode) => {
    if (mode === 'end') {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    input.measureLayout(
      content,
      (_x, y, _width, height) => {
        const target = y + height + FIELD_MARGIN - viewportHeight.current;
        if (target > 0) scrollRef.current?.scrollTo({ y: target, animated: true });
      },
      () => undefined,
    );
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardShown(true);
      // 영역이 줄어드는 레이아웃이 끝난 다음 프레임에 스크롤한다.
      setTimeout(() => {
        const target = pending.current;
        pending.current = null;
        if (target) scrollNow(target.input, target.mode);
      }, 50);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollNow]);

  const scrollToInput = useCallback<ScrollToInput>(
    (input, mode) => {
      // 키보드가 이미 떠 있으면(다른 칸으로 옮겨 감) 바로, 아니면 키보드가 뜬 뒤에
      if (keyboardShown) scrollNow(input, mode);
      else pending.current = { input, mode };
    },
    [keyboardShown, scrollNow],
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        // 내용이 짧아도 화면 높이를 채운다(코드 입력처럼 세로 가운데 정렬하는 화면)
        contentContainerStyle={styles.grow}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
      >
        <View
          ref={contentRef}
          collapsable={false}
          style={[
            contentContainerStyle,
            {
              paddingTop: paddingTop + insets.top,
              paddingBottom: paddingBottom + (keyboardShown ? 0 : insets.bottom),
            },
          ]}
        >
          <ScrollToInputContext.Provider value={scrollToInput}>{children}</ScrollToInputContext.Provider>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
