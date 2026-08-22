import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { BabyStickerVaultModal } from "../../components/babylog/BabyStickerVaultModal";
import { DiaryComposeModal } from "../../components/babylog/DiaryComposeModal";
import { DiaryReminderSettingsModal } from "../../components/babylog/DiaryReminderSettingsModal";
import { GrowthBookVaultModal } from "../../components/babylog/GrowthBookVaultModal";
import { GrowthBookEditorModal } from "../../components/babylog/GrowthBookEditorModal";
import { DiaryMoodStamp } from "../../components/babylog/DiaryStamp";
import { PushToast } from "../../components/babylog/PushToast";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import type { DiaryComposeDraft } from "../../constants/diaryCompose";
import { useBabyLog } from "../../context/BabyLogContext";
import { useConsultFabBehavior } from "../../hooks/useConsultFabBehavior";
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
  sortGrowthBookEntries,
} from "../../utils/diaryModel";
import { buildTodaySummary } from "../../utils/reportAggregates";
import {
  estimateGrowthBookPageCount,
  growthBookPhotoCount,
  resolveGrowthBookCoverPhoto,
} from "../../utils/growthBookPages";
import {
  buildDiaryNotificationCopy,
  draftToComposePrefill,
  filterDiaries,
  findDiaryForDate,
  groupDiariesByMonth,
  isMeaningfulDiaryDraft,
  resolveDiaryComposeTarget,
} from "../../utils/diaryToday";
import { EmptyState } from "../../components/states/FeedbackStates";
import { colors, radius, type } from "../../theme";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import type { MainTabParamList } from "../../navigation/types";
import { diaryStageLabel, formatDottedDate } from "../../utils/childDisplay";
import { useLanguage } from "../../LanguageContext";
import { formatLocalizedDate } from "../../utils/localeFormat";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenShared?: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
};

type DiaryFilter = "all" | "growth" | "book";

export function DiaryScreen({ onOpenProfile, onOpenSettings, onOpenNotifications, onOpenShared, onOpenConsult }: Props) {
  const { locale, t } = useLanguage();
  const route = useRoute<RouteProp<MainTabParamList, "Diary">>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Diary">>();
  const {
    diaryEntries,
    localDataScope,
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
    addBabySticker,
    deleteBabySticker,
    careSetup,
  } = useBabyLog();
  const me = familyMembers.find((member) => member.isMe);
  const allowAdd = canAddLog(myFamilyRole);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReadOnly, setComposeReadOnly] = useState(false);
  const [composeFromPush, setComposeFromPush] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [initialDraft, setInitialDraft] = useState<DiaryComposeDraft | null>(null);
  const [pushVisible, setPushVisible] = useState(false);
  const [filter, setFilter] = useState<DiaryFilter>("all");
  const [vaultOpen, setVaultOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialDiaryId, setEditorInitialDiaryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const pendingGrowthBookEditorRef = useRef<{ diaryId: string | null } | null>(null);
  const pendingGrowthBookVaultRef = useRef(false);
  const [chipPressing, setChipPressing] = useState(false);
  const [reminder, setReminder] = useState<DiaryReminderSettings>({ ...DEFAULT_DIARY_REMINDER });
  const [draftMemory, setDraftMemory] = useState<DiaryDraft | null>(null);
  const sheetOpen = composeOpen || vaultOpen || editorOpen || settingsOpen || stickerOpen;
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(
    pushVisible || sheetOpen || chipPressing,
  );
  const diaryEntriesRef = useRef(diaryEntries);
  const persistLockRef = useRef(false);
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
      await Promise.all([hydrateDiaryDraft(localDataScope, true), hydrateDiaryReminder(localDataScope)]);
      setDraftMemory(getDiaryDraft());
      setReminder(getDiaryReminder());
    })();
  }, [localDataScope]);

  const openComposeFresh = useCallback(() => {
    const target = resolveDiaryComposeTarget({
      entries: diaryEntriesRef.current,
      draft: getDiaryDraft() ?? draftRef.current,
      dateKey: formatDateKey(),
    });
    if (target.kind === "edit") {
      setEditingEntry(target.entry);
      setInitialDraft(null);
      setComposeReadOnly(!canEditLog(myFamilyRole, target.entry.createdBy, me));
      setComposeFromPush(false);
      setComposeOpen(true);
      return;
    }
    if (!allowAdd) return;
    setEditingEntry(null);
    setInitialDraft(target.kind === "draft" ? draftToComposePrefill(target.draft) : null);
    setComposeReadOnly(false);
    setComposeFromPush(false);
    setComposeOpen(true);
  }, [allowAdd, me, myFamilyRole]);

  const requestGrowthBookEditor = useCallback((diaryId: string | null) => {
    if (Platform.OS === "ios") {
      pendingGrowthBookEditorRef.current = { diaryId };
      setVaultOpen(false);
      return;
    }

    setEditorInitialDiaryId(diaryId);
    setVaultOpen(false);
    setEditorOpen(true);
  }, []);

  const openPendingGrowthBookEditor = useCallback(() => {
    const request = pendingGrowthBookEditorRef.current;
    if (!request) return;
    pendingGrowthBookEditorRef.current = null;
    setEditorInitialDiaryId(request.diaryId);
    setEditorOpen(true);
  }, []);

  const requestGrowthBookVault = useCallback(() => {
    setEditorOpen(false);
    setEditorInitialDiaryId(null);
    if (Platform.OS === "ios") {
      pendingGrowthBookVaultRef.current = true;
      return;
    }
    setVaultOpen(true);
  }, []);

  const openPendingGrowthBookVault = useCallback(() => {
    if (!pendingGrowthBookVaultRef.current) return;
    pendingGrowthBookVaultRef.current = false;
    setVaultOpen(true);
  }, []);

  const openEdit = useCallback((entry: DiaryEntry, fromPush = false) => {
    setInitialDraft(null);
    setEditingEntry(entry);
    setComposeReadOnly(!canEditLog(myFamilyRole, entry.createdBy, me));
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
    if (target.kind !== "edit" && !allowAdd) return;
    setComposeFromPush(true);
    if (target.kind === "edit") {
      setInitialDraft(null);
      setEditingEntry(target.entry);
      setComposeReadOnly(!canEditLog(myFamilyRole, target.entry.createdBy, me));
    } else if (target.kind === "draft") {
      setEditingEntry(null);
      setInitialDraft(draftToComposePrefill(target.draft));
      setComposeReadOnly(false);
    } else {
      setEditingEntry(null);
      setInitialDraft(null);
      setComposeReadOnly(false);
    }
    setComposeOpen(true);
  }, [allowAdd, me, myFamilyRole]);

  useEffect(() => {
    const params = route.params;
    if (!params) return;
    if (params.diaryEntryId) return;
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
    const diaryEntryId = route.params?.diaryEntryId;
    if (!diaryEntryId) return;
    const entry = diaryEntries.find((candidate) => candidate.id === diaryEntryId);
    if (!entry) return;
    navigation.setParams({ diaryEntryId: undefined, source: undefined });
    openEdit(entry, true);
  }, [diaryEntries, navigation, openEdit, route.params?.diaryEntryId]);

  useEffect(() => {
    if (!route.params?.openGrowthBookVault) return;
    setVaultOpen(true);
    navigation.setParams({ openGrowthBookVault: undefined });
  }, [navigation, route.params?.openGrowthBookVault]);

  useEffect(() => {
    if (!reminder.enabled) return;
    const tick = () => {
      const now = new Date();
      if (now.getHours() !== reminder.hour || now.getMinutes() !== reminder.minute) return;
      const key = formatDateKey(now);
      if (reminder.lastFiredDateKey === key) return;
      const next = { ...reminder, lastFiredDateKey: key };
      setReminder(next);
      void saveDiaryReminder(next, localDataScope);
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
    () => sortGrowthBookEntries(diaryEntries.filter((d) => d.includedInGrowthBook)),
    [diaryEntries],
  );
  const bookCoverPhoto = resolveGrowthBookCoverPhoto(bookEntries, growthBookEdit);
  const growthCount = useMemo(
    () => diaryEntries.filter(diaryHasMilestone).length,
    [diaryEntries],
  );
  const bookPhotoCount = useMemo(
    () => growthBookPhotoCount(bookEntries, growthBookEdit),
    [bookEntries, growthBookEdit],
  );
  const filtered = useMemo(() => filterDiaries(diaryEntries, filter), [diaryEntries, filter]);
  const monthSections = useMemo(() => groupDiariesByMonth(filtered), [filtered]);

  const liveEditing = editingEntry
    ? diaryEntries.find((d) => d.id === editingEntry.id) ?? editingEntry
    : null;

  const reminderLabel = reminder.enabled
    ? formatReminderTime(reminder.hour, reminder.minute)
    : t("diary.screen.reminderOff");
  const todayDiary = findDiaryForDate(diaryEntries, todayKey);
  const canEditToday = todayDiary ? canEditLog(myFamilyRole, todayDiary.createdBy, me) : allowAdd;
  const writeLabel = todayDiary
    ? canEditToday
      ? t("diary.screen.editToday")
      : t("diary.screen.viewToday")
    : t("diary.screen.newEntry");
  const writeDisabled = !todayDiary && !allowAdd;

  const persistFromDraft = (draft: DiaryComposeDraft, source: "manual" | "notification") => {
    if (persistLockRef.current) return;
    persistLockRef.current = true;
    try {
      const existingToday = diaryEntries.find((d) => d.dateKey === todayKey);
      const target = editingEntry ?? existingToday;
      if (target) {
        if (!canEditLog(myFamilyRole, target.createdBy, me)) return;
      } else if (!allowAdd) {
        return;
      }
      void clearDiaryDraft(localDataScope, todayKey);
      setDraftMemory(null);
      const now = new Date();
      const dateLabel = formatLocalizedDate(now, locale, { month: "long", day: "numeric", weekday: "short" });

      if (editingEntry) {
        updateDiary(editingEntry.id, {
          photos: draft.photos,
          coverStyleId: draft.coverStyleId,
          pageStyleId: draft.pageStyleId,
          coverPhotoUri: draft.coverPhotoUri,
          coverPhotoTransform: draft.coverPhotoTransform,
          coverTitle: draft.coverTitle,
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
          coverStyleId: draft.coverStyleId,
          pageStyleId: draft.pageStyleId,
          coverPhotoUri: draft.coverPhotoUri,
          coverPhotoTransform: draft.coverPhotoTransform,
          coverTitle: draft.coverTitle,
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
        babyId: localDataScope?.babyId ?? "",
        date: dateLabel,
        dateKey: todayKey,
        photos: draft.photos,
        coverStyleId: draft.coverStyleId,
        pageStyleId: draft.pageStyleId,
        coverPhotoUri: draft.coverPhotoUri,
        coverPhotoTransform: draft.coverPhotoTransform,
        coverTitle: draft.coverTitle,
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
    } finally {
      persistLockRef.current = false;
    }
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
      <AppHeader
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onOpenNotifications={onOpenNotifications}
        onOpenShared={onOpenShared}
      />
      <SectionList
        sections={monthSections.map((section, index) => ({
          key: section.monthKey,
          title: section.label,
          isFirst: index === 0,
          data: section.entries,
        }))}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled
        initialNumToRender={8}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
        ListHeaderComponent={
          <>
        {!allowAdd && (
          <Text style={styles.viewerBanner}>{t("diary.screen.viewerBanner")}</Text>
        )}
        <Pressable
          style={[styles.writeBtn, styles.btnPrimary, writeDisabled && styles.disabled]}
          disabled={writeDisabled}
          accessibilityRole="button"
          accessibilityLabel={writeLabel}
          accessibilityState={{ disabled: writeDisabled }}
          onPress={openComposeFresh}
        >
          <View style={styles.btnInner}>
            <BabyLogIcon kind="edit" size={14} color={colors.amberDark} strokeWidth={2.2} />
            <Text style={styles.btnPrimaryText}>{writeLabel}</Text>
          </View>
        </Pressable>

        <View style={styles.bookRow}>
          <Pressable
            style={styles.bookCard}
            onPress={() => setVaultOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("diary.screen.openGrowthBookA11y", { babyName })}
          >
            <View style={styles.bookCover}>
              {bookCoverPhoto ? (
                <Image source={{ uri: bookCoverPhoto }} style={styles.bookCoverImage} contentFit="cover" />
              ) : (
                <View style={styles.bookCoverFallback}>
                  <BabyLogIcon kind="tab" tab="diary" size={18} color={colors.amberText} />
                </View>
              )}
            </View>
            <View style={styles.bookCardLeft}>
              <View style={styles.bookCardTitleRow}>
                <Text style={styles.bookCardTitle}>{t("diary.screen.growthBookTitle", { babyName })}</Text>
              </View>
              <Text style={styles.bookCardStats}>
                {t("diary.screen.growthBookStats", { entries: bookEntries.length, photos: bookPhotoCount, pages: estimateGrowthBookPageCount(bookEntries.length) })}
              </Text>
              {bookEntries.length === 0 ? (
                <Text style={styles.bookCardDesc}>{t("diary.screen.growthBookEmpty")}</Text>
              ) : null}
            </View>
            <View style={styles.bookCardBtn}>
              <Text style={styles.bookCardBtnText}>{t("diary.screen.openGrowthBook")}</Text>
              <BabyLogIcon kind="chevron" size={14} color={colors.amberText} />
            </View>
          </Pressable>

          <Pressable
            style={styles.stickerBtn}
            onPress={() => setStickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("diary.screen.makeStickerA11y")}
          >
            <BabyLogIcon kind="baby" size={16} color={colors.amberText} />
            <Text style={styles.stickerBtnText}>{t("diary.screen.sticker")}</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.reminderRow}
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("diary.screen.reminderSettingsA11y")}
        >
          <BabyLogIcon kind="clock" size={14} color={colors.muted} />
          <Text style={styles.reminderHint}>{t("diary.screen.reminderSummary", { value: reminderLabel })}</Text>
          <BabyLogIcon kind="chevron" size={14} color={colors.muted} />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(
            [
              { key: "all", label: t("diary.screen.filterAll", { count: diaryEntries.length }) },
              { key: "growth", label: t("diary.screen.filterGrowth", { count: growthCount }) },
              { key: "book", label: t("diary.screen.filterBook", { count: bookEntries.length }) },
            ] as const
          ).map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPressIn={() => setChipPressing(true)}
                onPressOut={() => setChipPressing(false)}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityLabel={f.label}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              diaryEntries.length === 0
                ? t("diary.screen.emptyAllTitle")
                : filter === "growth"
                  ? t("diary.screen.emptyGrowthTitle")
                  : filter === "book"
                    ? t("diary.screen.emptyBookTitle")
                    : t("diary.screen.emptyFilteredTitle")
            }
            body={
              diaryEntries.length === 0
                ? t("diary.screen.emptyAllBody")
                : filter === "growth"
                  ? t("diary.screen.emptyGrowthBody")
                  : filter === "book"
                    ? t("diary.screen.emptyBookBody")
                    : undefined
            }
            ctaLabel={diaryEntries.length === 0 ? t("diary.screen.firstEntry") : undefined}
            onPressCta={diaryEntries.length === 0 ? openComposeFresh : undefined}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={[styles.monthHeader, section.isFirst && styles.monthHeaderFirst]}
            accessibilityRole="header"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item: d }) => (
          <DiaryCard
            entry={d}
            ageLabel={diaryStageLabel(d, careSetup.child)}
            dateLabel={formatDottedDate(d.dateKey) ?? d.date}
            canToggleBook={canEditLog(myFamilyRole, d.createdBy, me)}
            onOpen={() => openEdit(d)}
            onToggleBook={() => toggleDiaryInGrowthBook(d.id)}
          />
        )}
      />

      <DiaryComposeModal
        visible={composeOpen}
        fromPush={composeFromPush}
        readOnly={composeReadOnly}
        editingEntry={liveEditing}
        initialDraft={initialDraft}
        onClose={() => {
          setComposeOpen(false);
          setEditingEntry(null);
          setInitialDraft(null);
          setComposeFromPush(false);
          setComposeReadOnly(false);
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
          void saveDiaryDraft(payload, localDataScope);
        }}
        onSave={(draft) => persistFromDraft(draft, composeFromPush ? "notification" : "manual")}
        onDelete={(id) => {
          const entry = diaryEntries.find((diary) => diary.id === id);
          if (!entry || !canDeleteLog(myFamilyRole, entry.createdBy, me)) return;
          deleteDiary(id);
          void clearDiaryDraft(localDataScope, todayKey);
          setDraftMemory(null);
        }}
      />

      <BabyStickerVaultModal
        visible={stickerOpen}
        babyId={localDataScope?.babyId}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        onClose={() => setStickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
      />

      <GrowthBookVaultModal
        visible={vaultOpen}
        babyName={babyName}
        entries={diaryEntries}
        edit={growthBookEdit}
        onClose={() => setVaultOpen(false)}
        onDismiss={openPendingGrowthBookEditor}
        onOpenEditor={() => requestGrowthBookEditor(null)}
        onRemove={(id) => {
          const entry = diaryEntries.find((diary) => diary.id === id);
          if (entry && canEditLog(myFamilyRole, entry.createdBy, me)) {
            updateDiary(id, { includedInGrowthBook: false });
          }
        }}
        onGoToDiary={() => setVaultOpen(false)}
      />

      <GrowthBookEditorModal
        visible={editorOpen}
        babyName={babyName}
        babyId={localDataScope?.babyId ?? ""}
        entries={diaryEntries}
        edit={growthBookEdit}
        me={me}
        myRole={myFamilyRole}
        initialDiaryId={editorInitialDiaryId}
        onChange={setGrowthBookEdit}
        onClose={requestGrowthBookVault}
        onDismiss={openPendingGrowthBookVault}
      />

      <DiaryReminderSettingsModal
        visible={settingsOpen}
        value={reminder}
        babyName={babyName}
        babyId={localDataScope?.babyId ?? null}
        myRole={myFamilyRole}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setReminder(next);
          void saveDiaryReminder(next, localDataScope);
        }}
        onTestNotification={() => setPushVisible(true)}
      />

      <ConsultFab hidden={fabHidden} onPress={() => setPromptOpen(true)} />
      <ConsultPromptSheet
        visible={promptOpen}
        todayLogCount={summary.totalCount}
        onClose={() => setPromptOpen(false)}
        onSelectQuestion={(question) => {
          setPromptOpen(false);
          onOpenConsult(question);
        }}
        onAskFreely={() => {
          setPromptOpen(false);
          onOpenConsult();
        }}
      />
    </View>
  );
}

const THUMB_SIZE = 88;
const CARD_PAD = 12;
const BOOKMARK_CHIP = 24;
const BOOKMARK_HIT = Platform.OS === "android" ? 48 : 44;
const BOOKMARK_SLOP = (BOOKMARK_HIT - BOOKMARK_CHIP) / 2;
const BOOKMARK_NUDGE = 4;

function DiaryCard({
  entry,
  ageLabel,
  dateLabel,
  canToggleBook,
  onOpen,
  onToggleBook,
}: {
  entry: DiaryEntry;
  ageLabel: string | null;
  dateLabel: string;
  canToggleBook: boolean;
  onOpen: () => void;
  onToggleBook: () => void;
}) {
  const { t } = useLanguage();
  const inBook = entry.includedInGrowthBook;
  const photo = diaryPrimaryPhoto(entry) ?? entry.photos[0] ?? null;
  const milestone = diaryMilestoneLabel(entry);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!photo && !photoFailed;
  const moodStamp = entry.moodStamp;
  useEffect(() => {
    setPhotoFailed(false);
  }, [photo]);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardMain}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={
          milestone
            ? t("diary.screen.milestoneEntryA11y", { date: entry.date, milestone })
            : t("diary.screen.entryA11y", { date: entry.date })
        }
      >
        <View style={styles.thumbWrap}>
          {showPhoto ? (
            <Image
              source={{ uri: photo }}
              style={styles.thumb}
              contentFit="cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={styles.thumbFallback}>
              {moodStamp ? (
                <DiaryMoodStamp id={moodStamp} selected size="md" />
              ) : (
                <BabyLogIcon kind="image" size={22} color={colors.faint} />
              )}
            </View>
          )}
          {entry.photos.length > 1 ? (
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>+{entry.photos.length - 1}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.dateRow}>
            <Text style={styles.date} numberOfLines={1}>
              {ageLabel ? `${ageLabel} · ${dateLabel}` : entry.date}
            </Text>
            {showPhoto && moodStamp ? (
              <DiaryMoodStamp id={moodStamp} selected size="sm" />
            ) : null}
          </View>
          <Text style={styles.comment} numberOfLines={2}>
            {diaryDisplayComment(entry)}
          </Text>
          {entry.createdBy?.name ? (
            <Text style={styles.author}>{t("diary.screen.author", { name: entry.createdBy.name })}</Text>
          ) : null}
          {milestone ? (
            <View style={styles.growthTag}>
              <BabyLogIcon kind="sparkles" size={12} color={colors.text} />
              <Text style={styles.growthTagText} numberOfLines={1}>
                {milestone}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.bookmarkBtn,
          inBook && styles.bookmarkBtnActive,
          !canToggleBook && styles.disabled,
          pressed && canToggleBook && styles.bookmarkBtnPressed,
        ]}
        hitSlop={BOOKMARK_SLOP}
        disabled={!canToggleBook}
        onPress={onToggleBook}
        accessibilityRole="button"
        accessibilityLabel={
          canToggleBook
            ? inBook
              ? t("diary.screen.removeFromBook")
              : t("diary.screen.addToBook")
            : inBook
              ? t("diary.screen.bookReadOnlyIncluded")
              : t("diary.screen.bookReadOnlyAdd")
        }
        accessibilityState={{ selected: inBook, disabled: !canToggleBook }}
      >
        <BabyLogIcon
          kind="bookmark"
          size={14}
          color={inBook ? colors.amberText : colors.muted}
          fill={inBook ? colors.amber : "transparent"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 96 },
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
  writeBtn: { minHeight: 44, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  disabled: { opacity: 0.45 },
  btnPrimary: { backgroundColor: colors.amber },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14 },
  bookRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
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
    paddingVertical: 10,
  },
  bookCardLeft: { flex: 1 },
  bookCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookCardTitle: { flexShrink: 1, fontSize: 14.5, fontWeight: "800", color: colors.text },
  bookCardStats: { fontSize: 12.5, color: colors.muted, marginTop: 4, fontWeight: "600" },
  bookCardDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  bookCardBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  bookCardBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.amberText },
  bookCover: {
    width: 48,
    height: 62,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookCoverImage: { width: "100%", height: "100%" },
  bookCoverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerBtn: {
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  stickerBtnText: { fontSize: 11, fontWeight: "800", color: colors.amberText },
  reminderRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  reminderHint: {
    flex: 1,
    fontSize: type.xs,
    color: colors.muted,
    fontWeight: "600",
  },
  filterRow: { gap: 8, paddingBottom: 8 },
  filterChip: {
    minHeight: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  filterChipTextActive: { color: colors.amberDark },
  monthHeader: {
    fontSize: type.xs,
    fontWeight: "800",
    color: colors.muted,
    marginTop: 10,
    marginBottom: 8,
    marginLeft: 2,
    backgroundColor: colors.background,
    paddingVertical: 4,
  },
  monthHeaderFirst: { marginTop: 0 },
  card: {
    marginBottom: 10,
  },
  cardMain: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: CARD_PAD,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.cardHi,
  },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  photoCountBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "rgba(46,42,38,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCountText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { flex: 1, fontSize: type.xs, color: colors.muted, fontWeight: "700" },
  comment: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 19 },
  author: { fontSize: type.xs, color: colors.muted, marginTop: 4, fontWeight: "600" },
  growthTag: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  growthTagText: { flexShrink: 1, fontSize: type.xs, fontWeight: "700", color: colors.text },
  bookmarkBtn: {
    position: "absolute",
    top: CARD_PAD - BOOKMARK_NUDGE,
    left: CARD_PAD + THUMB_SIZE - BOOKMARK_CHIP + BOOKMARK_NUDGE,
    zIndex: 2,
    width: BOOKMARK_CHIP,
    height: BOOKMARK_CHIP,
    borderRadius: BOOKMARK_CHIP / 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkBtnActive: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  bookmarkBtnPressed: { opacity: 0.7 },
});
