import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ActiveTimerSheet } from "../../components/babylog/ActiveTimerSheet";
import { AddCustomCategorySheet } from "../../components/babylog/AddCustomCategorySheet";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import {
  OneTouchRecordGrid,
  type OneTouchAction,
} from "../../components/babylog/OneTouchRecordGrid";
import { QuickRecordsBar } from "../../components/babylog/QuickRecordsBar";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { RecordCreatedToast } from "../../components/babylog/RecordCreatedToast";
import { RecordDetailSheet, type RecordSheetPrefill } from "../../components/babylog/RecordDetailSheet";
import { RecordHomeHeader } from "../../components/babylog/RecordHomeHeader";
import { GrowthRecordModal } from "../../components/babylog/GrowthRecordModal";
import { TodayLogSummaryCard } from "../../components/babylog/TodayLogSummaryCard";
import { RecordDatePickerModal } from "../../components/babylog/RecordDatePickerModal";
import { TodayTimeline } from "../../components/babylog/TodayTimeline";
import { EmptyState } from "../../components/states/FeedbackStates";
import { useBabyLog } from "../../context/BabyLogContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import type { ActiveTimer, TimerSide } from "../../types/activeTimer";
import { formatElapsedClock, elapsedMsNow, isTimerAction } from "../../types/activeTimer";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { customCategoryKey } from "../../types/logCategory";
import type { QuickRecord } from "../../types/quickRecord";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import { createId } from "../../utils/id";
import {
  dayNavLabel,
  formatDateKey,
  offsetDateKey,
  shortDateLabel,
  yesterdayDateKey,
} from "../../utils/dateKey";
import {
  buildTimerStopResult,
  changeTimerSide,
  createActiveTimer,
  pauseTimer,
  resumeTimer,
  timerFromOpenSleep,
} from "../../utils/activeTimerOps";
import { getActiveTimers, hydrateActiveTimers, saveActiveTimers } from "../../utils/activeTimersStore";
import { elapsedClockMinutes, nowTime } from "../../utils/formatLog";
import {
  actionToCategory,
  longPressModeFor,
  longPressSheetPrefill,
} from "../../utils/longPressActions";
import { getLogsForDay } from "../../utils/reportAggregates";
import { colors } from "../../theme";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
};

const TIMER_LABEL: Record<ActiveTimer["kind"], string> = {
  breastfeeding: "모유수유",
  sleep: "수면",
  pump: "유축",
  tummy: "터미타임",
  play: "놀이",
};

export function RecordScreen({ onOpenProfile, onOpenSettings, onOpenConsult }: Props) {
  const { settings, ready: settingsReady } = useAppSettings();
  const {
    logs,
    addLog,
    addLogWithPersistence,
    updateLog,
    updateLogWithPersistence,
    deleteLog,
    customCategories,
    upsertCustomCategory,
    quickRecords,
    setQuickRecords,
    myFamilyRole,
    familyMembers,
    storageReady,
    addGrowthRecord,
    updateGrowthRecord,
  } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<LogCategoryKey | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey());
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [timerSheetId, setTimerSheetId] = useState<string | null>(null);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerTick, setTimerTick] = useState(0);
  const [consultPromptOpen, setConsultPromptOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [categoryPressing, setCategoryPressing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [growthRecordOpen, setGrowthRecordOpen] = useState(false);
  const [growthMeasuredAt, setGrowthMeasuredAt] = useState<string | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRestoreInitialized = useRef(false);
  const activeSleepRef = useRef<BabyLogEntry | undefined>(undefined);
  const suppressedRestoredSleepId = useRef<string | null>(null);

  useEffect(() => {
    if (settingsReady) setSelectedDateKey(formatDateKey());
  }, [settingsReady, settings.time.dayStart]);

  const me = familyMembers.find((m) => m.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const todayKey = formatDateKey();
  const dayLogs = useMemo(
    () => getLogsForDay(logs, selectedDateKey, todayKey),
    [logs, selectedDateKey, todayKey],
  );
  const isViewingToday = selectedDateKey === todayKey;
  const canGoNext = selectedDateKey < todayKey;
  const canGoPrev = selectedDateKey > offsetDateKey(todayKey, -365);
  const timelineTitle = isViewingToday
    ? "오늘의 기록"
    : selectedDateKey === yesterdayDateKey()
      ? "어제 기록"
      : `${shortDateLabel(selectedDateKey).replace("/", ".")} 기록`;
  const activeSleep = useMemo(() => {
    const yesterdayKey = yesterdayDateKey();
    return [...logs]
      .filter(
        (entry) =>
          entry.cat === "sleep" &&
          !entry.duration &&
          (entry.dateKey === todayKey || entry.dateKey === yesterdayKey),
      )
      .sort((a, b) => `${b.dateKey ?? todayKey}T${b.time}`.localeCompare(`${a.dateKey ?? todayKey}T${a.time}`))[0];
  }, [logs, todayKey]);
  activeSleepRef.current = activeSleep;

  useEffect(() => {
    if (!settingsReady) return;
    void (async () => {
      await hydrateActiveTimers();
      const restored = settings.timers.restoreAfterRestart ? getActiveTimers() ?? [] : [];
      suppressedRestoredSleepId.current = settings.timers.restoreAfterRestart
        ? null
        : activeSleepRef.current?.id ?? null;
      setActiveTimers(restored);
      if (!settings.timers.restoreAfterRestart) await saveActiveTimers([]);
      timerRestoreInitialized.current = true;
    })();
  }, [settingsReady, settings.timers.restoreAfterRestart]);

  useEffect(() => {
    if (!storageReady) return;
    void saveActiveTimers(activeTimers);
  }, [activeTimers, storageReady]);

  // Keep sleep timer in sync with open sleep log (short-tap start / restore).
  useEffect(() => {
    if (!storageReady || !timerRestoreInitialized.current) return;
    setActiveTimers((prev) => {
      const sleepTimer = prev.find((t) => t.kind === "sleep");
      if (activeSleep) {
        if (activeSleep.id === suppressedRestoredSleepId.current) return prev;
        if (sleepTimer && sleepTimer.linkedLogId === activeSleep.id) return prev;
        const next = prev.filter((t) => t.kind !== "sleep");
        return [...next, timerFromOpenSleep(activeSleep)];
      }
      suppressedRestoredSleepId.current = null;
      if (sleepTimer?.linkedLogId) {
        const linkedStillOpen = logs.some(
          (entry) =>
            entry.id === sleepTimer.linkedLogId &&
            entry.cat === "sleep" &&
            !entry.duration,
        );
        if (!linkedStillOpen) {
          return prev.filter((t) => t.kind !== "sleep");
        }
      }
      return prev;
    });
  }, [activeSleep, logs, storageReady]);

  useEffect(() => {
    if (!activeTimers.some((t) => t.status === "running")) return;
    const id = setInterval(() => setTimerTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeTimers]);

  useEffect(() => {
    const tag = "k-nanny-active-timer";
    const shouldStayAwake =
      settings.timers.keepScreenAwake &&
      activeTimers.some((timer) => timer.status === "running");
    if (shouldStayAwake) void activateKeepAwakeAsync(tag);
    else void deactivateKeepAwake(tag);
    return () => {
      void deactivateKeepAwake(tag);
    };
  }, [activeTimers, settings.timers.keepScreenAwake]);

  const openSheet = (catKey: LogCategoryKey, nextPrefill?: RecordSheetPrefill) => {
    if (!nextPrefill?.editId && !allowAdd) return;
    setPrefill(nextPrefill ?? null);
    setSheetCat(catKey);
  };

  const openEdit = useCallback(
    (entry: BabyLogEntry) => {
      if (!canEditLog(myFamilyRole, entry.createdBy, me)) return;
      openSheet(entry.cat, {
        editId: entry.id,
        cat: entry.cat,
        time: entry.time,
        chip: entry.chip,
        chip2: entry.chip2,
        stoolState: entry.stoolState,
        amount: entry.amount,
        duration: entry.duration,
        notes: entry.notes,
        voice: entry.voice,
        source: entry.source,
        rawTranscript: entry.rawTranscript,
        createdBy: entry.createdBy,
        dateKey: entry.dateKey,
        flags: entry.flags,
        confidence: entry.confidence,
        title: entry.title,
        details: entry.details,
        nextAt: entry.nextAt,
      });
    },
    [allowAdd, me, myFamilyRole],
  );

  const announceCreated = (entry: BabyLogEntry, title: string) => {
    setHighlightId(entry.id);
    setToast({ id: entry.id, title });
    setTimeout(() => setHighlightId((cur) => (cur === entry.id ? null : cur)), 1800);
  };

  const handleSave = (entry: Omit<BabyLogEntry, "id">, editId?: string) => {
    if (editId) {
      const existing = logs.find((log) => log.id === editId);
      if (existing && canEditLog(myFamilyRole, existing.createdBy, me)) {
        updateLog(editId, entry);
      }
    } else if (allowAdd) {
      addLog(entry);
    }
  };

  const handleOneTouch = (action: OneTouchAction) => {
    if (!allowAdd) return;
    const next = longPressSheetPrefill(action);
    openSheet(next.cat ?? actionToCategory(action), {
      ...next,
      time: nowTime(),
      dateKey: todayKey,
    });
  };

  const startOrOpenTimer = (action: OneTouchAction) => {
    if (!allowAdd || !isTimerAction(action)) return;
    const existing = activeTimers.find((t) => t.action === action);
    if (existing) {
      setTimerSheetId(existing.id);
      return;
    }

    const otherActiveTimer = activeTimers[0];
    if (otherActiveTimer) {
      Alert.alert(
        "진행 중인 기록이 있어요",
        `${TIMER_LABEL[otherActiveTimer.kind]} 타이머를 먼저 종료해 주세요.`,
      );
      return;
    }

    if (action === "sleep") {
      if (activeSleep) {
        const linked = activeTimers.find((t) => t.kind === "sleep") ?? timerFromOpenSleep(activeSleep);
        setActiveTimers((prev) => {
          if (prev.some((t) => t.kind === "sleep")) return prev;
          return [...prev, linked];
        });
        setTimerSheetId(linked.id);
        return;
      }
      const timer = createActiveTimer("sleep", "sleep", {
        startTime: nowTime(),
        dateKey: todayKey,
      });
      setActiveTimers((prev) => [...prev.filter((t) => t.kind !== "sleep"), timer]);
      setTimerSheetId(timer.id);
      return;
    }

    const timer = createActiveTimer(action, action, {
      side:
        (action === "breastfeeding" || action === "pump") &&
        !settings.timers.switchBreastSide
          ? "both"
          : undefined,
    });
    setActiveTimers((prev) => [...prev.filter((t) => t.action !== action), timer]);
    setTimerSheetId(timer.id);
  };

  const handleLongPress = (action: OneTouchAction) => {
    if (!allowAdd) return;
    if (longPressModeFor(action) === "timer") {
      const timerEnabled =
        action === "breastfeeding"
          ? settings.timers.breastfeeding
          : action === "sleep"
            ? settings.timers.sleep
            : action === "pump"
              ? settings.timers.pump
              : action === "tummy"
                ? settings.timers.tummy
                : true;
      if (timerEnabled) {
        startOrOpenTimer(action);
        return;
      }
      const next = longPressSheetPrefill(action);
      openSheet(next.cat ?? actionToCategory(action), next);
      return;
    }
    const next = longPressSheetPrefill(action);
    openSheet(next.cat ?? actionToCategory(action), next);
  };

  const patchTimer = (id: string, updater: (t: ActiveTimer) => ActiveTimer) => {
    setActiveTimers((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  };

  const handleStopTimer = async (opts?: { amount?: string }) => {
    const timer = activeTimers.find((t) => t.id === timerSheetId);
    if (!timer || timerSaving) return;
    setTimerSaving(true);
    const result = buildTimerStopResult(timer, opts);
    const base = {
      time: result.startTime,
      dateKey: result.dateKey,
      source: "manual" as const,
      duration: String(result.durationMinutes),
      chip: result.chip,
      notes: result.notes,
      amount: result.amount,
    };

    try {
      let saved: BabyLogEntry | null = null;
      let title = "";
      if (timer.kind === "sleep" && timer.linkedLogId) {
        const existing = logs.find((l) => l.id === timer.linkedLogId);
        if (existing) {
          const { id, ...entry } = existing;
          saved = await updateLogWithPersistence(id, {
            ...entry,
            duration: String(result.durationMinutes),
          });
          title = "수면 종료 완료";
          if (saved) suppressedRestoredSleepId.current = id;
        }
      } else if (timer.kind === "sleep") {
        saved = await addLogWithPersistence({ ...base, cat: "sleep", chip: "낮잠" });
        title = "수면 타이머 저장";
      } else if (timer.kind === "breastfeeding") {
        saved = await addLogWithPersistence({ ...base, cat: "breast" });
        title = "모유수유 타이머 저장";
      } else if (timer.kind === "pump") {
        saved = await addLogWithPersistence({ ...base, cat: "pump" });
        title = "유축 타이머 저장";
      } else if (timer.kind === "tummy") {
        saved = await addLogWithPersistence({ ...base, cat: "tummy" });
        title = "터미타임 타이머 저장";
      } else if (timer.kind === "play") {
        saved = await addLogWithPersistence({ ...base, cat: "play" });
        title = "놀이 타이머 저장";
      }

      if (!saved) {
        Alert.alert("기록 저장에 실패했어요.", "타이머는 계속 유지돼요. 다시 종료해 주세요.");
        return;
      }
      announceCreated(saved, title);
      setActiveTimers((prev) => prev.filter((t) => t.id !== timer.id));
      setTimerSheetId(null);
    } finally {
      setTimerSaving(false);
    }
  };

  const handleQuickRecord = (record: QuickRecord) => {
    if (!allowAdd) return;
    const time = nowTime();
    const { defaults } = record;

    if (defaults.cat === "diaper" && !defaults.chip) {
      openSheet("diaper", {
        cat: "diaper",
        time,
        dateKey: todayKey,
        source: "manual",
      });
      return;
    }

    if (defaults.cat === "sleep" && (defaults.sleepAction === "start" || !defaults.duration)) {
      if (activeSleep && defaults.sleepAction !== "start") {
        const elapsed = Math.max(1, elapsedClockMinutes(activeSleep.time, time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, `${record.label} 완료`);
        suppressedRestoredSleepId.current = id;
        return;
      }
      if (activeSleep && defaults.sleepAction === "start") {
        const elapsed = Math.max(1, elapsedClockMinutes(activeSleep.time, time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, "수면 종료 완료");
        suppressedRestoredSleepId.current = id;
        return;
      }
    }

    const created = addLog({
      cat: defaults.cat,
      time,
      dateKey: todayKey,
      source: "manual",
      chip: defaults.chip,
      chip2: defaults.chip2,
      stoolState: defaults.stoolState,
      amount: defaults.amount,
      duration: defaults.duration,
      notes: defaults.notes,
    });
    announceCreated(created, `${record.label} 기록 완료`);
  };

  const editingEntry = prefill?.editId ? logs.find((l) => l.id === prefill.editId) : null;
  const allowDelete = editingEntry
    ? canDeleteLog(myFamilyRole, editingEntry.createdBy, me)
    : false;

  const toastEntry = toast ? logs.find((l) => l.id === toast.id) : null;
  const sheetTimer = activeTimers.find((t) => t.id === timerSheetId) ?? null;
  const activeTimerActions = activeTimers.map((t) => t.action);
  const primaryTimer = activeTimers[0];
  void timerTick;

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    };
  }, []);

  const scheduleScrollReveal = useCallback(() => {
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = setTimeout(() => setScrolling(false), 500);
  }, []);

  const handleScrollBegin = useCallback(() => {
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    setScrolling(true);
  }, []);

  const handleScrollEnd = useCallback(
    (_e?: NativeSyntheticEvent<NativeScrollEvent>) => {
      scheduleScrollReveal();
    },
    [scheduleScrollReveal],
  );

  const fabHidden =
    scrolling ||
    categoryPressing ||
    Boolean(toast) ||
    Boolean(sheetTimer) ||
    sheetCat !== null ||
    consultPromptOpen ||
    keyboardOpen ||
    growthRecordOpen;

  return (
    <View style={styles.root}>
      <RecordHomeHeader onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {!allowAdd && (
          <Text style={styles.viewerBanner}>보기 전용 계정이에요. 기록 추가·수정은 제한돼요.</Text>
        )}
        {primaryTimer ? (
          <Pressable
            style={({ pressed }) => [styles.timerBanner, pressed && styles.timerBannerPressed]}
            onPress={() => setTimerSheetId(primaryTimer.id)}
          >
            <View style={styles.timerBannerDot} />
            <View style={styles.timerBannerCopy}>
              <Text style={styles.timerBannerTitle}>
                {TIMER_LABEL[primaryTimer.kind]} 진행 중
                {activeTimers.length > 1 ? ` · +${activeTimers.length - 1}` : ""}
              </Text>
              <Text style={styles.timerBannerMeta}>
                {formatElapsedClock(elapsedMsNow(primaryTimer))} · 탭해서 이어서
              </Text>
            </View>
            <Text style={styles.timerBannerCta}>열기</Text>
          </Pressable>
        ) : null}
        <TodayLogSummaryCard
          logs={dayLogs}
          dateKey={selectedDateKey}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrevDay={() => setSelectedDateKey((key) => offsetDateKey(key, -1))}
          onNextDay={() => setSelectedDateKey((key) => offsetDateKey(key, 1))}
          onPressDate={() => setDatePickerOpen(true)}
        />
        <OneTouchRecordGrid
          sleepActive={Boolean(activeSleep)}
          activeTimerActions={activeTimerActions}
          visibleActions={settings.categories.order.filter((action) =>
            settings.categories.visible.includes(action),
          )}
          coreActions={settings.categories.core}
          customCategories={customCategories}
          disabled={!allowAdd}
          onSelect={handleOneTouch}
          onLongPress={handleLongPress}
          onInteractionChange={setCategoryPressing}
          onAdd={allowAdd ? () => setAddCategoryOpen(true) : undefined}
          onSelectCustom={(category: CustomCategory) => {
            if (!allowAdd) return;
            openSheet(customCategoryKey(category.id), {
              cat: customCategoryKey(category.id),
              dateKey: selectedDateKey,
              time: nowTime(),
              source: "manual",
            });
          }}
          onOpenGrowth={() => {
            setGrowthMeasuredAt(selectedDateKey);
            setGrowthRecordOpen(true);
          }}
          onOpenActiveTimer={(action) => {
            const found = activeTimers.find((t) => t.action === action);
            if (found) setTimerSheetId(found.id);
          }}
        />
        <QuickRecordsBar
          records={quickRecords}
          visibleActions={settings.categories.visible}
          disabled={!allowAdd}
          onTap={handleQuickRecord}
          onSaveRecords={setQuickRecords}
        />
        {!storageReady ? null : dayLogs.length === 0 ? (
          <EmptyState
            title={isViewingToday ? "아직 기록이 없어요." : "이 날의 기록이 없어요."}
            body={
              isViewingToday
                ? "첫 기록을 남겨보세요."
                : `${dayNavLabel(selectedDateKey)}에 남긴 기록이 없습니다.`
            }
            ctaLabel={allowAdd && isViewingToday ? "기록 추가하기" : undefined}
            onPressCta={allowAdd && isViewingToday ? () => handleOneTouch("formula") : undefined}
          />
        ) : (
          <TodayTimeline
            logs={dayLogs}
            title={timelineTitle}
            customCategories={customCategories}
            highlightId={highlightId}
            onPress={openEdit}
            limit={6}
            onDelete={(entry) => {
              if (canDeleteLog(myFamilyRole, entry.createdBy, me)) deleteLog(entry.id);
            }}
          />
        )}
      </ScrollView>

      <RecordDatePickerModal
        visible={datePickerOpen}
        selectedDateKey={selectedDateKey}
        onSelect={setSelectedDateKey}
        onClose={() => setDatePickerOpen(false)}
      />

      <ConsultFab
        hidden={fabHidden}
        onPress={() => setConsultPromptOpen(true)}
      />

      <ConsultPromptSheet
        visible={consultPromptOpen}
        todayLogCount={isViewingToday ? dayLogs.length : 0}
        onClose={() => setConsultPromptOpen(false)}
        onSelectQuestion={(question) => {
          setConsultPromptOpen(false);
          onOpenConsult(question);
        }}
      />

      <RecordCreatedToast
        visible={Boolean(toast)}
        title={toast?.title ?? ""}
        body="탭해서 수정"
        onDismiss={() => setToast(null)}
        onPress={() => {
          if (toastEntry) {
            openEdit(toastEntry);
            setToast(null);
          }
        }}
      />

      <RecordDetailSheet
        visible={sheetCat !== null}
        catKey={sheetCat}
        customCategories={customCategories}
        prefill={prefill}
        onClose={() => {
          setSheetCat(null);
          setPrefill(null);
        }}
        onSave={handleSave}
        onOpenGrowthRecord={
          sheetCat === "doctor"
            ? () => {
                setGrowthMeasuredAt(prefill?.dateKey ?? selectedDateKey);
                setTimeout(() => setGrowthRecordOpen(true), 120);
              }
            : undefined
        }
        onDelete={
          allowDelete
            ? (id) => {
                deleteLog(id);
                setSheetCat(null);
                setPrefill(null);
              }
            : undefined
        }
      />

      <AddCustomCategorySheet
        visible={addCategoryOpen}
        existingCategories={customCategories}
        onClose={() => setAddCategoryOpen(false)}
        onSave={(input) => {
          upsertCustomCategory({
            id: createId(),
            label: input.label,
            color: input.color,
            iconKey: input.iconKey,
            templateId: input.iconKey,
            kind: "custom",
            inputMode: input.inputMode,
            isEnabled: true,
            duration: input.inputMode === "duration",
            amount: input.inputMode === "amount" ? "회/량" : undefined,
            chips: input.inputMode === "check" ? ["완료", "미완료"] : undefined,
          });
          setAddCategoryOpen(false);
        }}
      />

      <ActiveTimerSheet
        visible={Boolean(sheetTimer)}
        timer={sheetTimer}
        saving={timerSaving}
        allowSideSwitch={settings.timers.switchBreastSide}
        onClose={() => setTimerSheetId(null)}
        onChangeSide={(side: TimerSide) => {
          if (!sheetTimer) return;
          patchTimer(sheetTimer.id, (t) => changeTimerSide(t, side));
        }}
        onPause={() => {
          if (!sheetTimer) return;
          patchTimer(sheetTimer.id, pauseTimer);
        }}
        onResume={() => {
          if (!sheetTimer) return;
          patchTimer(sheetTimer.id, resumeTimer);
        }}
        onStop={handleStopTimer}
      />

      <GrowthRecordModal
        visible={growthRecordOpen}
        initialSource="hospital"
        initialMeasuredAt={growthMeasuredAt}
        onClose={() => {
          setGrowthRecordOpen(false);
          setGrowthMeasuredAt(undefined);
        }}
        onSave={(draft, editId) => {
          if (editId) updateGrowthRecord(editId, draft);
          else addGrowthRecord(draft);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 112 },
  viewerBanner: {
    backgroundColor: colors.amberSoft,
    color: colors.amberDark,
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  timerBannerPressed: { opacity: 0.85 },
  timerBannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amber,
  },
  timerBannerCopy: { flex: 1 },
  timerBannerTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  timerBannerMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
  timerBannerCta: { fontSize: 13, fontWeight: "800", color: colors.amber },
});
