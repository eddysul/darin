import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { RecordDatePickerModal } from "../components/babylog/RecordDatePickerModal";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { EmptyState } from "../components/states/FeedbackStates";
import { useApp } from "../context/AppContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { useBabyLog } from "../context/BabyLogContext";
import type { RootStackParamList } from "../navigation/types";
import { BabyProfileRepository } from "../repositories/BabyProfileRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import {
  canInvite,
  canManageMembers,
  FAMILY_ROLE_LABELS,
  FAMILY_STATUS_LABELS,
  type FamilyRole,
} from "../types/family";
import type { FamilyMemberDisplay } from "../types/profileSettings";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import { familyRoleToPermission, permissionToFamilyRole } from "../utils/supabaseMappers";
import { formatBabyAge } from "../utils/childDisplay";
import { isValidBirthDate } from "../utils/dateInput";
import { formatDateKey } from "../utils/dateKey";
import { getSupabaseSync } from "../utils/supabaseSyncStore";
import { presentAvatarPicker } from "../utils/profileAvatarPicker";
import { colors, radius } from "../theme";

const MEMBER_COLORS = [colors.amber, "#7c83fd", "#5CB87A", "#c98a54"];

export function BabyProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  } = useBabyLog();

  const babyId = getSupabaseSync().babyId;
  const allowInvite = canInvite(myFamilyRole);
  const allowManage = canManageMembers(myFamilyRole);
  const canEditBaby = myFamilyRole === "owner" || myFamilyRole === "admin" || myFamilyRole === "editor" || myFamilyRole === "caregiver";

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(careSetup.child.photoUri);
  const [name, setName] = useState(careSetup.child.childName);
  const [nickname, setNickname] = useState(careSetup.child.nickname ?? "");
  const [birthDate, setBirthDate] = useState(careSetup.child.birthDate ?? "");
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [gender, setGender] = useState(careSetup.child.gender ?? "unknown");
  const [note, setNote] = useState(careSetup.child.specialNotes ?? "");
  const [members, setMembers] = useState<FamilyMemberDisplay[]>([]);

  const configuredAge = formatBabyAge(
    { ...careSetup.child, childName: name, birthDate: birthDate || undefined },
    settings.time.babyAge,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (babyId) {
        const profile = await BabyProfileRepository.getBabyProfile(babyId);
        if (profile) {
          setName(profile.name);
          setNickname(profile.nickname ?? "");
          setBirthDate(profile.birthDate ?? "");
          setGender((profile.gender as typeof gender) || "unknown");
          setNote(profile.note ?? "");
          setAvatarUrl(profile.avatarUrl ?? profile.photoUrl);
        }
        setMembers(await FamilyRepository.listMemberDisplays(babyId));
      } else {
        setName(careSetup.child.childName);
        setNickname(careSetup.child.nickname ?? "");
        setBirthDate(careSetup.child.birthDate ?? "");
        setGender(careSetup.child.gender ?? "unknown");
        setNote(careSetup.child.specialNotes ?? "");
        setAvatarUrl(careSetup.child.photoUri);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "아기 프로필을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [babyId, careSetup.child]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const syncLocal = (next: {
    name: string;
    nickname?: string;
    birthDate?: string;
    gender?: typeof gender;
    note?: string;
    photoUri?: string;
  }) => {
    const nextGender = next.gender === "girl" || next.gender === "boy" ? next.gender : "unknown";
    const setup = {
      ...careSetup,
      child: {
        ...careSetup.child,
        childName: next.name,
        nickname: next.nickname,
        birthDate: next.birthDate,
        gender: nextGender as "girl" | "boy" | "unknown",
        specialNotes: next.note,
        photoUri: next.photoUri,
      },
    };
    setCareSetup(setup);
  };

  const save = async () => {
    if (!canEditBaby || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("아기 이름을 입력해 주세요.");
      return;
    }
    if (birthDate.trim() && !isValidBirthDate(birthDate.trim())) {
      setError("생년월일을 YYYY-MM-DD 형식의 올바른 날짜로 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!babyId) throw new Error("현재 아기 정보를 서버에서 찾지 못했어요. 다시 로그인해 주세요.");
      const next = await BabyProfileRepository.updateBabyProfile({
        babyId,
        name: trimmed,
        nickname,
        birthDate: birthDate.trim() || null,
        gender: gender === "unknown" ? null : gender,
        note,
      });
      setAvatarUrl(next.avatarUrl ?? avatarUrl);
      syncLocal({
        name: next.name,
        nickname: next.nickname,
        birthDate: next.birthDate,
        gender: (next.gender as typeof gender) || "unknown",
        note: next.note,
        photoUri: next.avatarUrl ?? avatarUrl,
      });
      setEditing(false);
      await rehydrateFromServer().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = () => {
    if (!canEditBaby || !babyId) {
      setError("이 정보를 수정할 권한이 없어요.");
      return;
    }
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl),
      onPick: (avatar) => {
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
          .catch((cause) => setError(cause instanceof Error ? cause.message : "사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
      onClear: () => {
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
          .catch((cause) => setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
    });
  };

  const roleOptions = useMemo(() => (["admin", "editor", "caregiver", "viewer"] as FamilyRole[]), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.muted}>아기 프로필을 불러오는 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={88}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]} keyboardShouldPersistTaps="handled">
        <View style={styles.babyCard}>
          <ProfileAvatar
            uri={avatarUrl}
            size={96}
            fallback="baby"
            editable={canEditBaby}
            onPress={canEditBaby ? pickAvatar : undefined}
            label="아기 사진 추가"
            imageFit="contain"
          />
          <View style={styles.babyCopy}>
            {editing ? (
              <>
                <Text style={styles.label}>아기 이름</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="아기 이름" placeholderTextColor={colors.faint} maxLength={40} />
                <Text style={styles.label}>별명</Text>
                <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="선택 사항" placeholderTextColor={colors.faint} maxLength={40} />
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
                  void load();
                } else setEditing(true);
              }}
            >
              <Text style={styles.editBtnText}>{editing ? "취소" : "편집"}</Text>
            </Pressable>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.card}>
            <Text style={styles.label}>생년월일</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="생년월일 선택"
              style={styles.dateInput}
              onPress={() => setBirthPickerOpen(true)}
            >
              <Text style={[styles.dateInputText, !birthDate && styles.datePlaceholder]}>
                {birthDate || "날짜를 선택해 주세요"}
              </Text>
              <BabyLogIcon kind="calendar" size={18} color={colors.amber} />
            </Pressable>
            <Text style={styles.inputHint}>달력에서 생년월일을 선택해 주세요.</Text>
            <Text style={styles.label}>성별</Text>
            <View style={styles.chips}>
              {([
                ["unknown", "선택 안 함"],
                ["girl", "여아"],
                ["boy", "남아"],
              ] as const).map(([value, label]) => (
                <Pressable key={value} style={[styles.chip, gender === value && styles.chipActive]} onPress={() => setGender(value)}>
                  <Text style={[styles.chipText, gender === value && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>메모</Text>
            <TextInput
              style={[styles.input, styles.note]}
              value={note}
              onChangeText={setNote}
              placeholder="가족에게만 보이는 메모"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={400}
            />
            <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>저장</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.metaLabel}>생년월일</Text>
            <Text style={styles.metaValue}>{birthDate || "미입력"}</Text>
            <Text style={styles.metaLabel}>성별</Text>
            <Text style={styles.metaValue}>{gender === "girl" ? "여아" : gender === "boy" ? "남아" : "미입력"}</Text>
            {note ? (
              <>
                <Text style={styles.metaLabel}>메모</Text>
                <Text style={styles.metaValue}>{note}</Text>
              </>
            ) : null}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>함께 보는 가족</Text>
          <Pressable onPress={() => navigation.navigate("MyProfile")}>
            <Text style={styles.link}>내 프로필</Text>
          </Pressable>
        </View>

        {members.length === 0 ? (
          <EmptyState title="아직 공유 멤버가 없어요." body="가족 초대코드를 공유해 보세요." />
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
                  {m.isMe ? " (나)" : ""}
                </Text>
                <Text style={styles.memberRole}>
                  {m.relation} · {FAMILY_ROLE_LABELS[permissionToFamilyRole(m.role)]}
                  <Text style={styles.badge}> · 가족</Text>
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
                            .catch((cause) => setError(cause instanceof Error ? cause.message : "권한을 바꾸지 못했어요."));
                        }}
                      >
                        <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>
                          {FAMILY_ROLE_LABELS[r]}
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
                        Alert.alert("관계를 바꿀까요?", undefined, [
                          { text: "취소", style: "cancel" },
                          ...PROFILE_RELATION_OPTIONS.slice(0, 6).map((relation) => ({
                            text: relation,
                            onPress: () => {
                              void FamilyRepository.updateMemberRelation({
                                babyId: babyId!,
                                userId: m.userId,
                                relation,
                              })
                                .then(() => load())
                                .catch((cause) => setError(cause instanceof Error ? cause.message : "관계를 바꾸지 못했어요."));
                            },
                          })),
                        ]);
                      }}
                    >
                      <Text style={styles.actionText}>관계 수정</Text>
                    </Pressable>
                    {m.status !== "inactive" ? (
                      <Pressable style={styles.actionBtn} onPress={() => setFamilyMemberStatus(m.userId, "inactive")}>
                        <Text style={styles.actionText}>비활성화</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.actionBtn} onPress={() => setFamilyMemberStatus(m.userId, "active")}>
                        <Text style={styles.actionText}>다시 활성화</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        Alert.alert("구성원을 제거할까요?", "다시 초대하기 전까지 이 아기의 기록에 접근할 수 없어요.", [
                          { text: "취소", style: "cancel" },
                          {
                            text: "제거",
                            style: "destructive",
                            onPress: () => {
                              void FamilyRepository.removeMember({ babyId: babyId!, userId: m.userId })
                                .then(() => {
                                  removeFamilyMember(m.userId);
                                  return load();
                                })
                                .catch((cause) => setError(cause instanceof Error ? cause.message : "구성원을 제거하지 못했어요."));
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={[styles.actionText, styles.danger]}>삭제</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <Text style={styles.memberStatus}>{m.isMe ? "나" : FAMILY_STATUS_LABELS[m.status]}</Text>
            </View>
          ))
        )}

        {allowInvite ? (
          <Pressable style={styles.invite} onPress={() => navigation.navigate("FamilyShare")}>
            <Text style={styles.inviteText}>가족·친구 공유</Text>
          </Pressable>
        ) : (
          <Text style={styles.viewerHint}>초대 권한이 없어요. 관리자에게 요청해 주세요.</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <RecordDatePickerModal
        visible={birthPickerOpen}
        selectedDateKey={birthDate || formatDateKey()}
        minDateKey={formatDateKey(new Date(new Date().getFullYear() - 18, 0, 1), "midnight")}
        maxDateKey={formatDateKey()}
        title="생년월일 선택"
        onSelect={setBirthDate}
        onClose={() => setBirthPickerOpen(false)}
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
    padding: 18,
    alignItems: "center",
    gap: 12,
  },
  babyCopy: { width: "100%", alignItems: "center", gap: 6 },
  babyName: { color: colors.text, fontSize: 22, fontWeight: "800" },
  nickname: { color: colors.amber, fontSize: 13, fontWeight: "700" },
  babyAge: { color: colors.muted, fontSize: 13 },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  chipTextActive: { color: colors.amber },
  metaLabel: { color: colors.faint, fontSize: 11.5, fontWeight: "700" },
  metaValue: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  link: { color: colors.amber, fontWeight: "700", fontSize: 13 },
  memberRow: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  inactiveRow: { opacity: 0.55 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  memberRole: { color: colors.muted, fontSize: 12 },
  badge: { color: colors.faint },
  miniRoles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  miniChip: { minHeight: 30, paddingHorizontal: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  miniChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  miniChipText: { color: colors.muted, fontSize: 10.5, fontWeight: "700" },
  miniChipTextActive: { color: colors.amber },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionBtn: { minHeight: 34, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  actionText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  danger: { color: colors.dangerText },
  memberStatus: { color: colors.faint, fontSize: 11, fontWeight: "700" },
  invite: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  inviteText: { color: colors.amber, fontWeight: "800" },
  viewerHint: { textAlign: "center", color: colors.faint, fontSize: 12.5 },
  save: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveText: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
});
