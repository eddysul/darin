import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DIARY_COVER_TEMPLATES, type DiaryCoverTemplateId } from "../../constants/diaryCoverTemplates";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { colors } from "../../theme";
import { DiaryCoverTemplate } from "./DiaryCoverTemplate";

const TEMPLATE_NAME_KEYS: Record<DiaryCoverTemplateId, MessageKey> = {
  cloud_sky: "diary.coverTemplate.cloud_sky", purple_dot: "diary.coverTemplate.purple_dot",
  green_check: "diary.coverTemplate.green_check", pink_heart: "diary.coverTemplate.pink_heart",
  purple_star: "diary.coverTemplate.purple_star", yellow_flower: "diary.coverTemplate.yellow_flower",
  beige_paper: "diary.coverTemplate.beige_paper", mono_note: "diary.coverTemplate.mono_note",
  night: "diary.coverTemplate.night", simple_border: "diary.coverTemplate.simple_border",
};

export function DiaryCoverPicker({ value, photoUri, title, onChange }: { value: DiaryCoverTemplateId; photoUri?: string | null; title?: string | null; onChange: (id: DiaryCoverTemplateId) => void }) {
  const { t } = useLanguage();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {DIARY_COVER_TEMPLATES.map((template) => {
        const selected = template.id === value;
        const name = t(TEMPLATE_NAME_KEYS[template.id]);
        return (
          <Pressable key={template.id} onPress={() => onChange(template.id)} style={[styles.item, selected && { borderColor: template.borderColor, backgroundColor: `${template.borderColor}12` }]} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${t("diary.compose.cover")} ${name}`}>
            <DiaryCoverTemplate styleId={template.id} photoUri={photoUri} title={title} compact />
            <View style={styles.labelRow}><Text style={[styles.label, selected && { color: template.borderColor }]} numberOfLines={1}>{name}</Text></View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingRight: 12 },
  item: { width: 120, padding: 7, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", gap: 6 },
  labelRow: { minHeight: 20, justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted },
});
