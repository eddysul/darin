import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BABY_LOG_CATEGORIES, PREGNANCY_LOG_CATEGORIES } from "../../constants/babyLogCategories";
import {
  CUSTOM_CATEGORY_ICON_OPTIONS,
  PREGNANCY_CATEGORY_SUGGESTIONS,
  customCategoryIconOptionsForStage,
  type CustomCategoryIconKey,
} from "../../constants/customCategoryTemplates";
import { PREGNANCY_QUICK_RECORD_ACTIONS, QUICK_RECORD_ACTIONS } from "../../constants/quickRecordActions";
import type { CustomCategory, CustomCategoryInputMode } from "../../types/logCategory";
import { CUSTOM_CATEGORY_INPUT_MODES } from "../../types/logCategory";
import { colors, radius } from "../../theme";
import { CustomTemplateIcon } from "./CustomTemplateIcon";
import { useLanguage } from "../../LanguageContext";
import {
  customIconLabel,
  customModeHint,
  customModeLabel,
  customSuggestionLabel,
  recordCategoryLabel,
} from "../../utils/recordDisplay";

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
  pregnancy?: boolean;
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
  pregnancy = false,
  onClose,
  onSave,
}: Props) {
  const { t } = useLanguage();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [iconKey, setIconKey] = useState<CustomCategoryIconKey>(DEFAULT_ICON_KEY);
  const [inputMode, setInputMode] = useState<CustomCategoryInputMode>("memo");
  const [error, setError] = useState("");

  const iconOptions = useMemo(() => customCategoryIconOptionsForStage(pregnancy), [pregnancy]);
  const defaultIconKey = iconOptions[0]?.iconKey ?? DEFAULT_ICON_KEY;

  useEffect(() => {
    if (!visible) return;
    setLabel("");
    setColor(COLOR_OPTIONS[0]);
    setIconKey(defaultIconKey);
    setInputMode("memo");
    setError("");
  }, [defaultIconKey, visible]);

  const reservedNames = useMemo(() => {
    const names = new Set<string>();
    const builtIn = pregnancy ? PREGNANCY_LOG_CATEGORIES : BABY_LOG_CATEGORIES;
    const actions = pregnancy ? PREGNANCY_QUICK_RECORD_ACTIONS : QUICK_RECORD_ACTIONS;
    for (const item of builtIn) {
      names.add(item.label.trim().toLowerCase());
      names.add(recordCategoryLabel(t, item.id).trim().toLowerCase());
    }
    for (const item of actions) {
      names.add(item.label.trim().toLowerCase());
      names.add(recordCategoryLabel(t, item.cat).trim().toLowerCase());
    }
    for (const item of existingCategories) names.add(item.label.trim().toLowerCase());
    return names;
  }, [existingCategories, pregnancy, t]);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError(t("record.custom.nameRequired"));
      return;
    }
    if (reservedNames.has(trimmed.toLowerCase())) {
      setError(t("record.custom.duplicate"));
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
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t(pregnancy ? "record.custom.pregnancyTitle" : "record.custom.title")}</Text>
          <Text style={styles.subtitle}>
            {pregnancy
              ? t("record.custom.pregnancyBody")
              : t("record.custom.body")}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {pregnancy ? (
              <>
                <Text style={styles.fieldLabel}>{t("record.custom.recommended")}</Text>
                <View style={styles.suggestRow}>
                  {PREGNANCY_CATEGORY_SUGGESTIONS.map((suggestion) => {
                    const displayLabel = customSuggestionLabel(t, suggestion.iconKey, suggestion.label);
                    const active = label === displayLabel && iconKey === suggestion.iconKey;
                    return (
                      <Pressable
                        key={suggestion.label}
                        style={[styles.suggestChip, active && styles.suggestChipActive]}
                        onPress={() => {
                          setLabel(displayLabel);
                          setIconKey(suggestion.iconKey);
                          setInputMode(suggestion.inputMode);
                          setError("");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("record.custom.applySuggestion", { label: displayLabel })}
                      >
                        <Text style={[styles.suggestChipText, active && styles.suggestChipTextActive]}>
                          {displayLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>{t("record.custom.name")}</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={(value) => {
                setLabel(value.slice(0, MAX_LABEL_LENGTH));
                setError("");
              }}
              placeholder={t(pregnancy ? "record.custom.pregnancyPlaceholder" : "record.custom.placeholder")}
              placeholderTextColor={colors.faint}
              maxLength={MAX_LABEL_LENGTH}
              autoFocus
            />

            <Text style={styles.fieldLabel}>{t("record.custom.icon")}</Text>
            <View style={styles.iconGrid}>
              {iconOptions.map((option) => {
                const active = iconKey === option.iconKey;
                const displayLabel = customIconLabel(t, option.iconKey, option.label);
                return (
                  <Pressable
                    key={option.iconKey}
                    style={[styles.iconChip, active && styles.iconChipActive]}
                    onPress={() => setIconKey(option.iconKey)}
                    accessibilityRole="button"
                    accessibilityLabel={t("record.custom.iconA11y", { label: displayLabel })}
                  >
                    <CustomTemplateIcon iconKey={option.iconKey} size={20} color={active ? color : option.color} />
                    <Text style={styles.iconChipText} numberOfLines={2}>{displayLabel}</Text>
                  </Pressable>
                );
              })}
              {Array.from({
                length: (ICON_COLUMNS - (iconOptions.length % ICON_COLUMNS)) % ICON_COLUMNS,
              }).map((_, index) => (
                <View key={`spacer-${index}`} style={styles.iconChipSpacer} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t("record.custom.color")}</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((option) => {
                const active = color === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.colorDot, { backgroundColor: option }, active && styles.colorDotActive]}
                    onPress={() => setColor(option)}
                    accessibilityRole="button"
                    accessibilityLabel={t("record.custom.colorA11y", { color: option })}
                  />
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>{t("record.custom.method")}</Text>
            <View style={styles.modeList}>
              {CUSTOM_CATEGORY_INPUT_MODES.map((mode) => {
                const active = inputMode === mode.id;
                const displayLabel = customModeLabel(t, mode.id, mode.label);
                const displayHint = customModeHint(t, mode.id, mode.hint);
                return (
                  <Pressable
                    key={mode.id}
                    style={[styles.modeCard, active && styles.modeCardActive]}
                    onPress={() => setInputMode(mode.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${displayLabel}, ${displayHint}`}
                  >
                    <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{displayLabel}</Text>
                    <Text style={[styles.modeHint, active && styles.modeHintActive]}>{displayHint}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>{t("record.custom.cancel")}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
              <Text style={styles.btnPrimaryText}>{t("record.custom.save")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  suggestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  suggestChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  suggestChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  suggestChipTextActive: { color: colors.amberText },
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
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 14.5 },
});
