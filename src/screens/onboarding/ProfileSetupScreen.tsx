import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RelationshipLabel } from "../../types/growthBook";
import { PROFILE_RELATION_OPTIONS } from "../../types/profileSettings";
import type { PickedAvatar } from "../../utils/profileAvatarPicker";
import { presentAvatarPicker } from "../../utils/profileAvatarPicker";
import { ProfileAvatar } from "../../components/profile/ProfileAvatar";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { RecordDatePickerModal } from "../../components/babylog/RecordDatePickerModal";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import {
  createDarinIdentity,
  DarinIdentityRepository,
  generateDarinTag,
  validateDarinNicknameCode,
} from "../../repositories/DarinIdentityRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import type { RelationshipToChild } from "../../types/careSetup";
import { colors, radius } from "../../theme";
import { canSubmitUserProfile } from "../../utils/profileCompletion";
import { formatDateKey } from "../../utils/dateKey";
import {
  getVisibleAppLanguageOptions,
  RESIDENCE_COUNTRY_OPTIONS,
  resolveAppLocale,
  type AppLanguagePreference,
  type ResidenceCountry,
} from "../../types/profilePreferences";
import { canShowLanguagePicker } from "../../config/featureFlags";

export type ProfileSetupInitial = {
  /** Legacy aliases are retained only to resume an older interrupted setup. */
  displayName?: string;
  realName?: string;
  realNameFromProvider?: string;
  nickname?: string;
  darinTag?: string;
  relation?: RelationshipLabel;
  avatarUrl?: string;
  residenceCountry?: ResidenceCountry;
  preferredLanguage?: AppLanguagePreference;
  guardianBirthDate?: string;
};

function relationshipToCareValue(relation: RelationshipLabel): RelationshipToChild {
  const index = PROFILE_RELATION_OPTIONS.indexOf(relation);
  if (index === 0) return "mom";
  if (index === 1) return "dad";
  if (index === 8) return "sitter";
  if ([2, 3, 4, 5, 7].includes(index)) return "family";
  return "guardian";
}

export function ProfileSetupScreen({
  initial,
  onComplete,
}: {
  initial: ProfileSetupInitial;
  onComplete: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const { applyOwnerFromSetup } = useBabyLog();
  const { setSettings } = useAppSettings();
  const { setLocale, t } = useLanguage();
  const [nickname, setNickname] = useState(initial.nickname ?? initial.displayName ?? "");
  const [realNameFromProvider] = useState(initial.realNameFromProvider ?? initial.realName ?? "");
  const [darinTag, setDarinTag] = useState(initial.darinTag ?? generateDarinTag());
  const [relation, setRelation] = useState<RelationshipLabel | null>(initial.relation ?? null);
  const [residenceCountry, setResidenceCountry] = useState<ResidenceCountry | null>(
    initial.residenceCountry ?? null,
  );
  const [preferredLanguage, setPreferredLanguage] = useState<AppLanguagePreference | null>(
    initial.preferredLanguage ?? null,
  );
  const [guardianBirthDate, setGuardianBirthDate] = useState(initial.guardianBirthDate ?? "");
  const [birthDatePickerOpen, setBirthDatePickerOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [pickedAvatar, setPickedAvatar] = useState<PickedAvatar | null>(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nicknameErrorCode = validateDarinNicknameCode(nickname);
  const nicknameError = nicknameErrorCode ? t(`profileSetup.nicknameError.${nicknameErrorCode}` as MessageKey) : null;

  const canContinue = canSubmitUserProfile({
    displayName: nickname,
    realName: realNameFromProvider || nickname,
    relation,
    residenceCountry,
    preferredLanguage,
    guardianBirthDate,
  }) && !nicknameError && !saving;

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!nickname.trim() || nicknameError) missing.push(t("profileSetup.field.nickname"));
    if (!relation) missing.push(t("profileSetup.field.relationship"));
    if (!residenceCountry) missing.push(t("profileSetup.field.country"));
    if (!preferredLanguage) missing.push(t("profileSetup.field.language"));
    if (!guardianBirthDate.trim()) missing.push(t("profileSetup.field.birthDate"));
    return missing;
  }, [nickname, nicknameError, relation, residenceCountry, preferredLanguage, guardianBirthDate, t]);

  const relationLabel = (value: RelationshipLabel) => {
    const suffixes = ["mom", "dad", "grandmother", "grandfather", "aunt", "uncle", "guardian", "family", "sitter", "friend", "other"] as const;
    const suffix = suffixes[PROFILE_RELATION_OPTIONS.indexOf(value)] ?? "other";
    return t(`profileSetup.relation.${suffix}` as MessageKey);
  };
  const countryLabel = (value: ResidenceCountry) => t(`profileSetup.country.${value.toLowerCase()}` as MessageKey);
  const languageLabel = (value: AppLanguagePreference) => t(`profileSetup.language.${value}` as MessageKey);

  const pickAvatar = () => {
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl || pickedAvatar),
      onPick: (avatar) => {
        setPickedAvatar(avatar);
        setAvatarUrl(avatar.uri);
        setClearAvatar(false);
      },
      onClear: () => {
        setPickedAvatar(null);
        setAvatarUrl(undefined);
        setClearAvatar(true);
      },
    });
  };

  const save = async () => {
    if (!canContinue || nicknameError || !relation || !residenceCountry || !preferredLanguage) {
      if (nicknameError) setError(nicknameError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const identity = createDarinIdentity({
        realNameFromProvider: realNameFromProvider || nickname.trim(),
        nickname,
        tag: darinTag,
      });
      const saved = await ProfileRepository.upsertMyProfile({
        displayName: nickname,
        // Existing backend columns remain compatible: display_name is the Darin nickname,
        // while nickname stores the provider-confirmed real name until a schema migration.
        nickname: realNameFromProvider || null,
        darinId: identity.darinId,
        defaultRelation: relation,
        residenceCountry,
        preferredLanguage,
        guardianBirthDate: guardianBirthDate || null,
        avatarStoragePath: clearAvatar ? null : undefined,
        avatarUrl: clearAvatar ? null : undefined,
      });
      const user = await AuthRepository.getUser();
      if (user) {
        await DarinIdentityRepository.save(user.id, identity);
      }
      const uploaded = pickedAvatar
        ? await ProfileRepository.uploadMyAvatar(pickedAvatar)
        : null;
      const resolvedLanguage = resolveAppLocale(preferredLanguage);
      const nextSetup = {
        ...careSetup,
        parent: {
          ...careSetup.parent,
          parentName: saved.display_name.trim(),
          nickname: saved.nickname ?? undefined,
          relationshipToChild: relationshipToCareValue(relation),
          preferredLanguage: resolvedLanguage,
          avatarUri: uploaded?.avatarUrl ?? (clearAvatar ? undefined : avatarUrl),
        },
      };
      setCareSetup(nextSetup);
      applyOwnerFromSetup(nextSetup);
      setLocale(resolvedLanguage);
      setSettings((current) => ({
        ...current,
        account: {
          ...current.account,
          language: preferredLanguage,
          relationship: relationshipToCareValue(relation),
        },
      }));
      await onComplete();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("profileSetup.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 20, 32), paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.heading}>
          <Text style={styles.title}>{t("profileSetup.title")}</Text>
          <Text style={styles.subtitle}>{t("profileSetup.subtitle")}</Text>
        </View>

        <ProfileAvatar
          uri={avatarUrl}
          size={104}
          editable
          onPress={pickAvatar}
          label={avatarUrl ? t("profileSetup.photoChange") : t("profileSetup.photoAdd")}
        />

        <View style={styles.card}>
          <Text style={styles.label}>{t("profileSetup.nickname")} *</Text>
          <Text style={styles.help}>{t("profileSetup.nicknameHelp")}</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t("profileSetup.nicknamePlaceholder")}
            placeholderTextColor={colors.faint}
            maxLength={12}
            autoFocus={!nickname.trim()}
            returnKeyType="next"
          />
          {nickname.trim() && nicknameError ? (
            <Text style={styles.fieldError}>{nicknameError}</Text>
          ) : null}

          <Text style={styles.label}>{t("profileSetup.importedName")}</Text>
          <Text style={styles.help}>{t("profileSetup.importedNameHelp")}</Text>
          <View style={styles.readonlyField}><Text style={[styles.readonlyText, !realNameFromProvider && styles.placeholder]}>{realNameFromProvider || t("profileSetup.noImportedName")}</Text></View>

          <Text style={styles.label}>Darin ID</Text>
          <Text style={styles.help}>{t("profileSetup.darinIdHelp")}</Text>
          <View style={styles.darinIdRow}>
            <View style={styles.darinIdField}><Text style={styles.darinIdText}>{nickname.trim() ? `${nickname.trim()}#${darinTag}` : t("profileSetup.idPlaceholder")}</Text></View>
            <Pressable style={styles.regenerateButton} onPress={() => setDarinTag(generateDarinTag())} accessibilityRole="button" accessibilityLabel={t("profileSetup.newCodeA11y")}><Text style={styles.regenerateText}>{t("profileSetup.newCode")}</Text></Pressable>
          </View>

          <Text style={styles.label}>{t("profileSetup.relationship")} *</Text>
          <View style={styles.chips}>
            {PROFILE_RELATION_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, relation === option && styles.chipActive]}
                onPress={() => setRelation(option)}
              >
                <Text style={[styles.chipText, relation === option && styles.chipTextActive]}>
                  {relationLabel(option)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t("profileSetup.country")} *</Text>
          <Text style={styles.help}>{t("profileSetup.countryHelp")}</Text>
          <View style={styles.chips}>
            {RESIDENCE_COUNTRY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, residenceCountry === option.value && styles.chipActive]}
                onPress={() => setResidenceCountry(option.value)}
              >
                <Text style={[styles.chipText, residenceCountry === option.value && styles.chipTextActive]}>
                  {countryLabel(option.value)}
                </Text>
              </Pressable>
            ))}
          </View>

          {canShowLanguagePicker() ? (
            <>
              <Text style={styles.label}>{t("profileSetup.language")} *</Text>
              <Text style={styles.help}>{t("profileSetup.languageHelp")}</Text>
              <View style={styles.chips}>
                {getVisibleAppLanguageOptions().map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, preferredLanguage === option.value && styles.chipActive, option.disabled && styles.chipDisabled]}
                    onPress={() => setPreferredLanguage(option.value)}
                    disabled={option.disabled}
                    accessibilityState={{ disabled: option.disabled, selected: preferredLanguage === option.value }}
                  >
                    <Text style={[styles.chipText, preferredLanguage === option.value && styles.chipTextActive]}>
                      {languageLabel(option.value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>{t("profileSetup.birthDate")} *</Text>
          <Text style={styles.help}>{t("profileSetup.birthDateHelp")}</Text>
          <Pressable
            style={[styles.input, styles.dateInput]}
            onPress={() => setBirthDatePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("profileSetup.birthDateSelect")}
          >
            <Text style={[styles.dateInputText, !guardianBirthDate && styles.datePlaceholder]}>
              {guardianBirthDate || "YYYY-MM-DD"}
            </Text>
            <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {missingFields.length > 0 && !saving ? (
            <Text style={styles.missingHint}>
              {t("profileSetup.missing", { fields: missingFields.join(", ") })}
            </Text>
          ) : null}
          <Pressable
            style={[styles.next, !canContinue && styles.disabled]}
            onPress={() => void save()}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            accessibilityHint={
              missingFields.length > 0 ? t("profileSetup.missingA11y", { fields: missingFields.join(", ") }) : undefined
            }
          >
            {saving ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.nextText}>{t("profileSetup.next")}</Text>}
          </Pressable>
        </View>
        <RecordDatePickerModal
          visible={birthDatePickerOpen}
          selectedDateKey={
            guardianBirthDate
              || formatDateKey(new Date(new Date().getFullYear() - 30, 0, 1), "midnight")
          }
          minDateKey={formatDateKey(new Date(new Date().getFullYear() - 120, 0, 1), "midnight")}
          maxDateKey={formatDateKey()}
          title={t("profileSetup.birthDateSelect")}
          onSelect={setGuardianBirthDate}
          onClose={() => setBirthDatePickerOpen(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 20, gap: 20 },
  heading: { alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: "900", textAlign: "center" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  card: { padding: 16, gap: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 2 },
  help: { color: colors.faint, fontSize: 11.5, lineHeight: 17, marginTop: -5 },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, color: colors.text, fontSize: 15 },
  readonlyField: { minHeight: 48, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, justifyContent: "center" },
  readonlyText: { color: colors.text, fontSize: 15 },
  placeholder: { color: colors.faint },
  darinIdRow: { flexDirection: "row", gap: 8 },
  darinIdField: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, justifyContent: "center" },
  darinIdText: { color: colors.amberText, fontSize: 15, fontWeight: "800" },
  regenerateButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft, justifyContent: "center" },
  regenerateText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 42, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipDisabled: { opacity: 0.48 },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  chipTextActive: { color: colors.amberText },
  error: { padding: 12, borderRadius: radius.md, backgroundColor: colors.dangerSoft, color: colors.dangerText, fontSize: 12.5, lineHeight: 19 },
  fieldError: { color: colors.dangerText, fontSize: 11.5, lineHeight: 17, marginTop: -4 },
  missingHint: { color: colors.muted, fontSize: 12.5, lineHeight: 19, textAlign: "center" },
  footer: { marginTop: "auto", gap: 12 },
  dateInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: colors.text, fontSize: 15 },
  datePlaceholder: { color: colors.faint },
  next: { minHeight: 54, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  nextText: { color: colors.amberDark, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
