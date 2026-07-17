import { useEffect, useMemo, useState } from "react";
import {
  Modal,
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

const LINK_CATS: BabyLogCategoryId[] = [
  "formula",
  "breast",
  "sleep",
  "diaper",
  "food",
  "med",
  "temp",
  "memo",
];

type Props = {
  visible: boolean;
  records: QuickRecord[];
  editing: QuickRecord | null;
  onClose: () => void;
  onSave: (next: QuickRecord[]) => void;
};

export function QuickRecordEditorSheet({ visible, records, editing, onClose, onSave }: Props) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("💊");
  const [color, setColor] = useState(QUICK_RECORD_COLORS[0]);
  const [cat, setCat] = useState<BabyLogCategoryId>("med");
  const [amount, setAmount] = useState("");
  const [chip, setChip] = useState("");
  const [notes, setNotes] = useState("");
  const [pinned, setPinned] = useState(true);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);

  const loadRecord = (r: QuickRecord) => {
    setEditId(r.id);
    setLabel(r.label);
    setIcon(r.icon);
    setColor(r.color);
    setCat(r.defaults.cat);
    setAmount(r.defaults.amount ?? "");
    setChip(r.defaults.chip ?? "");
    setNotes(r.defaults.notes ?? "");
    setPinned(r.pinned);
    setMode("form");
  };

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      loadRecord(editing);
    } else {
      resetForm();
      setEditId(null);
      setMode("list");
    }
  }, [visible, editing]);

  const resetForm = () => {
    setLabel("");
    setIcon("💊");
    setColor(QUICK_RECORD_COLORS[0]);
    setCat("med");
    setAmount("");
    setChip("");
    setNotes("");
    setPinned(true);
  };

  const canSave = useMemo(() => label.trim().length > 0, [label]);

  const saveForm = () => {
    if (!canSave) return;
    const nextRecord: QuickRecord = {
      id: editId ?? createId(),
      label: label.trim(),
      icon: icon.trim() || "✨",
      color,
      pinned,
      isCustom: editId ? (records.find((r) => r.id === editId)?.isCustom ?? true) : true,
      defaults: {
        cat,
        amount: amount.trim() || undefined,
        chip: chip.trim() || undefined,
        notes: notes.trim() || undefined,
        sleepAction: cat === "sleep" && !amount ? "start" : undefined,
      },
    };
    if (editId) {
      onSave(records.map((r) => (r.id === editId ? nextRecord : r)));
    } else {
      onSave([...records, nextRecord]);
    }
    onClose();
  };

  const remove = (id: string) => {
    onSave(records.filter((r) => r.id !== id));
  };

  const togglePin = (id: string) => {
    onSave(records.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {mode === "form" ? (editId ? "빠른 기록 수정" : "빠른 기록 추가") : "자주 쓰는 기록"}
            </Text>
            {mode === "list" ? (
              <Pressable
                onPress={() => {
                  resetForm();
                  setEditId(null);
                  setMode("form");
                }}
              >
                <Text style={styles.link}>추가</Text>
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
                  <Text style={styles.listIcon}>{r.icon}</Text>
                  <View style={styles.listBody}>
                    <Text style={styles.listLabel}>{r.label}</Text>
                    <Text style={styles.listMeta}>
                      {getCategory(r.defaults.cat).label}
                      {r.defaults.amount ? ` · ${r.defaults.amount}` : ""}
                      {r.defaults.chip ? ` · ${r.defaults.chip}` : ""}
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
              <Pressable
                style={styles.primary}
                onPress={() => {
                  resetForm();
                  setEditId(null);
                  setMode("form");
                }}
              >
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
              />

              <Text style={styles.label}>아이콘</Text>
              <TextInput
                style={styles.input}
                value={icon}
                onChangeText={setIcon}
                placeholder="💊"
                placeholderTextColor={colors.faint}
              />

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

              <Text style={styles.label}>기본값 · 양</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="예: 120 또는 1 drop"
                placeholderTextColor={colors.faint}
              />

              <Text style={styles.label}>기본값 · 구분/칩</Text>
              <TextInput
                style={styles.input}
                value={chip}
                onChangeText={setChip}
                placeholder="예: 소변, 낮잠"
                placeholderTextColor={colors.faint}
              />

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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  listIcon: { fontSize: 18 },
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
});
