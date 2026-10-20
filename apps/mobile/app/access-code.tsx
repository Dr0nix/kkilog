import { normalizeAccessCode } from '@kkilog/contracts';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { UnauthorizedError, getMe } from '../src/api/client';
import { storeCode } from '../src/api/code-store';
import { KeyboardScroll } from '../src/components/KeyboardScroll';
import { TextField } from '../src/components/TextField';

export default function AccessCodeScreen() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const code = normalizeAccessCode(input);
    if (!code) {
      setError('코드 형식이 맞지 않습니다. 받은 코드를 그대로 입력해 주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const me = await getMe(code);
      await storeCode(code);
      router.replace(me.has_profile ? '/home' : '/onboarding');
    } catch (e) {
      setError(e instanceof UnauthorizedError ? '사용할 수 없는 코드입니다.' : '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardScroll contentContainerStyle={styles.container} paddingTop={24} paddingBottom={24}>
      <Text style={styles.title}>접속 코드</Text>
      <Text style={styles.help}>받은 코드를 입력하거나 붙여 넣으세요. 처음 한 번만 입력하면 됩니다.</Text>
      <TextField
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        editable={!submitting}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, (submitting || !input.trim()) && styles.buttonDisabled]}
        disabled={submitting || !input.trim()}
        onPress={() => void submit()}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>확인</Text>}
      </Pressable>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '600' },
  help: { fontSize: 14, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 18, letterSpacing: 1 },
  error: { color: '#c62828', fontSize: 14 },
  button: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16 },
});
