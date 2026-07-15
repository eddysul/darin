import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CategorySetupSheet,
  type CategorySetupDraft,
} from "../../components/babylog/CategorySetupSheet";
import { FrequentRecordSection } from "../../components/babylog/FrequentRecordSection";
import { MoreRecordGrid } from "../../components/babylog/MoreRecordGrid";
import { NewCategorySheet } from "../../components/babylog/NewCategorySheet";
import { QuickStatusRow } from "../../components/babylog/QuickStatusRow";
import { RecordDetailSheet, type RecordSheetPrefill } from "../../components/babylog/RecordDetailSheet";
import { RecordHomeHeader } from "../../components/babylog/RecordHomeHeader";
import { TodayTimeline } from "../../components/babylog/TodayTimeline";
import { useBabyLog } from "../../context/BabyLogContext";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { CustomCategoryTemplate } from "../../constants/customCategoryTemplates";
import type { BabyLogEntry } from "../../types/babyLog";
import type { LogCategoryKey } from "../../types/logCategory";
import { canAddLog, canDeleteLog, canEditLog } from "../../types/family";
import { formatDateKey } from "../../utils/dateKey";
import { getLogsForDay } from "../../utils/reportAggregates";
import { colors } from "../../theme";

type Props = {
  onOpenProfile: () => void;
};

export function RecordScreen({ onOpenProfile }: Props) {
  const {
    logs,
    addLog,
    updateLog,
    deleteLog,
    defaultFeedingMethod,
    frequentShortcuts,
    setFrequentShortcuts,
    customCategories,
    addCustomFromTemplate,
    addCustomByLabel,
    myFamilyRole,
    familyMembers,
  } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<LogCategoryKey | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [setupDraft, setSetupDraft] = useState<CategorySetupDraft | null>(null);

  const me = familyMembers.find((m) => m.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);

  const openSheet = (catKey: LogCategoryKey, nextPrefill?: RecordSheetPrefill) => {
    if (!nextPrefill?.editId && !allowAdd) return;
    setPrefill(nextPrefill ?? null);
    setSheetCat(catKey);
  };

  const openBuiltinSheet = (catId: BabyLogCategoryId, nextPrefill?: RecordSheetPrefill) => {
    openSheet(catId, nextPrefill);
  };

  const openEdit = (entry: BabyLogEntry) => {
    if (!canEditLog(myFamilyRole, entry.createdBy, me)) return;
    openSheet(entry.cat, {
      editId: entry.id,
      time: entry.time,
      chip: entry.chip,
      chip2: entry.chip2,
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
  };

  const handleSave = (entry: Omit<BabyLogEntry, "id">, editId?: string) => {
    if (editId) updateLog(editId, entry);
    else if (allowAdd) addLog(entry);
  };

  const closeNewCategoryFlow = () => {
    setNewCategoryOpen(false);
    setSetupDraft(null);
  };

  const handleSetupSave = (payload: { label: string; template?: CustomCategoryTemplate }) => {
    if (payload.template) {
      addCustomFromTemplate({ ...payload.template, label: payload.label });
    } else {
      addCustomByLabel(payload.label);
    }
    closeNewCategoryFlow();
  };

  const editingEntry = prefill?.editId ? logs.find((l) => l.id === prefill.editId) : null;
  const allowDelete = editingEntry
    ? canDeleteLog(myFamilyRole, editingEntry.createdBy, me)
    : false;

  return (
    <View style={styles.root}>
      <RecordHomeHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!allowAdd && (
          <Text style={styles.viewerBanner}>보기 전용 계정이에요. 기록 추가·수정은 제한돼요.</Text>
        )}
        <QuickStatusRow logs={todayLogs} />
        <FrequentRecordSection
          shortcuts={frequentShortcuts}
          defaultFeedingMethod={defaultFeedingMethod}
          onSelect={openBuiltinSheet}
          onSaveShortcuts={allowAdd ? setFrequentShortcuts : () => {}}
        />
        <MoreRecordGrid
          customCategories={customCategories}
          onSelect={openSheet}
          onNewPress={() => allowAdd && setNewCategoryOpen(true)}
        />
        <TodayTimeline logs={todayLogs} customCategories={customCategories} onPress={openEdit} />
      </ScrollView>

      <NewCategorySheet
        visible={newCategoryOpen && setupDraft === null}
        onClose={closeNewCategoryFlow}
        onSelectTemplate={(template) => {
          setNewCategoryOpen(false);
          setSetupDraft({ mode: "template", template });
        }}
        onCustomPress={() => {
          setNewCategoryOpen(false);
          setSetupDraft({ mode: "custom" });
        }}
      />

      <CategorySetupSheet
        visible={setupDraft !== null}
        draft={setupDraft}
        existingCategories={customCategories}
        onClose={closeNewCategoryFlow}
        onBack={() => {
          setSetupDraft(null);
          setNewCategoryOpen(true);
        }}
        onSave={handleSetupSave}
      />

      <RecordDetailSheet
        visible={sheetCat !== null}
        catKey={sheetCat}
        customCategories={customCategories}
        prefill={prefill}
        defaultFeedingMethod={defaultFeedingMethod}
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
