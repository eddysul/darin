import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { QuickRecord } from "../../types/quickRecord";
import { colors } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { QuickRecordEditorSheet } from "./QuickRecordEditorSheet";

type Props = {
  records: QuickRecord[];
  disabled?: boolean;
  onTap: (record: QuickRecord) => void;
  onSaveRecords: (next: QuickRecord[]) => void;
};

export function QuickRecordsBar({ records, disabled, onTap, onSaveRecords }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuickRecord | null>(null);

  const pinned = useMemo(() => records.filter((r) => r.pinned), [records]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>자주 쓰는 기록</Text>
          <Text style={styles.subtitle}>저장된 기본값으로 바로 남겨요</Text>
        </View>
        <Pressable
          style={[styles.editBtn, disabled && styles.disabled]}
          disabled={disabled}
          accessibilityState={{ disabled }}
          hitSlop={8}
          onPress={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <BabyLogIcon kind="edit" size={13} color={colors.faint} />
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
                    setEditing(record);
                    setEditorOpen(true);
                  }
            }
          >
            <Text style={styles.icon}>{record.icon}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {record.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          disabled={disabled}
          style={[styles.addChip, disabled && styles.disabled]}
          onPress={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </ScrollView>

      <QuickRecordEditorSheet
        visible={editorOpen}
        records={records}
        editing={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={onSaveRecords}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.faint },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  edit: { fontSize: 12.5, color: colors.faint, fontWeight: "600" },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  icon: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, maxWidth: 120 },
  addChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  addText: { fontSize: 20, color: colors.amberDark, fontWeight: "600", marginTop: -2 },
});
