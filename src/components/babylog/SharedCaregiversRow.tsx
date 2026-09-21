import { Pressable, StyleSheet, Text, View } from "react-native";
import { storedRelationshipLabel } from "../../utils/familyDisplay";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, fontScaleCap } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import type { Translate } from "../../utils/recordDisplay";
import { hasGrantedFamilyShare } from "../../types/family";

const CAREGIVER_TONES = ["#d97770", "#748db3", "#5CB87A", "#c98a54"] as const;

type Props = {
  onPress: () => void;
  size?: "sm" | "md" | "lg";
  label?: string;
};

export function SharedCaregiversRow({ onPress, size = "md", label }: Props) {
  const { familyMembers } = useBabyLog();
  const { t } = useLanguage();
  const sharedMembers = familyMembers.filter((member) => member.status === "active");
  if (!hasGrantedFamilyShare(familyMembers)) return null;
  const avatarSize = size === "lg" ? 28 : size === "sm" ? 20 : 22;
  const overlap = size === "lg" ? -6 : size === "sm" ? -6 : -7;
  const names = sharedMembers.slice(0, 3).map((member) => member.name);
  const resolved =
    label ??
    (names.length
      ? t(sharedMembers.length > 3 ? "chrome.critical.028" : "chrome.critical.027", { names: names.join(" · ") })
      : t("chrome.critical.026"));

  return (
    <Pressable style={[styles.row, size === "sm" && styles.rowSm]} onPress={onPress}>
      <View style={styles.stack}>
        {sharedMembers.slice(0, 3).map((member, index) => {
          const caption = storedRelationshipLabel(t as Translate, member.relationshipLabel ?? member.name);
          return (
            <View
              key={member.id}
              style={[
                styles.avatar,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  marginLeft: index > 0 ? overlap : 0,
                  backgroundColor: CAREGIVER_TONES[index % CAREGIVER_TONES.length],
                },
              ]}
            >
              <Text style={[styles.initial, size === "lg" && styles.initialLg]} maxFontSizeMultiplier={fontScaleCap.chrome}>
                {caption.slice(0, 2)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.label, size === "sm" && styles.labelSm]} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {resolved}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1, minHeight: 28 },
  rowSm: { gap: 6 },
  stack: { flexDirection: "row" },
  avatar: {
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#fff", fontSize: 9, fontWeight: "800" },
  initialLg: { fontSize: 10 },
  label: { fontSize: 11, color: colors.faint, fontWeight: "600", flexShrink: 1 },
  labelSm: { fontSize: 11 },
});
