import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { CustomTemplateIcon } from "./CustomTemplateIcon";
import type { CustomCategoryTemplate } from "../../constants/customCategoryTemplates";
import type { CustomCategory } from "../../types/logCategory";
import { colors, radius } from "../../theme";

export type CategorySetupDraft =
  | { mode: "template"; template: CustomCategoryTemplate }
  | { mode: "custom" };

type Props = {
  visible: boolean;
  draft: CategorySetupDraft | null;
  existingCategories: CustomCategory[];
  onClose: () => void;
  onBack: () => void;
  onSave: (payload: { label: string; template?: CustomCategoryTemplate }) => void;
};

export function CategorySetupSheet({
  visible,
  draft,
  existingCategories,
  onClose,
  onBack,
  onSave,
}: Props) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!visible || !draft) return;
    setLabel(draft.mode === "template" ? draft.template.label : "");
  }, [visible, draft]);

  if (!draft) return null;

  const isTemplate = draft.mode === "template";
  const template = isTemplate ? draft.template : null;
  const alreadyExists =
    isTemplate && template
      ? existingCategories.some((c) => c.templateId === template.templateId)
      : false;

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed || alreadyExists) return;
    onSave(isTemplate && template ? { label: trimmed, template } : { label: trimmed });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <BabyLogIcon kind="chevron" size={16} color={colors.faint} strokeWidth={2.2} />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>

          <Text style={styles.title}>{isTemplate ? "기록 카테고리 설정" : "나만의 기록 만들기"}</Text>
          <Text style={styles.subtitle}>
            {isTemplate
              ? "이름을 확인하고 기록 그리드에 추가해 주세요"
              : "원하는 이름으로 새 기록 카테고리를 만들어 보세요"}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.previewCard}>
              <View
                style={[
                  styles.previewIcon,
                  { backgroundColor: `${(template?.color ?? colors.faint)}22` },
                ]}
              >
                <CustomTemplateIcon
                  templateId={template?.templateId}
                  size={26}
                  color={template?.color ?? colors.muted}
                />
              </View>
              <Text style={styles.previewHint}>
                {isTemplate ? "추천 템플릿" : "사용자 정의"}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>카테고리 이름</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="기록 이름을 입력하세요"
              placeholderTextColor={colors.faint}
              editable={!alreadyExists}
            />

            {isTemplate && template?.chips && template.chips.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>빠른 선택 옵션</Text>
                <View style={styles.chipRow}>
                  {template.chips.map((chip) => (
                    <View key={chip} style={styles.chip}>
                      <Text style={styles.chipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {isTemplate && (template?.duration || template?.amount) && (
              <View style={styles.metaBox}>
                {template?.duration && <Text style={styles.metaText}>· 지속 시간 기록 가능</Text>}
                {template?.amount && (
                  <Text style={styles.metaText}>· 수치 입력 ({template.amount})</Text>
                )}
              </View>
            )}

            {alreadyExists && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>이미 기록 그리드에 추가된 카테고리예요.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                (!label.trim() || alreadyExists) && styles.btnDisabled,
              ]}
              disabled={!label.trim() || alreadyExists}
              onPress={handleSave}
            >
              <Text style={styles.btnPrimaryText}>그리드에 추가</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: "82%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    alignSelf: "center",
    marginVertical: 10,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 8 },
  backText: { fontSize: 13, color: colors.faint, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 12.5, color: colors.faint, marginBottom: 16 },
  previewCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    marginBottom: 16,
    gap: 8,
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHint: { fontSize: 12, color: colors.faint, fontWeight: "600" },
  fieldLabel: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12.5, color: colors.muted, fontWeight: "600" },
  metaBox: {
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    marginBottom: 12,
  },
  metaText: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  warnBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  warnText: { fontSize: 12.5, color: colors.dangerText, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
  btnDisabled: { opacity: 0.45 },
});
