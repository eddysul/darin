import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, fontScaleCap } from "../../theme";
import { useLanguage } from "../../LanguageContext";

const CAREGIVER_TONES = [colors.amber, "#7c83fd", "#5CB87A", "#c98a54"] as const;

type Props = {
  onPress: () => void;
  size?: "sm" | "md";
  label?: string;
};

export function SharedCaregiversRow({ onPress, size = "md", label }: Props) {
  const { familyMembers } = useBabyLog();
  const { t } = useLanguage();
  const avatarSize = size === "sm" ? 20 : 22;
  const overlap = size === "sm" ? -6 : -7;
  const names = familyMembers.slice(0, 3).map((m) => m.name);
  const resolved =
    label ??
    (names.length
      ? t(familyMembers.length > 3 ? "chrome.critical.028" : "chrome.critical.027", { names: names.join(" · ") })
      : t("chrome.critical.026"));

  return (
    <Pressable style={[styles.row, size === "sm" && styles.rowSm]} onPress={onPress}>
      <View style={styles.stack}>
        {familyMembers.slice(0, 3).map((m, i) => (
          <View
            key={m.id}
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
            <BabyLogIcon
              kind="profile"
              size={10}
              color={CAREGIVER_TONES[i % CAREGIVER_TONES.length]}
              strokeWidth={2.2}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.label, size === "sm" && styles.labelSm]} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {resolved}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  rowSm: { gap: 6 },
  stack: { flexDirection: "row" },
  avatar: {
    backgroundColor: colors.cardHi,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11.5, color: colors.faint, fontWeight: "600", flexShrink: 1 },
  labelSm: { fontSize: 11 },
});
