import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileEditFieldRow } from "./ProfileEditFieldRow";
import { ProfileEditLinkRow } from "./ProfileEditLinkRow";
import { NavigationHeader } from "../navigation/NavigationHeader";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { RecordDatePickerModal } from "../babylog/RecordDatePickerModal";
import { useApp } from "../../context/AppContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { AuthRepository } from "../../repositories/AuthRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import {
  createDarinIdentity,
  DarinIdentityRepository,
  generateDarinTag,
  validateDarinNickname,
  validateDarinNicknameCode,
} from "../../repositories/DarinIdentityRepository";
import { PROFILE_RELATION_OPTIONS } from "../../types/profileSettings";
import type { RelationshipLabel } from "../../types/growthBook";
import { presentAvatarPicker, type PickedAvatar } from "../../utils/profileAvatarPicker";
import { colors, fontScaleCap } from "../../theme";
import { familyRoleMessageKey } from "../../types/family";
import {
  getVisibleAppLanguageOptions,
  RESIDENCE_COUNTRY_OPTIONS,
  isAppLanguagePreference,
  isResidenceCountry,
  resolveAppLocale,
  type AppLanguagePreference,
  type ResidenceCountry,
} from "../../types/profilePreferences";
import { canShowLanguagePicker } from "../../config/featureFlags";
import { formatDateKey } from "../../utils/dateKey";
import { localizedErrorMessage, storedRelationshipLabel } from "../../utils/familyDisplay";
import { clampProfileBio, readProfileBio, writeProfileBio } from "../../utils/profileBioStore";
import type { MessageKey } from "../../i18n";
import type { RelationshipToChild } from "../../types/careSetup";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

function relationshipToCareValue(relation: RelationshipLabel): RelationshipToChild {
  if (relation === "엄마") return "mom";
  if (relation === "아빠") return "dad";
  if (relation === "보호자") return "guardian";
  if (relation === "시터") return "sitter";
  return "family";
}

type Props = {
  onClose: () => void;
};

type Panel = "main" | "family" | "language" | "personal";

type Snapshot = {
  nickname: string;
  tag: string;
  bio: string;
  relation: RelationshipLabel;
  residenceCountry: ResidenceCountry | null;
  preferredLanguage: AppLanguagePreference;
  guardianBirthDate: string;
  avatarUrl?: string;
};

export function MyProfileEditForm({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const { setSettings } = useAppSettings();
  const { activeBabyId, myFamilyRole, applyMyProfileUpdate } = useBabyLog();
  const { t, setLocale } = useLanguage();
  const [panel, setPanel] = useState<Panel>("main");
  const [nickname, setNickname] = useState(careSetup.parent.parentName);
  const [realName, setRealName] = useState(careSetup.parent.nickname ?? "");
  const [bio, setBio] = useState("");
  const [relation, setRelation] = useState<RelationshipLabel>(PROFILE_RELATION_OPTIONS[0]);
  const [residenceCountry, setResidenceCountry] = useState<ResidenceCountry | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<AppLanguagePreference>("system");
  const [guardianBirthDate, setGuardianBirthDate] = useState("");
  const [birthDatePickerOpen, setBirthDatePickerOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [pendingAvatar, setPendingAvatar] = useState<PickedAvatar | null>(null);
  const [pendingClear, setPendingClear] = useState(false);
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState(t("settings.critical.002"));
  const [darinTag, setDarinTag] = useState(generateDarinTag());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [idTaken, setIdTaken] = useState(false);

  const previewUri = pendingClear ? undefined : pendingAvatar?.uri ?? avatarUrl;
  const darinId = nickname.trim() ? `${nickname.trim()}#${darinTag}` : "";
  const nicknameCode = validateDarinNicknameCode(nickname);
  const nicknameReady = !nicknameCode;

  const dirty = useMemo(() => {
    if (!snapshot) return false;
    return (
      nickname.trim() !== snapshot.nickname
      || darinTag !== snapshot.tag
      || bio.trim() !== snapshot.bio
      || relation !== snapshot.relation
      || residenceCountry !== snapshot.residenceCountry
      || preferredLanguage !== snapshot.preferredLanguage
      || guardianBirthDate !== snapshot.guardianBirthDate
      || Boolean(pendingAvatar)
      || pendingClear
    );
  }, [snapshot, nickname, darinTag, bio, relation, residenceCountry, preferredLanguage, guardianBirthDate, pendingAvatar, pendingClear]);

  const canSave = dirty && nicknameReady && !saving && !loading;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setIdTaken(false);
    try {
      const user = await AuthRepository.getUser();
      setEmail(user?.email ?? "");
      const identities = user?.identities?.map((item) => item.provider) ?? [];
      if (identities.includes("apple")) setProvider("Apple");
      else if (identities.includes("google")) setProvider("Google");
      else if (identities.includes("kakao")) setProvider("Kakao");
      else setProvider(t("settings.critical.002"));

      let nextNickname = careSetup.parent.parentName;
      let nextRealName = careSetup.parent.nickname ?? "";
      let nextTag = generateDarinTag();
      let nextRelation = PROFILE_RELATION_OPTIONS[0];
      let nextCountry: ResidenceCountry | null = null;
      let nextLanguage: AppLanguagePreference = "system";
      let nextBirth = "";
      let nextAvatar: string | undefined;
      let nextBio = "";

      if (user) {
        const identity = await DarinIdentityRepository.get(user.id);
        if (identity) nextTag = identity.tag;
        nextBio = await readProfileBio(user.id);
      }

      const profile = await ProfileRepository.getMyProfile();
      if (profile) {
        nextNickname = profile.display_name;
        nextRealName = profile.nickname ?? "";
        nextCountry = isResidenceCountry(profile.residence_country) ? profile.residence_country : null;
        nextLanguage = isAppLanguagePreference(profile.preferred_language) ? profile.preferred_language : "system";
        nextBirth = profile.guardian_birth_date ?? "";
        nextAvatar = profile.avatar_storage_path
          ? await ProfileRepository.createProfileAvatarSignedUrl(profile.avatar_storage_path).catch(() => undefined)
          : profile.avatar_url ?? undefined;
        if (profile.default_relation) nextRelation = profile.default_relation as RelationshipLabel;
        if (profile.darin_id?.includes("#")) {
          const tag = profile.darin_id.slice(profile.darin_id.lastIndexOf("#") + 1);
          if (/^\d{4}$/.test(tag)) nextTag = tag;
        }
      }

      const babyId = activeBabyId;
      if (babyId && user?.id) {
        const members = await FamilyRepository.listMembers(babyId);
        const mine = members.find((row) => row.user_id === user.id);
        if (mine?.relationship_label) nextRelation = mine.relationship_label as RelationshipLabel;
      }

      setNickname(nextNickname);
      setRealName(nextRealName);
      setBio(nextBio);
      setRelation(nextRelation);
      setResidenceCountry(nextCountry);
      setPreferredLanguage(nextLanguage);
      setGuardianBirthDate(nextBirth);
      setAvatarUrl(nextAvatar);
      setDarinTag(nextTag);
      setPendingAvatar(null);
      setPendingClear(false);
      setSnapshot({
        nickname: nextNickname.trim(),
        tag: nextTag,
        bio: nextBio.trim(),
        relation: nextRelation,
        residenceCountry: nextCountry,
        preferredLanguage: nextLanguage,
        guardianBirthDate: nextBirth,
        avatarUrl: nextAvatar,
      });
    } catch (cause) {
      setError(cause instanceof Error ? localizedErrorMessage(t, cause.message) : t("settings.critical.003"));
    } finally {
      setLoading(false);
    }
  }, [activeBabyId, careSetup.parent.nickname, careSetup.parent.parentName, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const requestClose = () => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(t("settings.critical.335"), t("settings.critical.336"), [
      { text: t("settings.critical.338"), style: "cancel" },
      { text: t("settings.critical.337"), style: "destructive", onPress: onClose },
    ]);
  };

  const save = async () => {
    if (!canSave) return;
    const displayNickname = nickname.trim();
    const nicknameError = validateDarinNickname(displayNickname);
    if (nicknameError) {
      setError(t(nicknameCode === "required" ? "settings.critical.346" : "settings.critical.347"));
      return;
    }
    setSaving(true);
    setError("");
    setIdTaken(false);
    try {
      const confirmedRealName = realName.trim() || displayNickname;
      const identity = createDarinIdentity({
        realNameFromProvider: confirmedRealName,
        nickname: displayNickname,
        tag: darinTag,
      });
      if (pendingAvatar) {
        const uploaded = await ProfileRepository.uploadMyAvatar(pendingAvatar);
        setAvatarUrl(uploaded.avatarUrl);
      }
      const next = await ProfileRepository.updateMyProfile({
        displayName: displayNickname,
        darinId: identity.darinId,
        nickname: confirmedRealName,
        defaultRelation: relation,
        preferredLanguage,
        residenceCountry: residenceCountry ?? undefined,
        guardianBirthDate: guardianBirthDate || undefined,
        clearAvatar: pendingClear && !pendingAvatar,
      });
      const babyId = activeBabyId;
      const user = await AuthRepository.getUser();
      if (user) {
        await DarinIdentityRepository.save(user.id, identity);
        await writeProfileBio(user.id, bio);
      }
      if (babyId && user?.id) {
        await FamilyRepository.updateMemberRelation({
          babyId,
          userId: user.id,
          relation,
          displayNameOverride: null,
        });
      }
      const resolvedLanguage = resolveAppLocale(preferredLanguage);
      const nextSetup = {
        ...careSetup,
        parent: {
          ...careSetup.parent,
          parentName: next.displayName,
          nickname: confirmedRealName,
          relationshipToChild: relationshipToCareValue(relation),
          preferredLanguage: resolvedLanguage,
          avatarUri: pendingClear && !pendingAvatar ? undefined : next.avatarUrl,
        },
      };
      setCareSetup(nextSetup);
      setLocale(resolvedLanguage);
      setSettings((current) => ({
        ...current,
        account: { ...current.account, language: preferredLanguage },
      }));
      if (user) {
        applyMyProfileUpdate({
          userId: user.id,
          babyId,
          displayName: next.displayName,
          realName: confirmedRealName,
          avatarUrl: pendingClear && !pendingAvatar ? undefined : next.avatarUrl,
          relationshipLabel: relation,
        });
      }
      onClose();
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "";
      if (/이미 사용 중인 Darin ID|darin_id/i.test(raw)) {
        setIdTaken(true);
        setError(t("settings.critical.340"));
      } else {
        setError(cause instanceof Error ? localizedErrorMessage(t, raw) : t("settings.critical.006"));
      }
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = () => {
    presentAvatarPicker({
      hasAvatar: Boolean(previewUri),
      t,
      onPick: (avatar) => {
        setPendingAvatar(avatar);
        setPendingClear(false);
        setError("");
      },
      onClear: () => {
        setPendingAvatar(null);
        setPendingClear(true);
      },
    });
  };

  const nicknameStatus = nicknameCode === "required" && dirty
    ? t("settings.critical.346")
    : nicknameCode && nickname.trim()
      ? t("settings.critical.347")
      : undefined;
  const idChanged = Boolean(snapshot && (nickname.trim() !== snapshot.nickname || darinTag !== snapshot.tag));
  const idStatus = idTaken
    ? t("settings.critical.340")
    : nicknameReady && darinId && idChanged
      ? t("settings.critical.339")
      : undefined;

  const languageLabel = t(`profileSetup.language.${preferredLanguage}` as MessageKey);
  const countryLabel = residenceCountry
    ? t(`profileSetup.country.${residenceCountry.toLowerCase()}` as MessageKey)
    : undefined;
  const panelTitle = panel === "family"
    ? t("settings.critical.332")
    : panel === "language"
      ? t("settings.critical.333")
      : panel === "personal"
        ? t("settings.critical.334")
        : t("memory.critical.223");

  return (
    <View style={styles.root}>
      <NavigationHeader
        title={panelTitle}
        leftLabel={panel === "main" ? t("common.cancel") : undefined}
        onBack={panel === "main" ? requestClose : () => setPanel("main")}
        rightLabel={panel === "main" ? t("common.done") : undefined}
        onRightPress={panel === "main" ? () => void save() : undefined}
        rightDisabled={!canSave}
        rightBusy={saving}
      />
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("settings.critical.009")}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? undefined : "padding"}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {panel === "main" ? (
              <>
                <View style={styles.photo}>
                  <ProfileAvatar
                    uri={previewUri}
                    size={96}
                    onPress={pickAvatar}
                    label={t("settings.critical.325")}
                  />
                  <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel={t("settings.critical.325")}>
                    <Text style={styles.photoAction} maxFontSizeMultiplier={fontScaleCap.chrome}>
                      {t("settings.critical.325")}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.group}>
                  <ProfileEditFieldRow
                    label={t("settings.critical.326")}
                    value={nickname}
                    onChangeText={(value) => {
                      setNickname(value);
                      setIdTaken(false);
                    }}
                    placeholder={t("settings.critical.013")}
                    helper={t("settings.critical.327")}
                    status={nicknameStatus}
                    statusTone="error"
                    maxLength={12}
                  />
                  <ProfileEditFieldRow
                    label={t("settings.critical.018")}
                    value={realName || t("settings.critical.020")}
                    onChangeText={() => undefined}
                    helper={t("settings.critical.019")}
                    editable={false}
                  />
                  <ProfileEditFieldRow
                    label="Darin ID"
                    value={darinId}
                    onChangeText={() => undefined}
                    placeholder={t("settings.critical.015")}
                    helper={t("settings.critical.328")}
                    status={idStatus}
                    statusTone={idTaken ? "error" : "ok"}
                    editable={false}
                    trailing={(
                      <Pressable
                        style={styles.codeBtn}
                        onPress={() => {
                          setDarinTag(generateDarinTag());
                          setIdTaken(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("settings.critical.016")}
                      >
                        <Text style={styles.codeBtnText}>{t("settings.critical.017")}</Text>
                      </Pressable>
                    )}
                  />
                  <ProfileEditFieldRow
                    label={t("settings.critical.329")}
                    value={bio}
                    onChangeText={(value) => setBio(clampProfileBio(value))}
                    placeholder={t("settings.critical.331")}
                    helper={t("settings.critical.330")}
                    maxLength={60}
                  />
                </View>

                <View style={styles.group}>
                  <ProfileEditLinkRow
                    label={t("settings.critical.332")}
                    value={storedRelationshipLabel(t, relation)}
                    onPress={() => setPanel("family")}
                  />
                  {canShowLanguagePicker() ? (
                    <ProfileEditLinkRow
                      label={t("settings.critical.333")}
                      value={languageLabel}
                      onPress={() => setPanel("language")}
                    />
                  ) : null}
                  <ProfileEditLinkRow
                    label={t("settings.critical.334")}
                    value={countryLabel}
                    onPress={() => setPanel("personal")}
                  />
                </View>

                {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
                <Text style={styles.footer}>{t("settings.critical.344")}</Text>
              </>
            ) : null}

            {panel === "family" ? (
              <View style={styles.panel}>
                <Text style={styles.panelHint}>{t("settings.critical.342")}</Text>
                <View style={styles.chips}>
                  {PROFILE_RELATION_OPTIONS.map((option) => {
                    const active = relation === option;
                    return (
                      <Pressable
                        key={option}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setRelation(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {storedRelationshipLabel(t, option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {panel === "language" ? (
              <View style={styles.panel}>
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
                        {t(`profileSetup.language.${option.value}` as MessageKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {panel === "personal" ? (
              <View style={styles.panel}>
                <Text style={styles.panelHint}>{t("settings.critical.343")}</Text>
                <View style={styles.group}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("settings.critical.002")}</Text>
                    <Text style={styles.metaValue}>{email || t("settings.critical.026")}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("settings.critical.027")}</Text>
                    <Text style={styles.metaValue}>{provider}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("settings.critical.028")}</Text>
                    <Text style={styles.metaValue}>{t(familyRoleMessageKey(myFamilyRole))}</Text>
                  </View>
                </View>
                <Text style={styles.fieldTitle}>{t("settings.critical.022")}</Text>
                <View style={styles.chips}>
                  {RESIDENCE_COUNTRY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.chip, residenceCountry === option.value && styles.chipActive]}
                      onPress={() => setResidenceCountry(option.value)}
                    >
                      <Text style={[styles.chipText, residenceCountry === option.value && styles.chipTextActive]}>
                        {t(`profileSetup.country.${option.value.toLowerCase()}` as MessageKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldTitle}>{t("settings.critical.024")}</Text>
                <Pressable
                  style={styles.dateBtn}
                  onPress={() => setBirthDatePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.critical.025")}
                >
                  <Text style={[styles.dateText, !guardianBirthDate && styles.placeholder]}>
                    {guardianBirthDate || "YYYY-MM-DD"}
                  </Text>
                  <BabyLogIcon kind="calendar" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <RecordDatePickerModal
        visible={birthDatePickerOpen}
        selectedDateKey={guardianBirthDate || formatDateKey(new Date(new Date().getFullYear() - 30, 0, 1), "midnight")}
        minDateKey={formatDateKey(new Date(new Date().getFullYear() - 120, 0, 1), "midnight")}
        maxDateKey={formatDateKey()}
        title={t("settings.critical.025")}
        onSelect={setGuardianBirthDate}
        onClose={() => setBirthDatePickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted, fontSize: 13 },
  content: { paddingTop: 8 },
  photo: { alignItems: "center", paddingTop: 18, paddingBottom: 20, gap: 10 },
  photoAction: { color: colors.amberText, fontSize: 15, fontWeight: "700" },
  group: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 18,
  },
  codeBtn: { minHeight: TOUCH_MIN, paddingHorizontal: 8, justifyContent: "center" },
  codeBtnText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  error: {
    marginHorizontal: 16,
    marginBottom: 12,
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 12.5,
  },
  footer: {
    marginHorizontal: 20,
    color: colors.faint,
    fontSize: 12,
    lineHeight: 17,
  },
  panel: { paddingTop: 8, paddingBottom: 16 },
  panelHint: {
    marginHorizontal: 20,
    marginBottom: 12,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldTitle: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  chip: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipDisabled: { opacity: 0.45 },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: colors.accentStrong },
  metaRow: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metaLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  metaValue: { flex: 1, textAlign: "right", color: colors.muted, fontSize: 15 },
  dateBtn: {
    marginHorizontal: 16,
    minHeight: TOUCH_MIN,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { color: colors.text, fontSize: 15 },
  placeholder: { color: colors.faint },
});
