import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DIARY_PAGE_TEMPLATES, type DiaryPageTemplateId } from "../../constants/diaryPageTemplates";
import type { DiarySkyId } from "../../constants/diaryCompose";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { DiaryPageTemplate } from "./DiaryPageTemplate";

const TEMPLATE_NAME_KEYS: Record<DiaryPageTemplateId, MessageKey> = {
  basic_line: "diary.pageTemplate.basic_line", blue_cloud: "diary.pageTemplate.blue_cloud",
  green_check: "diary.pageTemplate.green_check", pink_heart: "diary.pageTemplate.pink_heart",
  purple_star: "diary.pageTemplate.purple_star", yellow_flower: "diary.pageTemplate.yellow_flower",
  beige_paper: "diary.pageTemplate.beige_paper", mono_note: "diary.pageTemplate.mono_note",
  night: "diary.pageTemplate.night", simple_border: "diary.pageTemplate.simple_border",
};

export function DiaryPageStylePicker({ value, dateLabel, weatherStamp, title, body, onChange }: { value: DiaryPageTemplateId; dateLabel?: string | null; weatherStamp?: DiarySkyId | null; title?: string | null; body?: string | null; onChange: (id: DiaryPageTemplateId) => void }) {
  const { t } = useLanguage();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {DIARY_PAGE_TEMPLATES.map((template) => {
        const selected = template.id === value;
        const name = t(TEMPLATE_NAME_KEYS[template.id]);
        return (
          <Pressable key={template.id} onPress={() => onChange(template.id)} style={[styles.item, selected && { borderColor: template.borderColor, backgroundColor: `${template.borderColor}12` }]} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${t("diary.compose.pageStyle")} ${name}`}>
            <DiaryPageTemplate styleId={template.id} dateLabel={dateLabel} weatherStamp={weatherStamp} title={title} body={body} compact />
            <View style={styles.labelRow}><Text style={[styles.label, selected && { color: template.accentColor }]} numberOfLines={1}>{name}</Text></View>
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
  label: { fontSize: 12, fontWeight: "700", color: "#746D65" },
});
