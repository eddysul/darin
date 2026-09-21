import { StyleSheet, Text, View } from "react-native";
import type { FamilyRole } from "../../types/family";
import { roleColors } from "../../themePalette";
import { fontScaleCap } from "../../theme";

type BadgeRole = FamilyRole | "friend";

function toneFor(role: BadgeRole) {
  if (role === "friend") return roleColors.friend;
  if (role === "viewer") return roleColors.viewer;
  if (role === "editor" || role === "caregiver") return roleColors.editor;
  return roleColors.admin;
}

export function RoleBadge({ role, label }: { role: BadgeRole; label: string }) {
  const tone = toneFor(role);
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text
        style={[styles.text, { color: tone.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={fontScaleCap.control}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
