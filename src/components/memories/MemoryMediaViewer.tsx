import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { Image } from "expo-image";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import type { MemoryMedia } from "../../types/memory";
import { colors } from "../../theme";

type Props = {
  media: MemoryMedia[];
  imageUrl?: string;
  onDoubleTap?: () => void;
};

export function MemoryMediaViewer({ media, imageUrl, onDoubleTap }: Props) {
  const lastTapRef = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const primaryMedia = media[0];

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
    <Pressable style={styles.wrap} onPress={handlePress}>
      {imageUrl && primaryMedia?.mediaType === "image" ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
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
    </Pressable>
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
