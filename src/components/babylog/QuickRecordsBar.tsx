import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { QuickRecord } from "../../types/quickRecord";
import { colors } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { QuickRecordEditorSheet } from "./QuickRecordEditorSheet";

type Props = {
  records: QuickRecord[];
  disabled?: boolean;
  onTap: (record: QuickRecord) => void;
  onSaveRecords: (next: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
};

export function QuickRecordsBar({ records, disabled, onTap, onSaveRecords }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuickRecord | null>(null);
  const [startInForm, setStartInForm] = useState(false);

  const pinned = useMemo(() => records.filter((r) => r.pinned), [records]);

  const openManage = () => {
    setEditing(null);
    setStartInForm(false);
    setEditorOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setStartInForm(true);
    setEditorOpen(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>자주 쓰는 기록</Text>
        <Pressable
          style={[styles.editBtn, disabled && styles.disabled]}
          disabled={disabled}
          accessibilityState={{ disabled }}
          hitSlop={8}
          onPress={openManage}
        >
          <BabyLogIcon kind="edit" size={13} color={colors.amber} />
          <Text style={styles.edit}>편집</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pinned.map((record) => (
          <Pressable
            key={record.id}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: `${record.color}55` },
              disabled && styles.disabled,
              pressed && !disabled && styles.pressed,
            ]}
            onPress={() => onTap(record)}
            onLongPress={
              disabled
                ? undefined
                : () => {
                    setStartInForm(false);
                    setEditing(record);
                    setEditorOpen(true);
                  }
            }
          >
            <View style={[styles.iconWrap, { backgroundColor: `${record.color}16` }]}>
              <LogCategoryIcon
                categoryKey={record.defaults.cat}
                customCategories={[]}
                size={17}
                color={record.color}
                strokeWidth={1.8}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {record.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          disabled={disabled}
          style={[styles.addChip, disabled && styles.disabled]}
          onPress={openCreate}
        >
          <BabyLogIcon kind="new" size={17} color={colors.amber} strokeWidth={2} />
          <Text style={styles.addLabel}>+ 추가</Text>
        </Pressable>
      </ScrollView>

      <QuickRecordEditorSheet
        visible={editorOpen}
        records={records}
        editing={editing}
        startInForm={startInForm}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          setStartInForm(false);
        }}
        onSave={onSaveRecords}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#4A3428",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  edit: { fontSize: 11.5, color: colors.amber, fontWeight: "700" },
  row: { gap: 7, paddingRight: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  iconWrap: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "700", color: colors.text, maxWidth: 110 },
  addChip: {
    minWidth: 72,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.amberSoft,
  },
  addLabel: { fontSize: 12, color: colors.amber, fontWeight: "700" },
});
