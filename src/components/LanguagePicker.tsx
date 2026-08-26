import { Check } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
import { useAppSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../LanguageContext";
import { canShowLanguagePicker } from "../config/featureFlags";
import { getVisibleAppLanguageOptions, type AppLanguagePreference } from "../types/profilePreferences";
import { colors, radius } from "../theme";

type LanguagePickerProps = {
  open: boolean;
  onClose: () => void;
};

export function LanguagePicker({ open, onClose }: LanguagePickerProps) {
  const { t } = useLanguage();
  const { settings, setSettings } = useAppSettings();
  if (!canShowLanguagePicker()) return null;
  const options = getVisibleAppLanguageOptions();
  const selected = settings.account.language;

  const choose = (value: AppLanguagePreference) => {
    setSettings((current) => current.account.language === value
      ? current
      : { ...current, account: { ...current.account, language: value } });
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("settings.critical.324")}</Text>
          {options.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.option, selected === option.value && styles.optionActive]}
              onPress={() => choose(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === option.value }}
            >
              <Text style={[styles.optionText, selected === option.value && styles.optionTextActive]}>
                {option.value === "system" ? t("profileSetup.language.system") : option.label}
              </Text>
              {selected === option.value ? <Check size={16} color={colors.yellow} strokeWidth={2.5} /> : null}
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
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  optionActive: { backgroundColor: colors.yellowSoft },
  optionText: { fontSize: 14, fontWeight: "600", color: colors.text },
  optionTextActive: { color: colors.text },
});
