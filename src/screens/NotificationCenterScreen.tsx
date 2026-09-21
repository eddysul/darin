import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BabyLogIcon, type MiscIconKey, type TabIconKey } from "../components/babylog/BabyLogIcon";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { colors, fontScaleCap, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { getNotificationQaSeed, type NotificationItem } from "../data/notificationQaSeed";
import { canAccessCareReminderUi, canShowNotificationEvent } from "../config/featureFlags";
import { useLanguage } from "../LanguageContext";
import { useBabyLog } from "../context/BabyLogContext";
import { familyErrorMessage, storedFamilyRoleLabel } from "../utils/familyDisplay";
import { notificationBodyLabel, notificationTitleLabel } from "../utils/noticeDisplay";
import { inviteSenderNameFromBody } from "../utils/inviteSearchStatus";
import { formatRelativeTime } from "../utils/localeFormat";
import { readDismissedNotificationEventIds } from "../utils/dismissedNotificationEventsStore";
import { AuthRepository } from "../repositories/AuthRepository";
import { useReduceMotion } from "../hooks/useReduceMotion";
import type { Locale } from "../i18n";

type Props = NativeStackScreenProps<RootStackParamList, "NotificationCenter">;
type Filter = "all" | "request" | "family" | "summary" | "event";
type RequestStatus = "pending" | "accepted" | "declined" | "expired" | "processed";
type CenterItem = NotificationItem & { requestId?: string; requestStatus?: RequestStatus };
type CenterRow =
  | { kind: "section"; id: string; title: string }
  | { kind: "item"; id: string; item: CenterItem };
type Translate = ReturnType<typeof useLanguage>["t"];
type ActivityIcon =
  | { kind: MiscIconKey }
  | { kind: "tab"; tab: TabIconKey };

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const AVATAR = 44;
const THUMB = 44;
const FILTER_KEYS: Filter[] = ["all", "request", "family", "summary", "event"];
const FILTER_LABEL: Record<Filter, "notice.critical.001" | "notice.critical.002" | "notice.critical.003" | "notice.critical.004" | "notice.critical.005"> = {
  all: "notice.critical.001",
  request: "notice.critical.002",
  family: "notice.critical.003",
  summary: "notice.critical.004",
  event: "notice.critical.005",
};
const THUMB_KEYS = ["thumbnailUrl", "coverUrl", "mediaUrl", "imageUrl", "previewUrl", "photoUrl", "thumbnail"] as const;

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
    case "feeding_reminder":
    case "sleep_reminder":
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

function httpUrl(value: unknown): string | undefined {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined;
}

function httpImageUrl(value: unknown): string | undefined {
  const url = httpUrl(value);
  if (!url || /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url)) return undefined;
  return url;
}

function thumbnailFromData(data: Record<string, unknown>): string | undefined {
  for (const key of THUMB_KEYS) {
    const url = httpImageUrl(data[key]);
    if (url) return url;
  }
  return undefined;
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
    title: event.title ?? "",
    body: event.body ?? "",
    period: periodFor(event.created_at),
    isRead: Boolean(event.read_at),
    createdAt: event.created_at,
    actorId: event.actor_id ?? undefined,
    thumbnailUrl: thumbnailFromData(data),
    eventType: event.event_type,
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

function activityIcon(item: CenterItem): ActivityIcon {
  switch (item.eventType ?? item.type) {
    case "invite_request":
    case "invite_declined":
    case "family_joined":
      return { kind: "family" };
    case "memory_reaction":
      return { kind: "heart" };
    case "memory_comment":
    case "growth_book_comment":
      return { kind: "chat" };
    case "growth_book_rolling_paper":
      return { kind: "bookmark" };
    case "new_diary":
    case "diary_reminder":
      return { kind: "tab", tab: "diary" };
    case "new_shared_log":
      return { kind: "tab", tab: "record" };
    case "daily_summary":
    case "weekly_summary":
      return { kind: "sparkles" };
    case "feeding_reminder":
    case "sleep_reminder":
    case "reminder":
      return { kind: "bell" };
    default:
      return { kind: "bell" };
  }
}

function activityPrimary(t: Translate, item: CenterItem): string {
  const body = notificationBodyLabel(t, item.body ?? "").trim();
  if (body) return body;
  return notificationTitleLabel(t, item.title ?? "").trim();
}

function requestStatusLabel(t: Translate, status: RequestStatus): string {
  if (status === "accepted") return t("notice.critical.017");
  if (status === "declined") return t("notice.critical.018");
  if (status === "expired") return t("notice.critical.019");
  return t("notice.critical.020");
}

export function NotificationCenterScreen({ navigation, friendOnly = false }: Props & { friendOnly?: boolean }) {
  const { t, locale } = useLanguage();
  const { familyMembers, babies } = useBabyLog();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<CenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await AuthRepository.getUser();
      const [events, pendingRequests, dismissed] = await Promise.all([
        NotificationRepository.listInAppEvents(),
        FamilyRepository.listDarinInviteRequests().catch(() => []),
        user ? readDismissedNotificationEventIds(user.id) : Promise.resolve(new Set<string>()),
      ]);
      const pendingById = new Map(pendingRequests.map((item) => [item.id, item]));
      const pendingRequestIds = new Set(pendingById.keys());
      const mapped = events
        .filter((event) => canShowNotificationEvent(event.event_type))
        .map((event) => toItem(event, pendingRequestIds));
      const next: CenterItem[] = (mapped.length ? mapped : getNotificationQaSeed().map((item) => ({
        ...item,
        requestStatus: item.type === "invite_request" ? "pending" as const : undefined,
      }))).filter((item) => !dismissed.has(item.id));
      const familyAvatars = Object.fromEntries(
        familyMembers.flatMap((member) => member.avatarUrl ? [[member.id, member.avatarUrl] as const] : []),
      );
      const missingActorIds = [...new Set(
        next.flatMap((item) => {
          const actorId = item.actorId;
          return actorId && !familyAvatars[actorId] ? [actorId] : [];
        }),
      )];
      if (missingActorIds.length) {
        const profiles = await ProfileRepository.listVisibleDisplayProfiles(missingActorIds).catch(() => []);
        for (const profile of profiles) {
          if (profile.avatarUrl) familyAvatars[profile.userId] = profile.avatarUrl;
        }
      }
      setItems(next.map((item) => {
        const actorAvatarUrl = item.actorId ? familyAvatars[item.actorId] ?? item.actorAvatarUrl : item.actorAvatarUrl;
        const request = item.requestId ? pendingById.get(item.requestId) : undefined;
        const detailed = item.type === "invite_request" && item.requestStatus === "pending" && request
          ? {
              ...item,
              body: request.requestType === "family"
                ? t("notice.critical.042", {
                    name: inviteSenderNameFromBody(item.body) || t("notice.critical.044"),
                    babyName: babies.find((baby) => baby.id === request.babyId)?.name ?? "",
                    role: storedFamilyRoleLabel(t, request.roleLabel),
                  })
                : t("notice.critical.043", {
                    name: inviteSenderNameFromBody(item.body) || t("notice.critical.044"),
                    babyName: babies.find((baby) => baby.id === request.babyId)?.name ?? "",
                  }),
            }
          : item;
        return actorAvatarUrl ? { ...detailed, actorAvatarUrl } : detailed;
      }));
      setLoadFailed(false);
    } catch {
      setItems([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [babies, familyMembers, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const visible = useMemo(() => items.filter((item) => matches(item, filter)), [filter, items]);
  const rows = useMemo<CenterRow[]>(() => [
    { id: "today", title: t("notice.critical.006"), items: visible.filter((item) => item.period === "today") },
    { id: "week", title: t("notice.critical.007"), items: visible.filter((item) => item.period === "week") },
    { id: "older", title: t("notice.critical.008"), items: visible.filter((item) => item.period === "older") },
  ].flatMap((section) => section.items.length
    ? [
        { kind: "section" as const, id: `section-${section.id}`, title: section.title },
        ...section.items.map((item) => ({ kind: "item" as const, id: item.id, item })),
      ]
    : []), [t, visible]);

  const markRead = useCallback((item: CenterItem) => {
    if (item.isRead) return;
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
    if (!item.id.startsWith("qa-")) {
      void NotificationRepository.markInAppEventRead(item.id).catch(() => {
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: false } : candidate));
      });
    }
  }, []);

  const remove = useCallback((item: CenterItem) => {
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    void NotificationRepository.dismissInAppEvent(item.id).catch(() => {
      setItems((current) => current.some((candidate) => candidate.id === item.id)
        ? current
        : [...current, item].sort((left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "")));
      Alert.alert(t("notice.critical.041"), t("notice.critical.027"));
    });
  }, [t]);

  const open = (item: CenterItem) => {
    markRead(item);
    if (item.type === "invite_request") {
      return;
    }
    const route = stringData(item, "route");
    const memoryPostId = stringData(item, "memoryPostId");
    const diaryEntryId = stringData(item, "diaryEntryId");
    const logId = stringData(item, "logId");

    if (friendOnly && !memoryPostId && route !== "memory") {
      navigation.navigate("MainTabs", { screen: "Memories" });
      return;
    }

    if (memoryPostId || route === "memory") {
      if (memoryPostId) navigation.navigate("MemoryDetail", { memoryPostId, source: friendOnly ? "friend" : "notification" });
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
      if (canAccessCareReminderUi()) navigation.navigate("SettingsDetail", { page: "careAlerts" });
      else navigation.navigate("NotificationCenter");
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
      Alert.alert(t("notice.critical.028"), t("notice.critical.029"));
      return;
    }
    setResponding(item.id);
    try {
      await FamilyRepository.respondToDarinIdInviteRequest(item.requestId, accept);
      setItems((current) => current.map((currentItem) => currentItem.id === item.id
        ? { ...currentItem, isRead: true, requestStatus: accept ? "accepted" : "declined" }
        : currentItem));
      Alert.alert(accept ? t("notice.critical.023") : t("notice.critical.024"), accept ? t("notice.critical.025") : t("notice.critical.024"));
    } catch (cause) {
      Alert.alert(t("notice.critical.026"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("notice.critical.027"));
    } finally {
      setResponding(null);
    }
  };
  return <FlatList
    style={styles.root}
    contentContainerStyle={styles.content}
    data={loading || loadFailed ? [] : rows}
    extraData={items}
    keyExtractor={(row) => row.id}
    ListHeaderComponent={<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTER_KEYS.map((key) => <Pressable key={key} style={[styles.filter, filter === key && styles.filterActive]} onPress={() => setFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: filter === key }}><Text style={[styles.filterText, filter === key && styles.filterTextActive]} maxFontSizeMultiplier={fontScaleCap.control}>{t(FILTER_LABEL[key])}</Text></Pressable>)}</ScrollView>}
    ListEmptyComponent={loading && !items.length ? (
      <View style={styles.empty}><ActivityIndicator color={colors.amberText} /><Text style={styles.emptyText}>{t("notice.critical.009")}</Text></View>
    ) : loadFailed ? (
      <View style={styles.empty}>
        <BabyLogIcon kind="alert" size={26} color={colors.muted} />
        <Text style={styles.emptyTitle}>{t("notice.critical.010")}</Text>
        <Text style={styles.emptyText}>{t("notice.critical.011")}</Text>
        <Pressable style={styles.retryButton} onPress={() => void load()} accessibilityRole="button"><Text style={styles.retryText}>{t("notice.critical.012")}</Text></Pressable>
      </View>
    ) : null}
    renderItem={({ item: row }) => row.kind === "section"
      ? <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.chrome}>{row.title}</Text>
      : <NotificationActivityRow item={row.item} locale={locale} open={open} respond={respond} responding={responding} remove={remove} t={t} />}
    ListFooterComponent={<>
      {!loading && !loadFailed && !visible.length ? <View style={styles.empty}><BabyLogIcon kind="bell" size={26} color={colors.faint} /><Text style={styles.emptyTitle}>{t("notice.critical.013")}</Text><Text style={styles.emptyText}>{t("notice.critical.014")}</Text></View> : null}
      {!friendOnly ? <Pressable style={styles.settingsRow} onPress={() => navigation.navigate("SettingsHome")} accessibilityRole="button"><View style={styles.settingsIcon}><BabyLogIcon kind="settings" size={18} color={colors.muted} /></View><Text style={styles.settingsText}>{t("notice.critical.015")}</Text><BabyLogIcon kind="chevron" size={18} color={colors.faint} /></Pressable> : null}
    </>}
  />;
}

function NotificationActivityRow({
  item,
  locale,
  open,
  respond,
  responding,
  remove,
  t,
}: {
  item: CenterItem;
  locale: Locale;
  open: (item: CenterItem) => void;
  respond: (item: CenterItem, accept: boolean) => void;
  responding: string | null;
  remove: (item: CenterItem) => void;
  t: Translate;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const primary = activityPrimary(t, item);
  const relativeTime = item.createdAt ? formatRelativeTime(item.createdAt, locale) : "";
  const status = item.type === "invite_request" && item.requestStatus && item.requestStatus !== "pending"
    ? requestStatusLabel(t, item.requestStatus)
    : undefined;
  const meta = [relativeTime, status].filter(Boolean).join(" · ");
  const pending = item.type === "invite_request" && item.requestStatus === "pending";
  const icon = activityIcon(item);
  const thumb = item.thumbnailUrl && !thumbFailed ? item.thumbnailUrl : undefined;
  const label = [primary, meta, item.isRead ? null : t("notice.critical.037")].filter(Boolean).join(". ");
  const reset = useCallback(
    () => Animated.timing(translateX, { toValue: 0, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start(),
    [reduceMotion, translateX],
  );
  const confirmDelete = useCallback(() => {
    Alert.alert(t("notice.critical.038"), t("notice.critical.039"), [
      { text: t("common.cancel"), style: "cancel", onPress: reset },
      { text: t("notice.critical.038"), style: "destructive", onPress: () => remove(item) },
    ]);
  }, [item, remove, reset, t]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx < -8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-96, Math.min(0, gesture.dx)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > -72) {
            reset();
            return;
          }
          Animated.timing(translateX, {
            toValue: -96,
            duration: reduceMotion ? 0 : 140,
            useNativeDriver: true,
          }).start(confirmDelete);
        },
        onPanResponderTerminate: reset,
      }),
    [confirmDelete, reduceMotion, reset, translateX],
  );
  const underlayOpacity = translateX.interpolate({
    inputRange: [-96, -8, 0],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  return (
    <View style={[styles.swipeWrap, !item.isRead && styles.rowUnread]}>
      <Animated.View style={[styles.deleteUnderlay, { opacity: underlayOpacity }]} pointerEvents="none">
        <Text style={styles.deleteText} maxFontSizeMultiplier={fontScaleCap.control}>{t("notice.critical.038")}</Text>
      </Animated.View>
      <Animated.View style={[styles.row, !item.isRead && styles.rowUnread, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable
          style={({ pressed }) => [styles.rowMain, pressed && styles.cardMainPressed]}
          onPress={() => { reset(); open(item); }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t("notice.critical.040")}
          accessibilityActions={[{ name: "delete", label: t("notice.critical.038") }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "delete") confirmDelete();
          }}
        >
        {item.actorAvatarUrl ? (
          <ProfileAvatar uri={item.actorAvatarUrl} size={AVATAR} fallback="profile" />
        ) : (
          <View style={styles.eventIcon}>
            {icon.kind === "tab"
              ? <BabyLogIcon kind="tab" tab={icon.tab} size={18} color={colors.amberText} />
              : <BabyLogIcon kind={icon.kind} size={18} color={colors.amberText} />}
          </View>
        )}
        <View style={styles.rowCopy}>
          <Text style={[styles.rowPrimary, !item.isRead && styles.rowPrimaryUnread]} numberOfLines={2}>{primary}</Text>
          {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        <View style={styles.trailing} pointerEvents="none">
          {thumb ? (
            <View>
              <Image
                source={{ uri: thumb }}
                style={styles.thumb}
                contentFit="cover"
                onError={() => setThumbFailed(true)}
              />
              {!item.isRead ? <View style={styles.thumbUnreadDot} /> : null}
            </View>
          ) : !item.isRead ? (
            <View style={styles.unreadDot} />
          ) : null}
        </View>
      </Pressable>
      {pending ? (
        <View style={styles.inviteActions}>
          <Pressable
            style={styles.declineButton}
            disabled={responding === item.id}
            onPress={() => void respond(item, false)}
            accessibilityRole="button"
            accessibilityState={{ disabled: responding === item.id }}
          >
            <Text style={styles.declineText} maxFontSizeMultiplier={fontScaleCap.control}>{t("notice.critical.021")}</Text>
          </Pressable>
          <Pressable
            style={styles.acceptButton}
            disabled={responding === item.id}
            onPress={() => void respond(item, true)}
            accessibilityRole="button"
            accessibilityState={{ disabled: responding === item.id }}
          >
            <Text style={styles.acceptText} maxFontSizeMultiplier={fontScaleCap.control}>{t("notice.critical.022")}</Text>
          </Pressable>
        </View>
      ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filter: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip, justifyContent: "center" },
  filterActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: colors.accentStrong },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, color: colors.muted, fontSize: 13, fontWeight: "700" },
  swipeWrap: { position: "relative", overflow: "hidden", backgroundColor: colors.background },
  deleteUnderlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 22,
    backgroundColor: colors.danger,
  },
  deleteText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  row: { backgroundColor: colors.background },
  rowUnread: { backgroundColor: colors.accentSoft },
  rowMain: { minHeight: TOUCH_MIN, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { opacity: 0.72 },
  cardMainPressed: { opacity: 0.72 },
  eventIcon: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowPrimary: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "500" },
  rowPrimaryUnread: { fontWeight: "700" },
  rowMeta: { marginTop: 2, color: colors.faint, fontSize: 12, lineHeight: 16 },
  trailing: { width: THUMB, minHeight: THUMB, alignItems: "flex-end", justifyContent: "center" },
  thumb: { width: THUMB, height: THUMB, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4, backgroundColor: colors.brandCoral },
  thumbUnreadDot: { position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandCoral, borderWidth: 1.5, borderColor: colors.amberSoft },
  inviteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingLeft: 72, paddingRight: 16, paddingBottom: 10 },
  declineButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.backgroundSecondary, justifyContent: "center" },
  declineText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  acceptButton: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center" },
  acceptText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 13 },
  empty: { alignItems: "center", paddingHorizontal: 30, paddingVertical: 52 },
  emptyTitle: { marginTop: 12, color: colors.text, fontSize: 16, fontWeight: "800" },
  emptyText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  retryButton: { marginTop: 16, minHeight: TOUCH_MIN, paddingHorizontal: 20, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.primaryForeground, fontSize: 13, fontWeight: "800" },
  settingsRow: { minHeight: TOUCH_MIN, marginTop: 8, marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 4, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  settingsIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  settingsText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
});
