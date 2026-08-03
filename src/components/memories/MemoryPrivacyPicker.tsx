import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MemoryPrivacyType } from "../../types/memory";
import { colors, radius } from "../../theme";

export const MEMORY_PRIVACY_OPTIONS: Array<{
  value: MemoryPrivacyType;
  label: string;
  description: string;
}> = [
  { value: "family_circle", label: "가족 공개", description: "초대된 가족이 볼 수 있어요." },
  { value: "only_me", label: "나만 보기", description: "나만 볼 수 있어요." },
  { value: "tagged_family", label: "태그된 가족만", description: "태그된 가족만 볼 수 있어요." },
  { value: "selected_people", label: "선택한 사람만", description: "선택한 사람만 볼 수 있어요." },
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
        const active = option.value === value;
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
