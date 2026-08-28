import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "../../components/ScreenBackground";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";

type Props = {
  children: ReactNode;
  /** Visible progress among the 3 user-facing steps (1–3). Hide when undefined. */
  progressStep?: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  footerHint?: string;
  /** Tighter header spacing so login fits one screen without scroll. */
  compact?: boolean;
  /** Disable idle-page scrolling when compact content already fits the viewport. */
  scrollEnabled?: boolean;
  /** Center only short, non-scrolling content. Long forms must start at the top. */
  centerContent?: boolean;
};

export function OnboardingShell({
  children,
  progressStep,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  footerHint,
  compact = false,
  scrollEnabled = true,
  centerContent = compact && !scrollEnabled,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const topPad = compact ? 4 : Math.max(insets.top, 20) + 16;
  const bottomPad = compact ? 8 : Math.max(insets.bottom, 12) + 24;
  const compactOffset = height <= 820 ? -8 : height >= 900 ? -22 : -16;

  return (
    <ScreenBackground style={styles.root}>
      <SafeAreaView style={styles.root} edges={compact ? ["top", "bottom"] : []}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              compact && styles.scrollCompact,
              centerContent && styles.scrollCentered,
              {
                paddingTop: topPad,
                paddingBottom: bottomPad,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
            bounces={scrollEnabled && !compact}
            alwaysBounceVertical={scrollEnabled && !compact}
            overScrollMode="never"
          >
            <View
              style={[
                styles.content,
                compact && styles.contentCompact,
                centerContent && { transform: [{ translateY: compactOffset }] },
              ]}
            >
              <Image
                source={require("../../../assets/darin-logo.png")}
                style={[styles.logo, compact && styles.logoCompact]}
                contentFit="contain"
              />
              {progressStep ? (
                <Text style={styles.stepPill}>{t("onboarding.stepOfThree", { step: progressStep })}</Text>
              ) : compact ? null : (
                <View style={styles.stepSpacer} />
              )}
              <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
              ) : null}

              <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>

              {footerHint ? <Text style={styles.footerHint}>{footerHint}</Text> : null}

              {primaryLabel && onPrimary ? (
                <Pressable
                  style={[styles.cta, primaryDisabled && styles.ctaDisabled]}
                  onPress={onPrimary}
                  disabled={primaryDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                >
                  <Text style={styles.ctaText}>{primaryLabel}</Text>
                </Pressable>
              ) : null}

              {secondaryLabel && onSecondary ? (
                <Pressable style={styles.secondaryBtn} onPress={onSecondary}>
                  <Text style={styles.secondaryText}>{secondaryLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

export function OnboardingField({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
        {optional ? <Text style={styles.optional}>{t("common.optional")}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function OnboardingOptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionWrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.optionBtn, active && styles.optionBtnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const onboardingInputStyle = {
  backgroundColor: colors.inputBg,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  color: colors.text,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  scrollCompact: {
    alignItems: "center",
  },
  scrollCentered: { justifyContent: "center" },
  content: {
    width: "100%",
  },
  contentCompact: {
    maxWidth: 360,
    width: "100%",
  },
  logo: {
    width: 148,
    height: 110,
    alignSelf: "center",
    marginBottom: 20,
  },
  logoCompact: {
    width: 80,
    height: 60,
    marginBottom: 8,
  },
  stepPill: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "800",
    color: colors.amberText,
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: 12,
    overflow: "hidden",
  },
  stepSpacer: { height: 8, marginBottom: 4 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 28,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 22,
  },
  subtitleCompact: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 18,
  },
  body: { gap: 4, marginBottom: 8 },
  bodyCompact: { marginBottom: 0, gap: 0 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  required: { color: colors.amberText },
  optional: { color: colors.faint, fontWeight: "500" },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  optionBtnActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionText: { flexShrink: 1, textAlign: "center", lineHeight: 18, fontSize: 13, color: colors.muted, fontWeight: "600" },
  optionTextActive: { color: colors.text, fontWeight: "800" },
  footerHint: {
    fontSize: 12,
    color: colors.faint,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 18,
  },
  cta: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { flexShrink: 1, textAlign: "center", lineHeight: 22, fontSize: 16, fontWeight: "800", color: colors.primaryForeground },
  secondaryBtn: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  secondaryText: { flexShrink: 1, textAlign: "center", lineHeight: 20, fontSize: 14, fontWeight: "700", color: colors.muted },
});
