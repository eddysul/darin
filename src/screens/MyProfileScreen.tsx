import { useCallback, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { RecordDatePickerModal } from "../components/babylog/RecordDatePickerModal";
import { useApp } from "../context/AppContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { useBabyLog } from "../context/BabyLogContext";
import { useLanguage } from "../LanguageContext";
import { AuthRepository } from "../repositories/AuthRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import {
  createDarinIdentity,
  DarinIdentityRepository,
  generateDarinTag,
  validateDarinNickname,
} from "../repositories/DarinIdentityRepository";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import type { RelationshipLabel } from "../types/growthBook";
import { presentAvatarPicker } from "../utils/profileAvatarPicker";
import { colors, radius } from "../theme";
import { FAMILY_ROLE_LABELS } from "../types/family";
import {
  APP_LANGUAGE_OPTIONS,
  RESIDENCE_COUNTRY_OPTIONS,
  isAppLanguagePreference,
  isResidenceCountry,
  resolveAppLocale,
  type AppLanguagePreference,
  type ResidenceCountry,
} from "../types/profilePreferences";
import { formatDateKey } from "../utils/dateKey";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

export function MyProfileScreen() {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const { setSettings } = useAppSettings();
  const { activeBabyId, myFamilyRole, applyOwnerFromSetup, rehydrateFromServer } = useBabyLog();
  const { setLocale } = useLanguage();
  const [nickname, setNickname] = useState(careSetup.parent.parentName);
  const [realName, setRealName] = useState(careSetup.parent.nickname ?? "");
  const [relation, setRelation] = useState<RelationshipLabel>("엄마");
  const [residenceCountry, setResidenceCountry] = useState<ResidenceCountry | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<AppLanguagePreference>("system");
  const [guardianBirthDate, setGuardianBirthDate] = useState("");
  const [birthDatePickerOpen, setBirthDatePickerOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("이메일");
  const [darinTag, setDarinTag] = useState(generateDarinTag());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await AuthRepository.getUser();
      setEmail(user?.email ?? "");
      const identities = user?.identities?.map((item) => item.provider) ?? [];
      if (identities.includes("apple")) setProvider("Apple");
      else if (identities.includes("google")) setProvider("Google");
      else if (identities.includes("kakao")) setProvider("Kakao");
      else setProvider("이메일");
      if (user) {
        const identity = await DarinIdentityRepository.get(user.id);
        if (identity) setDarinTag(identity.tag);
      }

      const profile = await ProfileRepository.getMyProfile();
      if (profile) {
        setNickname(profile.display_name);
        setRealName(profile.nickname ?? "");
        setResidenceCountry(isResidenceCountry(profile.residence_country) ? profile.residence_country : null);
        setPreferredLanguage(isAppLanguagePreference(profile.preferred_language) ? profile.preferred_language : "system");
        setGuardianBirthDate(profile.guardian_birth_date ?? "");
        setAvatarUrl(
          profile.avatar_storage_path
            ? await ProfileRepository.createProfileAvatarSignedUrl(profile.avatar_storage_path).catch(() => undefined)
            : profile.avatar_url ?? undefined,
        );
        if (profile.default_relation) setRelation(profile.default_relation as RelationshipLabel);
      } else {
        setNickname(careSetup.parent.parentName);
        setRealName(careSetup.parent.nickname ?? "");
      }

      const babyId = activeBabyId;
      if (babyId && user?.id) {
        const members = await FamilyRepository.listMembers(babyId);
        const mine = members.find((row) => row.user_id === user.id);
        if (mine?.relationship_label) setRelation(mine.relationship_label as RelationshipLabel);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [activeBabyId, careSetup.parent.nickname, careSetup.parent.parentName]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (saving) return;
    const displayNickname = nickname.trim();
    const confirmedRealName = realName.trim();
    const nicknameError = validateDarinNickname(displayNickname);
    if (nicknameError) {
      setError(nicknameError);
      return;
    }
    if (!confirmedRealName) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!residenceCountry || !guardianBirthDate) {
      setError("거주 국가와 보호자 생년월일을 확인해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const identity = createDarinIdentity({ realNameFromProvider: confirmedRealName || displayNickname, nickname: displayNickname, tag: darinTag });
      const next = await ProfileRepository.updateMyProfile({
        displayName: displayNickname,
        darinId: identity.darinId,
        nickname: confirmedRealName,
        defaultRelation: relation,
        preferredLanguage,
        residenceCountry,
        guardianBirthDate,
      });
      const babyId = activeBabyId;
      const user = await AuthRepository.getUser();
      if (user) {
        await DarinIdentityRepository.save(user.id, identity);
      }
      if (babyId && user?.id) {
        await FamilyRepository.updateMemberRelation({
          babyId,
          userId: user.id,
          relation,
        }).catch(() => undefined);
      }
      const resolvedLanguage = resolveAppLocale(preferredLanguage);
      const nextSetup = {
        ...careSetup,
        parent: {
          ...careSetup.parent,
          parentName: next.displayName,
          nickname: confirmedRealName,
          preferredLanguage: resolvedLanguage,
          avatarUri: next.avatarUrl,
        },
      };
      setCareSetup(nextSetup);
      applyOwnerFromSetup(nextSetup);
      setLocale(resolvedLanguage);
      setSettings((current) => ({
        ...current,
        account: { ...current.account, language: preferredLanguage },
      }));
      setAvatarUrl(next.avatarUrl);
      await rehydrateFromServer().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = () => {
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl),
      onPick: (avatar) => {
        setSaving(true);
        setError("");
        void ProfileRepository.uploadMyAvatar(avatar)
          .then((next) => {
            setAvatarUrl(next.avatarUrl);
            const nextSetup = {
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: next.avatarUrl, parentName: next.displayName },
            };
            setCareSetup(nextSetup);
            applyOwnerFromSetup(nextSetup);
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : "사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
      onClear: () => {
        setSaving(true);
        void ProfileRepository.updateMyProfile({
          displayName: nickname.trim() || careSetup.parent.parentName || "나",
          nickname: realName,
          defaultRelation: relation,
          clearAvatar: true,
        })
          .then((next) => {
            setAvatarUrl(undefined);
            setCareSetup({
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: undefined, parentName: next.displayName },
            });
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amberText} />
        <Text style={styles.muted}>내 프로필을 불러오는 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? undefined : "padding"} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <ProfileAvatar uri={avatarUrl} size={104} editable onPress={pickAvatar} label="내 사진 추가" />

        <View style={styles.card}>
          <Text style={styles.label}>닉네임 *</Text>
          <Text style={styles.help}>Darin에서 보이는 이름이에요. 2~12자, #과 /는 사용할 수 없어요.</Text>
          <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="예: 콩이맘, 준이아빠" placeholderTextColor={colors.faint} maxLength={12} />
          <Text style={styles.label}>Darin ID</Text>
          <Text style={styles.help}>가족·공유 멤버 검색과 요청에 사용하는 고유 ID예요.</Text>
          <View style={styles.darinIdRow}><View style={styles.darinIdField}><Text style={styles.darinIdText}>{nickname.trim() ? `${nickname.trim()}#${darinTag}` : "닉네임#코드"}</Text></View><Pressable style={styles.regenerateButton} onPress={() => setDarinTag(generateDarinTag())} accessibilityRole="button" accessibilityLabel="Darin ID 새 코드 만들기"><Text style={styles.regenerateText}>새 코드</Text></Pressable></View>
          <Text style={styles.label}>가져온 이름 *</Text>
          <Text style={styles.help}>로그인 제공자에서 가져온 이름으로, 초대 확인에 함께 보여요.</Text>
          <View style={styles.readonlyField}><Text style={[styles.readonlyText, !realName && styles.datePlaceholder]}>{realName || "가져온 이름이 없어요"}</Text></View>
          <Text style={styles.label}>아기와의 관계</Text>
          <View style={styles.chips}>
            {PROFILE_RELATION_OPTIONS.map((option) => {
              const active = relation === option;
              return (
                <Pressable key={option} style={[styles.chip, active && styles.chipActive]} onPress={() => setRelation(option)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>거주 국가 *</Text>
          <View style={styles.chips}>
            {RESIDENCE_COUNTRY_OPTIONS.map((option) => (
              <Pressable key={option.value} style={[styles.chip, residenceCountry === option.value && styles.chipActive]} onPress={() => setResidenceCountry(option.value)}>
                <Text style={[styles.chipText, residenceCountry === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>앱 언어 *</Text>
          <View style={styles.chips}>
            {APP_LANGUAGE_OPTIONS.map((option) => (
              <Pressable key={option.value} style={[styles.chip, preferredLanguage === option.value && styles.chipActive, option.disabled && styles.chipDisabled]} onPress={() => setPreferredLanguage(option.value)} disabled={option.disabled} accessibilityState={{ disabled: option.disabled, selected: preferredLanguage === option.value }}>
                <Text style={[styles.chipText, preferredLanguage === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>보호자 생년월일 *</Text>
          <Pressable style={[styles.input, styles.dateInput]} onPress={() => setBirthDatePickerOpen(true)} accessibilityRole="button" accessibilityLabel="보호자 생년월일 선택">
            <Text style={[styles.dateInputText, !guardianBirthDate && styles.datePlaceholder]}>{guardianBirthDate || "YYYY-MM-DD"}</Text>
            <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.metaLabel}>이메일</Text>
          <Text style={styles.metaValue}>{email || "연결되지 않음"}</Text>
          <Text style={styles.metaLabel}>로그인 방식</Text>
          <Text style={styles.metaValue}>{provider}</Text>
          <Text style={styles.metaLabel}>현재 역할</Text>
          <Text style={styles.metaValue}>{FAMILY_ROLE_LABELS[myFamilyRole]}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.saveText}>저장</Text>}
        </Pressable>
        <RecordDatePickerModal
          visible={birthDatePickerOpen}
          selectedDateKey={guardianBirthDate || formatDateKey(new Date(new Date().getFullYear() - 30, 0, 1), "midnight")}
          minDateKey={formatDateKey(new Date(new Date().getFullYear() - 120, 0, 1), "midnight")}
          maxDateKey={formatDateKey()}
          title="보호자 생년월일 선택"
          onSelect={setGuardianBirthDate}
          onClose={() => setBirthDatePickerOpen(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 10 },
  muted: { color: colors.muted, fontSize: 13 },
  content: { padding: 20, gap: 16, alignItems: "stretch" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  help: { color: colors.faint, fontSize: 11.5, lineHeight: 17, marginTop: -4 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, paddingHorizontal: 13, color: colors.text, fontSize: 15 },
  readonlyField: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, paddingHorizontal: 13, justifyContent: "center" },
  readonlyText: { color: colors.text, fontSize: 15 },
  darinIdRow: { flexDirection: "row", gap: 8 },
  darinIdField: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, justifyContent: "center" },
  darinIdText: { color: colors.amberText, fontSize: 15, fontWeight: "800" },
  regenerateButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft, justifyContent: "center" },
  regenerateText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  dateInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: colors.text, fontSize: 15 },
  datePlaceholder: { color: colors.faint },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipDisabled: { opacity: 0.48 },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  chipTextActive: { color: colors.amberText },
  metaLabel: { color: colors.faint, fontSize: 11.5, fontWeight: "700", marginTop: 4 },
  metaValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
  save: { minHeight: 52, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  saveText: { color: colors.amberDark, fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.55 },
});
