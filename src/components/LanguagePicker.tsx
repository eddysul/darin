import { Check } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../LanguageContext";
import type { Locale } from "../i18n";
import { colors, radius } from "../theme";

type LanguagePickerProps = {
  open: boolean;
  onClose: () => void;
};

const OPTIONS: { locale: Locale; labelKey: "langPicker.english" | "langPicker.korean" }[] = [
  { locale: "en", labelKey: "langPicker.english" },
  { locale: "ko", labelKey: "langPicker.korean" },
];

export function LanguagePicker({ open, onClose }: LanguagePickerProps) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("langPicker.title")}</Text>
          {OPTIONS.map(({ locale: opt, labelKey }) => (
            <Pressable
              key={opt}
              style={[styles.option, locale === opt && styles.optionActive]}
              onPress={() => {
                setLocale(opt);
                onClose();
              }}
            >
              <Text style={[styles.optionText, locale === opt && styles.optionTextActive]}>{t(labelKey)}</Text>
              {locale === opt && <Check size={16} color={colors.gold} strokeWidth={2.5} />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  optionActive: { backgroundColor: colors.champagne },
  optionText: { fontSize: 14, fontWeight: "600", color: colors.text },
  optionTextActive: { color: colors.gold },
});
