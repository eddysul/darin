import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBabyLog } from "../context/BabyLogContext";
import {
  DarinFriendRepository,
  type BabyMemoryFriendDisplay,
  type DarinFriendDisplay,
} from "../repositories/DarinFriendRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import type { InviteType } from "../types/database";
import { FAMILY_ROLE_LABELS } from "../types/family";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import { getSupabaseSync } from "../utils/supabaseSyncStore";
import { colors, radius } from "../theme";

type InvitePreview = NonNullable<Awaited<ReturnType<typeof FamilyRepository.previewInviteCode>>>;

const INVITE_LABELS: Record<InviteType, string> = {
  family: "가족 초대",
  baby_friend: "아기 친구 초대",
  darin_friend: "다린 친구 맺기",
};

const INVITE_DESCRIPTIONS: Record<InviteType, string> = {
  family: "기록과 성장책을 함께 볼 수 있어요.",
  baby_friend: "추억과 친구 공개 포스트를 함께 나눠요.",
  darin_friend: "앱 안에서 친구로 연결돼요. 아기 기록은 공유되지 않아요.",
};

const INVITE_PERMISSION_COPY: Record<InviteType, string> = {
  family: "관리자 또는 편집 가능 권한으로 기록·일기·성장책을 함께 관리해요.",
  baby_friend: "친구 공개 Memories만 볼 수 있고 기록·일기·성장책은 볼 수 없어요.",
  darin_friend: "친구 관계만 연결되며 어떤 아기 기록도 자동으로 공유되지 않아요.",
};

const INVITE_ICON: Record<InviteType, string> = {
  family: "●●",
  baby_friend: "♡",
  darin_friend: "●●",
};

type ShareTab = "create" | "enter" | "people";

function inviteMessage(type: InviteType, code: string, babyName: string): string {
  const intro =
    type === "family"
      ? `${babyName}의 다린 기록을 함께 남기도록 초대했어요.`
      : type === "baby_friend"
        ? `${babyName}의 친구 공개 순간을 함께 보도록 초대했어요.`
        : "다린 친구로 초대했어요.";
  return `${intro}\n\n초대코드: ${code}\n\n다린 앱에서 ‘초대코드 입력’을 선택해 주세요.`;
}

function previewTitle(preview: InvitePreview): string {
  if (preview.invite_type === "darin_friend") return `${preview.inviter_name}님의 다린 친구 초대`;
  if (preview.invite_type === "baby_friend") return `${preview.baby_name ?? "아기"}의 친구 공개 초대`;
  return `${preview.baby_name ?? "아기"}의 가족 초대`;
}

export function FamilyShareScreen() {
  const insets = useSafeAreaInsets();
  const { babyName, myFamilyRole, familyMembers, rehydrateFromServer } = useBabyLog();
  const babyId = getSupabaseSync().babyId;
  const isAdmin = myFamilyRole === "owner" || myFamilyRole === "admin";
  const [activeTab, setActiveTab] = useState<ShareTab>("create");
  const [inviteType, setInviteType] = useState<InviteType>(() => (isAdmin ? "family" : "darin_friend"));
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [relation, setRelation] = useState("가족");
  const [createdCodes, setCreatedCodes] = useState<Partial<Record<InviteType, string>>>({});
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [darinFriends, setDarinFriends] = useState<DarinFriendDisplay[]>([]);
  const [babyFriends, setBabyFriends] = useState<BabyMemoryFriendDisplay[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const createdCode = createdCodes[inviteType] ?? "";

  const refresh = useCallback(async () => {
    const [profile, friends] = await Promise.all([
      ProfileRepository.getMyProfile().catch(() => null),
      DarinFriendRepository.listMyFriends().catch(() => []),
      rehydrateFromServer().catch(() => undefined),
    ]);
    if (profile) {
      setDisplayName((current) => current || profile.display_name || "");
      setRealName((current) => current || profile.nickname || "");
      setRelation((current) =>
        current === "가족" && profile.default_relation ? profile.default_relation : current,
      );
    }
    setDarinFriends(friends);
    if (babyId && isAdmin) {
      setBabyFriends(await DarinFriendRepository.listBabyMemoryFriends(babyId).catch(() => []));
    }
  }, [babyId, isAdmin, rehydrateFromServer]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const chooseType = (next: InviteType) => {
    setInviteType(next);
    setError("");
    setRelation(next === "family" ? "가족" : "친구");
  };

  const createInvite = async () => {
    if (working) return;
    if (inviteType !== "darin_friend" && (!babyId || !isAdmin)) {
      setError("아기 초대코드는 관리자만 만들 수 있어요.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const invite = await FamilyRepository.createInviteCode({
        babyId: inviteType === "darin_friend" ? null : babyId,
        inviteType,
        role,
        relationshipLabel: inviteType === "family" ? relation : "친구",
      });
      setCreatedCodes((current) => ({ ...current, [inviteType]: invite.code }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "초대코드를 만들지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const copyCode = async () => {
    if (!createdCode) return;
    await Clipboard.setStringAsync(createdCode);
    Alert.alert("복사 완료", "초대코드를 복사했어요.");
  };

  const openShareSheet = async () => {
    if (!createdCode) return;
    try {
      await Share.share({ message: inviteMessage(inviteType, createdCode, babyName) });
    } catch {
      Alert.alert("공유할 수 없어요", "초대코드를 복사해서 직접 보내주세요.");
    }
  };

  const shareToKakao = async () => {
    // Native Kakao Share is intentionally deferred. iOS presents KakaoTalk as
    // a target when installed, and remains usable for every other share app.
    await openShareSheet();
  };

  const inspectInvite = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized || working) return;
    setWorking(true);
    setError("");
    try {
      const next = await FamilyRepository.previewInviteCode(normalized);
      if (!next) throw new Error("초대코드를 찾지 못했어요.");
      if (!next.is_valid) {
        const reason =
          next.invalid_reason === "expired"
            ? "만료된 초대코드예요."
            : next.invalid_reason === "revoked"
              ? "취소된 초대코드예요."
              : "이미 사용된 초대코드예요.";
        throw new Error(reason);
      }
      setCode(normalized);
      setPreview(next);
      if (next.invite_type === "family" && next.relation) setRelation(next.relation);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "초대 정보를 확인하지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const acceptInvite = async () => {
    if (!preview || !displayName.trim() || !realName.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      const accepted = await FamilyRepository.acceptInviteCode({
        code,
        displayName: displayName.trim(),
        nickname: realName.trim(),
        relation,
      });
      await refresh();
      const message =
        accepted?.invite_type === "family"
          ? "아기 가족 목록에 연결됐어요."
          : accepted?.invite_type === "baby_friend"
            ? "친구 공개 순간을 볼 수 있도록 연결됐어요."
            : "다린 친구 목록에 추가됐어요.";
      Alert.alert("초대 수락 완료", message);
      setPreview(null);
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "초대를 수락하지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const addFriendToBaby = async (friend: DarinFriendDisplay) => {
    if (!babyId || !isAdmin || working) return;
    setWorking(true);
    setError("");
    try {
      await DarinFriendRepository.inviteFriendToBaby(babyId, friend.userId);
      await refresh();
      Alert.alert("친구 공개 연결 완료", `${friend.displayName}님이 ${babyName}의 친구 공개 순간을 볼 수 있어요.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "친구를 연결하지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const activeFamily = familyMembers.filter((member) => member.status === "active");
  const babyFriendIds = new Set(babyFriends.map((friend) => friend.userId));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>가족·친구 초대</Text>
          <Text style={styles.headerSubtitle}>가족과 친구를 안전하게 연결해요.</Text>
        </View>

        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>✈</Text></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{babyName}네 가족</Text>
            <Text style={styles.summaryMeta}>가족 {activeFamily.length}명 · 함께 기록 중</Text>
            <Text style={styles.summaryHint} numberOfLines={2}>
              {activeFamily.length <= 1 ? "아직 초대된 가족이 없어요." : `${activeFamily.length - 1}명의 가족과 연결되어 있어요.`}
            </Text>
          </View>
          <Pressable
            testID="friend-add-button"
            style={styles.summaryButton}
            onPress={() => setActiveTab("create")}
            accessibilityRole="button"
            accessibilityLabel="가족·친구 초대"
          >
            <Text style={styles.summaryButtonText}>가족·친구 초대</Text>
          </Pressable>
        </View>

        <View style={styles.hubCard}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {([
              ["create", "초대 만들기"],
              ["enter", "초대코드 입력"],
              ["people", "연결된 친구"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.tab, activeTab === value && styles.tabActive]}
                onPress={() => {
                  setActiveTab(value);
                  setError("");
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === value }}
              >
                <Text style={[styles.tabText, activeTab === value && styles.tabTextActive]} numberOfLines={1}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "create" ? (
            <View style={styles.tabBody}>
              <Text style={styles.sectionTitle}>누구를 초대할까요?</Text>
              {(["family", "baby_friend", "darin_friend"] as InviteType[]).map((type) => {
                const disabled = type !== "darin_friend" && !isAdmin;
                return (
                  <Pressable
                    key={type}
                    testID={`invite-choice-${type}`}
                    style={[styles.inviteOption, inviteType === type && styles.inviteOptionActive, disabled && styles.disabled]}
                    disabled={disabled}
                    onPress={() => chooseType(type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: inviteType === type, disabled }}
                  >
                    <View style={[styles.optionIcon, inviteType === type && styles.optionIconActive]}>
                      <Text style={[styles.optionIconText, inviteType === type && styles.optionIconTextActive]}>{INVITE_ICON[type]}</Text>
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{INVITE_LABELS[type]}</Text>
                      <Text style={styles.optionDescription}>{INVITE_DESCRIPTIONS[type]}</Text>
                      {disabled ? <Text style={styles.adminHint}>아기 관리자만 선택할 수 있어요.</Text> : null}
                    </View>
                    <Text style={[styles.optionArrow, inviteType === type && styles.optionArrowActive]}>›</Text>
                  </Pressable>
                );
              })}

              <Text style={styles.permissionHint}>{INVITE_PERMISSION_COPY[inviteType]}</Text>
              {inviteType === "family" ? (
                <View style={styles.roleArea}>
                  <Text style={styles.fieldLabel}>가족 권한</Text>
                  <View style={styles.chips}>
                    {(["admin", "editor"] as const).map((value) => (
                      <Pressable key={value} style={[styles.chip, role === value && styles.chipActive]} onPress={() => setRole(value)}>
                        <Text style={[styles.chipText, role === value && styles.chipTextActive]}>{value === "admin" ? "관리자" : "편집 가능"}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.permissionHint}>관리자는 구성원과 초대를 관리하고, 편집 가능은 기록을 추가·수정할 수 있어요.</Text>
                </View>
              ) : null}

              <View style={styles.sendSection}>
                <Text style={styles.sectionTitle}>초대 보내기</Text>
                {createdCode ? (
                  <>
                    <View style={styles.codePill}><Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>{createdCode}</Text></View>
                    <View style={styles.actionRow}>
                      <Pressable style={styles.secondary} onPress={() => void copyCode()} accessibilityLabel="초대코드 복사">
                        <Text style={styles.secondaryText}>▣  복사</Text>
                      </Pressable>
                      <Pressable style={styles.shareButton} onPress={() => void shareToKakao()} accessibilityLabel="초대코드 공유하기">
                        <Text style={styles.shareButtonText}>⌯  공유하기</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.shareHelper}>카카오톡 또는 공유하기로 바로 보낼 수 있어요.</Text>
                  </>
                ) : (
                  <Pressable style={[styles.primary, working && styles.disabled]} onPress={() => void createInvite()} disabled={working}>
                    {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>초대코드 생성</Text>}
                  </Pressable>
                )}
                {createdCode ? (
                  <Pressable style={styles.regenerateButton} onPress={() => void createInvite()} disabled={working}>
                    <Text style={styles.regenerateText}>새 코드 만들기</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {activeTab === "enter" ? (
            <View style={styles.tabBody}>
              <Text style={styles.sectionTitle}>초대코드 입력</Text>
              <Text style={styles.description}>받은 코드를 입력하면 연결 정보와 권한을 먼저 확인할 수 있어요.</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(value) => {
                  setCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16));
                  setPreview(null);
                  setError("");
                }}
                placeholder="DARIN-XXXXXXXX"
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void inspectInvite()}
              />
              <Pressable style={[styles.primary, (!code.trim() || working) && styles.disabled]} onPress={() => void inspectInvite()} disabled={!code.trim() || working}>
                {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>초대 정보 확인</Text>}
              </Pressable>

              {preview ? (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>{previewTitle(preview)}</Text>
                  <Text style={styles.description}>초대한 사람: {preview.inviter_name}</Text>
                  <Text style={styles.permissionHint}>{INVITE_PERMISSION_COPY[preview.invite_type]}</Text>
                  <Text style={styles.fieldLabel}>닉네임</Text>
                  <Text style={styles.fieldHelp}>앱에서 주로 보이는 이름이에요.</Text>
                  <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="예: 콩이맘, 준이아빠" placeholderTextColor={colors.faint} maxLength={40} />
                  <Text style={styles.fieldLabel}>이름</Text>
                  <Text style={styles.fieldHelp}>친구와 가족이 확인할 수 있는 이름이에요.</Text>
                  <TextInput style={styles.input} value={realName} onChangeText={setRealName} placeholder="예: 김민지, 이원준" placeholderTextColor={colors.faint} maxLength={40} />
                  {preview.invite_type === "family" ? (
                    <>
                      <Text style={styles.fieldLabel}>아기와의 관계</Text>
                      <View style={styles.chips}>
                        {PROFILE_RELATION_OPTIONS.map((value) => (
                          <Pressable key={value} style={[styles.chip, relation === value && styles.chipActive]} onPress={() => setRelation(value)}>
                            <Text style={[styles.chipText, relation === value && styles.chipTextActive]}>{value}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Pressable style={[styles.primary, (!displayName.trim() || !realName.trim() || working) && styles.disabled]} onPress={() => void acceptInvite()} disabled={!displayName.trim() || !realName.trim() || working}>
                    <Text style={styles.primaryText}>초대 수락</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === "people" ? (
            <View style={styles.tabBody}>
              <Text style={styles.sectionTitle}>연결된 사람</Text>
              <Text style={styles.permissionHint}>친구 관계만으로는 아기 기록을 볼 수 없어요.</Text>

              <View style={styles.peopleSection}>
                <Text style={styles.peopleTitle}>가족</Text>
                {activeFamily.length ? activeFamily.map((member) => (
                  <View key={member.id} style={styles.personRow}>
                    <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{member.name.slice(0, 1)}</Text></View>
                    <View style={styles.friendCopy}>
                      <Text style={styles.person}>{member.name}</Text>
                      <Text style={styles.nickname}>{member.realName ? `${member.realName} · ` : ""}{member.relationshipLabel ?? "가족"} · {FAMILY_ROLE_LABELS[member.role]}</Text>
                    </View>
                  </View>
                )) : <Text style={styles.empty}>아직 초대된 가족이 없어요.</Text>}
              </View>

              <View style={styles.peopleSection}>
                <Text style={styles.peopleTitle}>아기 친구</Text>
                {babyFriends.length ? babyFriends.map((friend) => (
                  <View key={friend.membershipId} style={styles.personRow}>
                    <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{friend.displayName.slice(0, 1)}</Text></View>
                    <View style={styles.friendCopy}>
                      <Text style={styles.person}>{friend.displayName}</Text>
                      <Text style={styles.nickname}>{friend.realName ? `${friend.realName} · ` : ""}친구 공개 연결됨</Text>
                    </View>
                  </View>
                )) : <Text style={styles.empty}>아직 아기 친구가 없어요.</Text>}
              </View>

              <View style={styles.peopleSection}>
                <Text style={styles.peopleTitle}>다린 친구</Text>
                {darinFriends.length ? darinFriends.map((friend) => (
                  <View key={friend.friendshipId} style={styles.friendRow}>
                    <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{friend.displayName.slice(0, 1)}</Text></View>
                    <View style={styles.friendCopy}>
                      <Text style={styles.person}>{friend.displayName}</Text>
                      <Text style={styles.nickname}>{friend.realName ? `${friend.realName} · ` : ""}다린 친구</Text>
                    </View>
                    {isAdmin && babyId ? (
                      <Pressable style={[styles.friendAction, babyFriendIds.has(friend.userId) && styles.disabled]} disabled={babyFriendIds.has(friend.userId) || working} onPress={() => void addFriendToBaby(friend)}>
                        <Text style={styles.friendActionText}>{babyFriendIds.has(friend.userId) ? "아기 친구 연결됨" : "아기 친구로 초대"}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )) : <Text style={styles.empty}>아직 다린 친구가 없어요.</Text>}
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  headerCopy: { alignItems: "center", gap: 4, paddingVertical: 2 },
  title: { fontSize: 23, fontWeight: "900", color: colors.text, textAlign: "center" },
  headerSubtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16 },
  summaryCard: { minHeight: 116, flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  summaryIconText: { color: colors.amber, fontSize: 26, fontWeight: "900" },
  summaryCopy: { flex: 1, minWidth: 0, gap: 3 },
  summaryTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  summaryMeta: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  summaryHint: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  summaryButton: { minHeight: 44, maxWidth: 118, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  summaryButtonText: { color: colors.amber, fontSize: 12, fontWeight: "900", textAlign: "center" },
  hubCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, gap: 16 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: colors.card },
  tabActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  tabText: { color: colors.muted, fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  tabTextActive: { color: colors.amber },
  tabBody: { gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  description: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  permissionHint: { fontSize: 12, color: colors.faint, lineHeight: 18 },
  fieldHelp: { fontSize: 11.5, color: colors.faint, lineHeight: 17, marginTop: -5 },
  person: { fontSize: 14, color: colors.text, fontWeight: "700" },
  nickname: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
  inviteOption: { minHeight: 86, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 11 },
  inviteOptionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  optionIconActive: { backgroundColor: "rgba(232,145,138,0.24)" },
  optionIconText: { color: colors.muted, fontSize: 14, fontWeight: "900", letterSpacing: -2 },
  optionIconTextActive: { color: colors.amber },
  optionCopy: { flex: 1, minWidth: 0, gap: 3 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  optionDescription: { color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  optionArrow: { color: colors.faint, fontSize: 25 },
  optionArrowActive: { color: colors.amber },
  adminHint: { color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  roleArea: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 11, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.full },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.amber },
  primary: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: "#fff", fontWeight: "800" },
  sendSection: { gap: 10, marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  codePill: { minHeight: 64, paddingHorizontal: 14, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: "rgba(232,145,138,0.32)" },
  code: { fontSize: 20, fontWeight: "900", letterSpacing: 1, color: colors.amber, textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 8 },
  secondary: { minHeight: 48, flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  shareButton: { minHeight: 48, flex: 1.15, borderRadius: radius.md, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  shareButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  shareHelper: { color: colors.faint, fontSize: 11.5, lineHeight: 17, textAlign: "center" },
  regenerateButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  regenerateText: { color: colors.amber, fontSize: 12, fontWeight: "800" },
  input: { width: "100%", minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.cardHi, fontSize: 15 },
  preview: { gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  previewTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: colors.muted, marginTop: 2 },
  peopleSection: { gap: 9, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card },
  peopleTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  personRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  personAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  personAvatarText: { color: colors.amber, fontSize: 14, fontWeight: "900" },
  friendRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  friendCopy: { flex: 1, minWidth: 0 },
  friendAction: { minHeight: 36, maxWidth: 118, paddingHorizontal: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  friendActionText: { color: colors.amber, fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  empty: { color: colors.faint, fontSize: 12, lineHeight: 18 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
  disabled: { opacity: 0.48 },
});
