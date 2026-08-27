import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Vibration, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useLanguage } from "../../LanguageContext";
import type { MemoryMedia } from "../../types/memory";
import { colors } from "../../theme";
import {
  clampMemoryMediaTranslation,
  clampMemoryMediaZoom,
  memoryMediaPinchTranslation,
} from "../../utils/memoryMediaZoom";

type Props = {
  media: MemoryMedia[];
  imageUrls?: string[];
  onDoubleTap?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
};

type ZoomableImageProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  active: boolean;
  pageSize: number;
  reduceMotion: boolean;
  uri: string;
  onDoubleTap?: () => void;
  onZoomChange: (zoomed: boolean) => void;
};

function ZoomableMemoryImage({
  accessibilityHint,
  accessibilityLabel,
  active,
  pageSize,
  reduceMotion,
  uri,
  onDoubleTap,
  onZoomChange,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  const reset = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 220 });
    translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
  };

  useEffect(() => {
    if (active) return;
    reset();
    onZoomChange(false);
    // Shared values are stable; this reacts only to page selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onZoomChange]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      startTranslateX.value = translateX.value;
      startTranslateY.value = translateY.value;
      runOnJS(onZoomChange)(true);
    })
    .onUpdate((event) => {
      const nextScale = clampMemoryMediaZoom(startScale.value * event.scale);
      const focalX = event.focalX - pageSize / 2;
      const focalY = event.focalY - pageSize / 2;
      scale.value = nextScale;
      translateX.value = memoryMediaPinchTranslation({
        focal: focalX,
        startTranslation: startTranslateX.value,
        startZoom: startScale.value,
        nextZoom: nextScale,
        viewport: pageSize,
      });
      translateY.value = memoryMediaPinchTranslation({
        focal: focalY,
        startTranslation: startTranslateY.value,
        startZoom: startScale.value,
        nextZoom: nextScale,
        viewport: pageSize,
      });
    })
    .onFinalize(() => {
      const zoomed = scale.value > 1.01;
      if (!zoomed) {
        scale.value = withSpring(1, { damping: 20, stiffness: 220 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
      runOnJS(onZoomChange)(zoomed);
    });

  const pan = Gesture.Pan()
    .enabled(active)
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1.01) state.activate();
      else state.fail();
    })
    .onBegin(() => {
      startTranslateX.value = translateX.value;
      startTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clampMemoryMediaTranslation(
        startTranslateX.value + event.translationX,
        scale.value,
        pageSize,
      );
      translateY.value = clampMemoryMediaTranslation(
        startTranslateY.value + event.translationY,
        scale.value,
        pageSize,
      );
    });

  const doubleTap = Gesture.Tap()
    .enabled(Boolean(onDoubleTap))
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((_event, success) => {
      if (success && onDoubleTap) runOnJS(onDoubleTap)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View
        style={styles.zoomGestureSurface}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        <Reanimated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={reduceMotion ? 0 : 150} />
        </Reanimated.View>
      </View>
    </GestureDetector>
  );
}

export function MemoryMediaViewer({ media, imageUrls = [], onDoubleTap, onZoomChange }: Props) {
  const { t } = useLanguage();
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const reduceMotion = useReduceMotion();

  const playHeart = () => {
    if (reduceMotion) return;
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

  const handleDoubleTap = () => {
    if (!onDoubleTap) return;
    Vibration.vibrate(8);
    playHeart();
    onDoubleTap();
  };

  const handleZoomChange = useCallback((next: boolean) => {
    setZoomed(next);
    onZoomChange?.(next);
  }, [onZoomChange]);

  useEffect(() => () => onZoomChange?.(false), [onZoomChange]);

  return (
    <View style={styles.wrap} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
      {imageUrls.length > 0 && media[0]?.mediaType === "image" ? (
        <ScrollView
          style={styles.scroller}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1)))}
        >
          {imageUrls.map((url, index) => (
            <View
              key={media[index]?.id ?? `${url}-${index}`}
              style={[styles.page, { width: pageWidth || undefined }]}
            >
              <ZoomableMemoryImage
                uri={url}
                pageSize={pageWidth}
                active={index === activeIndex}
                reduceMotion={reduceMotion}
                onDoubleTap={onDoubleTap ? handleDoubleTap : undefined}
                onZoomChange={handleZoomChange}
                accessibilityLabel={
                imageUrls.length > 1
                  ? t("memory.critical.149", { current: index + 1, total: imageUrls.length })
                  : t("memory.critical.150")
              }
                accessibilityHint={onDoubleTap ? t("memory.critical.151") : undefined}
              />
            </View>
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
        <BabyLogIcon kind="heart" size={56} color={colors.amberText} fill={colors.amberText} />
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
    overflow: "hidden",
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroller: { width: "100%", height: "100%" },
  page: { height: "100%", alignItems: "center", justifyContent: "center" },
  zoomGestureSurface: { width: "100%", height: "100%" },
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
});
