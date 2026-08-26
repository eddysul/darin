import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import type { MemoryCriticalKey } from "../../i18nMemoriesCriticalMessages";
import { colors, radius } from "../../theme";

export type MemoryViewFilter = "all" | "family_circle" | "friend_circle" | "only_me" | "tagged" | "saved";
export type MemoryWhoFilter = "all" | "family" | string;

export const MEMORY_VIEW_FILTERS: Array<{
  key: MemoryViewFilter;
  labelKey: MemoryCriticalKey;
  descriptionKey: MemoryCriticalKey;
}> = [
  { key: "all", labelKey: "memory.critical.054", descriptionKey: "memory.critical.055" },
  { key: "family_circle", labelKey: "memory.critical.056", descriptionKey: "memory.critical.057" },
  { key: "friend_circle", labelKey: "memory.critical.058", descriptionKey: "memory.critical.059" },
  { key: "only_me", labelKey: "memory.critical.060", descriptionKey: "memory.critical.061" },
  { key: "tagged", labelKey: "memory.critical.062", descriptionKey: "memory.critical.063" },
  { key: "saved", labelKey: "memory.critical.064", descriptionKey: "memory.critical.065" },
];

export function memoryViewFilterMessageKey(value: MemoryViewFilter): MemoryCriticalKey {
  return MEMORY_VIEW_FILTERS.find((item) => item.key === value)?.labelKey ?? "memory.critical.013";
}

function OptionRow({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.option, active && styles.optionActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <View style={styles.copy}>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {active ? <BabyLogIcon kind="check" size={18} color={colors.amberText} strokeWidth={2.4} /> : null}
    </Pressable>
  );
}

export function MemoryViewFilterSheet({
  visible,
  value,
  onChange,
  whoValue,
  onChangeWho,
  babies,
  onClose,
}: {
  visible: boolean;
  value: MemoryViewFilter;
  onChange: (value: MemoryViewFilter) => void;
  whoValue: MemoryWhoFilter;
  onChangeWho: (value: MemoryWhoFilter) => void;
  babies: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const showWho = babies.length > 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("memory.critical.068")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t("memory.critical.066")}</Text>
            <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("memory.critical.067")}>
              <Text style={styles.closeText}>{t("memory.critical.067")}</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroller} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {showWho ? (
              <>
                <Text style={styles.section}>{t("memory.critical.069")}</Text>
                <OptionRow
                  label={t("memory.critical.011")}
                  description={t("memory.critical.070")}
                  active={whoValue === "all"}
                  onPress={() => {
                    onChangeWho("all");
                    onClose();
                  }}
                />
                <OptionRow
                  label={t("memory.critical.012")}
                  description={t("memory.critical.071")}
                  active={whoValue === "family"}
                  onPress={() => {
                    onChangeWho("family");
                    onClose();
                  }}
                />
                {babies.map((baby) => (
                  <OptionRow
                    key={baby.id}
                    label={baby.name}
                    description={t("memory.critical.072", { name: baby.name })}
                    active={whoValue === baby.id}
                    onPress={() => {
                      onChangeWho(baby.id);
                      onClose();
                    }}
                  />
                ))}
              </>
            ) : null}
            <Text style={[styles.section, showWho && styles.sectionSpaced]}>{t("memory.critical.073")}</Text>
            {MEMORY_VIEW_FILTERS.map((option) => (
              <OptionRow
                key={option.key}
                label={t(option.labelKey)}
                description={t(option.descriptionKey)}
                active={option.key === value}
                onPress={() => {
                  onChange(option.key);
                  onClose();
                }}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,42,38,0.32)" },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: 9, marginBottom: 5 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center" },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "800" },
  close: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  closeText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  scroller: { flexGrow: 0 },
  list: { gap: 8, paddingTop: 4, paddingBottom: 8 },
  section: { color: colors.faint, fontSize: 11, fontWeight: "800", letterSpacing: 0.2, paddingHorizontal: 4, paddingTop: 2 },
  sectionSpaced: { marginTop: 10 },
  option: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  copy: { flex: 1 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  labelActive: { color: colors.amberText },
  description: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
});
