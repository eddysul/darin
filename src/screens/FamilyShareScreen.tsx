import { useCallback, useMemo, useState } from "react";
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
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon, type MiscIconKey } from "../components/babylog/BabyLogIcon";
import { useBabyLog } from "../context/BabyLogContext";
import { FriendRepository, type FriendDisplay } from "../repositories/DarinFriendRepository";
import {
  FamilyRepository,
  type DarinInviteRequestView,
} from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { parseDarinId } from "../repositories/DarinIdentityRepository";
import { FAMILY_ROLE_LABELS } from "../types/family";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius } from "../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const INVITE_LABELS: Record<VisibleInviteType, string> = {
  family: "가족 초대",
  baby_friend: "친구 초대",
};

const INVITE_DESCRIPTIONS: Record<VisibleInviteType, string> = {
  family: "기록과 성장책을 함께 볼 수 있어요.",
  baby_friend: "친구 공개 순간만 볼 수 있어요.",
};

const INVITE_PERMISSION_COPY: Record<VisibleInviteType, string> = {
  family: "관리자 또는 편집 가능 권한으로 기록·일기·성장책을 함께 관리해요.",
  baby_friend: "친구 공개 순간만 볼 수 있고 기록·일기·성장책은 볼 수 없어요.",
};

const INVITE_ICON: Record<VisibleInviteType, MiscIconKey> = {
  family: "family",
  baby_friend: "handshake",
};

type ShareTab = "create" | "enter" | "people";
type VisibleInviteType = "family" | "baby_friend";
type IdPreview = { darinId: string; nickname: string; tag: string };
type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;

export function FamilyShareScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, myFamilyRole, familyMembers, rehydrateFromServer, activeBabyId } = useBabyLog();
  const babyId = activeBabyId;
  const isAdmin = myFamilyRole === "owner" || myFamilyRole === "admin";
  const [activeTab, setActiveTab] = useState<ShareTab>(() => route.params?.tab ?? (isAdmin ? "create" : "enter"));
  const [inviteType, setInviteType] = useState<VisibleInviteType>(() => (isAdmin ? "family" : "baby_friend"));
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [relation, setRelation] = useState("가족");
  const [targetDarinId, setTargetDarinId] = useState("");
  const [idPreview, setIdPreview] = useState<IdPreview | null>(null);
  const [friends, setFriends] = useState<FriendDisplay[]>([]);
  const [incoming, setIncoming] = useState<DarinInviteRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<DarinInviteRequestView[]>([]);
  const [working, setWorking] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [profile] = await Promise.all([
      ProfileRepository.getMyProfile().catch(() => null),
      rehydrateFromServer().catch(() => undefined),
    ]);
    if (profile) {
      setRelation((current) =>
        current === "가족" && profile.default_relation ? profile.default_relation : current,
      );
    }
    if (babyId && isAdmin) {
      const babyFriends = await FriendRepository.listFriendsByBabyId(babyId).catch(() => []);
      setFriends(babyFriends);
    } else {
      setFriends([]);
    }
    try {
      const requests = await FamilyRepository.listDarinInviteRequests();
      setIncoming(requests.filter((item) => item.direction === "incoming"));
      setOutgoing(requests.filter((item) => item.direction === "outgoing"));
    } catch {
      setIncoming([]);
      setOutgoing([]);
    }
  }, [babyId, isAdmin, rehydrateFromServer]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.tab) setActiveTab(route.params.tab);
      void refresh();
    }, [refresh, route.params?.tab]),
  );

  const chooseType = (next: VisibleInviteType) => {
    setInviteType(next);
    setError("");
    setIdPreview(null);
    setInviteCode("");
    setRelation(next === "family" ? "가족" : "친구");
  };

  const confirmDarinId = () => {
    const preview = parseDarinId(targetDarinId);
    if (!preview) {
      setIdPreview(null);
      setError("Darin ID를 닉네임#0000 형식으로 입력해 주세요.");
      return;
    }
    setError("");
    setIdPreview(preview);
  };

  const sendDarinIdRequest = async () => {
    if (working || !idPreview) return;
    if (!babyId || !isAdmin) {
      setError("초대 요청은 아기 관리자만 보낼 수 있어요.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const request = await FamilyRepository.sendDarinIdInviteRequest({
        babyId,
        darinId: idPreview.darinId,
        requestType: inviteType === "family" ? "family" : "friend",
        role,
        relationshipLabel: relation,
      });
      if (!request) throw new Error("초대 요청을 만들지 못했어요.");
      setTargetDarinId("");
      setIdPreview(null);
      Alert.alert(
        inviteType === "family" ? "가족 초대 요청을 보냈어요" : "친구 추가 요청을 보냈어요",
        `${request.recipient_nickname}님에게 요청을 보냈어요.`,
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "초대 요청을 보내지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const createAuxiliaryInviteCode = async () => {
    if (!babyId || !isAdmin || creatingCode) return;
    setCreatingCode(true);
    setError("");
    try {
      const row = await FamilyRepository.createInviteCode({
        babyId,
        inviteType,
        role,
        relationshipLabel: relation,
      });
      const code = row?.code ?? "";
      if (!code) throw new Error("초대코드를 만들지 못했어요.");
      setInviteCode(code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "초대코드를 만들지 못했어요.");
    } finally {
      setCreatingCode(false);
    }
  };

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert("코드를 복사했어요", "가족에게 코드를 공유해 주세요.");
  };

  const shareInviteCode = async () => {
    if (!inviteCode) return;
    await Share.share({ message: `다린 초대코드: ${inviteCode}` });
  };

  const respondToRequest = async (item: DarinInviteRequestView, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(item.id);
    try {
      await FamilyRepository.respondToDarinIdInviteRequest(item.id, accept);
      Alert.alert(accept ? "요청을 수락했어요" : "요청을 거절했어요", accept ? "공유 멤버 연결이 완료되었어요." : "요청을 거절했어요.");
      await refresh();
    } catch (cause) {
      Alert.alert("요청을 처리하지 못했어요", cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setRespondingId(null);
    }
  };

  const activeFamily = familyMembers.filter((member) => member.status === "active");
  const pendingOutgoing = useMemo(
    () => outgoing.filter((item) => !babyId || item.babyId === babyId),
    [babyId, outgoing],
  );

  return (
    <View style={styles.root}>
      <View style={styles.topChrome}>
        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.summaryIcon}>
            <BabyLogIcon kind="family" size={22} color={colors.amberText} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{babyName}네 가족</Text>
            <Text style={styles.summaryMeta}>가족 {activeFamily.length}명 · 친구 {friends.length}명</Text>
            <Text style={styles.summaryHint} numberOfLines={2}>
              {activeFamily.length <= 1 ? "아직 초대된 가족이 없어요." : `${activeFamily.length - 1}명의 가족과 연결되어 있어요.`}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? undefined : "padding"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.hubCard}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {([
                ["create", "요청 보내기"],
                ["enter", "요청 받기"],
                ["people", "연결된 사람"],
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
                {isAdmin ? (
                  <>
                <Text style={styles.sectionTitle}>누구를 초대할까요?</Text>
                {(["family", "baby_friend"] as VisibleInviteType[]).map((type) => (
                    <Pressable
                      key={type}
                      testID={`invite-choice-${type}`}
                      style={[styles.inviteOption, inviteType === type && styles.inviteOptionActive]}
                      onPress={() => chooseType(type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: inviteType === type }}
                    >
                      <View style={[styles.optionIcon, inviteType === type && styles.optionIconActive]}>
                        <BabyLogIcon kind={INVITE_ICON[type]} size={18} color={inviteType === type ? colors.amberText : colors.muted} />
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{INVITE_LABELS[type]}</Text>
                        <Text style={styles.optionDescription}>{INVITE_DESCRIPTIONS[type]}</Text>
                      </View>
                    </Pressable>
                ))}

                <Text style={styles.permissionHint}>{INVITE_PERMISSION_COPY[inviteType]}</Text>
                {inviteType === "family" ? (
                  <View style={styles.roleArea}>
                    <Text style={styles.fieldLabel}>가족 권한</Text>
                    <View style={styles.chips}>
                      {(["admin", "editor"] as const).map((value) => (
                        <Pressable
                          key={value}
                          style={[styles.chip, role === value && styles.chipActive]}
                          onPress={() => setRole(value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: role === value }}
                        >
                          <Text style={[styles.chipText, role === value && styles.chipTextActive]}>{value === "admin" ? "관리자" : "편집 가능"}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.permissionHint}>관리자는 구성원과 초대를 관리하고, 편집 가능은 기록을 추가·수정할 수 있어요.</Text>
                  </View>
                ) : null}

                <View style={styles.sendSection}>
                  <Text style={styles.sectionTitle}>{inviteType === "family" ? "Darin ID로 가족 요청" : "Darin ID로 친구 요청"}</Text>
                  <Text style={styles.description}>상대가 알려준 Darin ID 형식을 확인한 뒤 요청을 보내요. 실명과 사진은 보낸 뒤에 알려 줘요.</Text>
                  <TextInput
                    style={styles.input}
                    value={targetDarinId}
                    onChangeText={(value) => {
                      setTargetDarinId(value);
                      setError("");
                      setIdPreview(null);
                    }}
                    placeholder="예: 콩이맘#4821"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={confirmDarinId}
                    accessibilityLabel="Darin ID"
                    accessibilityHint={error || undefined}
                  />
                  {error ? <Text nativeID="invite-id-error" style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                  {!idPreview ? (
                    <Pressable
                      style={[styles.secondary, (!targetDarinId.trim() || working) && styles.disabled]}
                      onPress={confirmDarinId}
                      disabled={!targetDarinId.trim() || working}
                      accessibilityRole="button"
                      accessibilityLabel="형식 확인"
                    >
                      <Text style={styles.secondaryText}>형식 확인</Text>
                    </Pressable>
                  ) : (
                    <>
                      <View style={styles.previewCard}>
                        <Avatar name={idPreview.nickname} />
                        <View style={styles.friendCopy}>
                          <Text style={styles.person}>{idPreview.nickname}</Text>
                          <Text style={styles.nickname}>{idPreview.darinId}</Text>
                          <Text style={styles.permissionHint}>형식만 확인했어요. 상대가 없으면 전송되지 않아요.</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[styles.primary, working && styles.disabled]}
                        onPress={() => void sendDarinIdRequest()}
                        disabled={working}
                        accessibilityRole="button"
                        accessibilityLabel="요청 보내기"
                      >
                        {working ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.primaryText}>요청 보내기</Text>}
                      </Pressable>
                    </>
                  )}
                </View>

                <View style={styles.sendSection}>
                  <Text style={styles.sectionTitle}>초대코드 (보조)</Text>
                  <Text style={styles.description}>상대 ID를 모를 때만 코드를 만들어 공유해요. 앱 안 초대는 Darin ID 요청이 기본이에요.</Text>
                  {inviteCode ? (
                    <>
                      <View style={styles.codePill}>
                        <Text style={styles.codeText}>{inviteCode}</Text>
                      </View>
                      <View style={styles.inviteActions}>
                        <Pressable style={styles.secondary} onPress={() => void copyInviteCode()} accessibilityRole="button" accessibilityLabel="코드 복사">
                          <Text style={styles.secondaryText}>복사</Text>
                        </Pressable>
                        <Pressable style={styles.primary} onPress={() => void shareInviteCode()} accessibilityRole="button" accessibilityLabel="코드 공유">
                          <Text style={styles.primaryText}>공유</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable
                      style={[styles.secondary, creatingCode && styles.disabled]}
                      onPress={() => void createAuxiliaryInviteCode()}
                      disabled={creatingCode}
                      accessibilityRole="button"
                      accessibilityLabel="초대코드 만들기"
                    >
                      {creatingCode ? <ActivityIndicator color={colors.amberText} /> : <Text style={styles.secondaryText}>코드 만들기</Text>}
                    </Pressable>
                  )}
                </View>

                {pendingOutgoing.length ? (
                  <View style={styles.sendSection}>
                    <Text style={styles.sectionTitle}>보낸 요청</Text>
                    {pendingOutgoing.map((item) => (
                      <View key={item.id} style={styles.personRow}>
                        <View style={styles.personAvatar}>
                          <BabyLogIcon kind={item.requestType === "family" ? "family" : "handshake"} size={18} color={colors.amberText} />
                        </View>
                        <View style={styles.friendCopy}>
                          <Text style={styles.person}>{item.title}</Text>
                          <Text style={styles.nickname}>{item.body}</Text>
                          <Text style={styles.permissionHint}>{item.relation} · {item.roleLabel} · 수락 대기</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>요청 보내기</Text>
                    <Text style={styles.description}>초대는 아기 관리자만 보낼 수 있어요. 받은 요청은 요청 받기에서 확인하고 수락할 수 있어요.</Text>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => setActiveTab("enter")}
                      accessibilityRole="button"
                      accessibilityLabel="요청 받기 보기"
                    >
                      <Text style={styles.secondaryText}>요청 받기 보기</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            {activeTab === "enter" ? (
              <View style={styles.tabBody}>
                <Text style={styles.sectionTitle}>받은 요청</Text>
                <Text style={styles.description}>대기 중인 요청을 여기서 수락하거나 거절해요. 알림은 입구예요.</Text>
                {incoming.length ? incoming.map((item) => (
                  <View key={item.id} style={styles.requestCard}>
                    <View style={styles.previewCard}>
                      <View style={styles.personAvatar}>
                        <BabyLogIcon kind={item.requestType === "family" ? "family" : "handshake"} size={18} color={colors.amberText} />
                      </View>
                      <View style={styles.friendCopy}>
                        <Text style={styles.person}>{item.title}</Text>
                        <Text style={styles.nickname}>{item.body}</Text>
                        <Text style={styles.permissionHint}>{item.relation} · {item.roleLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.inviteActions}>
                      <Pressable
                        style={[styles.declineButton, respondingId === item.id && styles.disabled]}
                        disabled={respondingId === item.id}
                        onPress={() => void respondToRequest(item, false)}
                        accessibilityRole="button"
                        accessibilityLabel="거절"
                      >
                        <Text style={styles.declineText}>거절</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.acceptButton, respondingId === item.id && styles.disabled]}
                        disabled={respondingId === item.id}
                        onPress={() => void respondToRequest(item, true)}
                        accessibilityRole="button"
                        accessibilityLabel="수락"
                      >
                        {respondingId === item.id ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.acceptText}>수락</Text>}
                      </Pressable>
                    </View>
                  </View>
                )) : (
                  <View style={styles.emptyGroup}>
                    <Text style={styles.empty}>받은 요청이 없어요.</Text>
                    <Text style={styles.empty}>새 요청이 오면 알림과 여기에 같이 보여요.</Text>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => navigation.navigate("NotificationCenter")}
                      accessibilityRole="button"
                      accessibilityLabel="알림 열기"
                    >
                      <Text style={styles.secondaryText}>알림 열기</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === "people" ? (
              <View style={styles.tabBody}>
                <Text style={styles.sectionTitle}>연결된 사람</Text>
                <Text style={styles.permissionHint}>친구는 친구 공개 순간만 볼 수 있어요. 기록, 일기, 성장책은 가족에게만 공유돼요.</Text>

                <View style={styles.peopleSection}>
                  <Text style={styles.peopleTitle}>가족</Text>
                  {activeFamily.length ? activeFamily.map((member) => (
                    <View key={member.id} style={styles.personRow}>
                      <Avatar name={member.name} uri={member.avatarUrl} />
                      <View style={styles.friendCopy}>
                        <Text style={styles.person}>{member.name}</Text>
                        <Text style={styles.nickname}>{member.realName ? `${member.realName} · ` : ""}{member.relationshipLabel ?? "가족"} · {FAMILY_ROLE_LABELS[member.role]}</Text>
                      </View>
                    </View>
                  )) : <Text style={styles.empty}>아직 초대된 가족이 없어요.</Text>}
                </View>

                <View style={styles.peopleSection}>
                  <Text style={styles.peopleTitle}>친구</Text>
                  {friends.length ? friends.map((friend) => (
                    <View key={friend.membershipId} style={styles.personRow}>
                      <Avatar name={friend.displayName} />
                      <View style={styles.friendCopy}>
                        <Text style={styles.person}>{friend.displayName}</Text>
                        {friend.realName ? <Text style={styles.nickname}>{friend.realName}</Text> : null}
                      </View>
                    </View>
                  )) : (
                    <View style={styles.emptyGroup}>
                      <Text style={styles.empty}>아직 연결된 친구가 없어요.</Text>
                      <Text style={styles.empty}>친구를 초대해 추억을 함께 나눠보세요.</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Avatar({ name, uri }: { name: string; uri?: string }) {
  return (
    <View style={styles.personAvatar}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : (
        <Text style={styles.personAvatarText}>{name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topChrome: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16 },
  summaryCard: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  summaryCopy: { flex: 1, minWidth: 0, gap: 3 },
  summaryTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  summaryMeta: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  summaryHint: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  hubCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, gap: 16 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: { flex: 1, minWidth: 0, minHeight: TOUCH_MIN, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: colors.card },
  tabActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  tabText: { color: colors.muted, fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  tabTextActive: { color: colors.amberText },
  tabBody: { gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  description: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  permissionHint: { fontSize: 12, color: colors.faint, lineHeight: 18 },
  person: { fontSize: 14, color: colors.text, fontWeight: "700" },
  nickname: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
  inviteOption: { minHeight: 86, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 11 },
  inviteOptionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  optionIconActive: { backgroundColor: "rgba(232,145,138,0.24)" },
  optionCopy: { flex: 1, minWidth: 0, gap: 3 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  optionDescription: { color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  roleArea: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.full },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.amberText },
  primary: { minHeight: TOUCH_MIN, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: colors.amberDark, fontWeight: "800" },
  sendSection: { gap: 10, marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  secondary: { minHeight: TOUCH_MIN, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  input: { width: "100%", minHeight: TOUCH_MIN, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.cardHi, fontSize: 15 },
  previewCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  requestCard: { gap: 10, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card },
  requestButton: { minHeight: TOUCH_MIN, minWidth: 96, maxWidth: 118, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  requestButtonText: { color: colors.amberDark, fontSize: 12, fontWeight: "800", textAlign: "center" },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: colors.muted, marginTop: 2 },
  peopleSection: { gap: 9, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card },
  peopleTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  personRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  personAvatar: { width: 38, height: 38, borderRadius: 19, overflow: "hidden", backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  personAvatarText: { color: colors.amberText, fontSize: 14, fontWeight: "900" },
  friendCopy: { flex: 1, minWidth: 0 },
  emptyGroup: { gap: 8 },
  empty: { color: colors.faint, fontSize: 12, lineHeight: 18 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
  disabled: { opacity: 0.48 },
  inviteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  codePill: { minHeight: TOUCH_MIN, borderRadius: radius.md, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 2, color: colors.text },
  declineButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.backgroundSecondary, justifyContent: "center" },
  declineText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  acceptButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.amber, justifyContent: "center" },
  acceptText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 },
});
