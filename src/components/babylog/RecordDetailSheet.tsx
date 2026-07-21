import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import { LogCategoryIcon } from "./LogCategoryIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { colors } from "../../theme";
import { elapsedClockMinutes, nowTime, toMinutes } from "../../utils/formatLog";

export type RecordSheetPrefill = Partial<BabyLogEntry> & { editId?: string };

type Props = {
  visible: boolean;
  catKey: LogCategoryKey | null;
  customCategories: CustomCategory[];
  prefill?: RecordSheetPrefill | null;
  onClose: () => void;
  onSave: (entry: Omit<BabyLogEntry, "id">, editId?: string) => void;
  onDelete?: (id: string) => void;
  /** Render as overlay inside a parent Modal (iOS nested-Modal safe). */
  embedded?: boolean;
};

function minutesToHhMm(start: string, minutes: number): string {
  const total = (toMinutes(start) + Math.max(0, minutes)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((ch) => (
        <Pressable
          key={ch}
          style={[styles.chip, value === ch && styles.chipSel]}
          onPress={() => onChange(value === ch ? "" : ch)}
        >
          <Text style={[styles.chipText, value === ch && styles.chipTextSel]}>{ch}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function RecordDetailSheet({
  visible,
  catKey,
  customCategories,
  prefill,
  onClose,
  onSave,
  onDelete,
  embedded = false,
}: Props) {
  const [time, setTime] = useState(nowTime());
  const [endTime, setEndTime] = useState("");
  const [selectedCat, setSelectedCat] = useState<LogCategoryKey | null>(catKey);
  const [chip, setChip] = useState("");
  const [chip2, setChip2] = useState("");
  const [stoolState, setStoolState] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [foodName, setFoodName] = useState("");
  const [medName, setMedName] = useState("");
  const [recordTitle, setRecordTitle] = useState("");
  const [details, setDetails] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    if (!visible || !catKey) return;
    const nextCat = prefill?.cat ?? catKey;
    setSelectedCat(nextCat);
    setTime(prefill?.time ?? nowTime());
    setChip(prefill?.chip ?? "");
    setChip2(prefill?.chip2 ?? "");
    setStoolState(prefill?.stoolState ?? "");
    setAmount(prefill?.amount ?? "");
    setDuration(prefill?.duration ?? "");
    setVoice(prefill?.voice ?? false);
    setRecordTitle(prefill?.title ?? "");
    setDetails(prefill?.details ?? "");
    setNextAt(prefill?.nextAt ?? "");
    const note = prefill?.notes ?? "";
    if (nextCat === "food" || nextCat === "snack") {
      const [namePart, ...rest] = note.split(" · ");
      setFoodName(namePart ?? "");
      setNotes(rest.join(" · "));
      setMedName("");
    } else if (nextCat === "med") {
      const [namePart, ...rest] = note.split(" · ");
      setMedName(namePart ?? "");
      setNotes(rest.join(" · "));
      setFoodName("");
    } else {
      setFoodName("");
      setMedName("");
      setNotes(note);
    }
    if ((nextCat === "sleep" || nextCat === "breast") && prefill?.time && prefill?.duration) {
      setEndTime(minutesToHhMm(prefill.time, Number.parseInt(prefill.duration, 10) || 0));
    } else {
      setEndTime("");
    }
  }, [visible, catKey, prefill]);

  const computedDuration = useMemo(() => {
    if (!endTime || !time) return duration;
    return String(elapsedClockMinutes(time, endTime));
  }, [endTime, time, duration]);

  if (!catKey) return null;
  if (embedded && !visible) return null;
  const effectiveCat = selectedCat ?? catKey;
  const c = resolveLogCategory(effectiveCat, customCategories);
  const builtinId = isCustomCategoryKey(effectiveCat) ? null : (effectiveCat as BabyLogCategoryId);
  const isEdit = Boolean(prefill?.editId);

  const handleSave = () => {
    const isFood = builtinId === "food" || builtinId === "snack";
    const isMed = builtinId === "med";
    const timedDuration =
      builtinId === "sleep" || builtinId === "breast"
        ? computedDuration || duration
        : duration;
    const composedNotes = [
      isFood ? foodName.trim() : null,
      isMed ? medName.trim() : null,
      notes.trim() || null,
    ]
      .filter(Boolean)
      .join(" · ");
    onSave(
      {
        cat: effectiveCat,
        time,
        chip: chip || undefined,
        chip2: chip2 || undefined,
        stoolState: stoolState || undefined,
        amount: amount || undefined,
        duration: timedDuration || undefined,
        notes: composedNotes || undefined,
        title: recordTitle.trim() || undefined,
        details: details.trim() || undefined,
        nextAt: nextAt.trim() || undefined,
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

  const sheet = (
    <Pressable
      style={[styles.backdrop, embedded && styles.embeddedBackdrop]}
      onPress={onClose}
      accessible={false}
    >
      <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <LogCategoryIcon categoryKey={effectiveCat} customCategories={customCategories} size={18} />
          <Text style={styles.title}>
            {c.label} 기록{isEdit ? " 수정" : ""}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(builtinId === "breast" || builtinId === "formula" || builtinId === "storedMilk") && (
            <>
              <Text style={styles.fieldLabel}>수유 방식</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { id: "breast" as const, label: "모유" },
                    { id: "formula" as const, label: "분유" },
                    { id: "storedMilk" as const, label: "저장 모유" },
                  ] as const
                ).map((option) => (
                  <Pressable
                    key={option.id}
                    style={[styles.chip, effectiveCat === option.id && styles.chipSel]}
                    onPress={() => {
                      setSelectedCat(option.id);
                      if (option.id !== "breast") setChip("");
                    }}
                  >
                    <Text
                      style={[styles.chipText, effectiveCat === option.id && styles.chipTextSel]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {builtinId === "breast" ? (
                <>
                  <Text style={styles.fieldLabel}>좌/우/양쪽</Text>
                  <ChipRow options={["좌측", "우측", "양쪽"]} value={chip} onChange={setChip} />
                </>
              ) : null}
              {builtinId !== "breast" ? (
                <>
                  <Text style={styles.fieldLabel}>양 (ml)</Text>
                  <View style={styles.chipRow}>
                    {["60", "80", "100", "120", "150", "180"].map((ml) => (
                      <Pressable
                        key={ml}
                        style={[styles.chip, amount === ml && styles.chipSel]}
                        onPress={() => setAmount(ml)}
                      >
                        <Text style={[styles.chipText, amount === ml && styles.chipTextSel]}>
                          {ml}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="직접 입력"
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              {builtinId === "breast" ? (
                <>
                  <Text style={styles.fieldLabel}>종료 시간</Text>
                  <TextInput
                    style={styles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.faint}
                  />
                  <Text style={styles.fieldLabel}>총 시간 (분)</Text>
                  <TextInput
                    style={styles.input}
                    value={computedDuration}
                    onChangeText={(v) => {
                      setDuration(v);
                      const mins = Number.parseInt(v, 10);
                      if (!Number.isNaN(mins) && time) setEndTime(minutesToHhMm(time, mins));
                    }}
                    keyboardType="numeric"
                    placeholder="예: 15"
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
            </>
          )}

          {builtinId === "sleep" && (
            <>
              <Text style={styles.fieldLabel}>낮잠 / 밤잠</Text>
              <ChipRow options={["낮잠", "밤잠"]} value={chip} onChange={setChip} />
              <Text style={styles.fieldLabel}>시작 시간</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>종료 시간</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={(v) => {
                  setEndTime(v);
                  if (/^\d{1,2}:\d{2}$/.test(v)) {
                    setDuration(String(elapsedClockMinutes(time, v)));
                  }
                }}
                placeholder="HH:MM"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>총 시간 (분)</Text>
              <TextInput
                style={styles.input}
                value={computedDuration}
                onChangeText={(v) => {
                  setDuration(v);
                  const mins = Number.parseInt(v, 10);
                  if (!Number.isNaN(mins) && time) setEndTime(minutesToHhMm(time, mins));
                }}
                keyboardType="numeric"
                placeholder="예: 40"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {builtinId === "diaper" && (
            <>
              <Text style={styles.fieldLabel}>구분</Text>
              <ChipRow options={["소변", "대변", "둘다"]} value={chip} onChange={setChip} />
              {chip !== "소변" ? (
                <>
                  <Text style={styles.fieldLabel}>색깔</Text>
                  <ChipRow
                    options={["노란색", "황금색", "녹색", "갈색", "검정"]}
                    value={chip2}
                    onChange={setChip2}
                  />
                  <Text style={styles.fieldLabel}>상태</Text>
                  <ChipRow
                    options={["보통", "묽음", "딱딱함", "설사", "변비"]}
                    value={stoolState}
                    onChange={setStoolState}
                  />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>양</Text>
              <ChipRow options={["적음", "보통", "많음"]} value={amount} onChange={setAmount} />
            </>
          )}

          {(builtinId === "food" || builtinId === "snack") && (
            <>
              <Text style={styles.fieldLabel}>음식명</Text>
              <TextInput
                style={styles.input}
                value={foodName}
                onChangeText={setFoodName}
                placeholder={builtinId === "snack" ? "예: 사과 조각" : "예: 고구마 이유식"}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>양 (g)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="예: 80"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>반응</Text>
              <ChipRow options={["잘 먹음", "보통", "거부"]} value={chip} onChange={setChip} />
              <Text style={styles.fieldLabel}>알러지 여부</Text>
              <ChipRow options={["없음", "의심", "있음"]} value={chip2} onChange={setChip2} />
            </>
          )}

          {(builtinId === "pump") && (
            <>
              <Text style={styles.fieldLabel}>좌/우/양쪽</Text>
              <ChipRow options={["좌측", "우측", "양쪽"]} value={chip} onChange={setChip} />
              <Text style={styles.fieldLabel}>양 (ml)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="예: 90"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {(builtinId === "water" || builtinId === "milk") && (
            <>
              <Text style={styles.fieldLabel}>양 (ml)</Text>
              <View style={styles.chipRow}>
                {["30", "60", "80", "100", "120"].map((ml) => (
                  <Pressable
                    key={ml}
                    style={[styles.chip, amount === ml && styles.chipSel]}
                    onPress={() => setAmount(ml)}
                  >
                    <Text style={[styles.chipText, amount === ml && styles.chipTextSel]}>
                      {ml}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="직접 입력"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {(builtinId === "tummy" || builtinId === "play") && (
            <>
              {builtinId === "play" ? (
                <>
                  <Text style={styles.fieldLabel}>놀이 내용</Text>
                  <TextInput
                    style={styles.input}
                    value={details}
                    onChangeText={setDetails}
                    placeholder="예: 모빌 보기"
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>지속 시간 (분)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="예: 15"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {builtinId === "med" && (
            <>
              <Text style={styles.fieldLabel}>약 이름</Text>
              <TextInput
                style={styles.input}
                value={medName}
                onChangeText={setMedName}
                placeholder="예: 비타민D"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>용량</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="예: 1 drop"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {builtinId === "temp" && (
            <>
              <Text style={styles.fieldLabel}>체온 (℃)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="예: 36.5"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>측정 위치</Text>
              <ChipRow options={["겨드랑이", "귀", "이마", "구강"]} value={chip} onChange={setChip} />
            </>
          )}

          {builtinId === "doctor" && (
            <>
              <Text style={styles.fieldLabel}>병원명</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder="예: 다린소아과"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>진료 내용</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={details}
                onChangeText={setDetails}
                multiline
                placeholder="진료 결과나 처방 내용을 입력하세요"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>다음 예약</Text>
              <TextInput
                style={styles.input}
                value={nextAt}
                onChangeText={setNextAt}
                placeholder="예: 7/28 10:30"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {builtinId === "other" && (
            <>
              <Text style={styles.fieldLabel}>제목</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder="예: 발진, 토함, 마사지"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>내용</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={details}
                onChangeText={setDetails}
                multiline
                placeholder="상태나 상황을 입력하세요"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {builtinId !== "sleep" && (
            <>
              <Text style={styles.fieldLabel}>{builtinId === "breast" ? "시작 시간" : "시간"}</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.faint}
              />
            </>
          )}

          {(!builtinId || isCustomCategoryKey(effectiveCat)) && (
            <>
              {c.chips ? (
                <>
                  <Text style={styles.fieldLabel}>상태</Text>
                  <ChipRow options={c.chips} value={chip} onChange={setChip} />
                </>
              ) : null}
              {c.amount ? (
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
              ) : null}
              {c.duration ? (
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
              ) : null}
            </>
          )}

          <Text style={styles.fieldLabel}>{builtinId === "memo" ? "내용" : "메모"}</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={
              builtinId === "memo"
                ? "오늘 남기고 싶은 메모"
                : builtinId === "food"
                  ? "추가 메모"
                  : "자유롭게 메모하세요"
            }
            placeholderTextColor={colors.faint}
          />

          {isEdit && prefill?.editId && onDelete && (
            <Pressable style={styles.deleteBtn} onPress={() => onDelete(prefill.editId!)}>
              <Text style={styles.deleteText}>이 기록 삭제하기</Text>
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
  );

  if (embedded) {
    return <View style={styles.embeddedRoot}>{sheet}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  embeddedBackdrop: {
    justifyContent: "flex-end",
  },
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
