import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/babylog/AppHeader";
import { CategoryGrid } from "../../components/babylog/CategoryGrid";
import { LogList } from "../../components/babylog/LogList";
import { RecordDetailSheet, type RecordSheetPrefill } from "../../components/babylog/RecordDetailSheet";
import { useBabyLog } from "../../context/BabyLogContext";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { BabyLogEntry } from "../../types/babyLog";
import { colors } from "../../theme";

type Props = {
  onOpenProfile: () => void;
};

export function RecordScreen({ onOpenProfile }: Props) {
  const { logs, addLog, updateLog, deleteLog, defaultFeedingMethod, enabledCategoryIds } = useBabyLog();
  const [sheetCat, setSheetCat] = useState<BabyLogCategoryId | null>(null);
  const [prefill, setPrefill] = useState<RecordSheetPrefill | null>(null);

  const dayLabel = useMemo(() => {
    const d = new Date();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `오늘 · ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  }, []);

  const openSheet = (catId: BabyLogCategoryId, nextPrefill?: RecordSheetPrefill) => {
    setPrefill(nextPrefill ?? null);
    setSheetCat(catId);
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

  return (
    <View style={styles.root}>
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CategoryGrid enabledCategoryIds={enabledCategoryIds} onSelect={(id) => openSheet(id)} />
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <LogList logs={logs} onPress={openEdit} onDelete={deleteLog} />
      </ScrollView>

      <RecordDetailSheet
        visible={sheetCat !== null}
        catId={sheetCat}
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
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  dayLabel: {
    fontSize: 12.5,
    color: colors.faint,
    fontWeight: "600",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
