import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { FamilyPeopleManage } from "../components/family/FamilyPeopleManage";
import { InviteCodeSheet } from "../components/family/InviteCodeSheet";
import { InviteComposerSheet } from "../components/family/InviteComposerSheet";
import { InviteSearchRow } from "../components/family/InviteSearchRow";
import { useBabyLog } from "../context/BabyLogContext";
import { AuthRepository } from "../repositories/AuthRepository";
import { FriendRepository, type FriendDisplay } from "../repositories/DarinFriendRepository";
import { FamilyRepository, type DarinInviteRequestView } from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import type { RootStackParamList } from "../navigation/types";
import { canInvite, type BabyAccessPermissions } from "../types/family";
import type { InviteFamilyRole, InviteRequestKind, InviteSearchHit } from "../types/inviteSearch";
import { colors, fontScaleCap } from "../theme";
import { useLanguage } from "../LanguageContext";
import { familyErrorMessage } from "../utils/familyDisplay";
import { inviteSearchQueryReady, resolveInviteRowStatus } from "../utils/inviteSearchStatus";
import { localDataScopeId } from "../utils/scopedLocalStorage";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const SEARCH_DEBOUNCE_MS = 300;

type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;
type ShareMode = "create" | "people";
type PeopleFilter = "family" | "friend";

export function FamilyShareScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { babyName, myFamilyRole, familyMembers, rehydrateFromServer, activeBabyId, switchActiveBaby, localDataScope } = useBabyLog();
  const babyId = activeBabyId;
  const scopeKey = localDataScope ? localDataScopeId(localDataScope) : "";
  const canSendInvite = canInvite(myFamilyRole);
  const [mode, setMode] = useState<ShareMode>(() => route.params?.tab === "people" ? "people" : "create");
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>(() => route.params?.peopleFilter ?? "family");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<InviteSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [myDarinId, setMyDarinId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendDisplay[]>([]);
  const [incoming, setIncoming] = useState<DarinInviteRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<DarinInviteRequestView[]>([]);
  const [optimisticOutgoing, setOptimisticOutgoing] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<InviteSearchHit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [toast, setToast] = useState("");
  const searchGen = useRef(0);
  const refreshGen = useRef(0);
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;
  const [accessByUser, setAccessByUser] = useState<Map<string, BabyAccessPermissions>>(new Map());
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current;
    const requestScopeKey = scopeKey;
    setPermissionsLoading(Boolean(babyId));
    setPermissionsError("");
    if (!babyId) setAccessByUser(new Map());
    const [user, profile] = await Promise.all([
      AuthRepository.getUser().catch(() => null),
      ProfileRepository.getMyProfile().catch(() => null),
      rehydrateFromServer().catch(() => undefined),
    ]);
    if (gen !== refreshGen.current || requestScopeKey !== scopeKeyRef.current) return;
    setMeId(user?.id ?? null);
    setMyDarinId(profile?.darin_id ?? null);
    if (babyId) {
      const [friendResult, accessResult] = await Promise.allSettled([
        FriendRepository.listFriendsByBabyId(babyId),
        FamilyRepository.listBabyAccessPermissions(babyId),
      ]);
      if (gen !== refreshGen.current || requestScopeKey !== scopeKeyRef.current) return;
      setFriends(friendResult.status === "fulfilled" ? friendResult.value : []);
      if (accessResult.status === "fulfilled") {
        setAccessByUser(new Map(accessResult.value.map((item) => [item.userId, item.permissions])));
      } else {
        setAccessByUser(new Map());
        setPermissionsError(t("family.critical.157"));
      }
    } else {
      setFriends([]);
    }
    try {
      const requests = await FamilyRepository.listDarinInviteRequests();
      if (gen !== refreshGen.current || requestScopeKey !== scopeKeyRef.current) return;
      const scoped = requests.filter((item) => !babyId || item.babyId === babyId);
      setIncoming(scoped.filter((item) => item.direction === "incoming"));
      setOutgoing(scoped.filter((item) => item.direction === "outgoing"));
    } catch {
      if (gen !== refreshGen.current || requestScopeKey !== scopeKeyRef.current) return;
      setIncoming([]);
      setOutgoing([]);
    } finally {
      if (gen === refreshGen.current && requestScopeKey === scopeKeyRef.current) setPermissionsLoading(false);
    }
  }, [babyId, rehydrateFromServer, scopeKey, t]);

  useEffect(() => {
    refreshGen.current += 1;
    searchGen.current += 1;
    setHits([]);
    setSearching(false);
    setSearchError("");
    setSelected(null);
    setSubmitting(false);
    setSendError("");
    setCodeOpen(false);
    setOptimisticOutgoing(new Set());
    setFriends([]);
    setIncoming([]);
    setOutgoing([]);
    setAccessByUser(new Map());
    setPermissionsError("");
    setPermissionsLoading(Boolean(babyId));
  }, [babyId, scopeKey]);

  useEffect(() => () => {
    refreshGen.current += 1;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.tab === "people") setMode("people");
      else if (route.params?.tab === "create") setMode("create");
      if (route.params?.peopleFilter) setPeopleFilter(route.params.peopleFilter);
      void refresh();
    }, [refresh, route.params?.peopleFilter, route.params?.tab]),
  );

  const runSearch = useCallback(async (value: string) => {
    if (!babyId || !canSendInvite) {
      setHits([]);
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    const requestScopeKey = scopeKey;
    setSearching(true);
    setSearchError("");
    try {
      const next = await ProfileRepository.searchInviteProfiles(babyId, value);
      if (gen !== searchGen.current || requestScopeKey !== scopeKeyRef.current) return;
      setHits(next);
    } catch (cause) {
      if (gen !== searchGen.current || requestScopeKey !== scopeKeyRef.current) return;
      const message = cause instanceof Error ? cause.message : "";
      if (/42501|only baby admin/i.test(message)) {
        setHits([]);
        setSearchError("");
      } else {
        setHits([]);
        setSearchError(t("family.critical.128"));
      }
    } finally {
      if (gen === searchGen.current && requestScopeKey === scopeKeyRef.current) setSearching(false);
    }
  }, [babyId, canSendInvite, scopeKey, t]);

  useEffect(() => {
    if (mode !== "create") return;
    if (!inviteSearchQueryReady(query)) {
      searchGen.current += 1;
      setHits([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    const handle = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [mode, query, runSearch]);

  const familyIds = useMemo(
    () => new Set(familyMembers.filter((member) => member.status === "active").map((member) => member.id)),
    [familyMembers],
  );
  const friendIds = useMemo(
    () => new Set(friends.filter((friend) => friend.status === "active").map((friend) => friend.userId)),
    [friends],
  );
  const outgoingUserIds = useMemo(
    () => new Set(outgoing.map((item) => item.receiverId).filter(Boolean)),
    [outgoing],
  );
  const outgoingDarinIds = useMemo(() => {
    const ids = new Set<string>();
    for (const value of optimisticOutgoing) ids.add(value);
    return ids;
  }, [optimisticOutgoing]);
  const incomingUserIds = useMemo(
    () => new Set(incoming.map((item) => item.senderId).filter(Boolean)),
    [incoming],
  );

  const sendInvite = async (input: { requestType: InviteRequestKind; role: InviteFamilyRole }) => {
    if (submitting || !selected || !babyId || !localDataScope || !canSendInvite) return;
    const target = selected;
    const requestScopeKey = scopeKey;
    const requestAccountId = localDataScope.userId;
    const optimisticKey = (target.darinId || target.userId).trim().toLowerCase();
    setSubmitting(true);
    setSendError("");
    setOptimisticOutgoing((current) => new Set(current).add(optimisticKey));
    try {
      const request = await FamilyRepository.sendDarinIdInviteRequest({
        babyId,
        expectedAccountId: requestAccountId,
        darinId: target.darinId,
        requestType: input.requestType,
        role: input.requestType === "family" ? input.role : "editor",
        relationshipLabel: input.requestType === "family" ? "가족" : "친구",
      });
      if (requestScopeKey !== scopeKeyRef.current) return;
      if (!request) throw new Error(t("family.critical.017"));
      setSelected(null);
      setSendError("");
      setToast(t("family.critical.124"));
      AccessibilityInfo.announceForAccessibility(t("family.critical.124"));
      await refresh();
    } catch (cause) {
      if (requestScopeKey !== scopeKeyRef.current) return;
      setOptimisticOutgoing((current) => {
        const next = new Set(current);
        next.delete(optimisticKey);
        return next;
      });
      setSendError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.021"));
      await refresh();
    } finally {
      if (requestScopeKey === scopeKeyRef.current) setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(handle);
  }, [toast]);

  const title = mode === "people" ? t("family.critical.137") : t("family.critical.105");
  const subtitle = mode === "people" ? t("family.critical.138") : t("family.critical.106");
  const readyQuery = inviteSearchQueryReady(query);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.side}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("chrome.critical.023")}
        >
          <ChevronLeft size={27} color={colors.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.chrome}>{subtitle}</Text>
        </View>
        <Pressable
          style={styles.side}
          onPress={() => (mode === "people" ? setMode("create") : setCodeOpen(true))}
          accessibilityRole="button"
          accessibilityLabel={mode === "people" ? t("family.critical.108") : t("family.critical.133")}
        >
          {mode === "people" ? (
            <Text style={styles.sideLabel}>{t("family.critical.108")}</Text>
          ) : (
            <Text style={styles.sideLabel}>{t("family.critical.133")}</Text>
          )}
        </Pressable>
      </View>

      {mode === "people" ? (
        <FamilyPeopleManage
          key={scopeKey || "no-scope"}
          babyId={babyId}
          scopeKey={scopeKey}
          accountId={localDataScope?.userId ?? null}
          myRole={myFamilyRole}
          familyMembers={familyMembers}
          friends={friends}
          accessByUser={accessByUser}
          permissionsLoading={permissionsLoading}
          permissionsError={permissionsError}
          peopleFilter={peopleFilter}
          onChangeFilter={setPeopleFilter}
          onReload={refresh}
        />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? undefined : "padding"}>
          <View style={styles.searchWrap}>
            <View style={styles.search}>
              <BabyLogIcon kind="search" size={18} color={colors.muted} />
              <TextInput
                testID="invite-search-input"
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t("family.critical.107")}
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t("family.critical.153")}
                accessibilityHint={t("family.critical.107")}
              />
              {query ? (
                <Pressable
                  style={styles.clear}
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel={t("family.critical.134")}
                >
                  <Text style={styles.clearText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {!canSendInvite ? (
            <Text style={styles.permission}>{t("family.critical.135")}</Text>
          ) : null}

          <FlatList
            data={hits}
            keyExtractor={(item) => item.userId || item.darinId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.resultDivider} />}
            ListHeaderComponent={searching && readyQuery ? <SearchSkeleton /> : null}
            ListEmptyComponent={
              searching ? null : searchError ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>{searchError}</Text>
                  <Pressable style={styles.retry} onPress={() => void runSearch(query)} accessibilityRole="button">
                    <Text style={styles.retryText}>{t("chrome.critical.002")}</Text>
                  </Pressable>
                </View>
              ) : readyQuery ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>{t("family.critical.126")}</Text>
                  <Text style={styles.emptyBody}>{t("family.critical.127")}</Text>
                  {canSendInvite ? (
                    <Pressable style={styles.retry} onPress={() => setCodeOpen(true)} accessibilityRole="button">
                      <Text style={styles.retryText}>{t("family.critical.139")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyBody}>{t("family.critical.125")}</Text>
                  {canSendInvite ? (
                    <Pressable style={styles.retry} onPress={() => setCodeOpen(true)} accessibilityRole="button">
                      <Text style={styles.retryText}>{t("family.critical.139")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            }
            renderItem={({ item }) => {
              const status = resolveInviteRowStatus({
                hit: item,
                meId,
                myDarinId,
                familyIds,
                friendIds,
                outgoingUserIds,
                outgoingDarinIds,
                incomingUserIds,
                canInvite: canSendInvite,
              });
              return (
                <InviteSearchRow
                  hit={item}
                  status={status}
                  sending={submitting && selected?.darinId === item.darinId}
                  onInvite={() => {
                    if (status !== "invite" || submitting) return;
                    setSendError("");
                    setSelected(item);
                  }}
                  onOpenIncoming={() => navigation.navigate("NotificationCenter")}
                />
              );
            }}
          />
        </KeyboardAvoidingView>
      )}

      <InviteComposerSheet
        visible={Boolean(selected)}
        hit={selected}
        submitting={submitting}
        error={sendError}
        onClose={() => {
          if (submitting) return;
          setSelected(null);
          setSendError("");
        }}
        onSend={(input) => void sendInvite(input)}
      />
      <InviteCodeSheet
        visible={codeOpen}
        babyId={babyId}
        scopeKey={scopeKey}
        accountId={localDataScope?.userId ?? null}
        babyName={babyName}
        myFamilyRole={myFamilyRole}
        onClose={() => setCodeOpen(false)}
        onAccepted={(acceptedBabyId) => {
          if (acceptedBabyId) void switchActiveBaby(acceptedBabyId);
          else void refresh();
        }}
      />
      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SearchSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>
      ))}
      <ActivityIndicator color={colors.amberText} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  side: { width: 72, minHeight: TOUCH_MIN, alignItems: "center", justifyContent: "center" },
  sideLabel: { color: colors.amberText, fontSize: 13, fontWeight: "800", textAlign: "center" },
  headerCopy: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 17, textAlign: "center" },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
  },
  searchInput: { flex: 1, minHeight: TOUCH_MIN, color: colors.text, fontSize: 16 },
  clear: { minWidth: TOUCH_MIN, minHeight: TOUCH_MIN, alignItems: "center", justifyContent: "center" },
  clearText: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  permission: { paddingHorizontal: 16, paddingBottom: 8, color: colors.muted, fontSize: 13, lineHeight: 18 },
  list: { paddingBottom: 40, flexGrow: 1 },
  resultDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 78 },
  empty: { paddingHorizontal: 24, paddingTop: 36, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.muted, fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  retry: { minHeight: TOUCH_MIN, justifyContent: "center", paddingHorizontal: 12 },
  retryText: { color: colors.amberText, fontSize: 13, fontWeight: "800", textAlign: "center" },
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 8 },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeletonAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.cardHi },
  skeletonCopy: { flex: 1, gap: 8 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.cardHi },
  skeletonLineShort: { width: "48%" },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "rgba(30,32,42,0.96)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800", textAlign: "center" },
});
