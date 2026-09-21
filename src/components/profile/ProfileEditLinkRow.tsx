import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { colors, fontScaleCap } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  label: string;
  value?: string;
  onPress: () => void;
};

export function ProfileEditLinkRow({ label, value, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Text style={styles.label} maxFontSizeMultiplier={fontScaleCap.control}>{label}</Text>
      <View style={styles.trailing}>
        {value ? (
          <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.control}>
            {value}
          </Text>
        ) : null}
        <BabyLogIcon kind="chevron" size={16} color={colors.faint} strokeWidth={2.1} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  label: {
    flexShrink: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  trailing: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  value: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 15,
  },
});
