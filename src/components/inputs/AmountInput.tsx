import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLanguage } from "../../LanguageContext";
import { storedRecordValueLabel } from "../../utils/recordDisplay";
import { colors, radius } from "../../theme";

export const CUSTOM_AMOUNT_UNIT = "기타";

export function sanitizeAmountInput(value: string): string {
  return value.replace(",", ".").replace(/[^0-9.]/g, "");
}

export function isPositiveAmount(value: string): boolean {
  const normalized = value.trim().replace(",", ".");
  return /^(?:\d+\.?\d*|\.\d+)$/.test(normalized) && Number.parseFloat(normalized) > 0;
}

export function AmountInput({
  label,
  value,
  unit,
  unitOptions,
  customUnit,
  allowCustomUnit = true,
  onChangeValue,
  onChangeUnit,
  onChangeCustomUnit,
  error,
}: {
  label: string;
  value: string;
  unit: string;
  unitOptions: readonly string[];
  customUnit?: string;
  allowCustomUnit?: boolean;
  onChangeValue: (value: string) => void;
  onChangeUnit: (unit: string) => void;
  onChangeCustomUnit?: (unit: string) => void;
  error?: string;
}) {
  const { t } = useLanguage();
  const options = allowCustomUnit ? [...unitOptions, CUSTOM_AMOUNT_UNIT] : [...unitOptions];
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(next) => onChangeValue(sanitizeAmountInput(next))}
        keyboardType="decimal-pad"
        placeholder={t("chrome.critical.036")}
        placeholderTextColor={colors.faint}
      />
      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable key={option} style={[styles.chip, unit === option && styles.chipSelected]} onPress={() => onChangeUnit(unit === option ? "" : option)}>
            <Text style={[styles.chipText, unit === option && styles.chipTextSelected]}>{storedRecordValueLabel(t, option)}</Text>
          </Pressable>
        ))}
      </View>
      {unit === CUSTOM_AMOUNT_UNIT ? (
        <TextInput
          style={styles.input}
          value={customUnit ?? ""}
          onChangeText={onChangeCustomUnit}
          maxLength={16}
          placeholder={t("chrome.critical.037")}
          placeholderTextColor={colors.faint}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, marginTop: 14 },
  label: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  chipSelected: { borderColor: colors.amber, backgroundColor: colors.amber },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextSelected: { color: colors.brandCoralForeground },
  error: { color: colors.dangerText, fontSize: 11.5, lineHeight: 17 },
});
