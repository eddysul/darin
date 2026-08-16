import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors, type } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";

type Props = {
  onPress: () => void;
  /** Icon-only smaller FAB (Record tab). */
  compact?: boolean;
  /** Fade out and ignore presses while true. */
  hidden?: boolean;
  /** Extra offset above the default bottom placement. */
  bottomOffset?: number;
};

export function ConsultFab({ onPress, compact = false, hidden = false, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(hidden ? 0 : 1)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: hidden ? 0 : 1,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    }).start();
  }, [hidden, opacity, reduceMotion]);

  const size = compact ? 48 : 72;
  const bottom = compact
    ? Math.max(insets.bottom, 10) + 72 + 28 + bottomOffset
    : 18 + bottomOffset;

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      style={[
        styles.wrap,
        {
          opacity,
          right: compact ? 14 : 16,
          bottom,
          width: size,
          height: size,
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { width: size, height: size, borderRadius: size / 2 },
          compact && styles.fabCompact,
          !compact && styles.fabLarge,
          pressed && !reduceMotion && styles.pressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="AI 상담"
      >
        <BabyLogIcon kind="bot" size={compact ? 22 : 25} color="#FFFFFF" strokeWidth={1.9} />
        {compact ? null : <Text style={styles.text}>AI 상담</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 20,
  },
  fab: {
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#A84F48",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  fabCompact: {
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabLarge: {
    gap: 4,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  text: {
    color: "#FFFFFF",
    fontSize: type.xs,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
