import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { colors } from "../../theme";

type Props = {
  visible: boolean;
  title?: string;
  body?: string;
  onPress: () => void;
  onDismiss: () => void;
};

export function PushToast({
  visible,
  title,
  body,
  onPress,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("diary.reminder.previewTitle");
  const resolvedBody = body ?? t("diary.reminder.previewBody", { babyName: t("diary.reminder.babyFallback") });
  const cta = t("chrome.critical.011");

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable
      style={[styles.toast, { top: insets.top + 8 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${resolvedTitle}. ${resolvedBody}. ${cta}`}
    >
      <BabyLogIcon kind="bell" size={20} color={colors.accentOnDark} />
      <View style={styles.body}>
        <Text style={styles.title}>{resolvedTitle}</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {resolvedBody}
        </Text>
        <Text style={styles.cta}>{cta} →</Text>
      </View>
      <Pressable
        style={styles.close}
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("chrome.critical.012")}
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 60,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(30,32,42,0.96)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  sub: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3, lineHeight: 17 },
  cta: { fontSize: 11, fontWeight: "700", color: colors.accentOnDark, marginTop: 6 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: -2, marginRight: -4 },
  closeText: { color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: "700" },
});
