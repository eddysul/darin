import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme";

type Props = {
  title: string;
  onBack?: () => void;
  leftLabel?: string;
  rightLabel?: string;
  onRightPress?: () => void;
  rightDisabled?: boolean;
  includeSafeArea?: boolean;
};

/** Shared header for nested screens and create/edit modals. Root tabs do not use it. */
export function NavigationHeader({
  title,
  onBack,
  leftLabel,
  rightLabel,
  onRightPress,
  rightDisabled = false,
  includeSafeArea = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const modalActions = Boolean(leftLabel || rightLabel);

  return (
    <View
      style={[
        styles.header,
        { paddingTop: includeSafeArea ? Math.max(insets.top, 8) : 8 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leftLabel ?? "이전 화면으로 돌아가기"}
        onPress={onBack}
        disabled={!onBack}
        style={styles.sideButton}
        hitSlop={4}
      >
        {modalActions ? (
          <Text style={styles.leftLabel}>{leftLabel ?? "취소"}</Text>
        ) : onBack ? (
          <ChevronLeft size={27} color={colors.text} strokeWidth={2.2} />
        ) : null}
      </Pressable>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rightLabel}
        onPress={onRightPress}
        disabled={!onRightPress || rightDisabled}
        style={styles.sideButton}
        hitSlop={4}
      >
        {rightLabel ? (
          <Text style={[styles.rightLabel, rightDisabled && styles.disabled]}>{rightLabel}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  sideButton: {
    width: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    minHeight: 44,
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  leftLabel: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  rightLabel: { color: colors.amber, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.42 },
});
