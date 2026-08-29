import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { styles } from "./styles";

export function RatioOptionRow({
  title,
  values,
  value,
  onChange,
}: {
  title: string;
  values: number[];
  value?: number;
  onChange: (value?: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.ratioOptionSection}>
      <View style={styles.ratioOptionHeader}>
        <Text style={styles.ratioOptionTitle}>{title}</Text>
        <Text style={styles.ratioOptionValue}>{value ? `${Math.round(value * 100)}%` : t("growth.critical.054")}</Text>
      </View>
      <View style={styles.ratioOptionRow}>
        <Pressable
          onPress={() => onChange(undefined)}
          style={[styles.ratioChip, value === undefined && styles.ratioChipSelected]}
        >
          <Text style={[styles.ratioChipText, value === undefined && styles.ratioChipTextSelected]}>{t("growth.critical.054")}</Text>
        </Pressable>
        {values.map((ratio) => (
          <Pressable
            key={ratio}
            onPress={() => onChange(ratio)}
            style={[styles.ratioChip, value === ratio && styles.ratioChipSelected]}
          >
            <Text style={[styles.ratioChipText, value === ratio && styles.ratioChipTextSelected]}>
              {Math.round(ratio * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratioOptionHint}>{t("growth.critical.055")}</Text>
    </View>
  );
}
