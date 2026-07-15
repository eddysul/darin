import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getCategory,
  nowTime,
  type BabyLogCategoryId,
} from "../../constants/babyLogCategories";
import { LogCategoryIcon } from "./LogCategoryIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import type { DefaultFeedingMethod } from "../../types/careSetup";
import { isFeedingCategory } from "../../constants/logCategoryGroups";
import { colors } from "../../theme";

export type RecordSheetPrefill = Partial<BabyLogEntry> & { editId?: string };

function feedingHint(method: DefaultFeedingMethod | undefined, catId: BabyLogCategoryId): string | null {
  if (!method || method === "not_sure" || !isFeedingCategory(catId)) return null;
  if (method === "breastfeeding" && catId === "breast") return "기본: 모유 — 측면·시간을 기록해 주세요";
  if (method === "formula" && (catId === "formula" || catId === "food")) return "기본: 분유 — 용량(ml)을 먼저 입력해 주세요";
  if (method === "pumped_milk" && catId === "pump") return "기본: 유축 — 용량(ml)을 입력해 주세요";
  if (method === "mixed") return "혼합 수유 — 모유·분유·유축 중 실제로 한 방식을 기록해 주세요";
  return null;
}

type Props = {
  visible: boolean;
  catKey: LogCategoryKey | null;
  customCategories: CustomCategory[];
  prefill?: RecordSheetPrefill | null;
  defaultFeedingMethod?: DefaultFeedingMethod;
  onClose: () => void;
  onSave: (entry: Omit<BabyLogEntry, "id">, editId?: string) => void;
  onDelete?: (id: string) => void;
};

export function RecordDetailSheet({
  visible,
  catKey,
  customCategories,
  prefill,
  defaultFeedingMethod,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [time, setTime] = useState(nowTime());
  const [chip, setChip] = useState("");
  const [chip2, setChip2] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    if (!visible || !catKey) return;
    setTime(prefill?.time ?? nowTime());
    setChip(prefill?.chip ?? "");
    setChip2(prefill?.chip2 ?? "");
    setAmount(prefill?.amount ?? "");
    setDuration(prefill?.duration ?? "");
    setNotes(prefill?.notes ?? "");
    setVoice(prefill?.voice ?? false);
  }, [visible, catKey, prefill]);

  if (!catKey) return null;
  const c = resolveLogCategory(catKey, customCategories);
  const builtinId = isCustomCategoryKey(catKey) ? null : (catKey as BabyLogCategoryId);
  const isEdit = Boolean(prefill?.editId);
  const hint = builtinId ? feedingHint(defaultFeedingMethod, builtinId) : null;
  const emphasizeAmount =
    builtinId &&
    isFeedingCategory(builtinId) &&
    (defaultFeedingMethod === "formula" || defaultFeedingMethod === "pumped_milk") &&
    Boolean(c.amount);
  const emphasizeDuration =
    builtinId && isFeedingCategory(builtinId) && defaultFeedingMethod === "breastfeeding" && Boolean(c.duration);

  const handleSave = () => {
    onSave(
      {
        cat: catKey,
        time,
        chip: chip || undefined,
        chip2: chip2 || undefined,
        amount: amount || undefined,
        duration: duration || undefined,
        notes: notes.trim() || undefined,
        voice,
        source: prefill?.source ?? (voice ? "voice" : "manual"),
        rawTranscript: prefill?.rawTranscript,
        confidence: prefill?.confidence,
        flags: prefill?.flags,
        createdBy: prefill?.createdBy,
        dateKey: prefill?.dateKey,
      },
      prefill?.editId,
    );
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <LogCategoryIcon categoryKey={catKey} customCategories={customCategories} size={18} />
            <Text style={styles.title}>
              {c.label} 기록{isEdit ? " 수정" : ""}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {hint ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>시간</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.faint}
            />

            {emphasizeAmount && c.amount && (
              <>
                <Text style={[styles.fieldLabel, styles.fieldHighlight]}>양 ({c.amount})</Text>
                <TextInput
                  style={[styles.input, styles.inputHighlight]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="예: 150"
                  placeholderTextColor={colors.faint}
                />
              </>
            )}

            {c.chips && (
              <>
                <Text style={styles.fieldLabel}>{builtinId === "diaper" ? "구분" : "상태"}</Text>
                <View style={styles.chipRow}>
                  {c.chips.map((ch) => (
                    <Pressable
                      key={ch}
                      style={[styles.chip, chip === ch && styles.chipSel]}
                      onPress={() => setChip(chip === ch ? "" : ch)}
                    >
                      <Text style={[styles.chipText, chip === ch && styles.chipTextSel]}>{ch}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {c.chips2 && (
              <>
                <Text style={styles.fieldLabel}>색깔/특이사항</Text>
                <View style={styles.chipRow}>
                  {c.chips2.map((ch) => (
                    <Pressable
                      key={ch}
                      style={[styles.chip, chip2 === ch && styles.chipSel]}
                      onPress={() => setChip2(chip2 === ch ? "" : ch)}
                    >
                      <Text style={[styles.chipText, chip2 === ch && styles.chipTextSel]}>{ch}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {c.amount && !emphasizeAmount && (
              <>
                <Text style={styles.fieldLabel}>양 ({c.amount})</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="예: 150"
                  placeholderTextColor={colors.faint}
                />
              </>
            )}

            {emphasizeDuration && c.duration && (
              <>
                <Text style={[styles.fieldLabel, styles.fieldHighlight]}>지속 시간 (분)</Text>
                <TextInput
                  style={[styles.input, styles.inputHighlight]}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholder="예: 30"
                  placeholderTextColor={colors.faint}
                />
              </>
            )}

            {c.duration && !emphasizeDuration && (
              <>
                <Text style={styles.fieldLabel}>지속 시간 (분)</Text>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholder="예: 30"
                  placeholderTextColor={colors.faint}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>메모</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="자유롭게 메모하세요"
              placeholderTextColor={colors.faint}
            />

            {isEdit && prefill?.editId && onDelete && (
              <Pressable style={styles.deleteBtn} onPress={() => onDelete(prefill.editId!)}>
                <Text style={styles.deleteText}>🗑️ 이 기록 삭제하기</Text>
              </Pressable>
            )}

            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
                <Text style={styles.btnPrimaryText}>저장</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingBottom: 26,
    maxHeight: "88%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    alignSelf: "center",
    marginVertical: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  fieldLabel: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldHighlight: { color: colors.amber },
  hintBox: {
    backgroundColor: colors.amberSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  hintText: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  inputHighlight: { borderColor: colors.amber },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  notes: { height: 64, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSel: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  chipTextSel: { color: colors.amberDark },
  deleteBtn: { paddingVertical: 10, marginTop: 8 },
  deleteText: { color: colors.dangerText, fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 8 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
});
