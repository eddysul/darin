import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { colors } from "../../theme";

const CAREGIVER_TONES = [colors.amber, "#7c83fd", "#5CB87A"] as const;

type Props = {
  onPress: () => void;
  size?: "sm" | "md";
  label?: string;
};

export function SharedCaregiversRow({
  onPress,
  size = "md",
  label = "엄마 · 아빠 · 시터와 공유 중",
}: Props) {
  const avatarSize = size === "sm" ? 20 : 22;
  const overlap = size === "sm" ? -6 : -7;

  return (
    <Pressable style={[styles.row, size === "sm" && styles.rowSm]} onPress={onPress}>
      <View style={styles.stack}>
        {CAREGIVER_TONES.map((tone, i) => (
          <View
            key={tone}
            style={[
              styles.avatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                marginLeft: i > 0 ? overlap : 0,
              },
            ]}
          >
            <BabyLogIcon kind="profile" size={10} color={tone} strokeWidth={2.2} />
          </View>
        ))}
      </View>
      <Text style={[styles.label, size === "sm" && styles.labelSm]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowSm: { gap: 6 },
  stack: { flexDirection: "row" },
  avatar: {
    backgroundColor: colors.cardHi,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11.5, color: colors.faint, fontWeight: "600" },
  labelSm: { fontSize: 11 },
});
