import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "../../components/ScreenBackground";
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
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 20) + 16;

  return (
    <ScreenBackground style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: topPad,
              paddingBottom: Math.max(insets.bottom, 12) + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("../../../assets/darin-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
          {progressStep ? (
            <Text style={styles.stepPill}>{progressStep} / 3 단계</Text>
          ) : (
            <View style={styles.stepSpacer} />
          )}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.body}>{children}</View>

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
        </ScrollView>
      </KeyboardAvoidingView>
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
        {optional ? <Text style={styles.optional}> (선택)</Text> : null}
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
  logo: {
    width: 148,
    height: 110,
    alignSelf: "center",
    marginBottom: 20,
  },
  stepPill: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "800",
    color: colors.amber,
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
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 22,
  },
  body: { gap: 4, marginBottom: 8 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  required: { color: colors.amber },
  optional: { color: colors.faint, fontWeight: "500" },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  optionBtnActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
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
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.primaryForeground },
  secondaryBtn: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  secondaryText: { fontSize: 14, fontWeight: "700", color: colors.muted },
});
