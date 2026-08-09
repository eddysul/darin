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
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import { getSupabaseSync } from "../utils/supabaseSyncStore";
import { colors, radius } from "../theme";

type InvitePreview = NonNullable<Awaited<ReturnType<typeof FamilyRepository.previewInviteCode>>>;

const INVITE_LABELS: Record<InviteType, string> = {
  family: "가족 초대하기",
  baby_friend: "친구 초대하기",
  darin_friend: "다린 친구 맺기",
};

const INVITE_DESCRIPTIONS: Record<InviteType, string> = {
  family: "관리자 또는 편집 가능 권한으로 아기 기록 공간에 참여해요.",
  baby_friend: "이 아기의 친구 공개 순간만 볼 수 있어요. 돌봄·일기·성장책 권한은 생기지 않아요.",
  darin_friend: "다린 사용자끼리 친구가 돼요. 친구 관계만으로 어떤 아기 데이터도 볼 수 없어요.",
};

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
  const [inviteType, setInviteType] = useState<InviteType>("family");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [relation, setRelation] = useState("가족");
  const [createdCode, setCreatedCode] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [darinFriends, setDarinFriends] = useState<DarinFriendDisplay[]>([]);
  const [babyFriends, setBabyFriends] = useState<BabyMemoryFriendDisplay[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [profile, friends] = await Promise.all([
      ProfileRepository.getMyProfile().catch(() => null),
      DarinFriendRepository.listMyFriends().catch(() => []),
      rehydrateFromServer().catch(() => undefined),
    ]);
    if (profile) {
      setDisplayName((current) => current || profile.display_name || "");
      setNickname((current) => current || profile.nickname || "");
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
    setCreatedCode("");
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
      setCreatedCode(invite.code);
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
    if (!preview || !displayName.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      const accepted = await FamilyRepository.acceptInviteCode({
        code,
        displayName: displayName.trim(),
        nickname: nickname.trim(),
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
        <View style={styles.card}>
          <Text style={styles.title}>가족·친구 공유</Text>
          <Text style={styles.description}>가족 권한, 아기 친구 공개, 다린 친구 관계를 각각 안전하게 관리해요.</Text>
          <Text style={styles.count}>함께 기록하는 가족 {activeFamily.length}명</Text>
          {activeFamily.slice(0, 8).map((member) => (
            <Text key={member.id} style={styles.person} numberOfLines={1}>
              {member.name} · {member.relationshipLabel ?? "가족"}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>초대코드 생성</Text>
          <View style={styles.chips}>
            {(Object.keys(INVITE_LABELS) as InviteType[]).map((type) => {
              const disabled = type !== "darin_friend" && !isAdmin;
              return (
                <Pressable
                  key={type}
                  style={[styles.chip, inviteType === type && styles.chipActive, disabled && styles.disabled]}
                  onPress={() => chooseType(type)}
                  disabled={disabled}
                >
                  <Text style={[styles.chipText, inviteType === type && styles.chipTextActive]}>
                    {INVITE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.description}>{INVITE_DESCRIPTIONS[inviteType]}</Text>
          {inviteType === "family" ? (
            <>
              <View style={styles.chips}>
                {(["admin", "editor"] as const).map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.chip, role === value && styles.chipActive]}
                    onPress={() => setRole(value)}
                  >
                    <Text style={[styles.chipText, role === value && styles.chipTextActive]}>
                      {value === "admin" ? "관리자" : "편집 가능"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.permissionHint}>
                관리자는 구성원과 초대를 관리할 수 있고, 편집 가능은 기록을 추가·수정할 수 있어요.
              </Text>
            </>
          ) : null}
          <Pressable style={[styles.primary, working && styles.disabled]} onPress={() => void createInvite()} disabled={working}>
            {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>초대코드 생성</Text>}
          </Pressable>

          {createdCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.code}>{createdCode}</Text>
              <Text style={styles.description}>상대방이 다린에서 이 코드를 입력하면 연결돼요.</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.secondary} onPress={() => void copyCode()}>
                  <Text style={styles.secondaryText}>코드 복사</Text>
                </Pressable>
                <Pressable style={styles.kakaoButton} onPress={() => void shareToKakao()}>
                  <Text style={styles.kakaoText}>카카오톡으로 공유</Text>
                </Pressable>
              </View>
              <Pressable style={styles.shareSheetButton} onPress={() => void openShareSheet()}>
                <Text style={styles.secondaryText}>다른 앱으로 공유</Text>
              </Pressable>
              <Text style={styles.fallbackText}>카카오톡이 없거나 선택되지 않으면 iOS 공유 시트에서 다른 앱을 선택할 수 있어요.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>초대코드 입력</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16));
              setPreview(null);
              setError("");
            }}
            placeholder="DARIN-XXXXXXXXXX"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void inspectInvite()}
          />
          <Pressable
            style={[styles.primary, (!code.trim() || working) && styles.disabled]}
            onPress={() => void inspectInvite()}
            disabled={!code.trim() || working}
          >
            <Text style={styles.primaryText}>초대 정보 확인</Text>
          </Pressable>

          {preview ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>{previewTitle(preview)}</Text>
              <Text style={styles.description}>초대한 사람: {preview.inviter_name}</Text>
              <Text style={styles.permissionHint}>{INVITE_DESCRIPTIONS[preview.invite_type]}</Text>
              <Text style={styles.fieldLabel}>표시 이름</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="다른 사람에게 보일 이름"
                placeholderTextColor={colors.faint}
                maxLength={40}
              />
              <Text style={styles.fieldLabel}>닉네임</Text>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="선택 사항"
                placeholderTextColor={colors.faint}
                maxLength={40}
              />
              {preview.invite_type === "family" ? (
                <>
                  <Text style={styles.fieldLabel}>아기와의 관계</Text>
                  <View style={styles.chips}>
                    {PROFILE_RELATION_OPTIONS.map((value) => (
                      <Pressable
                        key={value}
                        style={[styles.chip, relation === value && styles.chipActive]}
                        onPress={() => setRelation(value)}
                      >
                        <Text style={[styles.chipText, relation === value && styles.chipTextActive]}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              <Pressable
                style={[styles.primary, (!displayName.trim() || working) && styles.disabled]}
                onPress={() => void acceptInvite()}
                disabled={!displayName.trim() || working}
              >
                <Text style={styles.primaryText}>초대 수락</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>다린 친구</Text>
          <Text style={styles.description}>친구 관계만으로는 아기 기록을 볼 수 없어요.</Text>
          {darinFriends.length ? (
            darinFriends.map((friend) => (
              <View key={friend.friendshipId} style={styles.friendRow}>
                <View style={styles.friendCopy}>
                  <Text style={styles.person}>{friend.displayName}</Text>
                  {friend.nickname ? <Text style={styles.nickname}>{friend.nickname}</Text> : null}
                </View>
                {isAdmin && babyId ? (
                  <Pressable
                    style={[styles.friendAction, babyFriendIds.has(friend.userId) && styles.disabled]}
                    disabled={babyFriendIds.has(friend.userId) || working}
                    onPress={() => void addFriendToBaby(friend)}
                  >
                    <Text style={styles.friendActionText}>
                      {babyFriendIds.has(friend.userId) ? "아기 친구 연결됨" : "이 아기 친구로 초대"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>아직 다린 친구가 없어요. ‘다린 친구 맺기’ 코드를 공유해 보세요.</Text>
          )}
          {babyFriends.length ? (
            <Text style={styles.permissionHint}>현재 {babyName}의 친구 공개 연결 {babyFriends.length}명</Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 11 },
  title: { fontSize: 21, fontWeight: "900", color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  description: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  permissionHint: { fontSize: 12, color: colors.faint, lineHeight: 18 },
  count: { fontSize: 13, color: colors.amber, fontWeight: "800" },
  person: { fontSize: 14, color: colors.text, fontWeight: "700" },
  nickname: { fontSize: 11.5, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 11, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.full },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.amber },
  primary: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: "#fff", fontWeight: "800" },
  codeBox: { gap: 9, padding: 13, borderRadius: radius.md, backgroundColor: colors.amberSoft },
  code: { fontSize: 20, fontWeight: "900", letterSpacing: 1, color: colors.text },
  actionRow: { flexDirection: "row", gap: 8 },
  secondary: { minHeight: 44, flex: 1, borderRadius: radius.md, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  kakaoButton: { minHeight: 44, flex: 1.3, borderRadius: radius.md, backgroundColor: "#FEE500", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  kakaoText: { color: "#191919", fontSize: 12, fontWeight: "800" },
  shareSheetButton: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontSize: 10.5, color: colors.faint, lineHeight: 16 },
  input: { width: "100%", minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.cardHi, fontSize: 15 },
  preview: { gap: 10, paddingTop: 6 },
  previewTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: colors.muted, marginTop: 2 },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  friendCopy: { flex: 1, minWidth: 0 },
  friendAction: { minHeight: 36, maxWidth: 150, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  friendActionText: { color: colors.amber, fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  empty: { color: colors.faint, fontSize: 12, lineHeight: 18 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
  disabled: { opacity: 0.48 },
});
