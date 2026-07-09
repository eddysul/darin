import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
  } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<LogCategoryKey | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [setupDraft, setSetupDraft] = useState<CategorySetupDraft | null>(null);

  const openSheet = (catKey: LogCategoryKey, nextPrefill?: RecordSheetPrefill) => {
    setPrefill(nextPrefill ?? null);
    setSheetCat(catKey);
  };

  const openBuiltinSheet = (catId: BabyLogCategoryId, nextPrefill?: RecordSheetPrefill) => {
    openSheet(catId, nextPrefill);
  };

  const openEdit = (entry: BabyLogEntry) => {
    openSheet(entry.cat, {
      editId: entry.id,
      time: entry.time,
      chip: entry.chip,
      chip2: entry.chip2,
      amount: entry.amount,
      duration: entry.duration,
      notes: entry.notes,
      voice: entry.voice,
    });
  };

  const handleSave = (entry: Omit<BabyLogEntry, "id">, editId?: string) => {
    if (editId) updateLog(editId, entry);
    else addLog(entry);
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

  return (
    <View style={styles.root}>
      <RecordHomeHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <QuickStatusRow logs={logs} />
        <FrequentRecordSection
          shortcuts={frequentShortcuts}
          defaultFeedingMethod={defaultFeedingMethod}
          onSelect={openBuiltinSheet}
          onSaveShortcuts={setFrequentShortcuts}
        />
        <MoreRecordGrid
          customCategories={customCategories}
          onSelect={openSheet}
          onNewPress={() => setNewCategoryOpen(true)}
        />
        <TodayTimeline logs={logs} customCategories={customCategories} onPress={openEdit} />
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
        onDelete={(id) => {
          deleteLog(id);
          setSheetCat(null);
          setPrefill(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
});
