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
import { getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { QuickRecord } from "../../types/quickRecord";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { useAppSettings } from "../../context/AppSettingsContext";
import { formatVolume, volumeFromMl, volumeToMl } from "../../utils/measurementFormat";
import { DurationPickerField, DurationPickerSheet } from "../inputs/TimePickerFields";

const LINK_CATS: BabyLogCategoryId[] = [
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

const VOLUME_CATS: BabyLogCategoryId[] = [
  "formula",
  "storedMilk",
  "pump",
  "water",
  "milk",
];

const DURATION_CATS: BabyLogCategoryId[] = ["breast", "sleep", "pump", "tummy", "bath", "play"];
const AMOUNT_CATS: BabyLogCategoryId[] = [...VOLUME_CATS, "food", "snack", "med", "temp"];
const STATE_CATS: BabyLogCategoryId[] = ["breast", "sleep", "diaper", "food", "snack", "pump", "temp"];

type Props = {
  visible: boolean;
  records: QuickRecord[];
  editing: QuickRecord | null;
  /** Open directly on the create/edit form instead of the manage list. */
  startInForm?: boolean;
  onClose: () => void;
  onSave: (next: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
};

export function QuickRecordEditorSheet({
  visible,
  records,
  editing,
  startInForm = false,
  onClose,
  onSave,
}: Props) {
  const { settings } = useAppSettings();
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
      r.defaults.cat === "diaper" && ["둘다", "둘 다"].includes(r.defaults.chip ?? "")
        ? "소변+대변"
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
    setCat("formula");
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
  }, [visible, editing, startInForm]);

  const canSave = useMemo(
    () => label.trim().length > 0 && (cat !== "diaper" || ["소변", "대변", "소변+대변"].includes(chip)),
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
      <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {mode === "form" ? (editId ? "빠른 기록 수정" : "빠른 기록 추가") : "자주 쓰는 기록"}
            </Text>
            {mode === "list" ? (
              <Pressable onPress={openCreateForm} accessibilityRole="button" accessibilityLabel="새로 추가">
                <Text style={styles.link}>새로 추가</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setEditId(null);
                  setMode("list");
                }}
              >
                <Text style={styles.link}>목록</Text>
              </Pressable>
            )}
          </View>

          {mode === "list" ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {records.map((r) => (
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
                    <Text style={styles.listLabel}>{r.label}</Text>
                    <Text style={styles.listMeta}>
                      {getCategory(r.defaults.cat).label}
                      {r.defaults.amount
                        ? ` · ${
                            VOLUME_CATS.includes(r.defaults.cat)
                              ? formatVolume(r.defaults.amount, settings.units.volume)
                              : r.defaults.amount
                          }`
                        : ""}
                      {r.defaults.chip ? ` · ${r.defaults.chip}` : ""}
                      {r.defaults.duration ? ` · ${r.defaults.duration}분` : ""}
                    </Text>
                  </View>
                  <Pressable style={styles.miniBtn} onPress={() => togglePin(r.id)}>
                    <Text style={styles.miniBtnText}>{r.pinned ? "고정됨" : "고정"}</Text>
                  </Pressable>
                  <Pressable style={styles.miniBtn} onPress={() => loadRecord(r)}>
                    <Text style={styles.miniBtnText}>수정</Text>
                  </Pressable>
                  {r.isCustom ? (
                    <Pressable style={styles.miniBtn} onPress={() => remove(r.id)}>
                      <Text style={[styles.miniBtnText, styles.danger]}>삭제</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Pressable style={styles.primary} onPress={openCreateForm}>
                <Text style={styles.primaryText}>새 빠른 기록 만들기</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="예: 비타민D"
                placeholderTextColor={colors.faint}
                autoFocus={startInForm && !editing}
              />
              {!label.trim() ? (
                <Text style={styles.hint}>이름을 입력해야 저장할 수 있어요.</Text>
              ) : null}

              <Text style={styles.label}>색상</Text>
              <View style={styles.colorRow}>
                {QUICK_RECORD_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <Text style={styles.label}>연결 카테고리</Text>
              <View style={styles.chipRow}>
                {LINK_CATS.map((id) => {
                  const active = cat === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCat(id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {getCategory(id).label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {AMOUNT_CATS.includes(cat) ? (
                <>
                  <Text style={styles.label}>
                    {VOLUME_CATS.includes(cat) ? `기본 양 (${settings.units.volume})` : "기본 수치 또는 용량"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={cat === "temp" ? "예: 36.5" : cat === "med" ? "예: 1 drop" : "예: 120"}
                    placeholderTextColor={colors.faint}
                    keyboardType={cat === "med" ? "default" : "decimal-pad"}
                  />
                </>
              ) : null}

              {DURATION_CATS.includes(cat) ? (
                <DurationPickerField
                  label="기본 지속 시간"
                  valueMinutes={Number.parseInt(duration, 10) || null}
                  placeholder={cat === "sleep" ? "비워두면 수면 타이머 시작" : "기간 선택"}
                  onPress={() => setDurationPickerOpen(true)}
                />
              ) : null}

              {cat === "diaper" ? (
                <>
                  <Text style={styles.label}>기저귀 종류</Text>
                  <View style={styles.chipRow}>
                    {["소변", "대변", "소변+대변"].map((option) => (
                      <Pressable
                        key={option}
                        style={[styles.chip, chip === option && styles.chipActive]}
                        onPress={() => setChip(option)}
                      >
                        <Text style={[styles.chipText, chip === option && styles.chipTextActive]}>
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {!["소변", "대변", "소변+대변"].includes(chip) ? (
                    <Text style={styles.hint}>종류를 선택해야 바로 기록할 수 있어요.</Text>
                  ) : null}
                </>
              ) : STATE_CATS.includes(cat) ? (
                <>
                  <Text style={styles.label}>기본 상태</Text>
                  <TextInput
                    style={styles.input}
                    value={chip}
                    onChangeText={setChip}
                    placeholder={cat === "sleep" ? "예: 낮잠 또는 밤잠" : "선택 사항"}
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}

              <Text style={styles.label}>기본값 · 메모</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="예: 비타민D 1 drop"
                placeholderTextColor={colors.faint}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>자주 쓰는 기록으로 고정</Text>
                <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.amber }} />
              </View>

              <Pressable style={[styles.primary, !canSave && styles.disabled]} disabled={!canSave} onPress={saveForm}>
                <Text style={styles.primaryText}>저장</Text>
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
  link: { fontSize: 13, fontWeight: "700", color: colors.amber },
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
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
  swatch: { width: 28, height: 28, borderRadius: 14 },
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
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: colors.amberDark, fontSize: 14.5 },
  disabled: { opacity: 0.45 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 6 },
});
