import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";

type SheetProps = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  columns: number;
  rows: number;
  playing?: boolean;
  durationMs?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function OverviewSpriteSheet({
  source,
  width,
  height,
  columns,
  rows,
  playing = false,
  durationMs = 2200,
  onPress,
  style,
  accessibilityLabel,
}: SheetProps) {
  const reduceMotion = useReduceMotion();
  const total = columns * rows;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!playing || reduceMotion) {
      setFrame(0);
      return;
    }
    const step = Math.max(80, Math.round(durationMs / total));
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index >= total) {
        setFrame(total - 1);
        clearInterval(timer);
        return;
      }
      setFrame(index);
    }, step);
    return () => clearInterval(timer);
  }, [durationMs, playing, reduceMotion, total]);

  const col = frame % columns;
  const row = Math.floor(frame / columns);
  const body = (
    <View style={[{ width, height, overflow: "hidden" }, style]}>
      <Image
        source={source}
        style={{
          width: width * columns,
          height: height * rows,
          transform: [{ translateX: -col * width }, { translateY: -row * height }],
        }}
      />
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {body}
    </Pressable>
  );
}

const MOTION_WIDTH = 108;
const MOTION_HEIGHT = 96;
const MOTION_INSET = 6;

type FrameProps = {
  frames: readonly ImageSourcePropType[];
  playing: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function OverviewMotionFrames({ frames, playing, style, onPress, accessibilityLabel }: FrameProps) {
  const reduceMotion = useReduceMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!playing || reduceMotion) {
      setIndex(0);
      return;
    }
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      if (frame >= frames.length * 2) {
        setIndex(frames.length - 1);
        clearInterval(timer);
        return;
      }
      setIndex(frame % frames.length);
    }, 90);
    return () => clearInterval(timer);
  }, [frames.length, playing, reduceMotion]);

  const body = (
    <View style={[styles.motion, style]} collapsable={false}>
      <Image source={frames[index]} style={styles.frame} resizeMode="contain" />
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  motion: {
    width: MOTION_WIDTH,
    height: MOTION_HEIGHT,
    overflow: "hidden",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: MOTION_WIDTH - MOTION_INSET * 2,
    height: MOTION_HEIGHT - MOTION_INSET * 2,
    margin: MOTION_INSET,
  },
});
