import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BABY_LOG_CATEGORIES } from "../../constants/babyLogCategories";
import {
  CUSTOM_CATEGORY_ICON_OPTIONS,
  type CustomCategoryIconKey,
} from "../../constants/customCategoryTemplates";
import { QUICK_RECORD_ACTIONS } from "../../constants/quickRecordActions";
import type { CustomCategory, CustomCategoryInputMode } from "../../types/logCategory";
import { CUSTOM_CATEGORY_INPUT_MODES } from "../../types/logCategory";
import { colors, radius } from "../../theme";
import { CustomTemplateIcon } from "./CustomTemplateIcon";

const COLOR_OPTIONS = [
  "#E8918A",
  "#c98a54",
  "#7c83fd",
  "#e8607a",
  "#f0a93c",
  "#4ec9b0",
  "#5b8dee",
  "#69AFA0",
  "#9096a6",
];

const MAX_LABEL_LENGTH = 20;
const ICON_COLUMNS = 3;
const DEFAULT_ICON_KEY: CustomCategoryIconKey = CUSTOM_CATEGORY_ICON_OPTIONS[0]?.iconKey ?? "play";

type Props = {
  visible: boolean;
  existingCategories: CustomCategory[];
  onClose: () => void;
  onSave: (input: {
    label: string;
    color: string;
    iconKey?: CustomCategoryIconKey;
    inputMode: CustomCategoryInputMode;
  }) => void;
};

export function AddCustomCategorySheet({
  visible,
  existingCategories,
  onClose,
  onSave,
}: Props) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [iconKey, setIconKey] = useState<CustomCategoryIconKey>(DEFAULT_ICON_KEY);
  const [inputMode, setInputMode] = useState<CustomCategoryInputMode>("memo");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setLabel("");
    setColor(COLOR_OPTIONS[0]);
    setIconKey(DEFAULT_ICON_KEY);
    setInputMode("memo");
    setError("");
  }, [visible]);

  const reservedNames = useMemo(() => {
    const names = new Set<string>();
    for (const item of BABY_LOG_CATEGORIES) names.add(item.label.trim().toLowerCase());
    for (const item of QUICK_RECORD_ACTIONS) names.add(item.label.trim().toLowerCase());
    for (const item of existingCategories) names.add(item.label.trim().toLowerCase());
    return names;
  }, [existingCategories]);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("카테고리 이름을 입력해 주세요.");
      return;
    }
    if (reservedNames.has(trimmed.toLowerCase())) {
      setError("이미 있는 카테고리예요.");
      return;
    }
    onSave({
      label: trimmed.slice(0, MAX_LABEL_LENGTH),
      color,
      iconKey,
      inputMode,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>기록 카테고리 추가</Text>
          <Text style={styles.subtitle}>새 기록에 사용할 이름, 아이콘, 색상, 기록 방식을 정해 주세요.</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>카테고리 이름</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={(value) => {
                setLabel(value.slice(0, MAX_LABEL_LENGTH));
                setError("");
              }}
              placeholder="예: 산책, 마사지, 병원 전화"
              placeholderTextColor={colors.faint}
              maxLength={MAX_LABEL_LENGTH}
              autoFocus
            />

            <Text style={styles.fieldLabel}>아이콘</Text>
            <View style={styles.iconGrid}>
              {CUSTOM_CATEGORY_ICON_OPTIONS.map((option) => {
                const active = iconKey === option.iconKey;
                return (
                  <Pressable
                    key={option.iconKey}
                    style={[styles.iconChip, active && styles.iconChipActive]}
                    onPress={() => setIconKey(option.iconKey)}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} 아이콘`}
                  >
                    <CustomTemplateIcon iconKey={option.iconKey} size={20} color={active ? color : option.color} />
                    <Text style={styles.iconChipText} numberOfLines={2}>{option.label}</Text>
                  </Pressable>
                );
              })}
              {Array.from({
                length: (ICON_COLUMNS - (CUSTOM_CATEGORY_ICON_OPTIONS.length % ICON_COLUMNS)) % ICON_COLUMNS,
              }).map((_, index) => (
                <View key={`spacer-${index}`} style={styles.iconChipSpacer} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>색상</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((option) => {
                const active = color === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.colorDot, { backgroundColor: option }, active && styles.colorDotActive]}
                    onPress={() => setColor(option)}
                    accessibilityRole="button"
                    accessibilityLabel={`색상 ${option}`}
                  />
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>기록 방식</Text>
            <View style={styles.modeList}>
              {CUSTOM_CATEGORY_INPUT_MODES.map((mode) => {
                const active = inputMode === mode.id;
                return (
                  <Pressable
                    key={mode.id}
                    style={[styles.modeCard, active && styles.modeCardActive]}
                    onPress={() => setInputMode(mode.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${mode.label}, ${mode.hint}`}
                  >
                    <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{mode.label}</Text>
                    <Text style={[styles.modeHint, active && styles.modeHintActive]}>{mode.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
              <Text style={styles.btnPrimaryText}>저장</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(30,26,23,0.48)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: "86%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    alignSelf: "center",
    marginVertical: 10,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 12.5, color: colors.faint, marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: colors.faint, fontWeight: "700", marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginBottom: 16,
  },
  iconChip: {
    width: "31.5%",
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  iconChipSpacer: {
    width: "31.5%",
    minHeight: 72,
  },
  iconChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  iconChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  colorDot: { width: 44, height: 44, borderRadius: 22 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  modeList: { gap: 8, marginBottom: 12 },
  modeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeCardActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  modeLabel: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 3 },
  modeLabelActive: { color: colors.amberText },
  modeHint: { fontSize: 12, color: colors.faint, fontWeight: "600" },
  modeHintActive: { color: colors.muted },
  error: {
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14.5 },
});
