import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { eatenAtOn, formatTime, parseTime } from '../format';
import { TextField } from './TextField';

// 고를 수 있는 날짜(오늘·어제·그제). 서버는 더 오래 전도 받지만 화면은 놓친 끼니를 바로 적는 정도로 둔다.
const DAYS = [
  { daysAgo: 0, label: '오늘' },
  { daysAgo: 1, label: '어제' },
  { daysAgo: 2, label: '그제' },
] as const;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function describe(value: Date | null): string {
  if (!value) return '지금';
  return `${value.getMonth() + 1}월 ${value.getDate()}일 (${WEEKDAYS[value.getDay()]}) ${formatTime(value.toISOString())}`;
}

function daysAgoOf(value: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(value)) / (24 * 60 * 60 * 1000));
}

// 먹은 시각(spec 2.4). null이면 기록하는 순간(지금)으로 저장된다. 네이티브 날짜 선택기 없이 화면 안에서 고른다.
export function EatenAtPicker({
  value,
  onChange,
  disabled,
}: {
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [daysAgo, setDaysAgo] = useState(0);
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  function open() {
    const now = new Date();
    const current = value ?? now;
    setDaysAgo(value ? Math.min(Math.max(daysAgoOf(current, now), 0), DAYS.length - 1) : 0);
    setTime(formatTime(current.toISOString()));
    setError(null);
    setEditing(true);
  }

  function apply() {
    const parsed = parseTime(time);
    if (!parsed) {
      setError('시각은 13:30처럼 적어 주세요.');
      return;
    }
    const now = new Date();
    const next = eatenAtOn(now, daysAgo, parsed.hour, parsed.minute);
    if (next.getTime() > now.getTime()) {
      setError('지금보다 나중 시각은 고를 수 없어요.');
      return;
    }
    onChange(next);
    setEditing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>먹은 시각</Text>
        <Text style={styles.value}>{describe(value)}</Text>
        {!editing ? (
          <Pressable onPress={open} disabled={disabled} hitSlop={8}>
            <Text style={[styles.link, disabled && styles.disabled]}>바꾸기</Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={styles.editor}>
          <View style={styles.row}>
            {DAYS.map((day) => (
              <Pressable
                key={day.daysAgo}
                style={[styles.chip, daysAgo === day.daysAgo && styles.chipSelected]}
                onPress={() => setDaysAgo(day.daysAgo)}
              >
                <Text style={[styles.chipText, daysAgo === day.daysAgo && styles.chipTextSelected]}>{day.label}</Text>
              </Pressable>
            ))}
            <TextField
              style={styles.timeInput}
              value={time}
              onChangeText={setTime}
              placeholder="13:30"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable style={styles.apply} onPress={apply}>
              <Text style={styles.applyText}>적용</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onChange(null);
                setEditing(false);
              }}
              hitSlop={8}
            >
              <Text style={styles.link}>지금으로</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)} hitSlop={8}>
              <Text style={styles.cancel}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 14, color: '#555' },
  value: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  link: { color: '#1565c0', fontSize: 14 },
  disabled: { opacity: 0.4 },
  cancel: { color: '#555', fontSize: 14 },
  editor: { gap: 10, padding: 12, borderRadius: 10, backgroundColor: '#f6f6f6' },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipSelected: { backgroundColor: '#222', borderColor: '#222' },
  chipText: { fontSize: 14 },
  chipTextSelected: { color: '#fff' },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    minWidth: 72,
    backgroundColor: '#fff',
  },
  error: { color: '#c62828', fontSize: 13 },
  apply: { backgroundColor: '#222', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  applyText: { color: '#fff', fontSize: 14 },
});
