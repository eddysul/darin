import { Image } from "expo-image";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { ScreenBackground } from "../components/ScreenBackground";
import { PressSlide } from "../components/PressSlide";
import { useLanguage } from "../LanguageContext";
import type { UserProfile } from "../types/profile";
import { DEFAULT_CAREGIVER_PROFILE } from "../context/AppContext";
import { colors, radius } from "../theme";

type Props = {
  onComplete: (profile: UserProfile) => void;
};

export function CaregiverSetupScreen({ onComplete }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<UserProfile>({ ...DEFAULT_CAREGIVER_PROFILE });

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleContinue = () => {
    if (!draft.name.trim()) return;
    onComplete({ ...draft, name: draft.name.trim(), location: draft.location.trim() });
  };

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image source={require("../../assets/darin-logo.png")} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>{t("caregiverSetup.title")}</Text>
          <Text style={styles.subtitle}>{t("caregiverSetup.subtitle")}</Text>

          <Field label={t("profile.name")} required>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(v) => set("name", v)}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("profile.location")}>
            <TextInput
              style={styles.input}
              value={draft.location}
              onChangeText={(v) => set("location", v)}
              placeholder={t("profile.locationPlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("profile.experience")}>
            <TextInput
              style={styles.input}
              value={draft.experience ?? ""}
              onChangeText={(v) => set("experience", v)}
              placeholder={t("profile.experiencePlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("onboarding.specialty")}>
            <TextInput
              style={styles.input}
              value={draft.specialty ?? ""}
              onChangeText={(v) => set("specialty", v)}
              placeholder="e.g. Newborn care, breastfeeding support"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("profile.weeklyRate")}>
            <TextInput
              style={styles.input}
              value={draft.weeklyRate ?? ""}
              onChangeText={(v) => set("weeklyRate", v)}
              placeholder={t("profile.weeklyRatePlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("profile.availability")}>
            <TextInput
              style={styles.input}
              value={draft.availability ?? ""}
              onChangeText={(v) => set("availability", v)}
              placeholder={t("profile.availabilityPlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("onboarding.languages")}>
            <TextInput
              style={styles.input}
              value={draft.languages ?? ""}
              onChangeText={(v) => set("languages", v)}
              placeholder="Korean, English"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("profile.liveIn")}>
            <ToggleRow
              options={[
                { label: t("profile.liveInYes"), value: true },
                { label: t("profile.liveInNo"), value: false },
              ]}
              value={draft.liveIn ?? false}
              onChange={(v) => set("liveIn", v)}
            />
          </Field>

          <Field label={t("profile.breastfeeding")}>
            <ToggleRow
              options={[
                { label: t("profile.breastfeedingYes"), value: true },
                { label: t("profile.breastfeedingNo"), value: false },
              ]}
              value={draft.breastfeeding ?? false}
              onChange={(v) => set("breastfeeding", v)}
            />
          </Field>

          <Field label={t("caregiverSetup.bio")}>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draft.bio ?? ""}
              onChangeText={(v) => set("bio", v)}
              placeholder={t("caregiverSetup.bioPlaceholder")}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Field>

          <PressSlide
            style={[styles.cta, !draft.name.trim() && styles.ctaDisabled]}
            onPress={handleContinue}
            disabled={!draft.name.trim()}
          >
            <Text style={styles.ctaText}>{t("caregiverSetup.cta")}</Text>
          </PressSlide>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow<T>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {options.map((opt) => (
        <PressSlide
          key={String(opt.value)}
          style={[styles.toggleBtn, opt.value === value && styles.toggleBtnActive]}
          onPress={() => onChange(opt.value)}
         
        >
          <Text style={[styles.toggleText, opt.value === value && styles.toggleTextActive]}>{opt.label}</Text>
        </PressSlide>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 28, paddingBottom: 48 },
  logo: { width: 160, height: 96, alignSelf: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
  required: { color: colors.gold },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.text,
  },
  textarea: { minHeight: 100, paddingTop: 13 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.inputBg,
  },
  toggleBtnActive: { borderColor: colors.gold, backgroundColor: colors.champagne },
  toggleText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  toggleTextActive: { color: colors.text, fontWeight: "700" },
  cta: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 15, fontWeight: "700", color: colors.text },
});
