import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { ActiveTimerSheet } from "../../components/babylog/ActiveTimerSheet";
import { ContractionTimerSheet } from "../../components/babylog/ContractionTimerSheet";
import { AddCustomCategorySheet } from "../../components/babylog/AddCustomCategorySheet";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import {
  OneTouchRecordGrid,
  type OneTouchAction,
} from "../../components/babylog/OneTouchRecordGrid";
import { QuickRecordsBar } from "../../components/babylog/QuickRecordsBar";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { LogCategoryIcon } from "../../components/babylog/LogCategoryIcon";
import { RecordCreatedToast } from "../../components/babylog/RecordCreatedToast";
import { RecordDetailSheet, type RecordSheetPrefill } from "../../components/babylog/RecordDetailSheet";
import { RecordHomeHeader } from "../../components/babylog/RecordHomeHeader";
import { GrowthRecordModal } from "../../components/babylog/GrowthRecordModal";
import { TodayLogSummaryCard } from "../../components/babylog/TodayLogSummaryCard";
import { RecordDatePickerModal } from "../../components/babylog/RecordDatePickerModal";
import { TodayTimeline } from "../../components/babylog/TodayTimeline";
import { EmptyState, LoadingState } from "../../components/states/FeedbackStates";
import { useBabyLog } from "../../context/BabyLogContext";
import { PREGNANCY_QUICK_ACTION_IDS } from "../../constants/quickRecordActions";
import { isPregnancyStage } from "../../utils/childDisplay";
import { useAppSettings } from "../../context/AppSettingsContext";
import type { ActiveTimer, TimerSide } from "../../types/activeTimer";
import { formatElapsedClock, elapsedMsNow, isBornTimer, isTimerAction } from "../../types/activeTimer";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { customCategoriesForStage, customCategoryKey, isCustomCategoryKey } from "../../types/logCategory";
import type { QuickRecord } from "../../types/quickRecord";
import type { FoodIngredient, FoodIngredientSource } from "../../types/foodIngredient";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import { createId } from "../../utils/id";
import {
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
import { FEEDING_CATS, getLogsForDay } from "../../utils/reportAggregates";
import { colors, type } from "../../theme";
import { useCompactLayout } from "../../hooks/useCompactLayout";
import { loadFoodIngredients, normalizeIngredientName, saveFoodIngredients } from "../../utils/foodIngredientsStore";
import type { MainTabParamList } from "../../navigation/types";
import { useLanguage } from "../../LanguageContext";
import { RECORD_VALUE } from "../../constants/recordInternalValues";
import { quickRecordLabel } from "../../utils/recordDisplay";
import { formatDayNavLabel } from "../../utils/insightDisplay";
import {
  buildContractionSaveEntry,
  contractionUpdatesAfterDelete,
  durationSecondsOf,
  hhmmFromIso,
  isContractionLog,
  siblingContractionUpdates,
} from "../../utils/contractionLog";
import { careLogCoverageContains } from "../../utils/careLogHistory";

type Props = {
  onOpenProfile: (opts?: { convertBirth?: boolean }) => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
};

/** Window in which a repeated tap on the same quick record is treated as a mis-tap. */
const QUICK_RECORD_REPEAT_GUARD_MS = 1200;

const TIMER_LABEL_KEYS = {
  breastfeeding: "record.timer.breastfeeding",
  formula: "record.timer.formula",
  storedMilk: "record.timer.storedMilk",
  sleep: "record.timer.sleep",
  pump: "record.timer.pump",
  tummy: "record.timer.tummy",
  play: "record.timer.play",
  contraction: "record.contraction.title",
} as const;

export function RecordScreen({ onOpenProfile, onOpenSettings, onOpenNotifications, onOpenConsult }: Props) {
  const { t } = useLanguage();
  const route = useRoute<RouteProp<MainTabParamList, "Record">>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Record">>();
  const { settings, ready: settingsReady } = useAppSettings();
  const {
    logs,
    careLogCoverage,
    ensureCareLogsForRange,
    ensureCareLogById,
    ensureCareLogsForCategories,
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
    localDataScope,
    logAuthor,
    careSetup,
  } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<LogCategoryKey | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey());
  const [historyLoadingDateKey, setHistoryLoadingDateKey] = useState<string | null>(null);
  const [historyResult, setHistoryResult] = useState<{ dateKey: string; complete: boolean } | null>(null);
  const [inventoryHistoryComplete, setInventoryHistoryComplete] = useState(false);
  const [contractionHistoryComplete, setContractionHistoryComplete] = useState(false);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [timerSheetId, setTimerSheetId] = useState<string | null>(null);
  const [contractionSheetOpen, setContractionSheetOpen] = useState(false);
  const [contractionSaving, setContractionSaving] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerTick, setTimerTick] = useState(0);
  const [consultPromptOpen, setConsultPromptOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [categoryPressing, setCategoryPressing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [growthRecordOpen, setGrowthRecordOpen] = useState(false);
  const [growthMeasuredAt, setGrowthMeasuredAt] = useState<string | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [foodIngredients, setFoodIngredients] = useState<FoodIngredient[]>([]);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRestoreInitialized = useRef(false);
  const activeTimersScopeRef = useRef<string | null>(null);
  const activeSleepRef = useRef<BabyLogEntry | undefined>(undefined);
  const suppressedRestoredSleepId = useRef<string | null>(null);
  const lastQuickRecordTap = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    if (settingsReady) setSelectedDateKey(formatDateKey());
  }, [settingsReady, settings.time.dayStart]);

  useEffect(() => {
    let active = true;
    void loadFoodIngredients(localDataScope).then((items) => {
      if (active) setFoodIngredients(items);
    });
    return () => { active = false; };
  }, [localDataScope]);

  const me = familyMembers.find((m) => m.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const pregnancy = isPregnancyStage(careSetup.child);
  const stageCustomCategories = customCategoriesForStage(customCategories, pregnancy);
  const visibleRecordActions = pregnancy
    ? PREGNANCY_QUICK_ACTION_IDS
    : settings.categories.order.filter((action) => settings.categories.visible.includes(action));
  const coreRecordActions = pregnancy ? PREGNANCY_QUICK_ACTION_IDS : settings.categories.core;
  const compact = useCompactLayout();
  const todayKey = formatDateKey();
  const selectedDateCovered = careLogCoverage
    ? careLogCoverageContains(careLogCoverage, selectedDateKey, selectedDateKey)
    : false;
  const historyComplete = selectedDateCovered
    || (historyResult?.dateKey === selectedDateKey && historyResult.complete);
  const historyLoading = storageReady
    && !selectedDateCovered
    && (historyLoadingDateKey === selectedDateKey || historyResult?.dateKey !== selectedDateKey);
  const allowRecord = allowAdd && storageReady && historyComplete && !historyLoading;
  const dayLogs = useMemo(
    () => getLogsForDay(logs, selectedDateKey, todayKey),
    [logs, selectedDateKey, todayKey],
  );
  const storedMilkEstimatedAvailableMl = useMemo(() => {
    if (!inventoryHistoryComplete) return undefined;
    const canSumVolume = (entry: BabyLogEntry) => !entry.amountUnit || entry.amountUnit === "ml" || entry.amountUnit === "oz";
    const pumped = logs.filter((entry) => entry.cat === "pump" && canSumVolume(entry)).reduce((sum, entry) => sum + (Number.parseFloat(entry.amount ?? "0") || 0), 0);
    if (pumped <= 0) return undefined;
    const consumed = logs.filter((entry) => entry.cat === "storedMilk" && canSumVolume(entry)).reduce((sum, entry) => sum + (Number.parseFloat(entry.amount ?? "0") || 0), 0);
    return Math.max(0, pumped - consumed);
  }, [inventoryHistoryComplete, logs]);
  const isViewingToday = selectedDateKey === todayKey;

  useEffect(() => {
    if (!storageReady) return;
    if (selectedDateCovered) {
      setHistoryLoadingDateKey(null);
      setHistoryResult({ dateKey: selectedDateKey, complete: true });
      return;
    }
    let active = true;
    setHistoryLoadingDateKey(selectedDateKey);
    void ensureCareLogsForRange(selectedDateKey, selectedDateKey).then((result) => {
      if (!active) return;
      setHistoryResult({ dateKey: selectedDateKey, complete: result.complete });
      setHistoryLoadingDateKey(null);
    });
    return () => { active = false; };
  }, [ensureCareLogsForRange, selectedDateCovered, selectedDateKey, storageReady]);

  useEffect(() => {
    let active = true;
    if (!storageReady) {
      setInventoryHistoryComplete(false);
      return () => {
        active = false;
      };
    }
    setInventoryHistoryComplete(false);
    void ensureCareLogsForCategories(["pump", "storedMilk"]).then((result) => {
      if (active) setInventoryHistoryComplete(result.complete);
    });
    return () => {
      active = false;
    };
  }, [ensureCareLogsForCategories, localDataScope, storageReady]);

  useEffect(() => {
    let active = true;
    if (!contractionSheetOpen || !storageReady) {
      setContractionHistoryComplete(false);
      return () => {
        active = false;
      };
    }
    void ensureCareLogsForCategories(["contraction"]).then((result) => {
      if (active) setContractionHistoryComplete(result.complete);
    });
    return () => {
      active = false;
    };
  }, [contractionSheetOpen, ensureCareLogsForCategories, localDataScope, storageReady]);
  const canGoNext = selectedDateKey < todayKey;
  const canGoPrev = selectedDateKey > offsetDateKey(todayKey, -365);
  const timelineTitle = isViewingToday
    ? t("record.screen.today")
    : selectedDateKey === yesterdayDateKey()
      ? t("record.screen.yesterday")
      : t("record.screen.dateLogs", { date: shortDateLabel(selectedDateKey).replace("/", ".") });
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
    let cancelled = false;
    const scopeKey = localDataScope ? `${localDataScope.userId}:${localDataScope.babyId}` : null;
    activeTimersScopeRef.current = null;
    timerRestoreInitialized.current = false;
    setActiveTimers([]);
    void (async () => {
      await hydrateActiveTimers(localDataScope);
      if (cancelled) return;
      const restored = settings.timers.restoreAfterRestart ? getActiveTimers() ?? [] : [];
      const linkedLogIds = [...new Set(
        restored
          .map((timer) => timer.linkedLogId)
          .filter((id): id is string => Boolean(id)),
      )];
      if (linkedLogIds.length) {
        await Promise.all(linkedLogIds.map((id) => ensureCareLogById(id)));
        if (cancelled) return;
      }
      suppressedRestoredSleepId.current = settings.timers.restoreAfterRestart
        ? null
        : activeSleepRef.current?.id ?? null;
      setActiveTimers(restored);
      activeTimersScopeRef.current = scopeKey;
      if (!settings.timers.restoreAfterRestart) await saveActiveTimers([], localDataScope);
      timerRestoreInitialized.current = true;
    })();
    return () => { cancelled = true; };
  }, [ensureCareLogById, localDataScope, settingsReady, settings.timers.restoreAfterRestart]);

  useEffect(() => {
    if (!storageReady) return;
    const scopeKey = localDataScope ? `${localDataScope.userId}:${localDataScope.babyId}` : null;
    if (activeTimersScopeRef.current !== scopeKey) return;
    void saveActiveTimers(activeTimers, localDataScope);
  }, [activeTimers, localDataScope, storageReady]);

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
    if (!nextPrefill?.editId && !allowRecord) return;
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
        amountValue: entry.amountValue,
        amountUnit: entry.amountUnit,
        amountText: entry.amountText,
        duration: entry.duration,
        feedingMethod: entry.feedingMethod,
        leftDuration: entry.leftDuration,
        rightDuration: entry.rightDuration,
        leftAmount: entry.leftAmount,
        rightAmount: entry.rightAmount,
        leftAmountValue: entry.leftAmountValue,
        leftAmountUnit: entry.leftAmountUnit,
        leftAmountText: entry.leftAmountText,
        rightAmountValue: entry.rightAmountValue,
        rightAmountUnit: entry.rightAmountUnit,
        rightAmountText: entry.rightAmountText,
        burped: entry.burped,
        spitUp: entry.spitUp,
        supplement: entry.supplement,
        feedingNote: entry.feedingNote,
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
        medicationType: entry.medicationType,
        medicationName: entry.medicationName,
        medicationStatus: entry.medicationStatus,
        doseValue: entry.doseValue,
        doseUnit: entry.doseUnit,
        doseText: entry.doseText,
        medicationReminderEnabled: entry.medicationReminderEnabled,
        visitType: entry.visitType,
        doctorName: entry.doctorName,
        cautions: entry.cautions,
        cautionReminderEnabled: entry.cautionReminderEnabled,
        vaccineName: entry.vaccineName,
        vaccinationRound: entry.vaccinationRound,
        vaccinationRoundText: entry.vaccinationRoundText,
        vaccinationHospitalName: entry.vaccinationHospitalName,
        vaccinationDoctorName: entry.vaccinationDoctorName,
        injectionSite: entry.injectionSite,
        injectionSiteText: entry.injectionSiteText,
        aftercareNotes: entry.aftercareNotes,
        vaccinationReminderSetting: entry.vaccinationReminderSetting,
        vaccinationCustomReminderAt: entry.vaccinationCustomReminderAt,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationSeconds: entry.durationSeconds,
        intervalSeconds: entry.intervalSeconds,
      });
    },
    [allowAdd, me, myFamilyRole],
  );

  useEffect(() => {
    const logId = route.params?.logId;
    if (!logId || !storageReady) return;
    let active = true;
    void ensureCareLogById(logId).then((entry) => {
      if (!active) return;
      navigation.setParams({ logId: undefined });
      if (!entry) return;
      if (entry.dateKey) setSelectedDateKey(entry.dateKey);
      setHighlightId(entry.id);
      openEdit(entry);
    });
    return () => { active = false; };
  }, [ensureCareLogById, navigation, openEdit, route.params?.logId, storageReady]);

  const announceCreated = (entry: BabyLogEntry, title: string) => {
    setHighlightId(entry.id);
    setToast({ id: entry.id, title });
    setTimeout(() => setHighlightId((cur) => (cur === entry.id ? null : cur)), 1800);
  };

  const persistContractionSiblings = (allLogs: BabyLogEntry[], saved: BabyLogEntry) => {
    for (const { id, entry } of siblingContractionUpdates(allLogs, saved)) {
      updateLog(id, entry);
    }
  };

  const persistContractionDelete = (deletedId: string) => {
    for (const { id, entry } of contractionUpdatesAfterDelete(logs, deletedId)) {
      updateLog(id, entry);
    }
  };

  const handleSave = (entry: Omit<BabyLogEntry, "id">, editId?: string) => {
    const nextEntry = isContractionLog(entry) ? buildContractionSaveEntry(entry, logs, editId) : entry;
    if (editId) {
      const existing = logs.find((log) => log.id === editId);
      if (existing && canEditLog(myFamilyRole, existing.createdBy, me)) {
        updateLog(editId, nextEntry);
        if (isContractionLog(nextEntry)) persistContractionSiblings(logs, { ...nextEntry, id: editId });
      }
    } else if (allowRecord) {
      const created = addLog(nextEntry);
      if (isContractionLog(created)) persistContractionSiblings(logs, created);
    }
  };

  const handleDeleteLog = (id: string) => {
    const existing = logs.find((entry) => entry.id === id);
    deleteLog(id);
    if (existing && isContractionLog(existing)) persistContractionDelete(id);
  };

  const addFoodIngredient = (nameInput: string, source: FoodIngredientSource): FoodIngredient | null => {
    const name = normalizeIngredientName(nameInput);
    if (!name) return null;
    const existing = foodIngredients.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) return existing;
    const ingredient: FoodIngredient = {
      id: createId(),
      name,
      source,
      createdAt: new Date().toISOString(),
      babyId: localDataScope?.babyId,
      createdBy: logAuthor.userId,
    };
    const next = [...foodIngredients, ingredient];
    setFoodIngredients(next);
    void saveFoodIngredients(next, localDataScope);
    return ingredient;
  };

  const endActiveSleep = () => {
    const sleep = activeSleepRef.current;
    if (!sleep || !allowRecord) return;
    const elapsed = Math.max(1, elapsedClockMinutes(sleep.time, nowTime()));
    const { id, ...entry } = sleep;
    updateLog(id, { ...entry, duration: String(elapsed) });
    announceCreated({ ...entry, id, duration: String(elapsed) }, t("record.screen.sleepEnded"));
    suppressedRestoredSleepId.current = id;
    setActiveTimers((prev) => prev.filter((timer) => timer.kind !== "sleep"));
    setTimerSheetId((openId) => {
      const open = activeTimers.find((timer) => timer.id === openId);
      return open?.kind === "sleep" ? null : openId;
    });
  };

  const handleOneTouch = (action: OneTouchAction) => {
    if (!allowRecord) return;
    if (action === "contraction") {
      setContractionSheetOpen(true);
      return;
    }
    if (action === "sleep" && activeSleep) {
      endActiveSleep();
      return;
    }
    const next = longPressSheetPrefill(action, selectedDateKey);
    openSheet(next.cat ?? actionToCategory(action), next);
  };

  const startOrOpenTimer = (action: OneTouchAction) => {
    if (!allowRecord || !isTimerAction(action)) return;
    const existing = activeTimers.find((t) => t.action === action);
    if (existing) {
      setTimerSheetId(existing.id);
      return;
    }

    const otherActiveTimer = activeTimers[0];
    if (otherActiveTimer) {
      Alert.alert(
        t("record.screen.timerConflict"),
        t("record.screen.timerConflictBody", { label: t(TIMER_LABEL_KEYS[otherActiveTimer.kind]) }),
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
    if (!allowRecord) return;
    if (action === "contraction") {
      setContractionSheetOpen(true);
      return;
    }
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
      const next = longPressSheetPrefill(action, selectedDateKey);
      openSheet(next.cat ?? actionToCategory(action), next);
      return;
    }
    const next = longPressSheetPrefill(action, selectedDateKey);
    openSheet(next.cat ?? actionToCategory(action), next);
  };

  const startContractionTimer = () => {
    if (!allowRecord) return;
    const existing = activeTimers.find((timer) => timer.kind === "contraction");
    if (existing) {
      setContractionSheetOpen(true);
      return;
    }
    const timer = createActiveTimer("contraction", "contraction", {
      startTime: nowTime(),
      dateKey: todayKey,
    });
    setActiveTimers((prev) => [...prev.filter((item) => item.kind !== "contraction"), timer]);
    setContractionSheetOpen(true);
  };

  const handleStopContraction = async (opts: { chip?: string; notes?: string }) => {
    const timer = activeTimers.find((item) => item.kind === "contraction");
    if (!timer || contractionSaving) return;
    setContractionSaving(true);
    try {
      const endedAt = new Date().toISOString();
      const startedAt = timer.segmentStartedAt;
      const draft = buildContractionSaveEntry(
        {
          cat: "contraction",
          time: hhmmFromIso(startedAt) || timer.startTime,
          dateKey: timer.dateKey,
          startedAt,
          endedAt,
          durationSeconds: durationSecondsOf(startedAt, endedAt),
          chip: opts.chip,
          notes: opts.notes,
          source: "manual",
        },
        logs,
      );
      const saved = addLog(draft);
      persistContractionSiblings(logs, saved);
      announceCreated(saved, t("record.contraction.saved"));
      setActiveTimers((prev) => prev.filter((item) => item.id !== timer.id));
    } finally {
      setContractionSaving(false);
    }
  };

  const patchTimer = (id: string, updater: (t: ActiveTimer) => ActiveTimer) => {
    setActiveTimers((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  };

  const handleStopTimer = async (opts?: Parameters<React.ComponentProps<typeof ActiveTimerSheet>["onStop"]>[0]) => {
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
      amountValue: opts?.amountValue,
      amountUnit: opts?.amountUnit,
      amountText: opts?.amountText,
      leftDuration: result.leftMinutes ? String(result.leftMinutes) : undefined,
      rightDuration: result.rightMinutes ? String(result.rightMinutes) : undefined,
      leftAmount: result.leftAmount,
      rightAmount: result.rightAmount,
      leftAmountValue: opts?.leftAmountValue,
      leftAmountUnit: opts?.leftAmountUnit,
      leftAmountText: opts?.leftAmountText,
      rightAmountValue: opts?.rightAmountValue,
      rightAmountUnit: opts?.rightAmountUnit,
      rightAmountText: opts?.rightAmountText,
    };

    try {
      let saved: BabyLogEntry | null = null;
      let title = "";
      if (timer.kind === "sleep" && timer.linkedLogId) {
        const existing = logs.find((l) => l.id === timer.linkedLogId)
          ?? await ensureCareLogById(timer.linkedLogId);
        if (existing) {
          const { id, ...entry } = existing;
          saved = await updateLogWithPersistence(id, {
            ...entry,
            duration: String(result.durationMinutes),
          });
          title = t("record.screen.sleepEnded");
          if (saved) suppressedRestoredSleepId.current = id;
        }
      } else if (timer.kind === "sleep") {
        saved = await addLogWithPersistence({ ...base, cat: "sleep", chip: RECORD_VALUE.nap });
        title = t("record.screen.sleepTimerSaved");
      } else if (timer.kind === "breastfeeding") {
        saved = await addLogWithPersistence({ ...base, cat: "breast" });
        title = t("record.screen.breastTimerSaved");
      } else if (timer.kind === "formula") {
        saved = await addLogWithPersistence({ ...base, cat: "formula" });
        title = t("record.screen.formulaSaved");
      } else if (timer.kind === "storedMilk") {
        saved = await addLogWithPersistence({ ...base, cat: "storedMilk" });
        title = t("record.screen.storedMilkSaved");
      } else if (timer.kind === "pump") {
        const totalAmount = (Number.parseFloat(result.leftAmount ?? "0") || 0) + (Number.parseFloat(result.rightAmount ?? "0") || 0);
        saved = await addLogWithPersistence({ ...base, cat: "pump", amount: totalAmount > 0 ? String(totalAmount) : undefined });
        title = t("record.screen.pumpTimerSaved");
      } else if (timer.kind === "tummy") {
        saved = await addLogWithPersistence({ ...base, cat: "tummy" });
        title = t("record.screen.tummyTimerSaved");
      } else if (timer.kind === "play") {
        saved = await addLogWithPersistence({ ...base, cat: "play" });
        title = t("record.screen.playTimerSaved");
      }

      if (!saved) {
        Alert.alert(t("record.screen.saveFailed"), t("record.screen.saveFailedBody"));
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
    if (!allowRecord) return;
    // Every tap mints a fresh log id, so the server upsert cannot dedupe an
    // accidental double tap. Ignore an immediate repeat of the same record.
    const tappedAt = Date.now();
    const lastTap = lastQuickRecordTap.current;
    if (lastTap && lastTap.id === record.id && tappedAt - lastTap.at < QUICK_RECORD_REPEAT_GUARD_MS) return;
    lastQuickRecordTap.current = { id: record.id, at: tappedAt };
    const time = nowTime();
    const { defaults } = record;

    if (defaults.cat === "diaper" && !defaults.chip) {
      openSheet("diaper", {
        cat: "diaper",
        time,
        dateKey: selectedDateKey,
        source: "manual",
      });
      return;
    }

    if (defaults.cat === "sleep" && (defaults.sleepAction === "start" || !defaults.duration)) {
      if (activeSleep && defaults.sleepAction !== "start") {
        const elapsed = Math.max(1, elapsedClockMinutes(activeSleep.time, time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, t("record.screen.completed", { label: quickRecordLabel(t, record) }));
        suppressedRestoredSleepId.current = id;
        return;
      }
      if (activeSleep && defaults.sleepAction === "start") {
        const elapsed = Math.max(1, elapsedClockMinutes(activeSleep.time, time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, t("record.screen.sleepEnded"));
        suppressedRestoredSleepId.current = id;
        return;
      }
    }

    const created = addLog({
      cat: defaults.cat,
      time,
      dateKey: selectedDateKey,
      source: "manual",
      chip: defaults.chip,
      chip2: defaults.chip2,
      stoolState: defaults.stoolState,
      amount: defaults.amount,
      duration: defaults.duration,
      notes: defaults.notes,
    });
    announceCreated(created, t("record.screen.recorded", { label: quickRecordLabel(t, record) }));
  };

  const editingEntry = prefill?.editId ? logs.find((l) => l.id === prefill.editId) : null;
  const allowDelete = editingEntry
    ? canDeleteLog(myFamilyRole, editingEntry.createdBy, me)
    : false;

  const toastEntry = toast ? logs.find((l) => l.id === toast.id) : null;
  const sheetTimer = activeTimers.find((t) => t.id === timerSheetId && isBornTimer(t)) ?? null;
  const contractionTimer = activeTimers.find((t) => t.kind === "contraction") ?? null;
  const bornTimers = activeTimers.filter(isBornTimer);
  const activeTimerActions = activeTimers.map((t) => t.action);
  const primaryTimer = bornTimers[0];
  const sessionLabelFor = (cat: LogCategoryKey | null, editId?: string, dateKey?: string) => {
    if (!cat || isCustomCategoryKey(cat)) return undefined;
    const targetDate = dateKey ?? selectedDateKey;
    const targetLogs = getLogsForDay(logs, targetDate, todayKey);
    const cats = cat === "pump" ? ["pump"] : FEEDING_CATS;
    if (!cats.includes(cat as never)) return undefined;
    const ordered = targetLogs
      .filter((entry) => cats.includes(entry.cat as never))
      .sort((a, b) => a.time.localeCompare(b.time));
    const index = editId ? ordered.findIndex((entry) => entry.id === editId) + 1 : ordered.length + 1;
    const dayPart = targetDate === todayKey ? t("record.screen.todayShort") : shortDateLabel(targetDate).replace("/", ".");
    return t("record.screen.sessionLabel", { day: dayPart, index: Math.max(1, index), kind: t(cat === "pump" ? "record.screen.pumping" : "record.screen.feeding") });
  };
  const activeSessionLabel = primaryTimer
    ? sessionLabelFor(primaryTimer.kind === "breastfeeding" ? "breast" : primaryTimer.kind, undefined, primaryTimer.dateKey)
    : undefined;
  const primaryTimerCategory: LogCategoryKey | null = primaryTimer
    ? primaryTimer.kind === "breastfeeding"
      ? "breast"
      : primaryTimer.kind
    : null;
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
    contractionSheetOpen ||
    sheetCat !== null ||
    consultPromptOpen ||
    keyboardOpen ||
    growthRecordOpen;

  return (
    <View style={styles.root}>
      <TodayTimeline
        logs={storageReady && !historyLoading ? dayLogs : []}
        title={timelineTitle}
        customCategories={customCategories}
        highlightId={highlightId}
        onPress={openEdit}
        limit={6}
        onDelete={(entry) => {
          if (canDeleteLog(myFamilyRole, entry.createdBy, me)) handleDeleteLog(entry.id);
        }}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        scrollProps={{
          onScrollBeginDrag: handleScrollBegin,
          onScrollEndDrag: handleScrollEnd,
          onMomentumScrollBegin: handleScrollBegin,
          onMomentumScrollEnd: handleScrollEnd,
          scrollEventThrottle: 16,
        }}
        listEmpty={
          !storageReady || historyLoading ? (
            <LoadingState label={t("record.screen.loading")} />
          ) : !historyComplete ? (
            <EmptyState
              title={t("home.storage.loadError")}
              body={t("home.storage.offlineError")}
            />
          ) : (
            <EmptyState
              title={t(isViewingToday ? "record.screen.emptyToday" : "record.screen.emptyDay")}
              body={
                allowAdd
                  ? isViewingToday
                    ? t("record.screen.emptyTodayBody")
                    : t("record.screen.emptyDayBody", { date: formatDayNavLabel(selectedDateKey, t) })
                  : isViewingToday
                    ? t("record.screen.emptyToday")
                    : t("record.screen.emptyDayBody", { date: formatDayNavLabel(selectedDateKey, t) })
              }
            />
          )
        }
        listHeader={
          <>
        <RecordHomeHeader embedded onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} onOpenNotifications={onOpenNotifications} />
        {!allowAdd && (
          <Text style={styles.viewerBanner}>{t("record.screen.readOnly")}</Text>
        )}
        {contractionTimer ? (
          <View style={styles.timerBanner}>
            <View style={styles.timerBannerIcon}><LogCategoryIcon categoryKey="contraction" customCategories={customCategories} size={18} color={colors.amberText} /></View>
            <Pressable style={styles.timerBannerCopy} onPress={() => setContractionSheetOpen(true)}>
              <Text style={styles.timerBannerTitle}>
                {t("record.grid.actionInProgress", { label: t("record.contraction.title") })}
              </Text>
              <Text style={styles.timerBannerMeta}>
                {[formatElapsedClock(elapsedMsNow(contractionTimer)), t("record.contraction.continue")].join(" · ")}
              </Text>
            </Pressable>
            <Pressable style={styles.timerBannerAction} onPress={() => setContractionSheetOpen(true)}>
              <Text style={styles.timerBannerActionText}>{t("record.contraction.end")}</Text>
            </Pressable>
          </View>
        ) : primaryTimer ? (
          <View style={styles.timerBanner}>
            {primaryTimerCategory ? <View style={styles.timerBannerIcon}><LogCategoryIcon categoryKey={primaryTimerCategory} customCategories={customCategories} size={18} color={colors.amberText} /></View> : null}
            <Pressable style={styles.timerBannerCopy} onPress={() => setTimerSheetId(primaryTimer.id)}>
              <Text style={styles.timerBannerTitle}>
                {t("record.grid.actionInProgress", { label: t(TIMER_LABEL_KEYS[primaryTimer.kind]) })}
                {bornTimers.length > 1 ? ` · +${bornTimers.length - 1}` : ""}
              </Text>
              <Text style={styles.timerBannerMeta}>
                {[activeSessionLabel, formatElapsedClock(elapsedMsNow(primaryTimer)), t("record.screen.continue")].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.timerBannerAction}
              onPress={() => patchTimer(primaryTimer.id, primaryTimer.status === "paused" ? resumeTimer : pauseTimer)}
            >
              <Text style={styles.timerBannerActionText}>{t(primaryTimer.status === "paused" ? "record.screen.restart" : "record.screen.pause")}</Text>
            </Pressable>
            <Pressable style={styles.timerBannerAction} onPress={() => setTimerSheetId(primaryTimer.id)}>
              <Text style={styles.timerBannerActionText}>{t("record.screen.end")}</Text>
            </Pressable>
          </View>
        ) : null}
        <TodayLogSummaryCard
          logs={dayLogs}
          dateKey={selectedDateKey}
          pregnancy={pregnancy}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrevDay={() => setSelectedDateKey((key) => offsetDateKey(key, -1))}
          onNextDay={() => setSelectedDateKey((key) => offsetDateKey(key, 1))}
          onPressDate={() => setDatePickerOpen(true)}
        />
        <View style={styles.addSection}>
          <OneTouchRecordGrid
            sleepActive={Boolean(activeSleep)}
            activeTimerActions={activeTimerActions}
            visibleActions={visibleRecordActions}
            coreActions={coreRecordActions}
            logs={logs}
            babyScopeKey={localDataScope?.babyId}
            customCategories={stageCustomCategories}
            disabled={!allowRecord}
            onSelect={handleOneTouch}
            onLongPress={handleLongPress}
            onInteractionChange={setCategoryPressing}
            onAdd={allowRecord ? () => setAddCategoryOpen(true) : undefined}
            onSelectCustom={(category: CustomCategory) => {
              if (!allowRecord) return;
              openSheet(customCategoryKey(category.id), {
                cat: customCategoryKey(category.id),
                dateKey: selectedDateKey,
                time: nowTime(),
                source: "manual",
              });
            }}
            onOpenGrowth={pregnancy || !allowRecord ? undefined : () => {
              setGrowthMeasuredAt(selectedDateKey);
              setGrowthRecordOpen(true);
            }}
            onOpenActiveTimer={(action) => {
              if (action === "contraction") {
                setContractionSheetOpen(true);
                return;
              }
              const found = activeTimers.find((t) => t.action === action);
              if (found) {
                setTimerSheetId(found.id);
                return;
              }
              if (action === "sleep") startOrOpenTimer("sleep");
            }}
          />
          <QuickRecordsBar
            records={quickRecords}
            visibleActions={visibleRecordActions}
            pregnancy={pregnancy}
            disabled={!allowRecord}
            onTap={handleQuickRecord}
            onSaveRecords={setQuickRecords}
          />
        </View>
          </>
        }
      />

      <RecordDatePickerModal
        visible={datePickerOpen}
        selectedDateKey={selectedDateKey}
        onSelect={setSelectedDateKey}
        onClose={() => setDatePickerOpen(false)}
      />

      {/* Product invariant: keep the full-size consultation FAB unchanged across releases. */}
      <ConsultFab hidden={fabHidden} onPress={() => setConsultPromptOpen(true)} />

      <ConsultPromptSheet
        visible={consultPromptOpen}
        todayLogCount={isViewingToday ? dayLogs.length : 0}
        onClose={() => setConsultPromptOpen(false)}
        onSelectQuestion={(question) => {
          setConsultPromptOpen(false);
          onOpenConsult(question);
        }}
        onAskFreely={() => {
          setConsultPromptOpen(false);
          onOpenConsult();
        }}
      />

      <RecordCreatedToast
        visible={Boolean(toast)}
        title={toast?.title ?? ""}
        body={t("record.screen.tapEdit")}
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
        logs={logs}
        foodIngredients={foodIngredients}
        onAddFoodIngredient={addFoodIngredient}
        storedMilkEstimatedAvailableMl={storedMilkEstimatedAvailableMl}
        sessionLabel={sessionLabelFor(sheetCat, prefill?.editId, prefill?.dateKey)}
        onClose={() => {
          setSheetCat(null);
          setPrefill(null);
        }}
        onSave={handleSave}
        onDelete={
          allowDelete
            ? (id) => {
                handleDeleteLog(id);
                setSheetCat(null);
                setPrefill(null);
              }
            : undefined
        }
      />

      <AddCustomCategorySheet
        visible={addCategoryOpen}
        existingCategories={stageCustomCategories}
        pregnancy={pregnancy}
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
            amount: input.inputMode === "amount" ? RECORD_VALUE.countOrAmount : undefined,
            chips: input.inputMode === "check" ? [RECORD_VALUE.done, RECORD_VALUE.notDone] : undefined,
            stage: pregnancy ? "pregnancy" : "born",
          });
          setAddCategoryOpen(false);
        }}
      />

      <ActiveTimerSheet
        visible={Boolean(sheetTimer)}
        timer={sheetTimer}
        saving={timerSaving}
        sessionLabel={sheetTimer ? sessionLabelFor(sheetTimer.kind === "breastfeeding" ? "breast" : sheetTimer.kind, undefined, sheetTimer.dateKey) : undefined}
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

      <ContractionTimerSheet
        visible={contractionSheetOpen}
        timer={contractionTimer}
        logs={contractionHistoryComplete ? logs : dayLogs}
        dateKey={selectedDateKey}
        saving={contractionSaving}
        onClose={() => setContractionSheetOpen(false)}
        onStart={startContractionTimer}
        onStop={(opts) => { void handleStopContraction(opts); }}
        onEdit={(entry) => {
          setContractionSheetOpen(false);
          openEdit(entry);
        }}
        onDelete={
          allowAdd
            ? (entry) => {
                if (canDeleteLog(myFamilyRole, entry.createdBy, me)) handleDeleteLog(entry.id);
              }
            : undefined
        }
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
  content: { paddingHorizontal: 20, paddingBottom: 96 },
  contentCompact: { paddingHorizontal: 16, paddingBottom: 80 },
  viewerBanner: {
    backgroundColor: colors.amberSoft,
    color: colors.amberText,
    fontSize: type.xs,
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
    marginBottom: 8,
  },
  timerBannerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  timerBannerCopy: { flex: 1 },
  timerBannerTitle: { fontSize: type.sm, fontWeight: "800", color: colors.text },
  timerBannerMeta: { fontSize: type.xs, color: colors.muted, marginTop: 2, fontWeight: "600" },
  timerBannerAction: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.amberSoft },
  timerBannerActionText: { fontSize: type.xs, fontWeight: "800", color: colors.amberText },
  addSection: { marginBottom: 4, paddingTop: 0 },
});
