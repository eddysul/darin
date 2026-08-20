import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { colors, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { getNotificationQaSeed, type NotificationItem } from "../data/notificationQaSeed";

type Props = NativeStackScreenProps<RootStackParamList, "NotificationCenter">;
type Filter = "all" | "request" | "family" | "summary" | "event";
type RequestStatus = "pending" | "accepted" | "declined" | "expired" | "processed";
type CenterItem = NotificationItem & { requestId?: string; requestStatus?: RequestStatus };
const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const FILTERS: Array<{ key: Filter; label: string }> = [{ key: "all", label: "전체" }, { key: "request", label: "요청" }, { key: "family", label: "가족" }, { key: "summary", label: "요약" }, { key: "event", label: "이벤트" }];

function periodFor(value: string): CenterItem["period"] {
  const age = Date.now() - new Date(value).getTime();
  return age < 86_400_000 ? "today" : age < 7 * 86_400_000 ? "week" : "older";
}

function centerTypeFor(eventType: string): CenterItem["type"] {
  switch (eventType) {
    case "invite_request":
      return "invite_request";
    case "new_diary":
      return "new_diary";
    case "daily_summary":
      return "daily_summary";
    case "weekly_summary":
      return "weekly_summary";
    case "diary_reminder":
    case "reminder":
      return "reminder";
    case "family_joined":
    case "memory_comment":
    case "memory_reaction":
    case "new_shared_log":
      return "new_shared_log";
    default:
      return "event";
  }
}

function toItem(
  event: Awaited<ReturnType<typeof NotificationRepository.listInAppEvents>>[number],
  pendingRequestIds: Set<string>,
): CenterItem {
  const rawData = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
  const defaultRoute = event.event_type === "family_joined"
    ? "family"
    : event.event_type === "diary_reminder"
      ? "diary"
      : event.event_type === "growth_book_comment" || event.event_type === "growth_book_rolling_paper"
        ? "growth_book"
        : undefined;
  const data = typeof rawData.route === "string" || !defaultRoute
    ? rawData
    : { ...rawData, route: defaultRoute };
  const requestId = typeof data.requestId === "string" ? data.requestId : undefined;
  const rawRequestStatus = typeof data.requestStatus === "string" ? data.requestStatus : undefined;
  const requestStatus = event.event_type === "invite_request"
    ? requestId && pendingRequestIds.has(requestId)
      ? "pending"
      : rawRequestStatus === "accepted" || rawRequestStatus === "declined" || rawRequestStatus === "expired"
        ? rawRequestStatus
        : "processed"
    : undefined;
  return {
    id: event.id,
    type: centerTypeFor(event.event_type),
    title: event.title,
    body: event.body,
    period: periodFor(event.created_at),
    isRead: Boolean(event.read_at),
    data,
    requestId,
    requestStatus,
  };
}

function matches(item: CenterItem, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "request") return item.type === "invite_request";
  if (filter === "family") return item.type === "new_shared_log" || item.type === "new_diary";
  if (filter === "summary") return item.type === "daily_summary" || item.type === "weekly_summary";
  return item.type === "reminder" || item.type === "event";
}

function stringData(item: CenterItem, key: string): string | undefined {
  const value = item.data?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function NotificationCenterScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<CenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [events, pendingRequests] = await Promise.all([
        NotificationRepository.listInAppEvents(),
        FamilyRepository.listDarinInviteRequests().catch(() => []),
      ]);
      const pendingRequestIds = new Set(pendingRequests.map((item) => item.id));
      const mapped = events.map((event) => toItem(event, pendingRequestIds));
      setItems(mapped.length ? mapped : getNotificationQaSeed().map((item) => ({
        ...item,
        requestStatus: item.type === "invite_request" ? "pending" : undefined,
      })));
      setLoadFailed(false);
    } catch {
      setItems([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const visible = useMemo(() => items.filter((item) => matches(item, filter)), [filter, items]);

  const markRead = useCallback((item: CenterItem) => {
    if (item.isRead) return;
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
    if (!item.id.startsWith("qa-")) {
      void NotificationRepository.markInAppEventRead(item.id).catch(() => {
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: false } : candidate));
      });
    }
  }, []);

  const open = (item: CenterItem) => {
    markRead(item);
    if (item.type === "invite_request") {
      navigation.navigate("FamilyShare", { tab: "enter" });
      return;
    }
    const route = stringData(item, "route");
    const memoryPostId = stringData(item, "memoryPostId");
    const diaryEntryId = stringData(item, "diaryEntryId");
    const logId = stringData(item, "logId");

    if (memoryPostId || route === "memory") {
      if (memoryPostId) navigation.navigate("MemoryDetail", { memoryPostId });
      else navigation.navigate("MainTabs", { screen: "Memories" });
      return;
    }
    if (route === "growth_book") {
      navigation.navigate("MainTabs", { screen: "Diary", params: { openGrowthBookVault: true } });
      return;
    }
    if (route === "family") {
      navigation.navigate("FamilyShare", { tab: "people" });
      return;
    }
    if (route === "settings" || stringData(item, "settingsPage") === "careAlerts") {
      navigation.navigate("SettingsDetail", { page: "careAlerts" });
      return;
    }
    if (item.type === "new_diary" || route === "diary") {
      navigation.navigate("MainTabs", {
        screen: "Diary",
        params: diaryEntryId
          ? { diaryEntryId, source: "notification" }
          : item.type === "reminder"
            ? { openCompose: true, source: "notification", date: stringData(item, "date") }
            : undefined,
      });
      return;
    }
    if (item.type === "daily_summary" || item.type === "weekly_summary" || route === "report") {
      navigation.navigate("MainTabs", { screen: "Report" });
      return;
    }
    navigation.navigate("MainTabs", { screen: "Record", params: logId ? { logId } : undefined });
  };
  const respond = async (item: CenterItem, accept: boolean) => {
    if (responding) return;
    if (!item.requestId) {
      Alert.alert("QA 샘플 알림", "실제 초대 요청에서 수락과 거절을 확인할 수 있어요.");
      return;
    }
    setResponding(item.id);
    try {
      await FamilyRepository.respondToDarinIdInviteRequest(item.requestId, accept);
      setItems((current) => current.map((currentItem) => currentItem.id === item.id
        ? { ...currentItem, isRead: true, requestStatus: accept ? "accepted" : "declined" }
        : currentItem));
      Alert.alert(accept ? "요청을 수락했어요" : "요청을 거절했어요", accept ? "공유 멤버 연결이 완료되었어요." : "요청을 거절했어요.");
    } catch (cause) {
      Alert.alert("요청을 처리하지 못했어요", cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setResponding(null);
    }
  };
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.map((item) => <Pressable key={item.key} style={[styles.filter, filter === item.key && styles.filterActive]} onPress={() => setFilter(item.key)}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
    {loading && !items.length ? (
      <View style={styles.empty}><ActivityIndicator color={colors.amberText} /><Text style={styles.emptyText}>알림을 불러오는 중이에요.</Text></View>
    ) : loadFailed ? (
      <View style={styles.empty}>
        <BabyLogIcon kind="alert" size={26} color={colors.muted} />
        <Text style={styles.emptyTitle}>알림을 불러오지 못했어요</Text>
        <Text style={styles.emptyText}>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</Text>
        <Pressable style={styles.retryButton} onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    ) : (
      <>
        <Section title="오늘" items={visible.filter((item) => item.period === "today")} open={open} respond={respond} responding={responding} />
        <Section title="이번 주" items={visible.filter((item) => item.period === "week")} open={open} respond={respond} responding={responding} />
        <Section title="이전 알림" items={visible.filter((item) => item.period === "older")} open={open} respond={respond} responding={responding} />
        {!visible.length ? <View style={styles.empty}><BabyLogIcon kind="bell" size={26} color={colors.faint} /><Text style={styles.emptyTitle}>새 알림이 없어요</Text><Text style={styles.emptyText}>가족 초대, 공유 기록, 요약과 리마인더가 여기에 모여요.</Text></View> : null}
      </>
    )}
    <Pressable style={styles.settingsRow} onPress={() => navigation.navigate("SettingsHome")}><View style={styles.settingsIcon}><BabyLogIcon kind="settings" size={18} color={colors.muted} /></View><Text style={styles.settingsText}>알림 설정</Text><BabyLogIcon kind="chevron" size={18} color={colors.faint} /></Pressable>
  </ScrollView>;
}

function Section({ title, items, open, respond, responding }: { title: string; items: CenterItem[]; open: (item: CenterItem) => void; respond: (item: CenterItem, accept: boolean) => void; responding: string | null }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{items.length ? items.map((item) => <View key={item.id} style={[styles.card, !item.isRead && styles.unreadCard]}><Pressable style={styles.cardMain} onPress={() => open(item)}><View style={styles.cardIcon}><BabyLogIcon kind={item.type === "invite_request" ? "family" : "bell"} size={18} color={colors.muted} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardBody}>{item.body}</Text>{item.type === "invite_request" && item.requestStatus && item.requestStatus !== "pending" ? <Text style={styles.requestStatus}>{item.requestStatus === "accepted" ? "수락됨" : item.requestStatus === "declined" ? "거절됨" : item.requestStatus === "expired" ? "만료됨" : "처리 완료"}</Text> : null}</View>{!item.isRead ? <View style={styles.unreadDot} /> : null}</Pressable>{item.type === "invite_request" && item.requestStatus === "pending" ? <View style={styles.inviteActions}><Pressable style={styles.declineButton} disabled={responding === item.id} onPress={() => void respond(item, false)}><Text style={styles.declineText}>거절</Text></Pressable><Pressable style={styles.acceptButton} disabled={responding === item.id} onPress={() => void respond(item, true)}><Text style={styles.acceptText}>수락</Text></Pressable></View> : null}</View>) : <Text style={styles.sectionEmpty}>알림이 없어요</Text>}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, paddingBottom: 32 }, filters: { gap: 8, paddingBottom: 20 }, filter: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: "center" }, filterActive: { backgroundColor: colors.amberSoft, borderColor: colors.amber }, filterText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, filterTextActive: { color: colors.amberText }, section: { gap: 9, marginBottom: 22 }, sectionTitle: { marginLeft: 2, color: colors.text, fontSize: 15, fontWeight: "800" }, sectionEmpty: { paddingLeft: 2, color: colors.faint, fontSize: 13 }, card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" }, unreadCard: { borderColor: "#E8918A" }, cardMain: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, padding: 13 }, cardIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.backgroundSecondary, alignItems: "center", justifyContent: "center" }, cardCopy: { flex: 1 }, cardTitle: { color: colors.text, fontSize: 14, fontWeight: "800" }, cardBody: { marginTop: 3, color: colors.muted, fontSize: 12.5, lineHeight: 18 }, requestStatus: { marginTop: 5, color: colors.faint, fontSize: 11.5, fontWeight: "700" }, unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E8918A" }, inviteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingHorizontal: 13, paddingBottom: 13 }, declineButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.backgroundSecondary, justifyContent: "center" }, declineText: { color: colors.muted, fontWeight: "700", fontSize: 13 }, acceptButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.amber, justifyContent: "center" }, acceptText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 }, empty: { alignItems: "center", paddingHorizontal: 30, paddingVertical: 52 }, emptyTitle: { marginTop: 12, color: colors.text, fontSize: 16, fontWeight: "800" }, emptyText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" }, retryButton: { marginTop: 16, minHeight: TOUCH_MIN, paddingHorizontal: 20, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" }, retryText: { color: colors.amberDark, fontSize: 13, fontWeight: "800" }, settingsRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, settingsIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.backgroundSecondary, alignItems: "center", justifyContent: "center" }, settingsText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
});
