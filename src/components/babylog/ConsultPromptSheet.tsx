import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import type { ConsultCriticalKey } from "../../i18nConsultCriticalMessages";

type Props = {
  visible: boolean;
  todayLogCount: number;
  onClose: () => void;
  onSelectQuestion: (question: string) => void;
  /** Open consult with an empty input — suggestions are optional. */
  onAskFreely: () => void;
};

const EMPTY_QUESTION_KEYS: ConsultCriticalKey[] = [
  "consult.critical.056",
  "consult.critical.057",
  "consult.critical.058",
];

const ACTIVE_QUESTION_KEYS: ConsultCriticalKey[] = [
  "consult.critical.059",
  "consult.critical.060",
  "consult.critical.061",
  "consult.critical.062",
];

export function ConsultPromptSheet({
  visible,
  todayLogCount,
  onClose,
  onSelectQuestion,
  onAskFreely,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const questions = (todayLogCount === 0 ? EMPTY_QUESTION_KEYS : ACTIVE_QUESTION_KEYS).map((key) => t(key));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{t("consult.critical.063")}</Text>
          <Text style={styles.subtitle}>
            {todayLogCount === 0
              ? t("consult.critical.064")
              : t("consult.critical.074", { count: todayLogCount })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={onAskFreely}
            accessibilityRole="button"
            accessibilityLabel={t("consult.critical.065")}
          >
            <Text style={styles.primaryBtnText}>{t("consult.critical.065")}</Text>
          </Pressable>
          <Text style={styles.exampleLabel}>{t("consult.critical.066")}</Text>
          <View style={styles.list}>
            {questions.map((q) => (
              <Pressable
                key={q}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onSelectQuestion(q)}
                accessibilityRole="button"
                accessibilityLabel={q}
              >
                <Text style={styles.rowText}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("consult.critical.013")}
          >
            <Text style={styles.closeText}>{t("consult.critical.013")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 14,
  },
  primaryBtn: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  primaryBtnPressed: { opacity: 0.88 },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: colors.primaryForeground },
  exampleLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.faint,
    marginBottom: 8,
  },
  list: { gap: 8 },
  row: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  rowText: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  closeBtn: {
    marginTop: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  closeText: { fontSize: 14, fontWeight: "700", color: colors.muted },
});
