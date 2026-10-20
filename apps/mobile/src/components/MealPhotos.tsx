import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

// 끼니 사진. 여러 장이면 옆으로 넘겨 보고, 몇 번째 사진인지 표시한다.
export function MealPhotos({ urls }: { urls: readonly string[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  if (urls.length === 0) return null;

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {urls.map((url) => (
            <Image key={url} source={{ uri: url }} style={[styles.photo, { width }]} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}
      {urls.length > 1 ? (
        <Text style={styles.counter}>
          {index + 1}/{urls.length}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  photo: { height: '100%' },
  counter: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
