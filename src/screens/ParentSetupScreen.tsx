import { Image } from "expo-image";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState, type ReactNode } from "react";
import { ScreenBackground } from "../components/ScreenBackground";
import { PressSlide } from "../components/PressSlide";
import { useLanguage } from "../LanguageContext";
import {
  ALL_LOG_CATEGORY_GROUPS,
  DEFAULT_CARE_SETUP,
  type CareSetup,
  type ChildStatus,
  type DefaultFeedingMethod,
  type LogCategoryGroup,
  type PostpartumStatus,
  type PreferredLanguage,
  type RelationshipToChild,
} from "../types/careSetup";
import { colors, radius } from "../theme";

type Props = {
  onComplete: (setup: CareSetup) => void;
};

type Step = 0 | 1 | 2;

export function ParentSetupScreen({ onComplete }: Props) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(0);
  const [setup, setSetup] = useState<CareSetup>(DEFAULT_CARE_SETUP);

  const setParent = <K extends keyof CareSetup["parent"]>(key: K, value: CareSetup["parent"][K]) =>
    setSetup((s) => ({ ...s, parent: { ...s.parent, [key]: value } }));

  const setChild = <K extends keyof CareSetup["child"]>(key: K, value: CareSetup["child"][K]) =>
    setSetup((s) => ({ ...s, child: { ...s.child, [key]: value } }));

  const setPref = <K extends keyof CareSetup["preferences"]>(key: K, value: CareSetup["preferences"][K]) =>
    setSetup((s) => ({ ...s, preferences: { ...s.preferences, [key]: value } }));

  const toggleCategory = (group: LogCategoryGroup) => {
    const current = setup.preferences.enabledLogCategories;
    const next = current.includes(group) ? current.filter((g) => g !== group) : [...current, group];
    setPref("enabledLogCategories", next.length ? next : [group]);
  };

  const canNext =
    step === 0
      ? setup.parent.parentName.trim().length > 0
      : step === 1
        ? setup.child.childName.trim().length > 0
        : true;

  const handleNext = () => {
    if (!canNext) return;
    if (step < 2) setStep((s) => (s + 1) as Step);
    else onComplete(setup);
  };

  const stepTitles = [t("setup.stepYou"), t("setup.stepBaby"), t("setup.stepCare")];

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image source={require("../../assets/darin-logo.png")} style={styles.logo} contentFit="contain" />
          <Text style={styles.stepPill}>
            {t("setup.stepOf").replace("{current}", String(step + 1)).replace("{total}", "3")}
          </Text>
          <Text style={styles.title}>{stepTitles[step]}</Text>
          <Text style={styles.subtitle}>{t("setup.subtitle")}</Text>

          {step === 0 && (
            <>
              <Field label={t("setup.parentName")} required>
                <TextInput
                  style={styles.input}
                  value={setup.parent.parentName}
                  onChangeText={(v) => setParent("parentName", v)}
                  placeholder={t("setup.parentNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
              </Field>

              <Field label={t("setup.relationship")}>
                <OptionRow
                  options={[
                    { value: "mom", label: t("setup.relMom") },
                    { value: "dad", label: t("setup.relDad") },
                    { value: "guardian", label: t("setup.relGuardian") },
                    { value: "family", label: t("setup.relFamily") },
                  ]}
                  value={setup.parent.relationshipToChild}
                  onChange={(v) => setParent("relationshipToChild", v as RelationshipToChild)}
                />
              </Field>

              <Field label={t("setup.postpartumStatus")}>
                <OptionRow
                  options={[
                    { value: "pregnant", label: t("setup.statusPregnant") },
                    { value: "expecting", label: t("setup.statusExpecting") },
                    { value: "postpartum", label: t("setup.statusPostpartum") },
                    { value: "not_applicable", label: t("setup.statusNA") },
                  ]}
                  value={setup.parent.postpartumStatus}
                  onChange={(v) => setParent("postpartumStatus", v as PostpartumStatus)}
                />
              </Field>

              <Field label={t("setup.birthRecoveryNote")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={setup.parent.birthRecoveryNote ?? ""}
                  onChangeText={(v) => setParent("birthRecoveryNote", v || undefined)}
                  placeholder={t("setup.birthRecoveryPlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <SkipLink label={t("setup.skipForNow")} onPress={() => setParent("birthRecoveryNote", undefined)} />
              </Field>

              <Field label={t("setup.preferredLanguage")}>
                <OptionRow
                  options={[
                    { value: "ko", label: t("setup.langKo") },
                    { value: "en", label: t("setup.langEn") },
                  ]}
                  value={setup.parent.preferredLanguage}
                  onChange={(v) => setParent("preferredLanguage", v as PreferredLanguage)}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label={t("setup.childName")} required>
                <TextInput
                  style={styles.input}
                  value={setup.child.childName}
                  onChangeText={(v) => setChild("childName", v)}
                  placeholder={t("setup.childNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
              </Field>

              <Field label={t("setup.childStatus")}>
                <OptionRow
                  options={[
                    { value: "unborn", label: t("setup.childUnborn") },
                    { value: "newborn", label: t("setup.childNewborn") },
                    { value: "infant", label: t("setup.childInfant") },
                  ]}
                  value={setup.child.childStatus}
                  onChange={(v) => setChild("childStatus", v as ChildStatus)}
                />
              </Field>

              <Field label={t("setup.birthDate")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={styles.input}
                  value={setup.child.birthDate ?? ""}
                  onChangeText={(v) => setChild("birthDate", v || undefined)}
                  placeholder={t("setup.birthDatePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
              </Field>

              <Field label={t("setup.dueDate")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={styles.input}
                  value={setup.child.dueDate ?? ""}
                  onChangeText={(v) => setChild("dueDate", v || undefined)}
                  placeholder={t("setup.dueDatePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
              </Field>

              <Field label={t("setup.gestationalWeeks")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={styles.input}
                  value={setup.child.gestationalAgeWeeks?.toString() ?? ""}
                  onChangeText={(v) => setChild("gestationalAgeWeeks", v ? parseInt(v, 10) || undefined : undefined)}
                  keyboardType="numeric"
                  placeholder={t("setup.gestationalWeeksPlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <SkipLink label={t("setup.skipForNow")} onPress={() => setChild("gestationalAgeWeeks", undefined)} />
              </Field>

              <Field label={t("setup.birthWeight")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={styles.input}
                  value={setup.child.birthWeight ?? ""}
                  onChangeText={(v) => setChild("birthWeight", v || undefined)}
                  placeholder={t("setup.birthWeightPlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <SkipLink label={t("setup.skipForNow")} onPress={() => setChild("birthWeight", undefined)} />
              </Field>

              <Field label={t("setup.specialNotes")} optionalLabel={t("setup.optional")}>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={setup.child.specialNotes ?? ""}
                  onChangeText={(v) => setChild("specialNotes", v || undefined)}
                  placeholder={t("setup.specialNotesPlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <SkipLink label={t("setup.skipForNow")} onPress={() => setChild("specialNotes", undefined)} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label={t("setup.defaultFeeding")}>
                <OptionRow
                  options={[
                    { value: "breastfeeding", label: t("setup.feedBreast") },
                    { value: "formula", label: t("setup.feedFormula") },
                    { value: "mixed", label: t("setup.feedMixed") },
                    { value: "pumped_milk", label: t("setup.feedPumped") },
                    { value: "not_sure", label: t("setup.feedNotSure") },
                  ]}
                  value={setup.preferences.defaultFeedingMethod}
                  onChange={(v) => setPref("defaultFeedingMethod", v as DefaultFeedingMethod)}
                />
              </Field>

              <Field label={t("setup.enabledCategories")}>
                <View style={styles.wrapChips}>
                  {ALL_LOG_CATEGORY_GROUPS.map((group) => {
                    const active = setup.preferences.enabledLogCategories.includes(group);
                    return (
                      <Pressable
                        key={group}
                        style={[styles.catChip, active && styles.catChipActive]}
                        onPress={() => toggleCategory(group)}
                      >
                        <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                          {t(`setup.cat.${group}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t("setup.familySharing")}</Text>
                  <Text style={styles.switchHint}>{t("setup.familySharingHint")}</Text>
                </View>
                <Switch
                  value={setup.preferences.familySharingEnabled}
                  onValueChange={(v) => setPref("familySharingEnabled", v)}
                  trackColor={{ false: colors.border, true: colors.amber }}
                />
              </View>
            </>
          )}

          <View style={styles.navRow}>
            {step > 0 ? (
              <Pressable style={styles.backBtn} onPress={() => setStep((s) => (s - 1) as Step)}>
                <Text style={styles.backBtnText}>{t("setup.back")}</Text>
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            <PressSlide
              style={[styles.cta, !canNext && styles.ctaDisabled, { flex: 1 }]}
              onPress={handleNext}
              disabled={!canNext}
            >
              <Text style={styles.ctaText}>{step === 2 ? t("parentSetup.cta") : t("setup.next")}</Text>
            </PressSlide>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function Field({
  label,
  required,
  optionalLabel,
  children,
}: {
  label: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
        {optionalLabel && <Text style={styles.optional}> ({optionalLabel})</Text>}
      </Text>
      {children}
    </View>
  );
}

function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.optionWrap}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.optionBtn, opt.value === value && styles.optionBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, opt.value === value && styles.optionTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SkipLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.skip}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 28, paddingBottom: 48 },
  logo: { width: 180, height: 135, alignSelf: "center", marginBottom: 16 },
  stepPill: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.amber,
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 10,
    overflow: "hidden",
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 24, textAlign: "center" },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
  required: { color: colors.yellow },
  optional: { color: colors.faint, fontWeight: "500" },
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
  textarea: { minHeight: 88, textAlignVertical: "top" },
  skip: { fontSize: 12, color: colors.faint, marginTop: 6, fontWeight: "600" },
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
  optionTextActive: { color: colors.text, fontWeight: "700" },
  wrapChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  catChipText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  catChipTextActive: { color: colors.amberDark },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    paddingVertical: 8,
  },
  switchHint: { fontSize: 11.5, color: colors.faint, marginTop: 2, lineHeight: 16 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "center" },
  backBtn: { paddingVertical: 15, paddingHorizontal: 8, minWidth: 64 },
  backBtnText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 15, fontWeight: "700", color: colors.primaryForeground },
});
