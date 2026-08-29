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
import { familyRoleMessageKey } from "../types/family";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius } from "../theme";
import { useLanguage } from "../LanguageContext";
import {
  familyErrorMessage,
  inviteRequestBody,
  inviteRequestTitle,
  storedFamilyRoleLabel,
  storedRelationshipLabel,
} from "../utils/familyDisplay";
import { inviteUrl } from "../utils/inviteCode";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const INVITE_ICON: Record<VisibleInviteType, MiscIconKey> = {
  family: "family",
  baby_friend: "handshake",
};

type ShareTab = "create" | "enter" | "people";
type VisibleInviteType = "family" | "baby_friend";
type IdPreview = { darinId: string; nickname: string; tag: string };
type CodePreview = {
  code: string;
  babyId: string | null;
  babyName: string | null;
  inviterName: string;
  inviteType: VisibleInviteType;
};
type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;

export function FamilyShareScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { babyName, myFamilyRole, familyMembers, rehydrateFromServer, activeBabyId, switchActiveBaby } = useBabyLog();
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
  const [enteredCode, setEnteredCode] = useState("");
  const [codePreview, setCodePreview] = useState<CodePreview | null>(null);
  const [codeWorking, setCodeWorking] = useState(false);
  const [codeError, setCodeError] = useState("");
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
      setError(t("family.critical.015"));
      return;
    }
    setError("");
    setIdPreview(preview);
  };

  const sendDarinIdRequest = async () => {
    if (working || !idPreview) return;
    if (!babyId || !isAdmin) {
      setError(t("family.critical.016"));
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
      if (!request) throw new Error(t("family.critical.017"));
      setTargetDarinId("");
      setIdPreview(null);
      Alert.alert(
        inviteType === "family" ? t("family.critical.018") : t("family.critical.019"),
        t("family.critical.020", { name: request.recipient_nickname }),
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.021"));
    } finally {
      setWorking(false);
    }
  };

  const createInviteCode = async () => {
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
      if (!row?.code) throw new Error(t("family.critical.022"));
      setInviteCode(row.code);
    } catch (cause) {
      setError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.022"));
    } finally {
      setCreatingCode(false);
    }
  };

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert(t("family.critical.023"), t("family.critical.024"));
  };

  const copyInviteLink = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteUrl(inviteCode));
    Alert.alert(t("family.critical.025"), t("family.critical.026"));
  };

  const shareInviteCode = async () => {
    if (!inviteCode) return;
    const inviteLink = inviteUrl(inviteCode);
    await Share.share({
      message: t("family.critical.027", {
        babyName,
        kind: inviteType === "family" ? t("family.critical.028") : t("family.critical.029"),
        link: inviteLink,
        code: inviteCode,
      }),
    });
  };

  const previewEnteredCode = async () => {
    const code = enteredCode.trim().toUpperCase();
    if (!code || codeWorking) return;
    setCodeWorking(true);
    setCodeError("");
    setCodePreview(null);
    try {
      const row = await FamilyRepository.previewInviteCode(code);
      if (!row?.is_valid) {
        throw new Error(row?.invalid_reason === "expired" ? t("family.critical.030") : t("family.critical.031"));
      }
      if (row.invite_type === "darin_friend") {
        throw new Error(t("family.critical.032"));
      }
      setCodePreview({
        code,
        babyId: row.baby_id,
        babyName: row.baby_name,
        inviterName: row.inviter_name,
        inviteType: row.invite_type,
      });
    } catch (cause) {
      setCodeError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.033"));
    } finally {
      setCodeWorking(false);
    }
  };

  const acceptEnteredCode = async () => {
    if (!codePreview || codeWorking) return;
    setCodeWorking(true);
    setCodeError("");
    try {
      const profile = await ProfileRepository.getMyDisplayProfile();
      if (!profile) throw new Error(t("family.critical.034"));
      const accepted = await FamilyRepository.acceptInviteCode({
        code: codePreview.code,
        displayName: profile.displayName,
        nickname: profile.nickname,
        relation: profile.defaultRelation ?? "가족",
      });
      if (!accepted) throw new Error(t("family.critical.035"));
      setEnteredCode("");
      setCodePreview(null);
      if (accepted.invite_type === "family" && accepted.baby_id) {
        await switchActiveBaby(accepted.baby_id);
      } else {
        await refresh();
      }
      Alert.alert(
        t("family.critical.036"),
        accepted.invite_type === "family" ? t("family.critical.037") : t("family.critical.038"),
      );
    } catch (cause) {
      setCodeError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.035"));
    } finally {
      setCodeWorking(false);
    }
  };

  const respondToRequest = async (item: DarinInviteRequestView, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(item.id);
    try {
      await FamilyRepository.respondToDarinIdInviteRequest(item.id, accept);
      Alert.alert(accept ? t("family.critical.039") : t("family.critical.040"), accept ? t("family.critical.041") : t("family.critical.040"));
      await refresh();
    } catch (cause) {
      Alert.alert(t("family.critical.042"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.043"));
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
            <Text style={styles.summaryTitle}>{t("family.critical.044", { babyName })}</Text>
            <Text style={styles.summaryMeta}>{t("family.critical.045", { family: activeFamily.length, friends: friends.length })}</Text>
            <Text style={styles.summaryHint} numberOfLines={2}>
              {activeFamily.length <= 1 ? t("family.critical.046") : t("family.critical.047", { count: activeFamily.length - 1 })}
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
                ["create", t("family.critical.048")],
                ["enter", t("family.critical.049")],
                ["people", t("family.critical.050")],
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
                <Text style={styles.sectionTitle}>{t("family.critical.051")}</Text>
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
                        <Text style={styles.optionTitle}>{type === "family" ? t("family.critical.009") : t("family.critical.010")}</Text>
                        <Text style={styles.optionDescription}>{type === "family" ? t("family.critical.011") : t("family.critical.012")}</Text>
                      </View>
                    </Pressable>
                ))}

                <Text style={styles.permissionHint}>{inviteType === "family" ? t("family.critical.013") : t("family.critical.014")}</Text>
                {inviteType === "family" ? (
                  <View style={styles.roleArea}>
                    <Text style={styles.fieldLabel}>{t("family.critical.052")}</Text>
                    <View style={styles.chips}>
                      {(["admin", "editor"] as const).map((value) => (
                        <Pressable
                          key={value}
                          style={[styles.chip, role === value && styles.chipActive]}
                          onPress={() => setRole(value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: role === value }}
                        >
                          <Text style={[styles.chipText, role === value && styles.chipTextActive]}>{t(familyRoleMessageKey(value))}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.permissionHint}>{t("family.critical.053")}</Text>
                  </View>
                ) : null}

                <View style={styles.sendSection}>
                  <Text style={styles.sectionTitle}>{inviteType === "family" ? t("family.critical.054") : t("family.critical.055")}</Text>
                  <Text style={styles.description}>{t("family.critical.056")}</Text>
                  <TextInput
                    style={styles.input}
                    value={targetDarinId}
                    onChangeText={(value) => {
                      setTargetDarinId(value);
                      setError("");
                      setIdPreview(null);
                    }}
                    placeholder={t("family.critical.057")}
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
                      accessibilityLabel={t("family.critical.058")}
                    >
                      <Text style={styles.secondaryText}>{t("family.critical.058")}</Text>
                    </Pressable>
                  ) : (
                    <>
                      <View style={styles.previewCard}>
                        <Avatar name={idPreview.nickname} />
                        <View style={styles.friendCopy}>
                          <Text style={styles.person}>{idPreview.nickname}</Text>
                          <Text style={styles.nickname}>{idPreview.darinId}</Text>
                          <Text style={styles.permissionHint}>{t("family.critical.059")}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[styles.primary, working && styles.disabled]}
                        onPress={() => void sendDarinIdRequest()}
                        disabled={working}
                        accessibilityRole="button"
                        accessibilityLabel={t("family.critical.048")}
                      >
                        {working ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryText}>{t("family.critical.048")}</Text>}
                      </Pressable>
                    </>
                  )}
                </View>

                <View style={styles.sendSection}>
                  <Text style={styles.sectionTitle}>{t("family.critical.060")}</Text>
                  <Text style={styles.description}>{t("family.critical.061")}</Text>
                  {inviteCode ? (
                    <>
                      <View style={styles.codePill}>
                        <Text style={styles.codeText}>{inviteCode}</Text>
                      </View>
                      <View style={styles.inviteActions}>
                        <Pressable style={styles.secondaryAction} onPress={() => void copyInviteCode()} accessibilityRole="button" accessibilityLabel={t("family.critical.062")}>
                          <Text style={styles.secondaryText}>{t("family.critical.062")}</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryAction} onPress={() => void copyInviteLink()} accessibilityRole="button" accessibilityLabel={t("family.critical.063")}>
                          <Text style={styles.secondaryText}>{t("family.critical.063")}</Text>
                        </Pressable>
                        <Pressable style={styles.primaryAction} onPress={() => void shareInviteCode()} accessibilityRole="button" accessibilityLabel={t("family.critical.064")} accessibilityHint={t("family.critical.065")}>
                          <Text style={styles.primaryText}>{t("family.critical.064")}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable
                      style={[styles.secondary, creatingCode && styles.disabled]}
                      onPress={() => void createInviteCode()}
                      disabled={creatingCode}
                      accessibilityRole="button"
                      accessibilityLabel={t("family.critical.066")}
                    >
                      {creatingCode ? <ActivityIndicator color={colors.amberText} /> : <Text style={styles.secondaryText}>{t("family.critical.066")}</Text>}
                    </Pressable>
                  )}
                </View>

                {pendingOutgoing.length ? (
                  <View style={styles.sendSection}>
                    <Text style={styles.sectionTitle}>{t("family.critical.067")}</Text>
                    {pendingOutgoing.map((item) => (
                      <View key={item.id} style={styles.personRow}>
                        <View style={styles.personAvatar}>
                          <BabyLogIcon kind={item.requestType === "family" ? "family" : "handshake"} size={18} color={colors.amberText} />
                        </View>
                        <View style={styles.friendCopy}>
                          <Text style={styles.person}>{inviteRequestTitle(t, item.title)}</Text>
                          <Text style={styles.nickname}>{inviteRequestBody(t, item.body)}</Text>
                          <Text style={styles.permissionHint}>{t("family.critical.068", { relation: storedRelationshipLabel(t, item.relation), role: storedFamilyRoleLabel(t, item.roleLabel) })}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>{t("family.critical.048")}</Text>
                    <Text style={styles.description}>{t("family.critical.069")}</Text>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => setActiveTab("enter")}
                      accessibilityRole="button"
                      accessibilityLabel={t("family.critical.070")}
                    >
                      <Text style={styles.secondaryText}>{t("family.critical.070")}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            {activeTab === "enter" ? (
              <View style={styles.tabBody}>
                <Text style={styles.sectionTitle}>{t("family.critical.071")}</Text>
                <Text style={styles.description}>{t("family.critical.072")}</Text>
                {incoming.length ? incoming.map((item) => (
                  <View key={item.id} style={styles.requestCard}>
                    <View style={styles.previewCard}>
                      <View style={styles.personAvatar}>
                        <BabyLogIcon kind={item.requestType === "family" ? "family" : "handshake"} size={18} color={colors.amberText} />
                      </View>
                      <View style={styles.friendCopy}>
                        <Text style={styles.person}>{inviteRequestTitle(t, item.title)}</Text>
                        <Text style={styles.nickname}>{inviteRequestBody(t, item.body)}</Text>
                        <Text style={styles.permissionHint}>{storedRelationshipLabel(t, item.relation)} · {storedFamilyRoleLabel(t, item.roleLabel)}</Text>
                      </View>
                    </View>
                    <View style={styles.inviteActions}>
                      <Pressable
                        style={[styles.declineButton, respondingId === item.id && styles.disabled]}
                        disabled={respondingId === item.id}
                        onPress={() => void respondToRequest(item, false)}
                        accessibilityRole="button"
                        accessibilityLabel={t("family.critical.073")}
                      >
                        <Text style={styles.declineText}>{t("family.critical.073")}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.acceptButton, respondingId === item.id && styles.disabled]}
                        disabled={respondingId === item.id}
                        onPress={() => void respondToRequest(item, true)}
                        accessibilityRole="button"
                        accessibilityLabel={t("family.critical.074")}
                      >
                        {respondingId === item.id ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.acceptText}>{t("family.critical.074")}</Text>}
                      </Pressable>
                    </View>
                  </View>
                )) : (
                  <View style={styles.emptyGroup}>
                    <Text style={styles.empty}>{t("family.critical.075")}</Text>
                    <Text style={styles.empty}>{t("family.critical.076")}</Text>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => navigation.navigate("NotificationCenter")}
                      accessibilityRole="button"
                      accessibilityLabel={t("family.critical.077")}
                    >
                      <Text style={styles.secondaryText}>{t("family.critical.077")}</Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.sendSection}>
                  <Text style={styles.sectionTitle}>{t("family.critical.078")}</Text>
                  <Text style={styles.description}>{t("family.critical.079")}</Text>
                  <TextInput
                    style={styles.input}
                    value={enteredCode}
                    onChangeText={(value) => {
                      setEnteredCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24));
                      setCodePreview(null);
                      setCodeError("");
                    }}
                    placeholder={t("family.critical.080")}
                    placeholderTextColor={colors.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => void previewEnteredCode()}
                    accessibilityLabel={t("family.critical.078")}
                  />
                  {codeError ? <Text style={styles.error} accessibilityRole="alert">{codeError}</Text> : null}
                  {codePreview ? (
                    <View style={styles.requestCard}>
                      <Text style={styles.person}>{codePreview.inviteType === "family" ? t("family.critical.009") : t("family.critical.010")}</Text>
                      {codePreview.babyName ? <Text style={styles.nickname}>{t("family.critical.081", { name: codePreview.babyName })}</Text> : null}
                      <Text style={styles.nickname}>{t("family.critical.082", { name: codePreview.inviterName })}</Text>
                      <Text style={styles.permissionHint}>{codePreview.inviteType === "family" ? t("family.critical.083") : t("family.critical.012")}</Text>
                      <Pressable
                        style={[styles.primary, codeWorking && styles.disabled]}
                        disabled={codeWorking}
                        onPress={() => void acceptEnteredCode()}
                        accessibilityRole="button"
                        accessibilityLabel={t("family.critical.084")}
                      >
                        {codeWorking ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryText}>{t("family.critical.084")}</Text>}
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.secondary, (!enteredCode.trim() || codeWorking) && styles.disabled]}
                      disabled={!enteredCode.trim() || codeWorking}
                      onPress={() => void previewEnteredCode()}
                      accessibilityRole="button"
                      accessibilityLabel={t("family.critical.085")}
                    >
                      {codeWorking ? <ActivityIndicator color={colors.amberText} /> : <Text style={styles.secondaryText}>{t("family.critical.085")}</Text>}
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            {activeTab === "people" ? (
              <View style={styles.tabBody}>
                <Text style={styles.sectionTitle}>{t("family.critical.050")}</Text>
                <Text style={styles.permissionHint}>{t("family.critical.086")}</Text>

                <View style={styles.peopleSection}>
                  <Text style={styles.peopleTitle}>{t("family.critical.087")}</Text>
                  {activeFamily.length ? activeFamily.map((member) => (
                    <View key={member.id} style={styles.personRow}>
                      <Avatar name={member.name} uri={member.avatarUrl} />
                      <View style={styles.friendCopy}>
                        <Text style={styles.person}>{member.name}</Text>
                        <Text style={styles.nickname}>{member.realName ? `${member.realName} · ` : ""}{storedRelationshipLabel(t, member.relationshipLabel ?? "가족")} · {t(familyRoleMessageKey(member.role))}</Text>
                      </View>
                    </View>
                  )) : <Text style={styles.empty}>{t("family.critical.046")}</Text>}
                </View>

                <View style={styles.peopleSection}>
                  <Text style={styles.peopleTitle}>{t("family.critical.088")}</Text>
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
                      <Text style={styles.empty}>{t("family.critical.089")}</Text>
                      <Text style={styles.empty}>{t("family.critical.090")}</Text>
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
  primary: { minHeight: TOUCH_MIN, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: colors.primaryForeground, fontWeight: "800" },
  sendSection: { gap: 10, marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  secondary: { minHeight: TOUCH_MIN, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  input: { width: "100%", minHeight: TOUCH_MIN, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.cardHi, fontSize: 15 },
  previewCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  requestCard: { gap: 10, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card },
  requestButton: { minHeight: TOUCH_MIN, minWidth: 96, maxWidth: 118, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  requestButtonText: { color: colors.primaryForeground, fontSize: 12, fontWeight: "800", textAlign: "center" },
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
  secondaryAction: { flex: 1, minHeight: TOUCH_MIN, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  primaryAction: { flex: 1, minHeight: TOUCH_MIN, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  codePill: { minHeight: TOUCH_MIN, borderRadius: radius.md, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 2, color: colors.text },
  declineButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.backgroundSecondary, justifyContent: "center" },
  declineText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  acceptButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center" },
  acceptText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 13 },
});
