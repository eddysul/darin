import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { QUICK_RECORD_COLORS } from "../../constants/defaultQuickRecords";
import { getCategory, PREGNANCY_LOG_CATEGORIES, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import { quickRecordsForStage } from "../../constants/defaultQuickRecords";
import type { QuickRecord } from "../../types/quickRecord";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { useAppSettings } from "../../context/AppSettingsContext";
import { formatVolume, volumeFromMl, volumeToMl } from "../../utils/measurementFormat";
import { DurationPickerField, DurationPickerSheet } from "../inputs/TimePickerFields";
import { useLanguage } from "../../LanguageContext";
import { RECORD_VALUE } from "../../constants/recordInternalValues";
import { quickRecordLabel, recordCategoryLabel, storedRecordValueLabel } from "../../utils/recordDisplay";

const BORN_LINK_CATS: BabyLogCategoryId[] = [
  "formula",
  "breast",
  "storedMilk",
  "sleep",
  "diaper",
  "food",
  "water",
  "milk",
  "snack",
  "pump",
  "tummy",
  "bath",
  "play",
  "med",
  "temp",
  "doctor",
  "memo",
  "other",
];

const PREGNANCY_LINK_CATS: BabyLogCategoryId[] = PREGNANCY_LOG_CATEGORIES
  .map((category) => category.id)
  .filter((id) => id !== "contraction");

const VOLUME_CATS: BabyLogCategoryId[] = [
  "formula",
  "storedMilk",
  "pump",
  "water",
  "milk",
];

const DURATION_CATS: BabyLogCategoryId[] = ["breast", "sleep", "pump", "tummy", "bath", "play"];
const AMOUNT_CATS: BabyLogCategoryId[] = [...VOLUME_CATS, "food", "snack", "med", "temp", "pregWeight", "pregBp"];
const STATE_CATS: BabyLogCategoryId[] = [
  "breast",
  "sleep",
  "diaper",
  "food",
  "snack",
  "pump",
  "temp",
  "pregMood",
  "pregSymptom",
  "pregKick",
  "pregMed",
  "pregHospital",
];

type Props = {
  visible: boolean;
  records: QuickRecord[];
  editing: QuickRecord | null;
  pregnancy?: boolean;
  /** Open directly on the create/edit form instead of the manage list. */
  startInForm?: boolean;
  onClose: () => void;
  onSave: (next: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
};

export function QuickRecordEditorSheet({
  visible,
  records,
  editing,
  pregnancy = false,
  startInForm = false,
  onClose,
  onSave,
}: Props) {
  const { settings } = useAppSettings();
  const { t } = useLanguage();
  const linkCats = pregnancy ? PREGNANCY_LINK_CATS : BORN_LINK_CATS;
  const defaultCat: BabyLogCategoryId = pregnancy ? "pregMood" : "formula";
  const stageRecords = useMemo(() => quickRecordsForStage(records, pregnancy), [pregnancy, records]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(QUICK_RECORD_COLORS[0]);
  const [cat, setCat] = useState<BabyLogCategoryId>("formula");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [chip, setChip] = useState("");
  const [notes, setNotes] = useState("");
  const [pinned, setPinned] = useState(true);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);

  const loadRecord = (r: QuickRecord) => {
    setEditId(r.id);
    setLabel(r.label);
    setColor(r.color);
    setCat(r.defaults.cat);
    setAmount(
      r.defaults.amount && VOLUME_CATS.includes(r.defaults.cat)
        ? volumeFromMl(r.defaults.amount, settings.units.volume)
        : r.defaults.amount ?? "",
    );
    setChip(
      r.defaults.cat === "diaper" && ([RECORD_VALUE.diaperLegacyBoth, RECORD_VALUE.diaperLegacyBothSpaced] as readonly string[]).includes(r.defaults.chip ?? "")
        ? RECORD_VALUE.diaperBoth
        : r.defaults.chip ?? "",
    );
    setDuration(r.defaults.duration ?? "");
    setNotes(r.defaults.notes ?? "");
    setPinned(r.pinned);
    setMode("form");
    setDurationPickerOpen(false);
  };

  const resetForm = () => {
    setLabel("");
    setColor(QUICK_RECORD_COLORS[0]);
    setCat(defaultCat);
    setAmount("");
    setChip("");
    setDuration("");
    setNotes("");
    setPinned(true);
    setDurationPickerOpen(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      loadRecord(editing);
      return;
    }
    resetForm();
    setEditId(null);
    setMode(startInForm ? "form" : "list");
  }, [visible, editing, startInForm, defaultCat]);

  const canSave = useMemo(
    () => label.trim().length > 0 && (cat !== "diaper" || ([RECORD_VALUE.diaperUrine, RECORD_VALUE.diaperStool, RECORD_VALUE.diaperBoth] as readonly string[]).includes(chip)),
    [cat, chip, label],
  );

  const saveForm = () => {
    if (!canSave) return;
    const nextRecord: QuickRecord = {
      id: editId ?? createId(),
      label: label.trim(),
      icon: editId ? (records.find((record) => record.id === editId)?.icon ?? "") : "",
      color,
      pinned,
      isCustom: editId ? (records.find((r) => r.id === editId)?.isCustom ?? true) : true,
      defaults: {
        cat,
        amount:
          !AMOUNT_CATS.includes(cat)
            ? undefined
            : amount.trim() && VOLUME_CATS.includes(cat)
            ? volumeToMl(amount.trim(), settings.units.volume)
            : amount.trim() || undefined,
        chip: STATE_CATS.includes(cat) ? chip.trim() || undefined : undefined,
        duration: DURATION_CATS.includes(cat) ? duration.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        sleepAction: cat === "sleep" && !duration.trim() ? "start" : undefined,
      },
    };
    onSave((prev) => {
      if (editId) return prev.map((r) => (r.id === editId ? nextRecord : r));
      if (prev.some((r) => r.id === nextRecord.id)) return prev;
      return [...prev, nextRecord];
    });
    onClose();
  };

  const remove = (id: string) => {
    onSave((prev) => prev.filter((r) => r.id !== id));
  };

  const togglePin = (id: string) => {
    onSave((prev) => prev.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)));
  };

  const openCreateForm = () => {
    resetForm();
    setEditId(null);
    setMode("form");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {mode === "form" ? t(editId ? "record.quick.editTitle" : "record.quick.addTitle") : t("record.quick.title")}
            </Text>
            {mode === "list" ? (
              <Pressable onPress={openCreateForm} accessibilityRole="button" accessibilityLabel={t("record.quick.new")}>
                <Text style={styles.link}>{t("record.quick.new")}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setEditId(null);
                  setMode("list");
                }}
              >
                <Text style={styles.link}>{t("record.quick.list")}</Text>
              </Pressable>
            )}
          </View>

          {mode === "list" ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {stageRecords.length === 0 ? (
                <Text style={styles.hint}>
                  {pregnancy
                    ? t("record.quick.listPregnancyHint")
                    : t("record.quick.listHint")}
                </Text>
              ) : null}
              {stageRecords.map((r) => (
                <View key={r.id} style={styles.listRow}>
                  <View style={[styles.listIcon, { backgroundColor: `${r.color}16` }]}>
                    <LogCategoryIcon
                      categoryKey={r.defaults.cat}
                      customCategories={[]}
                      size={18}
                      color={r.color}
                    />
                  </View>
                  <View style={styles.listBody}>
                    <Text style={styles.listLabel}>{quickRecordLabel(t, r)}</Text>
                    <Text style={styles.listMeta}>
                      {recordCategoryLabel(t, r.defaults.cat)}
                      {r.defaults.amount
                        ? ` · ${
                            VOLUME_CATS.includes(r.defaults.cat)
                              ? formatVolume(r.defaults.amount, settings.units.volume)
                              : r.defaults.amount
                          }`
                        : ""}
                      {r.defaults.chip ? ` · ${storedRecordValueLabel(t, r.defaults.chip)}` : ""}
                      {r.defaults.duration ? ` · ${t("record.quick.durationMinutes", { count: r.defaults.duration })}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.miniBtn}
                    onPress={() => togglePin(r.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: r.pinned }}
                    accessibilityLabel={t(r.pinned ? "record.quick.unpinA11y" : "record.quick.pinA11y", { label: quickRecordLabel(t, r) })}
                  >
                    <Text style={styles.miniBtnText}>{t(r.pinned ? "record.quick.pinned" : "record.quick.pin")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.miniBtn}
                    onPress={() => loadRecord(r)}
                    accessibilityRole="button"
                    accessibilityLabel={t("record.quick.editA11y", { label: quickRecordLabel(t, r) })}
                  >
                    <Text style={styles.miniBtnText}>{t("record.quick.edit")}</Text>
                  </Pressable>
                  {r.isCustom ? (
                    <Pressable
                      style={styles.miniBtn}
                      onPress={() => remove(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t("record.quick.deleteA11y", { label: quickRecordLabel(t, r) })}
                    >
                      <Text style={[styles.miniBtnText, styles.danger]}>{t("record.quick.delete")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Pressable style={styles.primary} onPress={openCreateForm}>
                <Text style={styles.primaryText}>{t("record.quick.create")}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>{t("record.quick.name")}</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder={t(pregnancy ? "record.quick.namePregnancyPlaceholder" : "record.quick.namePlaceholder")}
                placeholderTextColor={colors.faint}
                autoFocus={startInForm && !editing}
              />
              {!label.trim() ? (
                <Text style={styles.hint}>{t("record.quick.nameRequired")}</Text>
              ) : null}

              <Text style={styles.label}>{t("record.quick.color")}</Text>
              <View style={styles.colorRow}>
                {QUICK_RECORD_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <Text style={styles.label}>{t("record.quick.linkCategory")}</Text>
              <View style={styles.chipRow}>
                {linkCats.map((id) => {
                  const active = cat === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCat(id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {recordCategoryLabel(t, id)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {AMOUNT_CATS.includes(cat) ? (
                <>
                  <Text style={styles.label}>
                    {VOLUME_CATS.includes(cat) ? t("record.quick.defaultVolume", { unit: settings.units.volume }) : t("record.quick.defaultAmount")}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={
                      cat === "temp" ? t("record.quick.exampleTemperature")
                      : cat === "med" ? t("record.quick.exampleDose")
                      : cat === "pregWeight" ? t("record.quick.exampleWeight")
                      : cat === "pregBp" ? t("record.quick.exampleBloodPressure")
                      : t("record.quick.exampleAmount")
                    }
                    placeholderTextColor={colors.faint}
                    keyboardType={cat === "med" || cat === "pregBp" ? "default" : "decimal-pad"}
                  />
                </>
              ) : null}

              {DURATION_CATS.includes(cat) ? (
                <DurationPickerField
                  label={t("record.quick.defaultDuration")}
                  valueMinutes={Number.parseInt(duration, 10) || null}
                  placeholder={t(cat === "sleep" ? "record.quick.sleepTimerPlaceholder" : "record.quick.durationPlaceholder")}
                  onPress={() => setDurationPickerOpen(true)}
                />
              ) : null}

              {cat === "diaper" ? (
                <>
                  <Text style={styles.label}>{t("record.quick.diaperType")}</Text>
                  <View style={styles.chipRow}>
                    {[RECORD_VALUE.diaperUrine, RECORD_VALUE.diaperStool, RECORD_VALUE.diaperBoth].map((option) => (
                      <Pressable
                        key={option}
                        style={[styles.chip, chip === option && styles.chipActive]}
                        onPress={() => setChip(option)}
                      >
                        <Text style={[styles.chipText, chip === option && styles.chipTextActive]}>
                          {storedRecordValueLabel(t, option)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {!([RECORD_VALUE.diaperUrine, RECORD_VALUE.diaperStool, RECORD_VALUE.diaperBoth] as readonly string[]).includes(chip) ? (
                    <Text style={styles.hint}>{t("record.quick.diaperRequired")}</Text>
                  ) : null}
                </>
              ) : STATE_CATS.includes(cat) ? (
                <>
                  <Text style={styles.label}>{t("record.quick.defaultState")}</Text>
                  {(getCategory(cat).chips ?? []).length > 0 ? (
                    <View style={styles.chipRow}>
                      {(getCategory(cat).chips ?? []).map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.chip, chip === option && styles.chipActive]}
                          onPress={() => setChip(chip === option ? "" : option)}
                        >
                          <Text style={[styles.chipText, chip === option && styles.chipTextActive]}>
                            {storedRecordValueLabel(t, option)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={chip}
                      onChangeText={setChip}
                      placeholder={t(cat === "sleep" ? "record.quick.sleepStatePlaceholder" : "record.quick.optional")}
                      placeholderTextColor={colors.faint}
                    />
                  )}
                </>
              ) : null}

              <Text style={styles.label}>{t("record.quick.defaultNote")}</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder={t(pregnancy ? "record.quick.defaultNotePregnancyPlaceholder" : "record.quick.defaultNotePlaceholder")}
                placeholderTextColor={colors.faint}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("record.quick.pinToggle")}</Text>
                <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.amber }} />
              </View>

              <Pressable style={[styles.primary, !canSave && styles.disabled]} disabled={!canSave} onPress={saveForm}>
                <Text style={styles.primaryText}>{t("record.quick.save")}</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
      <DurationPickerSheet
        visible={durationPickerOpen}
        valueMinutes={Number.parseInt(duration, 10) || null}
        onCancel={() => setDurationPickerOpen(false)}
        onConfirm={(minutes) => { setDuration(String(minutes)); setDurationPickerOpen(false); }}
        onClear={() => { setDuration(""); setDurationPickerOpen(false); }}
      />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  link: { fontSize: 13, fontWeight: "700", color: colors.amberText },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  listBody: { flex: 1 },
  listLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  listMeta: { fontSize: 11.5, color: colors.faint, marginTop: 2 },
  miniBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
  },
  miniBtnText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  danger: { color: "#B45309" },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  colorRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  swatch: { width: 44, height: 44, borderRadius: 22 },
  swatchActive: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: colors.text },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  switchLabel: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  primary: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: colors.primaryForeground, fontSize: 14.5 },
  disabled: { opacity: 0.45 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 6 },
});
