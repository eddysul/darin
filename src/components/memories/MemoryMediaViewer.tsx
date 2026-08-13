import { useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { Image } from "expo-image";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import type { MemoryMedia } from "../../types/memory";
import { colors } from "../../theme";

type Props = {
  media: MemoryMedia[];
  imageUrls?: string[];
  onDoubleTap?: () => void;
};

export function MemoryMediaViewer({ media, imageUrls = [], onDoubleTap }: Props) {
  const lastTapRef = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const playHeart = () => {
    heartScale.setValue(0.65);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.45,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 650,
        delay: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (!onDoubleTap) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      Vibration.vibrate(8);
      playHeart();
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <View style={styles.wrap} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
      {imageUrls.length > 0 && media[0]?.mediaType === "image" ? (
        <ScrollView
          style={styles.scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1)))}
        >
          {imageUrls.map((url, index) => (
            <Pressable key={media[index]?.id ?? `${url}-${index}`} style={[styles.page, { width: pageWidth || undefined }]} onPress={handlePress}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <BabyLogIcon kind="folder" size={40} color={colors.faint} />
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heart,
          {
            opacity: heartOpacity,
            transform: [{ scale: heartScale }],
          },
        ]}
      >
        <Text style={styles.heartText}>♥</Text>
      </Animated.View>
      {imageUrls.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {imageUrls.map((_, index) => <View key={index} style={[styles.dot, index === activeIndex && styles.dotActive]} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroller: { width: "100%", height: "100%" },
  page: { height: "100%", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 16, backgroundColor: "#fff" },
  heart: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  heartText: {
    color: colors.amber,
    fontSize: 78,
    textShadowColor: "rgba(46,42,38,0.16)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
});
