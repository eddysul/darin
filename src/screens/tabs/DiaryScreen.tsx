import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { DiaryComposeModal } from "../../components/babylog/DiaryComposeModal";
import { DiaryReminderSettingsModal } from "../../components/babylog/DiaryReminderSettingsModal";
import { GrowthBookVaultModal } from "../../components/babylog/GrowthBookVaultModal";
import { GrowthBookEditorModal } from "../../components/babylog/GrowthBookEditorModal";
import { GrowthBookPreviewModal } from "../../components/babylog/GrowthBookPreviewModal";
import { DiaryMoodStamp, DiaryStampPair } from "../../components/babylog/DiaryStamp";
import { PushToast } from "../../components/babylog/PushToast";
import type { DiaryComposeDraft } from "../../constants/diaryCompose";
import { useBabyLog } from "../../context/BabyLogContext";
import type { DiaryEntry } from "../../types/babyLog";
import type { DiaryDraft, DiaryReminderSettings } from "../../types/diaryReminder";
import { DEFAULT_DIARY_REMINDER } from "../../types/diaryReminder";
import { formatDateKey } from "../../utils/dateKey";
import {
  clearDiaryDraft,
  getDiaryDraft,
  hydrateDiaryDraft,
  saveDiaryDraft,
} from "../../utils/diaryDraftStore";
import {
  formatReminderTime,
  getDiaryReminder,
  hydrateDiaryReminder,
  saveDiaryReminder,
} from "../../utils/diaryReminderStore";
import {
  diaryDisplayComment,
  diaryHasMilestone,
  diaryMilestoneLabel,
  diaryPhotoCount,
  diaryPrimaryPhoto,
} from "../../utils/diaryModel";
import { buildTodaySummary } from "../../utils/reportAggregates";
import { createGrowthBookPdf } from "../../utils/growthBookPdf";
import {
  buildDiaryNotificationCopy,
  draftToComposePrefill,
  filterDiaries,
  isMeaningfulDiaryDraft,
  resolveDiaryComposeTarget,
} from "../../utils/diaryToday";
import { EmptyState } from "../../components/states/FeedbackStates";
import { colors, radius } from "../../theme";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import type { MainTabParamList } from "../MainTabs";

type Props = {
  onOpenProfile: () => void;
};

type DiaryFilter = "all" | "growth" | "book";

export function DiaryScreen({ onOpenProfile }: Props) {
  const route = useRoute<RouteProp<MainTabParamList, "Diary">>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Diary">>();
  const {
    diaryEntries,
    addDiary,
    updateDiary,
    deleteDiary,
    toggleDiaryInGrowthBook,
    babyName,
    logs,
    logAuthor,
    myFamilyRole,
    familyMembers,
    growthBookEdit,
    setGrowthBookEdit,
    babyStickers,
  } = useBabyLog();
  const me = familyMembers.find((member) => member.isMe);
  const allowAdd = canAddLog(myFamilyRole);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFromPush, setComposeFromPush] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [initialDraft, setInitialDraft] = useState<DiaryComposeDraft | null>(null);
  const [pushVisible, setPushVisible] = useState(false);
  const [filter, setFilter] = useState<DiaryFilter>("all");
  const [vaultOpen, setVaultOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [bookPreviewOpen, setBookPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminder, setReminder] = useState<DiaryReminderSettings>({ ...DEFAULT_DIARY_REMINDER });
  const [draftMemory, setDraftMemory] = useState<DiaryDraft | null>(null);
  const diaryEntriesRef = useRef(diaryEntries);
  diaryEntriesRef.current = diaryEntries;
  const draftRef = useRef(draftMemory);
  draftRef.current = draftMemory;

  const todayKey = formatDateKey();
  const summary = useMemo(() => buildTodaySummary(logs), [logs]);
  const notifCopy = useMemo(
    () => buildDiaryNotificationCopy({ babyName, summary }),
    [babyName, summary],
  );

  useEffect(() => {
    void (async () => {
      await Promise.all([hydrateDiaryDraft(), hydrateDiaryReminder()]);
      setDraftMemory(getDiaryDraft());
      setReminder(getDiaryReminder());
    })();
  }, []);

  const openComposeFresh = useCallback(() => {
    if (!allowAdd) return;
    const target = resolveDiaryComposeTarget({
      entries: diaryEntriesRef.current,
      draft: getDiaryDraft() ?? draftRef.current,
      dateKey: formatDateKey(),
    });
    if (
      target.kind === "edit" &&
      !canEditLog(myFamilyRole, target.entry.createdBy, me)
    ) {
      return;
    }
    setEditingEntry(target.kind === "edit" ? target.entry : null);
    setInitialDraft(target.kind === "draft" ? draftToComposePrefill(target.draft) : null);
    setComposeFromPush(false);
    setComposeOpen(true);
  }, [allowAdd, me, myFamilyRole]);

  const openEdit = useCallback((entry: DiaryEntry, fromPush = false) => {
    if (!canEditLog(myFamilyRole, entry.createdBy, me)) return;
    setInitialDraft(null);
    setEditingEntry(entry);
    setComposeFromPush(fromPush);
    setComposeOpen(true);
  }, [me, myFamilyRole]);

  const openFromNotification = useCallback((dateKeyArg?: string) => {
    const key = !dateKeyArg || dateKeyArg === "today" ? formatDateKey() : dateKeyArg;
    const target = resolveDiaryComposeTarget({
      entries: diaryEntriesRef.current,
      draft: getDiaryDraft() ?? draftRef.current,
      dateKey: key,
    });
    if (
      (target.kind === "edit" &&
        !canEditLog(myFamilyRole, target.entry.createdBy, me)) ||
      (target.kind !== "edit" && !allowAdd)
    ) {
      return;
    }
    setComposeFromPush(true);
    if (target.kind === "edit") {
      setInitialDraft(null);
      setEditingEntry(target.entry);
    } else if (target.kind === "draft") {
      setEditingEntry(null);
      setInitialDraft(draftToComposePrefill(target.draft));
    } else {
      setEditingEntry(null);
      setInitialDraft(null);
    }
    setComposeOpen(true);
  }, [allowAdd, me, myFamilyRole]);

  useEffect(() => {
    const params = route.params;
    if (!params) return;
    const shouldOpen =
      params.openCompose === true ||
      params.source === "notification" ||
      params.date === "today" ||
      (typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date));
    if (!shouldOpen) return;
    openFromNotification(params.date);
    navigation.setParams({ openCompose: undefined, source: undefined, date: undefined });
  }, [route.params, openFromNotification, navigation]);

  useEffect(() => {
    if (!reminder.enabled) return;
    const tick = () => {
      const now = new Date();
      if (now.getHours() !== reminder.hour || now.getMinutes() !== reminder.minute) return;
      const key = formatDateKey(now);
      if (reminder.lastFiredDateKey === key) return;
      const next = { ...reminder, lastFiredDateKey: key };
      setReminder(next);
      void saveDiaryReminder(next);
      setPushVisible(true);
    };
    const id = setInterval(tick, 20_000);
    tick();
    return () => clearInterval(id);
  }, [reminder]);

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const payload = response.notification.request.content.data as
            | { source?: string; date?: string; openCompose?: boolean }
            | undefined;
          if (payload?.source === "notification" || payload?.openCompose) {
            openFromNotification(typeof payload.date === "string" ? payload.date : "today");
          }
        });
      } catch {
        // Expo Go / missing native module — in-app toast path still works
      }
    })();
    return () => sub?.remove();
  }, [openFromNotification]);

  const bookEntries = useMemo(
    () => diaryEntries.filter((d) => d.includedInGrowthBook),
    [diaryEntries],
  );
  const growthCount = useMemo(
    () => diaryEntries.filter(diaryHasMilestone).length,
    [diaryEntries],
  );
  const bookPhotoCount = useMemo(() => diaryPhotoCount(bookEntries), [bookEntries]);
  const filtered = useMemo(() => filterDiaries(diaryEntries, filter), [diaryEntries, filter]);

  const liveEditing = editingEntry
    ? diaryEntries.find((d) => d.id === editingEntry.id) ?? editingEntry
    : null;

  const reminderLabel = reminder.enabled
    ? formatReminderTime(reminder.hour, reminder.minute)
    : "알림 꺼짐";

  const persistFromDraft = (draft: DiaryComposeDraft, source: "manual" | "notification") => {
    const existingToday = diaryEntries.find((d) => d.dateKey === todayKey);
    const target = editingEntry ?? existingToday;
    if (target) {
      if (!canEditLog(myFamilyRole, target.createdBy, me)) return;
    } else if (!allowAdd) {
      return;
    }
    void clearDiaryDraft(todayKey);
    setDraftMemory(null);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const now = new Date();
    const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 (${weekdays[now.getDay()]})`;

    if (editingEntry) {
      updateDiary(editingEntry.id, {
        photos: draft.photos,
        stickerIds: draft.stickerIds ?? [],
        comment: draft.comment,
        weatherStamp: draft.weatherStamp,
        moodStamp: draft.moodStamp,
        milestoneTag: draft.milestoneTag,
        customMilestoneTag: draft.customMilestoneTag,
        includedInGrowthBook: draft.includedInGrowthBook,
        // Keep frozen snapshot on edit — do not overwrite with live summary
        careLogSummarySnapshot: editingEntry.careLogSummarySnapshot,
        momentSuggestionsUsed: draft.momentSuggestionsUsed,
        dateKey: editingEntry.dateKey || todayKey,
        draftStatus: "saved",
      });
      return;
    }

    if (existingToday) {
      updateDiary(existingToday.id, {
        photos: draft.photos,
        stickerIds: draft.stickerIds ?? [],
        comment: draft.comment,
        weatherStamp: draft.weatherStamp,
        moodStamp: draft.moodStamp,
        milestoneTag: draft.milestoneTag,
        customMilestoneTag: draft.customMilestoneTag,
        includedInGrowthBook: draft.includedInGrowthBook,
        careLogSummarySnapshot: existingToday.careLogSummarySnapshot,
        momentSuggestionsUsed: draft.momentSuggestionsUsed,
        draftStatus: "saved",
      });
      return;
    }

    addDiary({
      babyId: "baby-1",
      date: dateLabel,
      dateKey: todayKey,
      photos: draft.photos,
      stickerIds: draft.stickerIds ?? [],
      comment: draft.comment,
      weatherStamp: draft.weatherStamp,
      moodStamp: draft.moodStamp,
      careLogSummarySnapshot: draft.careLogSummarySnapshot,
      momentSuggestionsUsed: draft.momentSuggestionsUsed,
      milestoneTag: draft.milestoneTag,
      customMilestoneTag: draft.customMilestoneTag,
      includedInGrowthBook: draft.includedInGrowthBook,
      createdBy: logAuthor,
      source,
      draftStatus: "saved",
    });
  };

  return (
    <View style={styles.root}>
      <PushToast
        visible={pushVisible}
        title={notifCopy.title}
        body={notifCopy.body}
        onDismiss={() => setPushVisible(false)}
        onPress={() => {
          setPushVisible(false);
          openFromNotification();
        }}
      />
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!allowAdd && (
          <Text style={styles.viewerBanner}>보기 전용 계정이에요. 일기 추가·수정은 제한돼요.</Text>
        )}
        <Pressable
          style={[styles.writeBtn, styles.btnPrimary, !allowAdd && styles.disabled]}
          disabled={!allowAdd}
          accessibilityState={{ disabled: !allowAdd }}
          onPress={openComposeFresh}
        >
          <View style={styles.btnInner}>
            <BabyLogIcon kind="edit" size={14} color={colors.amberDark} strokeWidth={2.2} />
            <Text style={styles.btnPrimaryText}>새 일기 쓰기</Text>
          </View>
        </Pressable>

        <View style={styles.bookRow}>
          <Pressable style={styles.bookCard} onPress={() => setVaultOpen(true)}>
            <View style={styles.bookCardLeft}>
              <Text style={styles.bookCardTitle}>📖 {babyName}의 성장책</Text>
              <Text style={styles.bookCardStats}>
                담은 기록 {bookEntries.length}개 · 사진 {bookPhotoCount}장
              </Text>
              {bookEntries.length === 0 ? (
                <Text style={styles.bookCardDesc}>소중한 순간을 성장책에 담아보세요</Text>
              ) : null}
            </View>
            <View style={styles.bookCardBtn}>
              <Text style={styles.bookCardBtnText}>성장책 보기</Text>
              <BabyLogIcon kind="chevron" size={14} color={colors.amber} />
            </View>
          </Pressable>

          <Pressable
            style={styles.settingsBtn}
            onPress={() => setSettingsOpen(true)}
            accessibilityLabel="일기 알림 설정"
          >
            <BabyLogIcon kind="bell" size={16} color={colors.muted} />
          </Pressable>
        </View>

        <Text style={styles.reminderHint}>
          일기 알림 · {reminderLabel}
          {!reminder.enabled ? " · 알림이 꺼져 있어요" : ""}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(
            [
              { key: "all", label: `전체 ${diaryEntries.length}` },
              { key: "growth", label: `성장 순간 ${growthCount}` },
              { key: "book", label: `성장책 ${bookEntries.length}` },
            ] as const
          ).map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            title={
              diaryEntries.length === 0
                ? "아직 작성한 일기가 없어요."
                : filter === "growth"
                  ? "성장 순간으로 표시된 일기가 없어요."
                  : filter === "book"
                    ? "아직 성장책에 담은 순간이 없어요."
                    : "표시할 일기가 없어요."
            }
            body={
              diaryEntries.length === 0
                ? "첫 일기를 남겨보세요."
                : filter === "growth"
                  ? "작성할 때 성장 순간 태그를 붙이면 여기에 모여요."
                  : filter === "book"
                    ? "소중한 일기에서 📖 담기를 눌러보세요."
                    : undefined
            }
            ctaLabel={diaryEntries.length === 0 ? "첫 일기 쓰기" : undefined}
            onPressCta={diaryEntries.length === 0 ? openComposeFresh : undefined}
          />
        ) : (
          filtered.map((d) => (
            <DiaryCard
              key={d.id}
              entry={d}
              onOpen={() => openEdit(d)}
              onToggleBook={() => {
                if (canEditLog(myFamilyRole, d.createdBy, me)) toggleDiaryInGrowthBook(d.id);
              }}
            />
          ))
        )}
      </ScrollView>

      <DiaryComposeModal
        visible={composeOpen}
        fromPush={composeFromPush}
        editingEntry={liveEditing}
        initialDraft={initialDraft}
        onClose={() => {
          setComposeOpen(false);
          setEditingEntry(null);
          setInitialDraft(null);
          setComposeFromPush(false);
          setDraftMemory(getDiaryDraft());
        }}
        onDraftChange={(draft) => {
          if (!isMeaningfulDiaryDraft(draft)) return;
          const payload: DiaryDraft = {
            ...draft,
            dateKey: todayKey,
            updatedAt: new Date().toISOString(),
          };
          setDraftMemory(payload);
          void saveDiaryDraft(payload);
        }}
        onSave={(draft) => persistFromDraft(draft, composeFromPush ? "notification" : "manual")}
        onDelete={(id) => {
          const entry = diaryEntries.find((diary) => diary.id === id);
          if (!entry || !canDeleteLog(myFamilyRole, entry.createdBy, me)) return;
          deleteDiary(id);
          void clearDiaryDraft(todayKey);
          setDraftMemory(null);
        }}
      />

      <GrowthBookVaultModal
        visible={vaultOpen}
        babyName={babyName}
        entries={diaryEntries}
        edit={growthBookEdit}
        onClose={() => setVaultOpen(false)}
        onOpenEditor={() => {
          setVaultOpen(false);
          setEditorOpen(true);
        }}
        onRemove={(id) => {
          const entry = diaryEntries.find((diary) => diary.id === id);
          if (entry && canEditLog(myFamilyRole, entry.createdBy, me)) {
            updateDiary(id, { includedInGrowthBook: false });
          }
        }}
        onOpenEntry={(entry) => {
          setVaultOpen(false);
          openEdit(entry);
        }}
      />

      <GrowthBookEditorModal
        visible={editorOpen}
        babyName={babyName}
        babyId="baby-1"
        entries={diaryEntries}
        edit={growthBookEdit}
        me={me}
        myRole={myFamilyRole}
        onChange={setGrowthBookEdit}
        onClose={() => setEditorOpen(false)}
        onOpenBookPreview={() => {
          setEditorOpen(false);
          setBookPreviewOpen(true);
        }}
      />

      <GrowthBookPreviewModal
        visible={bookPreviewOpen}
        babyName={babyName}
        entries={diaryEntries.filter((d) => d.includedInGrowthBook)}
        edit={growthBookEdit}
        onClose={() => setBookPreviewOpen(false)}
        onPdfCreate={() =>
          void createGrowthBookPdf({
            babyName,
            entries: diaryEntries.filter((d) => d.includedInGrowthBook),
            edit: growthBookEdit,
            stickers: babyStickers,
          })
        }
      />

      <DiaryReminderSettingsModal
        visible={settingsOpen}
        value={reminder}
        babyName={babyName}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setReminder(next);
          void saveDiaryReminder(next);
        }}
        onTestNotification={() => setPushVisible(true)}
      />
    </View>
  );
}

function DiaryCard({
  entry,
  onOpen,
  onToggleBook,
}: {
  entry: DiaryEntry;
  onOpen: () => void;
  onToggleBook: () => void;
}) {
  const inBook = entry.includedInGrowthBook;
  const photo = diaryPrimaryPhoto(entry);
  const milestone = diaryMilestoneLabel(entry);

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={styles.thumbPlaceholder}>
          {entry.moodStamp ? (
            <DiaryMoodStamp id={entry.moodStamp} selected size="sm" />
          ) : (
            <Text style={styles.thumbFallback}>📔</Text>
          )}
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.dateRow}>
          <Text style={styles.date} numberOfLines={1}>
            {entry.date}
          </Text>
          <DiaryStampPair skyId={entry.weatherStamp} moodId={entry.moodStamp} size="sm" />
        </View>
        <Text style={styles.comment} numberOfLines={2}>
          {diaryDisplayComment(entry)}
        </Text>
        {entry.createdBy?.name ? (
          <Text style={styles.author}>작성자: {entry.createdBy.name}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          {milestone ? (
            <View style={styles.growthTag}>
              <Text style={styles.growthTagText}>🌱 {milestone}</Text>
            </View>
          ) : (
            <View style={styles.footerSpacer} />
          )}
          <Pressable
            style={[styles.bookChip, inBook && styles.bookChipActive]}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleBook();
            }}
            hitSlop={6}
          >
            <Text style={[styles.bookChipText, inBook && styles.bookChipTextActive]}>
              {inBook ? "✓ 성장책에 담김" : "📖 담기"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  viewerBanner: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  writeBtn: { borderRadius: 14, paddingVertical: 12, alignItems: "center", marginBottom: 12 },
  disabled: { opacity: 0.45 },
  btnPrimary: { backgroundColor: colors.amber },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14 },
  bookRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bookCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bookCardLeft: { flex: 1 },
  bookCardTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  bookCardStats: { fontSize: 12.5, color: colors.muted, marginTop: 4, fontWeight: "600" },
  bookCardDesc: { fontSize: 12, color: colors.faint, marginTop: 4, lineHeight: 18 },
  bookCardBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  bookCardBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.amber },
  settingsBtn: {
    width: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderHint: {
    fontSize: 11.5,
    color: colors.faint,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 2,
  },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  filterChipTextActive: { color: colors.amberDark },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallback: { fontSize: 22 },
  body: { flex: 1, minWidth: 0 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { flex: 1, fontSize: 11.5, color: colors.faint, fontWeight: "700" },
  comment: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 19 },
  author: { fontSize: 11, color: colors.faint, marginTop: 4, fontWeight: "600" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  footerSpacer: { flex: 1 },
  growthTag: {
    flexShrink: 1,
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  growthTagText: { fontSize: 11.5, fontWeight: "700", color: colors.text },
  bookChip: {
    marginLeft: "auto",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bookChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  bookChipText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  bookChipTextActive: { color: colors.amber },
});
