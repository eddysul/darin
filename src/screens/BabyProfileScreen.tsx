import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../LanguageContext";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { BabySwitcher } from "../components/babylog/BabySwitcher";
import { RecordDatePickerModal } from "../components/babylog/RecordDatePickerModal";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { EmptyState } from "../components/states/FeedbackStates";
import { useApp } from "../context/AppContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { useBabyLog } from "../context/BabyLogContext";
import type { RootStackParamList } from "../navigation/types";
import { BabyProfileError, BabyProfileRepository, type BabyProfileErrorCode } from "../repositories/BabyProfileRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import {
  canInvite,
  canManageMembers,
  type FamilyRole,
} from "../types/family";
import type { FamilyMemberDisplay, UploadAvatarInput } from "../types/profileSettings";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import { familyRoleToPermission, permissionToFamilyRole } from "../utils/supabaseMappers";
import { BabyRepository } from "../repositories/BabyRepository";
import { formatBabyAge, formatDueCountdown, formatGestationalAge, isPregnancyStage } from "../utils/childDisplay";
import { isValidBirthDate, isValidCalendarDate } from "../utils/dateInput";
import { formatDateKey, offsetDateKey } from "../utils/dateKey";
import { presentAvatarPicker } from "../utils/profileAvatarPicker";
import { colors, radius } from "../theme";
import { CAUTION_FOOD_PRESETS } from "../types/cautionFood";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const MEMBER_COLORS = [colors.amber, "#7c83fd", "#5CB87A", "#c98a54"];

const BABY_PROFILE_ERROR_KEYS: Record<BabyProfileErrorCode, Parameters<ReturnType<typeof useLanguage>["t"]>[0]> = {
  name_required: "babyProfile.error.nameRequired",
  birth_date_invalid: "babyProfile.error.birthDateInvalid",
  permission_denied: "babyProfile.error.permission",
  save_failed: "babyProfile.error.save",
  photo_too_large: "babyProfile.error.photoTooLarge",
  photo_upload_failed: "babyProfile.error.photoUpload",
  photo_load_failed: "babyProfile.error.photoLoad",
};

export function BabyProfileScreen() {
  const { locale, t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "BabyProfile">>();
  const isCreating = route.params?.mode === "create";
  const convertBirth = route.params?.mode === "convertBirth";
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const { settings } = useAppSettings();
  const {
    babyName,
    babyBirthMeta,
    myFamilyRole,
    updateFamilyMemberRole,
    setFamilyMemberStatus,
    removeFamilyMember,
    rehydrateFromServer,
    cautionFoods,
    addCautionFood,
    removeCautionFood,
    activeBabyId,
    addBaby,
  } = useBabyLog();

  const babyId = activeBabyId;
  const allowInvite = canInvite(myFamilyRole);
  const allowManage = canManageMembers(myFamilyRole);
  const canEditBaby = isCreating || myFamilyRole === "owner" || myFamilyRole === "admin" || myFamilyRole === "editor" || myFamilyRole === "caregiver";

  const [editing, setEditing] = useState(isCreating || convertBirth);
  const [loading, setLoading] = useState(!convertBirth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(careSetup.child.photoUri);
  const [name, setName] = useState(careSetup.child.childName);
  const [nickname, setNickname] = useState(careSetup.child.nickname ?? "");
  const [birthDate, setBirthDate] = useState(careSetup.child.birthDate ?? "");
  const [dueDate, setDueDate] = useState(careSetup.child.dueDate ?? "");
  const [birthWeight, setBirthWeight] = useState(careSetup.child.birthWeight ?? "");
  const [createStage, setCreateStage] = useState<"pregnancy" | "born" | null>(null);
  const [converting, setConverting] = useState(convertBirth);
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [gender, setGender] = useState(careSetup.child.gender ?? "unknown");
  const [note, setNote] = useState(careSetup.child.specialNotes ?? "");
  const [members, setMembers] = useState<FamilyMemberDisplay[]>([]);
  const [customCautionFood, setCustomCautionFood] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<UploadAvatarInput | null>(null);

  const localizedError = useCallback((cause: unknown, fallback: Parameters<typeof t>[0]) =>
    cause instanceof BabyProfileError ? t(BABY_PROFILE_ERROR_KEYS[cause.code]) : t(fallback), [t]);
  const genderLabel = useCallback((value: typeof gender) => t(value === "girl" ? "babyProfile.gender.girl" : value === "boy" ? "babyProfile.gender.boy" : "babyProfile.gender.none"), [t]);
  const roleLabel = useCallback((role: FamilyRole) => t(`babyProfile.role.${role}` as Parameters<typeof t>[0]), [t]);
  const statusLabel = useCallback((status: FamilyMemberDisplay["status"]) => t(`babyProfile.status.${status}` as Parameters<typeof t>[0]), [t]);
  const relationLabel = useCallback((relation: string) => {
    const index = PROFILE_RELATION_OPTIONS.indexOf(relation as (typeof PROFILE_RELATION_OPTIONS)[number]);
    const keys = ["mom", "dad", "grandmother", "grandfather", "aunt", "uncle", "guardian", "family", "sitter", "friend", "other"] as const;
    return index >= 0 ? t(`profileSetup.relation.${keys[index]}` as Parameters<typeof t>[0]) : relation;
  }, [t]);

  useLayoutEffect(() => {
    const goHome = () => {
      if (convertBirth) navigation.setParams({ mode: undefined });
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("MainTabs");
    };
    navigation.setOptions({
      title: isCreating ? t("babyProfile.title.add") : convertBirth ? t("babyProfile.title.birth") : t("babyProfile.title.profile"),
      headerLeft: () => (
        <Pressable
          onPress={goHome}
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          accessibilityRole="button"
          accessibilityLabel={t("babyProfile.backHome")}
        >
          <ChevronLeft size={26} color={colors.text} strokeWidth={2.2} />
        </Pressable>
      ),
    });
  }, [convertBirth, isCreating, navigation, t]);

  const pregnancy = isCreating ? createStage === "pregnancy" : isPregnancyStage({
    childStatus: careSetup.child.childStatus,
    birthDate: birthDate || careSetup.child.birthDate,
  }) && !converting;
  const configuredAge = pregnancy
    ? [formatGestationalAge(dueDate || careSetup.child.dueDate, new Date(), locale), formatDueCountdown(dueDate || careSetup.child.dueDate, new Date(), locale)].filter(Boolean).join(" · ")
    : formatBabyAge(
        { ...careSetup.child, childName: name, birthDate: birthDate || undefined },
        settings.time.babyAge,
        locale,
      );

  const load = useCallback(async (opts?: { skipBirthConvert?: boolean }) => {
    setLoading(true);
    setError("");
    if (isCreating) {
      setName("");
      setNickname("");
      setBirthDate("");
      setDueDate("");
      setBirthWeight("");
      setCreateStage(null);
      setConverting(false);
      setGender("unknown");
      setNote("");
      setAvatarUrl(undefined);
      setPendingAvatar(null);
      setEditing(true);
      setMembers([]);
      setLoading(false);
      return;
    }
    const enterConvert = Boolean(convertBirth && !opts?.skipBirthConvert);
    const applyBirthConvert = (nextBirthDate?: string, nextStatus?: string) => {
      const stillPregnant = isPregnancyStage({
        childStatus: nextStatus === "unborn" || nextStatus === "newborn" || nextStatus === "infant"
          ? nextStatus
          : careSetup.child.childStatus,
        birthDate: nextBirthDate,
      });
      if (enterConvert && stillPregnant) {
        setConverting(true);
        setEditing(true);
        setBirthDate("");
      } else {
        setConverting(false);
      }
    };
    try {
      if (babyId) {
        const profile = await BabyProfileRepository.getBabyProfile(babyId);
        if (profile) {
          setName(profile.name);
          setNickname(profile.nickname ?? "");
          setBirthDate(profile.birthDate ?? "");
          setDueDate(profile.dueDate ?? careSetup.child.dueDate ?? "");
          setBirthWeight(profile.birthWeight ?? careSetup.child.birthWeight ?? "");
          setGender((profile.gender as typeof gender) || "unknown");
          setNote(profile.note ?? "");
          setAvatarUrl(profile.avatarUrl ?? profile.photoUrl);
          applyBirthConvert(profile.birthDate, profile.childStatus);
        } else {
          applyBirthConvert(careSetup.child.birthDate, careSetup.child.childStatus);
        }
        setMembers(await FamilyRepository.listMemberDisplays(babyId));
      } else {
        setName(careSetup.child.childName);
        setNickname(careSetup.child.nickname ?? "");
        setBirthDate(careSetup.child.birthDate ?? "");
        setDueDate(careSetup.child.dueDate ?? "");
        setBirthWeight(careSetup.child.birthWeight ?? "");
        setGender(careSetup.child.gender ?? "unknown");
        setNote(careSetup.child.specialNotes ?? "");
        setAvatarUrl(careSetup.child.photoUri);
        applyBirthConvert(careSetup.child.birthDate, careSetup.child.childStatus);
      }
    } catch (cause) {
      setError(localizedError(cause, "babyProfile.error.load"));
    } finally {
      setLoading(false);
    }
  }, [babyId, careSetup.child, convertBirth, isCreating, localizedError]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const syncLocal = (next: {
    name: string;
    nickname?: string;
    birthDate?: string;
    dueDate?: string;
    childStatus?: typeof careSetup.child.childStatus;
    gender?: typeof gender;
    note?: string;
    photoUri?: string;
    birthWeight?: string;
  }) => {
    const nextGender = next.gender === "girl" || next.gender === "boy" ? next.gender : "unknown";
    const setup = {
      ...careSetup,
      child: {
        ...careSetup.child,
        childName: next.name,
        nickname: next.nickname,
        birthDate: next.birthDate,
        dueDate: next.dueDate ?? careSetup.child.dueDate,
        childStatus: next.childStatus ?? careSetup.child.childStatus,
        gender: nextGender as "girl" | "boy" | "unknown",
        specialNotes: next.note,
        photoUri: next.photoUri,
        birthWeight: next.birthWeight ?? careSetup.child.birthWeight,
      },
    };
    setCareSetup(setup);
  };

  const save = async () => {
    if (!canEditBaby || saving) return;
    if (isCreating && !createStage) {
      setError(t("babyProfile.error.stageRequired"));
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("babyProfile.error.nameRequired"));
      return;
    }
    if (createStage === "born" && birthDate.trim() && !isValidBirthDate(birthDate.trim())) {
      setError(t("babyProfile.error.birthDateInvalid"));
      return;
    }
    if ((isCreating ? createStage === "pregnancy" : pregnancy || converting) && dueDate.trim() && !isValidCalendarDate(dueDate.trim())) {
      setError(t("babyProfile.error.dueDateInvalid"));
      return;
    }
    if (!isCreating && converting && !isValidBirthDate(birthDate.trim())) {
      setError(t("babyProfile.error.actualBirthRequired"));
      return;
    }
    if ((isCreating ? createStage === "pregnancy" : pregnancy) && !dueDate.trim()) {
      setError(t("babyProfile.error.dueDateRequired"));
      return;
    }
    if (isCreating && createStage === "born" && !birthDate.trim()) {
      setError(t("babyProfile.error.birthDateRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isCreating) {
        const created = await addBaby({
          name: trimmed,
          birthDate: createStage === "born" ? birthDate.trim() || undefined : undefined,
          dueDate: dueDate.trim() || undefined,
          childStatus: createStage === "pregnancy" ? "unborn" : "newborn",
          gender: gender === "unknown" ? undefined : gender,
          specialNotes: note.trim() || undefined,
          birthWeight: createStage === "born" ? birthWeight.trim() || undefined : undefined,
        });
        let profileFollowupFailed = false;
        try {
          if (nickname.trim()) {
            await BabyProfileRepository.updateBabyProfile({
              babyId: created.id,
              name: trimmed,
              nickname,
              gender: gender === "unknown" ? null : gender,
              note,
              ...(createStage === "born" ? { birthDate: birthDate.trim() || null } : { dueDate: dueDate.trim() || null, childStatus: "unborn" }),
            });
          }
          if (pendingAvatar) await BabyProfileRepository.uploadBabyAvatar(created.id, pendingAvatar);
        } catch {
          profileFollowupFailed = true;
        }
        await rehydrateFromServer().catch(() => undefined);
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "Record" } }],
        });
        if (profileFollowupFailed) {
          Alert.alert(t("babyProfile.addedTitle"), t("babyProfile.error.followup"));
        }
        return;
      }
      if (!babyId) {
        setError(t("babyProfile.error.noBaby"));
        return;
      }
      const becomingBorn = converting || Boolean(birthDate.trim() && careSetup.child.childStatus === "unborn");
      const next = await BabyProfileRepository.updateBabyProfile({
        babyId,
        name: trimmed,
        nickname,
        gender: gender === "unknown" ? null : gender,
        note,
        ...(pregnancy || converting || dueDate.trim()
          ? { dueDate: dueDate.trim() || careSetup.child.dueDate || null }
          : {}),
        ...(becomingBorn
          ? {
              birthDate: birthDate.trim(),
              childStatus: "newborn",
              birthWeight: birthWeight.trim() || null,
            }
          : pregnancy
            ? { childStatus: "unborn" }
            : { birthDate: birthDate.trim() || null }),
      });
      if (becomingBorn) {
        await BabyRepository.updateBaby(babyId, {
          dueDate: dueDate.trim() || careSetup.child.dueDate || null,
          childStatus: "newborn",
          birthDate: birthDate.trim(),
        }).catch(() => undefined);
      }
      setAvatarUrl(next.avatarUrl ?? avatarUrl);
      syncLocal({
        name: next.name,
        nickname: next.nickname,
        birthDate: becomingBorn ? birthDate.trim() : next.birthDate,
        dueDate: next.dueDate ?? (dueDate.trim() || careSetup.child.dueDate),
        childStatus: becomingBorn ? "newborn" : pregnancy ? "unborn" : careSetup.child.childStatus,
        gender: (next.gender as typeof gender) || "unknown",
        note: next.note,
        photoUri: next.avatarUrl ?? avatarUrl,
        birthWeight: birthWeight.trim() || next.birthWeight,
      });
      setConverting(false);
      setEditing(false);
      if (convertBirth) navigation.setParams({ mode: undefined });
      await rehydrateFromServer().catch(() => undefined);
    } catch (cause) {
      setError(localizedError(cause, "babyProfile.error.save"));
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = () => {
    if (!canEditBaby || (!babyId && !isCreating)) {
      setError(t("babyProfile.error.permission"));
      return;
    }
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl),
      t,
      onPick: (avatar) => {
        if (isCreating) {
          setPendingAvatar(avatar);
          setAvatarUrl(avatar.uri);
          return;
        }
        if (!babyId) return;
        setSaving(true);
        setError("");
        void BabyProfileRepository.uploadBabyAvatar(babyId, avatar)
          .then((next) => {
            setAvatarUrl(next.avatarUrl);
            syncLocal({
              name: next.name,
              nickname: next.nickname,
              birthDate: next.birthDate,
              gender: (next.gender as typeof gender) || gender,
              note: next.note,
              photoUri: next.avatarUrl,
            });
          })
          .catch((cause) => setError(localizedError(cause, "babyProfile.error.photoUpload")))
          .finally(() => setSaving(false));
      },
      onClear: () => {
        if (isCreating) {
          setPendingAvatar(null);
          setAvatarUrl(undefined);
          return;
        }
        if (!babyId) return;
        setSaving(true);
        void BabyProfileRepository.updateBabyProfile({
          babyId,
          name: name.trim() || babyName,
          nickname,
          birthDate: birthDate.trim() || null,
          gender: gender === "unknown" ? null : gender,
          note,
          clearAvatar: true,
        })
          .then((next) => {
            setAvatarUrl(undefined);
            syncLocal({
              name: next.name,
              nickname: next.nickname,
              birthDate: next.birthDate,
              gender: (next.gender as typeof gender) || "unknown",
              note: next.note,
              photoUri: undefined,
            });
          })
          .catch((cause) => setError(localizedError(cause, "babyProfile.error.save")))
          .finally(() => setSaving(false));
      },
    });
  };

  const roleOptions = useMemo(() => (["admin", "editor", "caregiver", "viewer"] as FamilyRole[]), []);

  if (loading && !converting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amberText} />
        <Text style={styles.muted}>{t("babyProfile.loading")}</Text>
      </View>
    );
  }

  if (isCreating) {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? undefined : "padding"} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.card}>
            <Text style={styles.label}>{t("babyProfile.stageLabel")}</Text>
            <Text style={styles.inputHint}>{t("babyProfile.stageHint")}</Text>
            <Pressable
              style={[styles.choice, createStage === "pregnancy" && styles.choiceActive]}
              onPress={() => {
                setCreateStage("pregnancy");
                setBirthDate("");
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: createStage === "pregnancy" }}
            >
              <Text style={[styles.choiceTitle, createStage === "pregnancy" && styles.choiceTitleActive]}>{t("babyProfile.stagePregnancy")}</Text>
              <Text style={styles.choiceBody}>{t("babyProfile.stagePregnancyHint")}</Text>
            </Pressable>
            <Pressable
              style={[styles.choice, createStage === "born" && styles.choiceActive]}
              onPress={() => {
                setCreateStage("born");
                setDueDate("");
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: createStage === "born" }}
            >
              <Text style={[styles.choiceTitle, createStage === "born" && styles.choiceTitleActive]}>{t("babyProfile.stageBorn")}</Text>
              <Text style={styles.choiceBody}>{t("babyProfile.stageBornHint")}</Text>
            </Pressable>
          </View>

          {createStage ? (
          <View style={styles.babyCard}>
            <ProfileAvatar
              uri={avatarUrl}
              size={96}
              fallback="baby"
              editable
              onPress={pickAvatar}
              label={t("babyProfile.photoAdd")}
              imageFit="contain"
            />
            <View style={styles.babyCopy}>
              <Text style={styles.label}>{createStage === "pregnancy" ? t("babyProfile.prenatalName") : t("babyProfile.nameRequired")}</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={createStage === "pregnancy" ? t("babyProfile.prenatalNameExample") : t("babyProfile.name")} placeholderTextColor={colors.faint} maxLength={40} />
              <Text style={styles.label}>{t("babyProfile.nickname")}</Text>
              <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder={t("babyProfile.optional")} placeholderTextColor={colors.faint} maxLength={40} />
            </View>
          </View>
          ) : null}

          {createStage ? (
          <View style={styles.card}>
            {createStage === "pregnancy" ? (
              <>
                <Text style={styles.label}>{t("babyProfile.dueDateRequired")}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t("babyProfile.selectDueDate")} style={styles.dateInput} onPress={() => setDuePickerOpen(true)}>
                  <Text style={[styles.dateInputText, !dueDate && styles.datePlaceholder]}>{dueDate || t("babyProfile.selectDate")}</Text>
                  <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>{t("babyProfile.birthDateRequired")}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t("babyProfile.selectBirthDate")} style={styles.dateInput} onPress={() => setBirthPickerOpen(true)}>
                  <Text style={[styles.dateInputText, !birthDate && styles.datePlaceholder]}>{birthDate || t("babyProfile.selectDate")}</Text>
                  <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
                </Pressable>
              </>
            )}
            <Text style={styles.label}>{t("babyProfile.gender")}</Text>
            <View style={styles.chips}>
              {(["unknown", "girl", "boy"] as const).map((value) => (
                <Pressable key={value} style={[styles.chip, gender === value && styles.chipActive]} onPress={() => setGender(value)}>
                  <Text style={[styles.chipText, gender === value && styles.chipTextActive]}>{genderLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t("babyProfile.note")}</Text>
            <TextInput style={[styles.input, styles.note]} value={note} onChangeText={setNote} placeholder={t("babyProfile.notePlaceholder")} placeholderTextColor={colors.faint} multiline maxLength={400} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.saveText}>{t("babyProfile.addAndSelect")}</Text>}
            </Pressable>
          </View>
          ) : null}
        </ScrollView>
        <RecordDatePickerModal visible={birthPickerOpen} selectedDateKey={birthDate || formatDateKey()} maxDateKey={formatDateKey()} title={t("babyProfile.selectBirthDate")} onSelect={setBirthDate} onClose={() => setBirthPickerOpen(false)} />
        <RecordDatePickerModal
          visible={duePickerOpen}
          selectedDateKey={dueDate || formatDateKey()}
          minDateKey={formatDateKey(new Date(new Date().getFullYear() - 1, 0, 1), "midnight")}
          maxDateKey={offsetDateKey(formatDateKey(), 365)}
          title={t("babyProfile.selectDueDate")}
          onSelect={setDueDate}
          onClose={() => setDuePickerOpen(false)}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? undefined : "padding"} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.babyCard}>
          <View style={styles.switcherBtn}>
            <BabySwitcher variant="switchButton" />
          </View>
          <ProfileAvatar
            uri={avatarUrl}
            size={96}
            fallback="baby"
            editable={canEditBaby}
            onPress={canEditBaby ? pickAvatar : undefined}
            label={t("babyProfile.photoAdd")}
            imageFit="contain"
          />
          <View style={styles.babyCopy}>
            {editing ? (
              <>
                <Text style={styles.label}>{t("babyProfile.name")}</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("babyProfile.name")} placeholderTextColor={colors.faint} maxLength={40} />
                <Text style={styles.label}>{t("babyProfile.nickname")}</Text>
                <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder={t("babyProfile.optional")} placeholderTextColor={colors.faint} maxLength={40} />
              </>
            ) : (
              <>
                <Text style={styles.babyName}>{name || babyName}</Text>
                {nickname ? <Text style={styles.nickname}>{nickname}</Text> : null}
                <Text style={styles.babyAge}>{configuredAge ?? babyBirthMeta}</Text>
              </>
            )}
          </View>
          {canEditBaby ? (
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                if (editing) {
                  setEditing(false);
                  setConverting(false);
                  if (convertBirth) navigation.setParams({ mode: undefined });
                  void load({ skipBirthConvert: true });
                } else setEditing(true);
              }}
            >
              <Text style={styles.editBtnText}>{editing ? t("babyProfile.cancel") : t("babyProfile.edit")}</Text>
            </Pressable>
          ) : null}
        </View>

        {canEditBaby && !editing && isPregnancyStage(careSetup.child) ? (
          <Pressable
            style={styles.save}
            onPress={() => {
              setConverting(true);
              setEditing(true);
              setBirthDate("");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("babyProfile.bornCta")}
          >
            <Text style={styles.saveText}>{t("babyProfile.bornCta")}</Text>
          </Pressable>
        ) : null}

        {editing ? (
          <View style={styles.card}>
            {pregnancy ? (
              <>
                <Text style={styles.label}>{t("babyProfile.dueDate")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("babyProfile.selectDueDate")}
                  style={styles.dateInput}
                  onPress={() => setDuePickerOpen(true)}
                >
                  <Text style={[styles.dateInputText, !dueDate && styles.datePlaceholder]}>
                    {dueDate || t("babyProfile.selectDate")}
                  </Text>
                  <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
                </Pressable>
                <Text style={styles.inputHint}>{t("babyProfile.dueDateHint")}</Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>{converting ? t("babyProfile.actualBirthDate") : t("babyProfile.birthDate")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={converting ? t("babyProfile.selectActualBirthDate") : t("babyProfile.selectBirthDate")}
                  style={styles.dateInput}
                  onPress={() => setBirthPickerOpen(true)}
                >
                  <Text style={[styles.dateInputText, !birthDate && styles.datePlaceholder]}>
                    {birthDate || t("babyProfile.selectDate")}
                  </Text>
                  <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
                </Pressable>
                {converting ? (
                  <>
                    <Text style={styles.inputHint}>{t("babyProfile.actualBirthHint")}</Text>
                    <Text style={styles.label}>{t("babyProfile.dueDate")}</Text>
                    <Text style={styles.metaValue}>{dueDate || t("babyProfile.notEntered")}</Text>
                    <Text style={styles.label}>{t("babyProfile.birthWeight")}</Text>
                    <TextInput style={styles.input} value={birthWeight} onChangeText={setBirthWeight} placeholder={t("babyProfile.birthWeightExample")} placeholderTextColor={colors.faint} />
                  </>
                ) : null}
              </>
            )}
            <Text style={styles.label}>{t("babyProfile.gender")}</Text>
            <View style={styles.chips}>
              {(["unknown", "girl", "boy"] as const).map((value) => (
                <Pressable key={value} style={[styles.chip, gender === value && styles.chipActive]} onPress={() => setGender(value)}>
                  <Text style={[styles.chipText, gender === value && styles.chipTextActive]}>{genderLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t("babyProfile.note")}</Text>
            <TextInput
              style={[styles.input, styles.note]}
              value={note}
              onChangeText={setNote}
              placeholder={t("babyProfile.notePlaceholder")}
              placeholderTextColor={colors.faint}
              multiline
              maxLength={400}
            />
            <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.saveText}>{converting ? t("babyProfile.registerBirth") : t("babyProfile.save")}</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            {isPregnancyStage(careSetup.child) ? (
              <>
                <Text style={styles.metaLabel}>{t("babyProfile.dueDate")}</Text>
                <Text style={styles.metaValue}>{dueDate || t("babyProfile.notEntered")}</Text>
              </>
            ) : (
              <>
                <Text style={styles.metaLabel}>{t("babyProfile.birthDate")}</Text>
                <Text style={styles.metaValue}>{birthDate || t("babyProfile.notEntered")}</Text>
                {dueDate ? (
                  <>
                    <Text style={styles.metaLabel}>{t("babyProfile.dueDate")}</Text>
                    <Text style={styles.metaValue}>{dueDate}</Text>
                  </>
                ) : null}
              </>
            )}
            <Text style={styles.metaLabel}>{t("babyProfile.gender")}</Text>
            <Text style={styles.metaValue}>{gender === "unknown" ? t("babyProfile.notEntered") : genderLabel(gender)}</Text>
            {note ? (
              <>
                <Text style={styles.metaLabel}>{t("babyProfile.note")}</Text>
                <Text style={styles.metaValue}>{note}</Text>
              </>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("babyProfile.caution.title")}</Text>
          <Text style={styles.cautionHelp}>{t("babyProfile.caution.help")}</Text>
          <View style={styles.chips}>
            {CAUTION_FOOD_PRESETS.slice(0, -1).map((food, foodIndex) => {
              const selected = cautionFoods.find((item) => item.foodName === food);
              return (
                <Pressable
                  key={food}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => void (selected ? removeCautionFood(selected.id) : addCautionFood(food, "preset")).catch(() => setError(t("babyProfile.error.cautionFood")))}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{selected ? "✓ " : ""}{t(`babyProfile.food.${["milk", "egg", "peanut", "wheat", "soy", "sesame", "nuts", "fish", "shellfish"][foodIndex]}` as Parameters<typeof t>[0])}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customFoodRow}>
            <TextInput style={[styles.input, styles.customFoodInput]} value={customCautionFood} onChangeText={setCustomCautionFood} placeholder={t("babyProfile.caution.custom")} placeholderTextColor={colors.faint} maxLength={40} />
            <Pressable style={styles.customFoodButton} onPress={() => {
              void addCautionFood(customCautionFood, "custom")
                .then(() => setCustomCautionFood(""))
                .catch(() => setError(t("babyProfile.error.cautionFood")));
            }}><Text style={styles.customFoodButtonText}>{t("babyProfile.add")}</Text></Pressable>
          </View>
          {cautionFoods.filter((food) => food.source === "custom").map((food) => (
            <View key={food.id} style={styles.customFoodItem}>
              <Text style={styles.customFoodName}>{food.foodName}</Text>
              <Pressable onPress={() => void removeCautionFood(food.id)}><Text style={styles.customFoodRemove}>{t("babyProfile.delete")}</Text></Pressable>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("babyProfile.family.title")}</Text>
          <Pressable onPress={() => navigation.navigate("MyProfile")}>
            <Text style={styles.link}>{t("babyProfile.myProfile")}</Text>
          </Pressable>
        </View>

        {members.length === 0 ? (
          <EmptyState
            title={t("babyProfile.family.emptyTitle")}
            body={t("babyProfile.family.emptyBody")}
            ctaLabel={t("babyProfile.family.invite")}
            onPressCta={() => navigation.navigate("FamilyShare")}
          />
        ) : (
          members.map((m, i) => (
            <View key={m.membershipId} style={[styles.memberRow, m.status === "inactive" && styles.inactiveRow]}>
              <View style={[styles.avatar, { backgroundColor: `${MEMBER_COLORS[i % MEMBER_COLORS.length]}22` }]}>
                {m.avatarUrl ? (
                  <Image source={{ uri: m.avatarUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <BabyLogIcon kind="profile" size={18} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {m.displayName}
                  {m.isMe ? t("babyProfile.meSuffix") : ""}
                </Text>
                <Text style={styles.memberRole}>
                  {m.realName ? `${m.realName} · ` : ""}{relationLabel(m.relation)} · {roleLabel(permissionToFamilyRole(m.role))}
                  <Text style={styles.badge}>{t("babyProfile.familyBadge")}</Text>
                </Text>
                {!m.isMe && allowManage && m.status !== "inactive" ? (
                  <View style={styles.miniRoles}>
                    {roleOptions.map((r) => {
                      const active = m.role === familyRoleToPermission(r);
                      return (
                      <Pressable
                        key={r}
                        style={[styles.miniChip, active && styles.miniChipActive]}
                        onPress={() => {
                          void FamilyRepository.updateMemberRole(babyId!, m.userId, r)
                            .then(() => {
                              updateFamilyMemberRole(m.userId, r);
                              return load();
                            })
                            .catch(() => setError(t("babyProfile.error.role")));
                        }}
                      >
                        <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>
                          {roleLabel(r)}
                        </Text>
                      </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {!m.isMe && allowManage ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        Alert.alert(t("babyProfile.changeRelationTitle"), undefined, [
                          { text: t("babyProfile.cancel"), style: "cancel" },
                          ...PROFILE_RELATION_OPTIONS.slice(0, 6).map((relation) => ({
                            text: relationLabel(relation),
                            onPress: () => {
                              void FamilyRepository.updateMemberRelation({
                                babyId: babyId!,
                                userId: m.userId,
                                relation,
                              })
                                .then(() => load())
                                .catch(() => setError(t("babyProfile.error.relation")));
                            },
                          })),
                        ]);
                      }}
                    >
                      <Text style={styles.actionText}>{t("babyProfile.changeRelation")}</Text>
                    </Pressable>
                    {m.status !== "inactive" ? (
                      <Pressable style={styles.actionBtn} onPress={() => setFamilyMemberStatus(m.userId, "inactive")}>
                        <Text style={styles.actionText}>{t("babyProfile.deactivate")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.actionBtn} onPress={() => setFamilyMemberStatus(m.userId, "active")}>
                        <Text style={styles.actionText}>{t("babyProfile.reactivate")}</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        Alert.alert(t("babyProfile.removeTitle"), t("babyProfile.removeBody"), [
                          { text: t("babyProfile.cancel"), style: "cancel" },
                          {
                            text: t("babyProfile.remove"),
                            style: "destructive",
                            onPress: () => {
                              void FamilyRepository.removeMember({ babyId: babyId!, userId: m.userId })
                                .then(() => {
                                  removeFamilyMember(m.userId);
                                  return load();
                                })
                                .catch(() => setError(t("babyProfile.error.removeMember")));
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={[styles.actionText, styles.danger]}>{t("babyProfile.delete")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <Text style={styles.memberStatus}>{m.isMe ? t("babyProfile.me") : statusLabel(m.status)}</Text>
            </View>
          ))
        )}

        {allowInvite ? (
          <Pressable style={styles.invite} onPress={() => navigation.navigate("FamilyShare")}>
            <Text style={styles.inviteText}>{t("babyProfile.share")}</Text>
          </Pressable>
        ) : (
          <Text style={styles.viewerHint}>{t("babyProfile.noInvitePermission")}</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <RecordDatePickerModal
        visible={birthPickerOpen}
        selectedDateKey={birthDate || formatDateKey()}
        minDateKey={formatDateKey(new Date(new Date().getFullYear() - 18, 0, 1), "midnight")}
        maxDateKey={formatDateKey()}
        title={converting ? t("babyProfile.selectActualBirthDate") : t("babyProfile.selectBirthDate")}
        onSelect={setBirthDate}
        onClose={() => setBirthPickerOpen(false)}
      />
      <RecordDatePickerModal
        visible={duePickerOpen}
        selectedDateKey={dueDate || formatDateKey()}
        minDateKey={formatDateKey(new Date(new Date().getFullYear() - 1, 0, 1), "midnight")}
        maxDateKey={offsetDateKey(formatDateKey(), 365)}
        title={t("babyProfile.selectDueDate")}
        onSelect={setDueDate}
        onClose={() => setDuePickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 13 },
  content: { padding: 20, gap: 14 },
  babyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 54,
    alignItems: "center",
    gap: 12,
  },
  babyCopy: { width: "100%", alignItems: "center", gap: 6 },
  babyName: { color: colors.text, fontSize: 22, fontWeight: "800" },
  nickname: { color: colors.amberText, fontSize: 13, fontWeight: "700" },
  babyAge: { color: colors.muted, fontSize: 13 },
  switcherBtn: { position: "absolute", top: 14, left: 14, zIndex: 2 },
  editBtn: { position: "absolute", top: 14, right: 14, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  editBtnText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", alignSelf: "flex-start" },
  input: { width: "100%", minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, paddingHorizontal: 12, color: colors.text, fontSize: 15 },
  dateInput: { width: "100%", minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  datePlaceholder: { color: colors.faint, fontWeight: "500" },
  inputHint: { color: colors.faint, fontSize: 11.5, lineHeight: 16 },
  note: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  cautionHelp: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  customFoodRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customFoodInput: { flex: 1 },
  customFoodButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  customFoodButtonText: { color: colors.amberDark, fontSize: 12.5, fontWeight: "800" },
  customFoodItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 40, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.backgroundSecondary },
  customFoodName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  customFoodRemove: { color: colors.dangerText, fontSize: 11.5, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  chipTextActive: { color: colors.amberText },
  choice: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  choiceActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  choiceTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  choiceTitleActive: { color: colors.amberText },
  choiceBody: { color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  metaLabel: { color: colors.faint, fontSize: 11.5, fontWeight: "700" },
  metaValue: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  link: { color: colors.amberText, fontWeight: "700", fontSize: 13 },
  memberRow: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  inactiveRow: { opacity: 0.55 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  memberRole: { color: colors.muted, fontSize: 12 },
  badge: { color: colors.faint },
  miniRoles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  miniChip: { minHeight: TOUCH_MIN, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  miniChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  miniChipText: { color: colors.muted, fontSize: 10.5, fontWeight: "700" },
  miniChipTextActive: { color: colors.amberText },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionBtn: { minHeight: TOUCH_MIN, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  actionText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  danger: { color: colors.dangerText },
  memberStatus: { color: colors.faint, fontSize: 11, fontWeight: "700" },
  invite: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  inviteText: { color: colors.amberText, fontWeight: "800" },
  viewerHint: { textAlign: "center", color: colors.faint, fontSize: 12.5 },
  save: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveText: { color: colors.amberDark, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
});
