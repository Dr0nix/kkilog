import { CreateWeightRequestSchema, type HomeResponse } from '@kkilog/contracts';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createWeight } from '../api/client';
import { NETWORK_ERROR, shouldShowError } from '../api/errors';
import { formatKg } from '../format';
import { newRequestId } from '../request-id';
import { TextField } from './TextField';

// 체중: 오늘 기록 여부 + [체중 기록](spec 2.3). 체중 API는 오늘 날짜로만 쌓으므로 오늘 화면에서만 기록할 수 있다.
export function WeightRow({
  weight,
  isToday,
  onSaved,
}: {
  weight: HomeResponse['weight'];
  isToday: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  // 같은 값을 다시 보내면(연타·재전송) 같은 id로 중복 기록을 막는다. 값이 바뀌면 새 기록이다.
  const [requestId, setRequestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRequestId(newRequestId()), [text]);

  async function save() {
    const parsed = CreateWeightRequestSchema.safeParse({
      weight_kg: Number(text.replace(',', '.')),
      client_request_id: requestId,
    });
    if (text.trim() === '' || !parsed.success) {
      setError('20~300kg 사이로 적어 주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createWeight(parsed.data);
      setEditing(false);
      setText('');
      onSaved();
    } catch (e) {
      if (shouldShowError(e)) setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  const latest = weight.latest;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>체중</Text>
          <Text style={styles.value}>
            {weight.recorded && latest
              ? `${formatKg(latest.weight_kg)} 기록함`
              : latest
                ? `기록 안 함 · 최근 ${formatKg(latest.weight_kg)}`
                : '기록 안 함'}
          </Text>
        </View>
        {isToday && !editing ? (
          <Pressable style={styles.button} onPress={() => setEditing(true)}>
            <Text style={styles.buttonText}>{weight.recorded ? '다시 기록' : '체중 기록'}</Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={styles.row}>
          <TextField
            style={[styles.input, styles.flex]}
            value={text}
            onChangeText={setText}
            placeholder={latest ? String(latest.weight_kg) : '예: 70.5'}
            keyboardType="decimal-pad"
            autoFocus
            editable={!saving}
          />
          <Text style={styles.unit}>kg</Text>
          <Pressable style={styles.button} onPress={() => void save()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>저장</Text>}
          </Pressable>
          <Pressable onPress={() => setEditing(false)} disabled={saving} hitSlop={8}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 16 },
  button: { backgroundColor: '#222', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, minWidth: 64, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  unit: { fontSize: 15, color: '#555' },
  cancel: { fontSize: 14, color: '#555' },
  error: { color: '#c62828', fontSize: 13 },
});
