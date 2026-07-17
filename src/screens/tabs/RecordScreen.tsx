import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  OneTouchRecordGrid,
  type OneTouchAction,
} from "../../components/babylog/OneTouchRecordGrid";
import { QuickRecordsBar } from "../../components/babylog/QuickRecordsBar";
import { RecordCreatedToast } from "../../components/babylog/RecordCreatedToast";
import { RecordDetailSheet, type RecordSheetPrefill } from "../../components/babylog/RecordDetailSheet";
import { RecordHomeHeader } from "../../components/babylog/RecordHomeHeader";
import { TodayLogSummaryCard } from "../../components/babylog/TodayLogSummaryCard";
import { TodayTimeline } from "../../components/babylog/TodayTimeline";
import { EmptyState } from "../../components/states/FeedbackStates";
import { useBabyLog } from "../../context/BabyLogContext";
import { nowTime, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { BabyLogEntry } from "../../types/babyLog";
import type { LogCategoryKey } from "../../types/logCategory";
import type { QuickRecord } from "../../types/quickRecord";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import { formatDateKey } from "../../utils/dateKey";
import { toMinutes } from "../../utils/formatLog";
import { getLogsForDay } from "../../utils/reportAggregates";
import { colors } from "../../theme";

type Props = {
  onOpenProfile: () => void;
};

const ACTION_TOAST: Record<OneTouchAction, string> = {
  feeding: "🍼 수유 기록 완료",
  sleep: "😴 수면 기록 완료",
  diaper: "🧷 기저귀 기록 완료",
  bowel: "🧷 배변 기록 완료",
  food: "🥣 이유식 기록 완료",
  med: "💊 약 기록 완료",
  temp: "🌡️ 체온 기록 완료",
  memo: "📝 메모 기록 완료",
};

export function RecordScreen({ onOpenProfile }: Props) {
  const {
    logs,
    addLog,
    updateLog,
    deleteLog,
    defaultFeedingMethod,
    customCategories,
    quickRecords,
    setQuickRecords,
    myFamilyRole,
    familyMembers,
    storageReady,
  } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<LogCategoryKey | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  const me = familyMembers.find((m) => m.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);
  const activeSleep = useMemo(
    () => todayLogs.find((entry) => entry.cat === "sleep" && !entry.duration),
    [todayLogs],
  );

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

  const feedingCategory: BabyLogCategoryId =
    defaultFeedingMethod === "breastfeeding" ? "breast" : "formula";

  const handleOneTouch = (action: OneTouchAction) => {
    if (!allowAdd) return;
    const time = nowTime();
    if (action === "sleep" && activeSleep) {
      const elapsed = Math.max(1, toMinutes(time) - toMinutes(activeSleep.time));
      const { id, ...entry } = activeSleep;
      updateLog(id, { ...entry, duration: String(elapsed) });
      announceCreated({ ...entry, id, duration: String(elapsed) }, "😴 수면 종료 완료");
      return;
    }

    const base = { time, dateKey: todayKey, source: "manual" as const };
    let created: BabyLogEntry | null = null;
    if (action === "feeding") created = addLog({ ...base, cat: feedingCategory });
    if (action === "sleep") created = addLog({ ...base, cat: "sleep", chip: "낮잠" });
    if (action === "diaper") created = addLog({ ...base, cat: "diaper", chip: "소변" });
    if (action === "bowel") created = addLog({ ...base, cat: "diaper", chip: "대변" });
    if (action === "food") created = addLog({ ...base, cat: "food" });
    if (action === "med") created = addLog({ ...base, cat: "med" });
    if (action === "temp") created = addLog({ ...base, cat: "temp" });
    if (action === "memo") created = addLog({ ...base, cat: "memo" });
    if (created) announceCreated(created, ACTION_TOAST[action]);
  };

  const handleQuickRecord = (record: QuickRecord) => {
    if (!allowAdd) return;
    const time = nowTime();
    const { defaults } = record;

    if (defaults.cat === "sleep" && (defaults.sleepAction === "start" || !defaults.duration)) {
      if (activeSleep && defaults.sleepAction !== "start") {
        const elapsed = Math.max(1, toMinutes(time) - toMinutes(activeSleep.time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, `${record.icon} ${record.label} 완료`);
        return;
      }
      if (activeSleep && defaults.sleepAction === "start") {
        // already sleeping — treat as end
        const elapsed = Math.max(1, toMinutes(time) - toMinutes(activeSleep.time));
        const { id, ...entry } = activeSleep;
        updateLog(id, { ...entry, duration: String(elapsed) });
        announceCreated({ ...entry, id, duration: String(elapsed) }, "😴 수면 종료 완료");
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
    announceCreated(created, `${record.icon} ${record.label} 기록 완료`);
  };

  const editingEntry = prefill?.editId ? logs.find((l) => l.id === prefill.editId) : null;
  const allowDelete = editingEntry
    ? canDeleteLog(myFamilyRole, editingEntry.createdBy, me)
    : false;

  const toastEntry = toast ? logs.find((l) => l.id === toast.id) : null;

  return (
    <View style={styles.root}>
      <RecordHomeHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!allowAdd && (
          <Text style={styles.viewerBanner}>보기 전용 계정이에요. 기록 추가·수정은 제한돼요.</Text>
        )}
        <QuickRecordsBar
          records={quickRecords}
          disabled={!allowAdd}
          onTap={handleQuickRecord}
          onSaveRecords={setQuickRecords}
        />
        <OneTouchRecordGrid
          sleepActive={Boolean(activeSleep)}
          disabled={!allowAdd}
          onSelect={handleOneTouch}
        />
        <TodayLogSummaryCard logs={todayLogs} />
        {!storageReady ? null : todayLogs.length === 0 ? (
          <EmptyState
            title="아직 기록이 없어요."
            body="첫 기록을 남겨보세요."
            ctaLabel={allowAdd ? "기록 추가하기" : undefined}
            onPressCta={allowAdd ? () => handleOneTouch("feeding") : undefined}
          />
        ) : (
          <TodayTimeline
            logs={todayLogs}
            customCategories={customCategories}
            highlightId={highlightId}
            onPress={openEdit}
            limit={100}
            onDelete={(entry) => {
              if (canDeleteLog(myFamilyRole, entry.createdBy, me)) deleteLog(entry.id);
            }}
          />
        )}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
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
});
