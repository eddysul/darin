import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useAppSettings } from "../../context/AppSettingsContext";
import { isValidClockInput } from "../../utils/timeInput";
import {
  temperatureFromCelsius,
  temperatureToCelsius,
  volumeFromMl,
  volumeToMl,
} from "../../utils/measurementFormat";
import {
  DurationPickerField,
  DurationPickerSheet,
  formatHHmm,
  TimeOfDayPickerField,
  TimePickerSheet,
} from "../inputs/TimePickerFields";

function normalizeDiaperChip(value: string): string {
  return value === "둘다" || value === "둘 다" ? "소변+대변" : value;
}

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
  /** Opens the separate growth-record flow from a clinic visit. */
  onOpenGrowthRecord?: () => void;
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
  onOpenGrowthRecord,
}: Props) {
  const { settings } = useAppSettings();
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
  const [timeError, setTimeError] = useState("");
  const [timePickerTarget, setTimePickerTarget] = useState<"time" | "end" | "nextAt" | null>(null);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible || !catKey) return;
    const nextCat = prefill?.cat ?? catKey;
    setSelectedCat(nextCat);
    setTimeError("");
    setTime(isValidClockInput(prefill?.time ?? "") ? prefill!.time! : nowTime());
    setChip(nextCat === "diaper" ? normalizeDiaperChip(prefill?.chip ?? "") : prefill?.chip ?? "");
    setChip2(prefill?.chip2 ?? "");
    setStoolState(prefill?.stoolState ?? "");
    const storedAmount = prefill?.amount ?? "";
    if (["formula", "storedMilk", "pump", "water", "milk"].includes(nextCat)) {
      setAmount(storedAmount ? volumeFromMl(storedAmount, settings.units.volume) : "");
    } else if (nextCat === "temp") {
      setAmount(
        storedAmount
          ? temperatureFromCelsius(storedAmount, settings.units.temperature)
          : "",
      );
    } else {
      setAmount(storedAmount);
    }
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
    setTimePickerTarget(null);
    setDurationPickerOpen(false);
  }, [visible, catKey, prefill, settings.units.temperature, settings.units.volume]);

  const computedDuration = useMemo(() => {
    if (!isValidClockInput(endTime) || !isValidClockInput(time)) return duration;
    return String(elapsedClockMinutes(time, endTime));
  }, [endTime, time, duration]);

  const durationMinutes = Number.parseInt(computedDuration || duration, 10);
  const durationValue = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null;
  const nextAtMatch = /(?:^|\s)(\d{1,2}):(\d{2})$/.exec(nextAt.trim());
  const nextAtTime = nextAtMatch ? formatHHmm(Number(nextAtMatch[1]), Number(nextAtMatch[2])) : "";
  const nextAtDate = nextAtMatch ? nextAt.slice(0, nextAtMatch.index).trim() : nextAt;

  const confirmTimePicker = (valueHHmm: string) => {
    const target = timePickerTarget;
    setTimePickerTarget(null);
    setTimeError("");
    if (target === "nextAt") {
      setNextAt([nextAtDate, valueHHmm].filter(Boolean).join(" "));
    } else if (target === "end") {
      setEndTime(valueHHmm);
      if (isValidClockInput(time)) setDuration(String(elapsedClockMinutes(time, valueHHmm)));
    } else {
      setTime(valueHHmm);
      if (isValidClockInput(endTime)) setDuration(String(elapsedClockMinutes(valueHHmm, endTime)));
    }
  };

  const confirmDurationPicker = (minutes: number) => {
    setDuration(String(minutes));
    if (isValidClockInput(time)) setEndTime(minutesToHhMm(time, minutes));
    setDurationPickerOpen(false);
  };

  if (!catKey) return null;
  if (embedded && !visible) return null;
  const effectiveCat = selectedCat ?? catKey;
  const c = resolveLogCategory(effectiveCat, customCategories);
  const builtinId = isCustomCategoryKey(effectiveCat) ? null : (effectiveCat as BabyLogCategoryId);
  const isEdit = Boolean(prefill?.editId);

  const handleSave = () => {
    if (!isValidClockInput(time) || (endTime && !isValidClockInput(endTime))) {
      setTimeError("시간을 00:00부터 23:59 사이로 입력해 주세요.");
      return;
    }
    setTimeError("");
    if (builtinId === "diaper" && !["소변", "대변", "소변+대변"].includes(chip)) {
      setTimeError("소변, 대변 또는 소변+대변 중 하나를 선택해 주세요.");
      return;
    }
    const isFood = builtinId === "food" || builtinId === "snack";
    const isMed = builtinId === "med";
    const customInputMode = c.isCustom ? c.inputMode ?? "memo" : null;
    const timedDuration =
      builtinId === "sleep" || builtinId === "breast" || customInputMode === "duration"
        ? computedDuration || duration
        : duration;
    const composedNotes = [
      isFood ? foodName.trim() : null,
      isMed ? medName.trim() : null,
      notes.trim() || null,
    ]
      .filter(Boolean)
      .join(" · ");
    const canonicalAmount =
      ["formula", "storedMilk", "pump", "water", "milk"].includes(effectiveCat)
        ? volumeToMl(amount, settings.units.volume)
        : effectiveCat === "temp"
          ? temperatureToCelsius(amount, settings.units.temperature)
          : amount;
    const diaperType = builtinId === "diaper" ? chip : "";
    onSave(
      {
        cat: effectiveCat,
        time,
        chip: chip || undefined,
        // The existing payload fields let us add this without a schema change:
        // amount = urine amount; chip2 = stool amount; stoolState = consistency.
        chip2: builtinId === "diaper" && diaperType === "소변" ? undefined : chip2 || undefined,
        stoolState:
          builtinId === "diaper" && diaperType === "소변" ? undefined : stoolState || undefined,
        amount:
          builtinId === "diaper" && diaperType === "대변"
            ? undefined
            : canonicalAmount || undefined,
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
    <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                  <Text style={styles.fieldLabel}>양 ({settings.units.volume})</Text>
                  <View style={styles.chipRow}>
                    {["60", "80", "100", "120", "150", "180"].map((ml) => {
                      const displayAmount = volumeFromMl(ml, settings.units.volume);
                      return (
                      <Pressable
                        key={ml}
                        style={[styles.chip, amount === displayAmount && styles.chipSel]}
                        onPress={() => setAmount(displayAmount)}
                      >
                        <Text style={[styles.chipText, amount === displayAmount && styles.chipTextSel]}>
                          {displayAmount}
                        </Text>
                      </Pressable>
                      );
                    })}
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
                  <TimeOfDayPickerField label="종료 시간" valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
                  <DurationPickerField label="총 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
                </>
              ) : null}
            </>
          )}

          {builtinId === "sleep" && (
            <>
              <Text style={styles.fieldLabel}>낮잠 / 밤잠</Text>
              <ChipRow options={["낮잠", "밤잠"]} value={chip} onChange={setChip} />
              <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <TimeOfDayPickerField label="종료 시간" valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
              <DurationPickerField label="총 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
              {endTime && isValidClockInput(time) && toMinutes(endTime) < toMinutes(time) ? <Text style={styles.overnightHint}>종료 시간이 시작보다 이르므로 다음 날 종료로 계산해요.</Text> : null}
            </>
          )}

          {builtinId === "diaper" && (
            <>
              <Text style={styles.fieldLabel}>무엇이 있었나요?</Text>
              <ChipRow options={["소변", "대변", "소변+대변"]} value={chip} onChange={setChip} />
              {(chip === "소변" || chip === "소변+대변") ? (
                <>
                  <Text style={styles.fieldLabel}>소변 양</Text>
                  <ChipRow options={["적음", "보통", "많음"]} value={amount} onChange={setAmount} />
                </>
              ) : null}
              {(chip === "대변" || chip === "소변+대변") ? (
                <>
                  <Text style={styles.fieldLabel}>대변 상태</Text>
                  <ChipRow
                    options={["보통", "묽음", "딱딱함", "설사", "기타"]}
                    value={stoolState}
                    onChange={setStoolState}
                  />
                  <Text style={styles.fieldLabel}>대변 양</Text>
                  <ChipRow options={["적음", "보통", "많음"]} value={chip2} onChange={setChip2} />
                </>
              ) : null}
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
              <Text style={styles.fieldLabel}>양 ({settings.units.volume})</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="예: 90"
                placeholderTextColor={colors.faint}
              />
              <DurationPickerField label="유축 지속 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {(builtinId === "water" || builtinId === "milk") && (
            <>
              <Text style={styles.fieldLabel}>양 ({settings.units.volume})</Text>
              <View style={styles.chipRow}>
                {["30", "60", "80", "100", "120"].map((ml) => {
                  const displayAmount = volumeFromMl(ml, settings.units.volume);
                  return (
                  <Pressable
                    key={ml}
                    style={[styles.chip, amount === displayAmount && styles.chipSel]}
                    onPress={() => setAmount(displayAmount)}
                  >
                    <Text style={[styles.chipText, amount === displayAmount && styles.chipTextSel]}>
                      {displayAmount}
                    </Text>
                  </Pressable>
                  );
                })}
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
              <DurationPickerField label="지속 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId === "bath" ? <DurationPickerField label="목욕 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} /> : null}

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
              <Text style={styles.fieldLabel}>
                체온 (°{settings.units.temperature === "c" ? "C" : "F"})
              </Text>
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
                value={nextAtDate}
                onChangeText={(date) => setNextAt([date.trim(), nextAtTime].filter(Boolean).join(" "))}
                placeholder="날짜 예: 7/28"
                placeholderTextColor={colors.faint}
              />
              <TimeOfDayPickerField label="다음 예약 시간" valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              {onOpenGrowthRecord ? (
                <Pressable
                  style={styles.growthLink}
                  onPress={() => {
                    handleSave();
                    setTimeout(onOpenGrowthRecord, 120);
                  }}
                >
                  <View style={styles.growthLinkCopy}>
                    <Text style={styles.growthLinkTitle}>이번 방문 성장 기록 추가</Text>
                    <Text style={styles.growthLinkBody}>키·몸무게·머리둘레는 별도 성장 기록으로 저장돼요.</Text>
                  </View>
                  <Text style={styles.growthLinkArrow}>›</Text>
                </Pressable>
              ) : null}
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

          {builtinId !== "sleep" && !(c.isCustom && (c.inputMode ?? "memo") === "duration") && (
            <TimeOfDayPickerField label={builtinId === "breast" ? "시작 시간" : "시간"} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
          )}

          {c.isCustom ? (
            <>
              {(c.inputMode ?? "memo") === "duration" ? (
                <>
                  <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
                  <TimeOfDayPickerField label="종료 시간" valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
                  <DurationPickerField label="총 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
                  {endTime && isValidClockInput(time) && toMinutes(endTime) < toMinutes(time) ? (
                    <Text style={styles.overnightHint}>종료 시간이 시작보다 이르므로 다음 날 종료로 계산해요.</Text>
                  ) : null}
                </>
              ) : null}
              {(c.inputMode ?? "memo") === "amount" ? (
                <>
                  <Text style={styles.fieldLabel}>양</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="예: 1, 30, 150"
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              {(c.inputMode ?? "memo") === "check" ? (
                <>
                  <Text style={styles.fieldLabel}>완료 여부</Text>
                  <ChipRow options={["완료", "미완료"]} value={chip} onChange={setChip} />
                </>
              ) : null}
            </>
          ) : !builtinId ? (
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
                <DurationPickerField label="지속 시간" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
              ) : null}
            </>
          ) : null}

          <Text style={styles.fieldLabel}>{builtinId === "memo" ? "내용" : "메모"}</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={
              builtinId === "memo" || (c.isCustom && (c.inputMode ?? "memo") === "memo")
                ? "오늘 남기고 싶은 메모"
                : builtinId === "food"
                  ? "추가 메모"
                  : "자유롭게 메모하세요"
            }
            placeholderTextColor={colors.faint}
          />

          {(builtinId === "sleep" || (c.isCustom && (c.inputMode ?? "memo") === "duration")) && timeError ? (
            <Text style={styles.inputError}>{timeError}</Text>
          ) : null}

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
      <TimePickerSheet
        visible={timePickerTarget !== null}
        valueHHmm={timePickerTarget === "end" ? endTime : timePickerTarget === "nextAt" ? nextAtTime : time}
        title={timePickerTarget === "end" ? "종료 시간" : timePickerTarget === "nextAt" ? "다음 예약 시간" : "시간 선택"}
        onCancel={() => setTimePickerTarget(null)}
        onConfirm={confirmTimePicker}
        onClear={timePickerTarget === "end"
          ? () => { setEndTime(""); setDuration(""); setTimePickerTarget(null); }
          : timePickerTarget === "nextAt"
            ? () => { setNextAt(nextAtDate); setTimePickerTarget(null); }
            : undefined}
      />
      <DurationPickerSheet
        visible={durationPickerOpen}
        valueMinutes={durationValue}
        onCancel={() => setDurationPickerOpen(false)}
        onConfirm={confirmDurationPicker}
        onClear={() => { setDuration(""); setEndTime(""); setDurationPickerOpen(false); }}
      />
    </KeyboardAvoidingView>
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
  keyboardRoot: { flex: 1 },
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
  inputError: { color: colors.dangerText, fontSize: 12, marginTop: 12 },
  overnightHint: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
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
  growthLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
  },
  growthLinkCopy: { flex: 1 },
  growthLinkTitle: { color: colors.amber, fontSize: 13.5, fontWeight: "800" },
  growthLinkBody: { color: colors.muted, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  growthLinkArrow: { color: colors.amber, fontSize: 24, fontWeight: "400" },
  deleteBtn: { paddingVertical: 10, marginTop: 8 },
  deleteText: { color: colors.dangerText, fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 8 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
});
