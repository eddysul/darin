import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";

type EmptyProps = {
  title: string;
  body?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
};

export function EmptyState({ title, body, ctaLabel, onPressCta }: EmptyProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onPressCta ? (
        <Pressable style={styles.cta} onPress={onPressCta}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ErrorProps = {
  title?: string;
  body?: string;
  retryLabel?: string;
  onRetry?: () => void;
  busy?: boolean;
};

export function ErrorState({
  title,
  body,
  retryLabel,
  onRetry,
  busy,
}: ErrorProps) {
  const { t } = useLanguage();
  return (
    <View style={[styles.box, styles.errorBox]}>
      <Text style={styles.title}>{title ?? t("chrome.critical.004")}</Text>
      <Text style={styles.body}>{body ?? t("chrome.critical.005")}</Text>
      {onRetry ? (
        <Pressable style={[styles.cta, busy && styles.disabled]} onPress={onRetry} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? t("chrome.critical.006") : retryLabel ?? t("chrome.critical.002")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type LoadingProps = {
  label?: string;
};

export function LoadingState({ label }: LoadingProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.amberText} />
      <Text style={[styles.body, { marginTop: 10 }]}>{label ?? t("chrome.critical.003")}</Text>
    </View>
  );
}

type ErrorBannerProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

export function ErrorBanner({ message, actionLabel, onAction, onDismiss }: ErrorBannerProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.bannerText}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.bannerAction} onPress={onAction}>
          <Text style={styles.bannerActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable hitSlop={10} onPress={onDismiss} accessibilityLabel={t("chrome.critical.013")}>
          <Text style={styles.bannerClose}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBox: { backgroundColor: "#FFF8F3", borderColor: "rgba(232,145,138,0.35)" },
  title: { fontSize: 14, fontWeight: "800", color: colors.text, textAlign: "center" },
  body: {
    marginTop: 8,
    fontSize: 13,
    color: colors.faint,
    textAlign: "center",
    lineHeight: 19,
  },
  cta: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF1ED",
    borderWidth: 1,
    borderColor: "rgba(190,70,55,0.28)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: { flex: 1, color: "#8A3429", fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  bannerAction: { paddingHorizontal: 8, paddingVertical: 5 },
  bannerActionText: { color: "#8A3429", fontSize: 12, fontWeight: "800" },
  bannerClose: { color: "#9B625B", fontSize: 14, fontWeight: "700" },
});
