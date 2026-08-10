import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MemoryPrivacyType } from "../../types/memory";
import { colors, radius } from "../../theme";

export const MEMORY_PRIVACY_OPTIONS: Array<{
  value: MemoryPrivacyType;
  label: string;
  description: string;
}> = [
  { value: "family_circle", label: "가족 공개", description: "함께 기록하는 가족만 볼 수 있어요." },
  { value: "friend_circle", label: "친구 공개", description: "연결된 친구가 볼 수 있어요." },
  { value: "only_me", label: "나만 보기", description: "나만 볼 수 있어요." },
];

export function memoryPrivacyLabel(value: MemoryPrivacyType): string {
  return MEMORY_PRIVACY_OPTIONS.find((item) => item.value === value)?.label ?? "가족 공개";
}

export function MemoryPrivacyPicker({
  value,
  onChange,
}: {
  value: MemoryPrivacyType;
  onChange: (value: MemoryPrivacyType) => void;
}) {
  return (
    <View style={styles.list}>
      {MEMORY_PRIVACY_OPTIONS.map((option) => {
        // Legacy restricted-family values remain stored as-is until the user
        // explicitly chooses one of the three Build 11 privacy options.
        const legacyFamilyValue = value === "tagged_family" || value === "selected_people";
        const active = option.value === value || (option.value === "family_circle" && legacyFamilyValue);
        return (
          <Pressable
            key={option.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.dot} /> : null}</View>
            <View style={styles.copy}>
              <Text style={styles.label}>{option.label}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  option: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.faint, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.amber },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
  copy: { flex: 1 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
});
