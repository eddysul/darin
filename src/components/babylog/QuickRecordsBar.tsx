import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { QuickRecord } from "../../types/quickRecord";
import { PREGNANCY_QUICK_RECORD_ACTIONS, QUICK_RECORD_ACTIONS, type OneTouchAction } from "../../constants/quickRecordActions";
import { quickRecordsForStage } from "../../constants/defaultQuickRecords";
import { colors, type } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { QuickRecordEditorSheet } from "./QuickRecordEditorSheet";
import { useLanguage } from "../../LanguageContext";
import { quickRecordLabel } from "../../utils/recordDisplay";

type Props = {
  records: QuickRecord[];
  visibleActions?: OneTouchAction[];
  pregnancy?: boolean;
  disabled?: boolean;
  onTap: (record: QuickRecord) => void;
  onSaveRecords: (next: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
};

export function QuickRecordsBar({
  records,
  visibleActions,
  pregnancy = false,
  disabled,
  onTap,
  onSaveRecords,
}: Props) {
  const { t } = useLanguage();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuickRecord | null>(null);
  const [startInForm, setStartInForm] = useState(false);
  const catalog = pregnancy ? PREGNANCY_QUICK_RECORD_ACTIONS : QUICK_RECORD_ACTIONS;
  const stageRecords = useMemo(() => quickRecordsForStage(records, pregnancy), [pregnancy, records]);

  const pinned = useMemo(
    () =>
      stageRecords.filter((record) => {
        if (!record.pinned) return false;
        if (!visibleActions) return true;
        return catalog.some(
          (action) =>
            visibleActions.includes(action.id) &&
            action.cat === record.defaults.cat,
        );
      }),
    [catalog, stageRecords, visibleActions],
  );

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
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{t("record.quick.title")}</Text>
          <Text style={styles.subtitle}>{t("record.quick.subtitle")}</Text>
        </View>
        <Pressable
          style={[styles.editBtn, disabled && styles.disabled]}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t("record.quick.manageA11y")}
          accessibilityState={{ disabled }}
          hitSlop={8}
          onPress={openManage}
        >
          <BabyLogIcon kind="edit" size={13} color={colors.amberText} />
          <Text style={styles.edit}>{t("record.quick.manage")}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pinned.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t("record.quick.empty")}</Text>
            <Text style={styles.emptyBody}>
              {pregnancy
                ? t("record.quick.emptyPregnancy")
                : t("record.quick.emptyBorn")}
            </Text>
          </View>
        ) : null}
        {pinned.map((record) => {
          const displayLabel = quickRecordLabel(t, record);
          return (
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
            accessibilityRole="button"
            accessibilityLabel={t("record.quick.saveNow", { label: displayLabel })}
            accessibilityHint={t("record.quick.editHint")}
            accessibilityState={{ disabled }}
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
              {displayLabel}
            </Text>
          </Pressable>
          );
        })}
        <Pressable
          disabled={disabled}
          style={[styles.addChip, disabled && styles.disabled]}
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel={t("record.quick.addA11y")}
        >
          <Text style={styles.addLabel}>{t("record.quick.add")}</Text>
        </Pressable>
      </ScrollView>

      <QuickRecordEditorSheet
        visible={editorOpen}
        records={records}
        editing={editing}
        pregnancy={pregnancy}
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
    marginBottom: 10,
    padding: 12,
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
    marginBottom: 8,
  },
  headingCopy: { flex: 1, paddingRight: 8 },
  title: { fontSize: type.md, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 2, fontSize: type.xs, lineHeight: 16, color: colors.faint },
  editBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  edit: { fontSize: type.xs, color: colors.amberText, fontWeight: "700" },
  row: { gap: 7, paddingRight: 6 },
  emptyState: { maxWidth: 230, justifyContent: "center", paddingRight: 4 },
  emptyTitle: { fontSize: type.xs, fontWeight: "700", color: colors.muted },
  emptyBody: { marginTop: 2, fontSize: type.xs, lineHeight: 16, color: colors.faint },
  chip: {
    minHeight: Platform.OS === "android" ? 48 : 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  iconWrap: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  label: { fontSize: type.xs, fontWeight: "700", color: colors.text, maxWidth: 110 },
  addChip: {
    minWidth: 88,
    minHeight: Platform.OS === "android" ? 48 : 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  addLabel: { fontSize: type.xs, color: colors.amberText, fontWeight: "700" },
});
