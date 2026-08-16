import { useState } from "react";
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
  validateDarinNickname,
} from "../../repositories/DarinIdentityRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../LanguageContext";
import type { RelationshipToChild } from "../../types/careSetup";
import { colors, radius } from "../../theme";
import { canSubmitUserProfile } from "../../utils/profileCompletion";
import { formatDateKey } from "../../utils/dateKey";
import {
  APP_LANGUAGE_OPTIONS,
  RESIDENCE_COUNTRY_OPTIONS,
  resolveAppLocale,
  type AppLanguagePreference,
  type ResidenceCountry,
} from "../../types/profilePreferences";

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
  if (relation === "엄마") return "mom";
  if (relation === "아빠") return "dad";
  if (relation === "시터") return "sitter";
  if (relation === "가족" || relation === "할머니" || relation === "할아버지" || relation === "이모" || relation === "삼촌") return "family";
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
  const { setLocale } = useLanguage();
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
  const nicknameError = validateDarinNickname(nickname);

  const canContinue = canSubmitUserProfile({
    displayName: nickname,
    realName: realNameFromProvider || nickname,
    relation,
    residenceCountry,
    preferredLanguage,
    guardianBirthDate,
  }) && !nicknameError && !saving;

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
          : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
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
          <Text style={styles.title}>내 프로필을 설정해 주세요</Text>
          <Text style={styles.subtitle}>가져온 이름을 확인하고 Darin에서 사용할 닉네임을 정해 주세요.</Text>
        </View>

        <ProfileAvatar
          uri={avatarUrl}
          size={104}
          editable
          onPress={pickAvatar}
          label={avatarUrl ? "내 사진 변경" : "내 사진 추가"}
        />

        <View style={styles.card}>
          <Text style={styles.label}>닉네임 *</Text>
          <Text style={styles.help}>Darin에서 보이는 이름이에요. 2~12자, #과 /는 사용할 수 없어요.</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="예: 콩이맘, 준이아빠"
            placeholderTextColor={colors.faint}
            maxLength={12}
            autoFocus={!nickname.trim()}
            returnKeyType="next"
          />

          <Text style={styles.label}>가져온 이름</Text>
          <Text style={styles.help}>Google, Apple 또는 카카오에서 가져온 이름이에요.</Text>
          <View style={styles.readonlyField}><Text style={[styles.readonlyText, !realNameFromProvider && styles.placeholder]}>{realNameFromProvider || "가져온 이름이 없어요"}</Text></View>

          <Text style={styles.label}>Darin ID</Text>
          <Text style={styles.help}>가족·공유 멤버 검색과 요청에 사용할 고유 ID예요.</Text>
          <View style={styles.darinIdRow}>
            <View style={styles.darinIdField}><Text style={styles.darinIdText}>{nickname.trim() ? `${nickname.trim()}#${darinTag}` : "닉네임#코드"}</Text></View>
            <Pressable style={styles.regenerateButton} onPress={() => setDarinTag(generateDarinTag())} accessibilityRole="button" accessibilityLabel="Darin ID 새 코드 만들기"><Text style={styles.regenerateText}>새 코드</Text></Pressable>
          </View>

          <Text style={styles.label}>아기와의 관계 *</Text>
          <View style={styles.chips}>
            {PROFILE_RELATION_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, relation === option && styles.chipActive]}
                onPress={() => setRelation(option)}
              >
                <Text style={[styles.chipText, relation === option && styles.chipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>거주 국가 *</Text>
          <Text style={styles.help}>단위와 기본 설정을 맞추는 데 사용돼요.</Text>
          <View style={styles.chips}>
            {RESIDENCE_COUNTRY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, residenceCountry === option.value && styles.chipActive]}
                onPress={() => setResidenceCountry(option.value)}
              >
                <Text style={[styles.chipText, residenceCountry === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>앱 언어 *</Text>
          <Text style={styles.help}>앱에서 사용할 언어를 선택해 주세요.</Text>
          <View style={styles.chips}>
            {APP_LANGUAGE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, preferredLanguage === option.value && styles.chipActive, option.disabled && styles.chipDisabled]}
                onPress={() => setPreferredLanguage(option.value)}
                disabled={option.disabled}
                accessibilityState={{ disabled: option.disabled, selected: preferredLanguage === option.value }}
              >
                <Text style={[styles.chipText, preferredLanguage === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>보호자 생년월일</Text>
          <Text style={styles.help}>맞춤 안내를 위해 사용해요.</Text>
          <Pressable
            style={[styles.input, styles.dateInput]}
            onPress={() => setBirthDatePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="보호자 생년월일 선택"
          >
            <Text style={[styles.dateInputText, !guardianBirthDate && styles.datePlaceholder]}>
              {guardianBirthDate || "YYYY-MM-DD"}
            </Text>
            <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.next, !canContinue && styles.disabled]}
          onPress={() => void save()}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.nextText}>다음</Text>}
        </Pressable>
        <RecordDatePickerModal
          visible={birthDatePickerOpen}
          selectedDateKey={
            guardianBirthDate
              || formatDateKey(new Date(new Date().getFullYear() - 30, 0, 1), "midnight")
          }
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
  dateInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: colors.text, fontSize: 15 },
  datePlaceholder: { color: colors.faint },
  next: { minHeight: 54, marginTop: "auto", borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
