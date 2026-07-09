import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { CustomTemplateIcon } from "./CustomTemplateIcon";
import { BottomSheet } from "./sheets/BottomSheet";
import { sheetStyles } from "./sheets/sheetStyles";
import {
  RECOMMENDED_CUSTOM_TEMPLATES,
  type CustomCategoryTemplate,
} from "../../constants/customCategoryTemplates";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: CustomCategoryTemplate) => void;
  onCustomPress: () => void;
};

export function NewCategorySheet({ visible, onClose, onSelectTemplate, onCustomPress }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="compact">
      <Text style={sheetStyles.title}>새 기록 추가</Text>
      <Text style={sheetStyles.subtitle}>추천 템플릿을 고르거나 나만의 기록을 만들어 보세요</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {RECOMMENDED_CUSTOM_TEMPLATES.map((template) => (
            <Pressable
              key={template.templateId}
              style={styles.cell}
              onPress={() => onSelectTemplate(template)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${template.color}22` }]}>
                <CustomTemplateIcon templateId={template.templateId} size={22} color={template.color} />
              </View>
              <Text style={styles.cellLabel} numberOfLines={1}>
                {template.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.createBtn} onPress={onCustomPress}>
          <BabyLogIcon kind="new" size={18} color={colors.amber} />
          <Text style={styles.createBtnText}>나만의 기록 만들기</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  cell: {
    width: "30%",
    flexGrow: 1,
    flexBasis: "28%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 8,
    shadowColor: "#2E2A26",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cellLabel: { fontSize: 11, color: colors.muted, fontWeight: "600", textAlign: "center" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingVertical: 14,
  },
  createBtnText: { fontSize: 14, fontWeight: "700", color: colors.amber },
});
