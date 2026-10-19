import { StyleSheet, Text, View } from 'react-native';

// PR 3에서 구현한다.
export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text>온보딩 (준비 중)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
