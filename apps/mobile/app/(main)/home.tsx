import { StyleSheet, Text, View } from 'react-native';

// PR 8에서 구현한다.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>홈 (준비 중)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
