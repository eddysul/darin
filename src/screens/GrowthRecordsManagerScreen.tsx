import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GrowthRecordModal } from "../components/babylog/GrowthRecordModal";
import { GrowthRecordsManagerModal } from "../components/babylog/GrowthRecordsManagerModal";
import { useAppSettings } from "../context/AppSettingsContext";
import { useBabyLog } from "../context/BabyLogContext";
import type { RootStackParamList } from "../navigation/types";
import type { GrowthRecord } from "../types/growthRecord";

type Props = NativeStackScreenProps<RootStackParamList, "GrowthRecords">;

export function GrowthRecordsManagerScreen({ navigation }: Props) {
  const { settings } = useAppSettings();
  const {
    growthRecords,
    addGrowthRecord,
    updateGrowthRecord,
    deleteGrowthRecord,
  } = useBabyLog();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GrowthRecord | null>(null);

  const openEditor = (record: GrowthRecord | null) => {
    setEditingRecord(record);
    setEditorOpen(true);
  };

  return (
    <>
      <GrowthRecordsManagerModal
        embedded
        records={growthRecords}
        weightUnit={settings.units.weight}
        heightUnit={settings.units.height}
        onClose={() => navigation.goBack()}
        onAdd={() => openEditor(null)}
        onEdit={(record) => openEditor(record)}
        onDelete={deleteGrowthRecord}
      />
      <GrowthRecordModal
        visible={editorOpen}
        record={editingRecord}
        onClose={() => {
          setEditorOpen(false);
          setEditingRecord(null);
        }}
        onSave={(draft, editId) => {
          if (editId) updateGrowthRecord(editId, draft);
          else addGrowthRecord(draft);
        }}
      />
    </>
  );
}
