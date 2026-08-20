import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { isPregnancyLogCategoryId, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import { LogCategoryIcon } from "./LogCategoryIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import type { FoodIngredient, FoodIngredientSource } from "../../types/foodIngredient";
import { isCustomCategoryKey } from "../../types/logCategory";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { colors } from "../../theme";
import { elapsedClockMinutes, nowTime, toMinutes } from "../../utils/formatLog";
import { useAppSettings } from "../../context/AppSettingsContext";
import { isValidClockInput } from "../../utils/timeInput";
import {
  temperatureFromCelsius,
  temperatureToCelsius,
  formatVolume,
  volumeFromMl,
  volumeToMl,
} from "../../utils/measurementFormat";
import {
  DurationPickerField,
  DurationPickerSheet,
  DatePickerField,
  DatePickerSheet,
  formatHHmm,
  TimeOfDayPickerField,
  TimePickerSheet,
} from "../inputs/TimePickerFields";
import { AmountInput, CUSTOM_AMOUNT_UNIT, isPositiveAmount } from "../inputs/AmountInput";
import { useBabyLog } from "../../context/BabyLogContext";
import { matchCautionFoods } from "../../utils/cautionFoodsStore";

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
  sessionLabel?: string;
  logs?: BabyLogEntry[];
  foodIngredients?: FoodIngredient[];
  onAddFoodIngredient?: (name: string, source: FoodIngredientSource) => FoodIngredient | null;
  storedMilkEstimatedAvailableMl?: number;
};

const STARTER_INGREDIENTS = ["쌀미음", "소고기", "애호박", "바나나", "고구마", "사과"];
const MEDICATION_DOSE_UNITS = ["ml", "drop", "방울", "포", "정", "회", "스푼", "g", "mg"];
const CUSTOM_DOSE_UNIT = CUSTOM_AMOUNT_UNIT;
const LIQUID_CATEGORIES = ["formula", "storedMilk", "pump", "water", "milk"] as const;

function parseMedicationDose(raw?: string): { value: string; unit: string } | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(\S(?:.*\S)?)\s*$/.exec(raw ?? "");
  if (!match) return null;
  return { value: match[1].replace(",", "."), unit: match[2] };
}

function normalizeMedicationType(value?: string): string {
  if (["medicine", "supplement", "ointment", "eye_drop", "other"].includes(value ?? "")) return value!;
  if (value === "영양제") return "supplement";
  if (value === "연고") return "ointment";
  if (value === "안약") return "eye_drop";
  return value ? "other" : "";
}

function normalizeMedicationStatus(value?: string): string {
  if (["given", "partial", "refused"].includes(value ?? "")) return value!;
  if (value === "복용 완료") return "given";
  if (value === "일부 복용") return "partial";
  if (value === "건너뜀" || value === "복용 안 함") return "refused";
  return value ? "given" : "";
}

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

function LabeledChipRow({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable key={option.value} style={[styles.chip, value === option.value && styles.chipSel]} onPress={() => onChange(value === option.value ? "" : option.value)}>
          <Text style={[styles.chipText, value === option.value && styles.chipTextSel]}>{option.label}</Text>
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
  sessionLabel,
  logs = [],
  foodIngredients = [],
  onAddFoodIngredient,
  storedMilkEstimatedAvailableMl,
}: Props) {
  const { settings } = useAppSettings();
  const { babyName, activeBabyId, cautionFoods } = useBabyLog();
  const [time, setTime] = useState(nowTime());
  const [endTime, setEndTime] = useState("");
  const [selectedCat, setSelectedCat] = useState<LogCategoryKey | null>(catKey);
  const [chip, setChip] = useState("");
  const [chip2, setChip2] = useState("");
  const [stoolState, setStoolState] = useState("");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState("");
  const [customAmountUnit, setCustomAmountUnit] = useState("");
  const [duration, setDuration] = useState("");
  const [leftDuration, setLeftDuration] = useState("");
  const [rightDuration, setRightDuration] = useState("");
  const [leftAmount, setLeftAmount] = useState("");
  const [rightAmount, setRightAmount] = useState("");
  const [feedingMethod, setFeedingMethod] = useState<BabyLogEntry["feedingMethod"]>();
  const [burped, setBurped] = useState<BabyLogEntry["burped"]>();
  const [spitUp, setSpitUp] = useState<BabyLogEntry["spitUp"]>();
  const [supplement, setSupplement] = useState("");
  const [feedingNote, setFeedingNote] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [ingredientError, setIngredientError] = useState("");
  const [medName, setMedName] = useState("");
  const [recordTitle, setRecordTitle] = useState("");
  const [details, setDetails] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [medicationType, setMedicationType] = useState("");
  const [medicationStatus, setMedicationStatus] = useState("");
  const [doseValue, setDoseValue] = useState("");
  const [doseUnit, setDoseUnit] = useState("");
  const [customDoseUnit, setCustomDoseUnit] = useState("");
  const [legacyDoseText, setLegacyDoseText] = useState("");
  const [doseUnitTouched, setDoseUnitTouched] = useState(false);
  const [medicationReminderEnabled, setMedicationReminderEnabled] = useState(false);
  const [visitType, setVisitType] = useState<BabyLogEntry["visitType"]>();
  const [doctorName, setDoctorName] = useState("");
  const [cautions, setCautions] = useState("");
  const [cautionReminderEnabled, setCautionReminderEnabled] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [vaccinationRound, setVaccinationRound] = useState<BabyLogEntry["vaccinationRound"]>();
  const [vaccinationRoundText, setVaccinationRoundText] = useState("");
  const [vaccinationHospitalName, setVaccinationHospitalName] = useState("");
  const [vaccinationDoctorName, setVaccinationDoctorName] = useState("");
  const [injectionSite, setInjectionSite] = useState<BabyLogEntry["injectionSite"]>();
  const [injectionSiteText, setInjectionSiteText] = useState("");
  const [aftercareNotes, setAftercareNotes] = useState<string[]>([]);
  const [vaccinationReminderSetting, setVaccinationReminderSetting] = useState<BabyLogEntry["vaccinationReminderSetting"]>("none");
  const [vaccinationDateKey, setVaccinationDateKey] = useState("");
  const [vaccinationCustomReminderAt, setVaccinationCustomReminderAt] = useState("");
  const [voice, setVoice] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [diaperError, setDiaperError] = useState("");
  const [feedingAmountError, setFeedingAmountError] = useState("");
  const [timePickerTarget, setTimePickerTarget] = useState<"time" | "end" | "nextAt" | "vaccinationReminder" | null>(null);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [nextDatePickerOpen, setNextDatePickerOpen] = useState(false);
  const [vaccinationDatePickerOpen, setVaccinationDatePickerOpen] = useState(false);
  const [vaccinationReminderDatePickerOpen, setVaccinationReminderDatePickerOpen] = useState(false);
  const [sideDurationTarget, setSideDurationTarget] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    if (!visible || !catKey) return;
    const nextCat = prefill?.cat ?? catKey;
    setSelectedCat(nextCat);
    setTimeError("");
    setDiaperError("");
    setFeedingAmountError("");
    setTime(isValidClockInput(prefill?.time ?? "") ? prefill!.time! : nowTime());
    setChip(nextCat === "diaper" ? normalizeDiaperChip(prefill?.chip ?? "") : prefill?.chip ?? "");
    setChip2(prefill?.chip2 ?? "");
    setStoolState(prefill?.stoolState ?? "");
    const storedAmount = prefill?.amount ?? "";
    if ((LIQUID_CATEGORIES as readonly string[]).includes(nextCat)) {
      const savedUnit = prefill?.amountUnit?.trim();
      const nextUnit = savedUnit || (prefill?.editId ? "ml" : settings.units.volume);
      const storedValue = prefill?.amountValue == null ? "" : String(prefill.amountValue);
      setAmount(
        storedValue || (storedAmount
          ? nextUnit === "ml" || nextUnit === "oz" ? volumeFromMl(storedAmount, nextUnit) : storedAmount
          : ""),
      );
      setAmountUnit(nextUnit === "ml" || nextUnit === "oz" ? nextUnit : CUSTOM_AMOUNT_UNIT);
      setCustomAmountUnit(nextUnit === "ml" || nextUnit === "oz" ? "" : nextUnit);
    } else if (nextCat === "temp") {
      setAmount(
        storedAmount
          ? temperatureFromCelsius(storedAmount, settings.units.temperature)
          : "",
      );
    } else {
      setAmount(storedAmount);
      setAmountUnit("");
      setCustomAmountUnit("");
    }
    setDuration(prefill?.duration ?? "");
    setLeftDuration(prefill?.leftDuration ?? "");
    setRightDuration(prefill?.rightDuration ?? "");
    const savedPumpUnit = prefill?.leftAmountUnit?.trim() || prefill?.rightAmountUnit?.trim();
    const nextPumpUnit = savedPumpUnit || (prefill?.editId ? "ml" : settings.units.volume);
    if (nextCat === "pump") {
      setAmountUnit(nextPumpUnit === "ml" || nextPumpUnit === "oz" ? nextPumpUnit : CUSTOM_AMOUNT_UNIT);
      setCustomAmountUnit(nextPumpUnit === "ml" || nextPumpUnit === "oz" ? "" : nextPumpUnit);
    }
    setLeftAmount(prefill?.leftAmountValue != null
      ? String(prefill.leftAmountValue)
      : prefill?.leftAmount
        ? (nextPumpUnit === "ml" || nextPumpUnit === "oz" ? volumeFromMl(prefill.leftAmount, nextPumpUnit) : prefill.leftAmount)
        : "");
    setRightAmount(prefill?.rightAmountValue != null
      ? String(prefill.rightAmountValue)
      : prefill?.rightAmount
        ? (nextPumpUnit === "ml" || nextPumpUnit === "oz" ? volumeFromMl(prefill.rightAmount, nextPumpUnit) : prefill.rightAmount)
        : "");
    setFeedingMethod(prefill?.feedingMethod);
    setBurped(prefill?.burped);
    setSpitUp(prefill?.spitUp);
    setSupplement(prefill?.supplement ?? "");
    setFeedingNote(prefill?.feedingNote ?? "");
    setVoice(prefill?.voice ?? false);
    setRecordTitle(prefill?.title ?? "");
    setDetails(prefill?.details ?? "");
    setNextAt(prefill?.nextAt ?? "");
    setMedicationType(normalizeMedicationType(prefill?.medicationType ?? (nextCat === "med" && prefill ? "other" : "")));
    setMedicationStatus(normalizeMedicationStatus(prefill?.medicationStatus ?? (nextCat === "med" && prefill ? "given" : "")));
    const structuredDoseValue = prefill?.doseValue == null ? "" : String(prefill.doseValue);
    const structuredDoseUnit = prefill?.doseUnit?.trim() ?? "";
    const legacyDose = prefill?.doseText?.trim() || (nextCat === "med" ? storedAmount.trim() : "");
    const parsedDose = structuredDoseValue && structuredDoseUnit
      ? { value: structuredDoseValue, unit: structuredDoseUnit }
      : parseMedicationDose(legacyDose);
    setDoseValue(parsedDose?.value ?? "");
    const medicationDefaultUnit = settings.units.medicationDefaultUnit;
    const defaultDoseUnit = medicationDefaultUnit === "none" ? "" : medicationDefaultUnit === "other" ? CUSTOM_DOSE_UNIT : medicationDefaultUnit;
    setDoseUnit(parsedDose ? (MEDICATION_DOSE_UNITS.includes(parsedDose.unit) ? parsedDose.unit : CUSTOM_DOSE_UNIT) : prefill?.editId ? "" : defaultDoseUnit);
    setCustomDoseUnit(parsedDose && !MEDICATION_DOSE_UNITS.includes(parsedDose.unit) ? parsedDose.unit : "");
    setLegacyDoseText(legacyDose && !parsedDose ? legacyDose : "");
    setDoseUnitTouched(false);
    setMedicationReminderEnabled(prefill?.medicationReminderEnabled ?? false);
    setVisitType(prefill?.visitType ?? (nextCat === "doctor" && prefill ? "checkup" : undefined));
    setDoctorName(prefill?.doctorName ?? "");
    setCautions(prefill?.cautions ?? "");
    setCautionReminderEnabled(prefill?.cautionReminderEnabled ?? false);
    setVaccineName(prefill?.vaccineName ?? "");
    setVaccinationRound(prefill?.vaccinationRound);
    setVaccinationRoundText(prefill?.vaccinationRoundText ?? "");
    setVaccinationHospitalName(prefill?.vaccinationHospitalName ?? "");
    setVaccinationDoctorName(prefill?.vaccinationDoctorName ?? "");
    setInjectionSite(prefill?.injectionSite);
    setInjectionSiteText(prefill?.injectionSiteText ?? "");
    setAftercareNotes(prefill?.aftercareNotes ?? []);
    setVaccinationReminderSetting(prefill?.vaccinationReminderSetting ?? "none");
    setVaccinationDateKey(prefill?.dateKey ?? new Date().toLocaleDateString("sv-SE"));
    setVaccinationCustomReminderAt(prefill?.vaccinationCustomReminderAt ?? "");
    const note = prefill?.notes ?? "";
    if (nextCat === "food" || nextCat === "snack") {
      const [namePart, ...rest] = note.split(" · ");
      setSelectedIngredients(
        Array.isArray(prefill?.ingredients)
          ? prefill.ingredients
          : (namePart ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      );
      setNotes(rest.join(" · "));
      setMedName("");
    } else if (nextCat === "med") {
      const [namePart, ...rest] = note.split(" · ");
      setMedName(prefill?.medicationName ?? namePart ?? "");
      setNotes(prefill?.medicationName ? note : rest.join(" · "));
      setSelectedIngredients([]);
    } else {
      setSelectedIngredients([]);
      setMedName("");
      setNotes(note);
    }
    if (["sleep", "breast", "pump"].includes(nextCat) && prefill?.time && prefill?.duration) {
      setEndTime(minutesToHhMm(prefill.time, Number.parseInt(prefill.duration, 10) || 0));
    } else {
      setEndTime("");
    }
    setTimePickerTarget(null);
    setDurationPickerOpen(false);
    setNextDatePickerOpen(false);
    setVaccinationDatePickerOpen(false);
    setVaccinationReminderDatePickerOpen(false);
    setSideDurationTarget(null);
    setAddingIngredient(false);
    setNewIngredientName("");
    setIngredientError("");
  }, [visible, catKey, prefill, settings.units.medicationDefaultUnit, settings.units.temperature, settings.units.volume]);

  useEffect(() => {
    if (!visible || catKey !== "med" || prefill?.editId || doseUnitTouched || !medName.trim()) return;
    const normalizedName = medName.trim().toLocaleLowerCase();
    const recent = [...logs]
      .filter((entry) => {
        if (entry.cat !== "med") return false;
        const savedName = entry.medicationName ?? entry.notes?.split(" · ")[0];
        return savedName?.trim().toLocaleLowerCase() === normalizedName;
      })
      .sort((a, b) => `${b.dateKey ?? ""} ${b.time}`.localeCompare(`${a.dateKey ?? ""} ${a.time}`))[0];
    const recentDose = recent?.doseUnit || parseMedicationDose(recent?.doseText ?? recent?.amount)?.unit;
    if (!recentDose) return;
    if (MEDICATION_DOSE_UNITS.includes(recentDose)) {
      setDoseUnit(recentDose);
      setCustomDoseUnit("");
    } else {
      setDoseUnit(CUSTOM_DOSE_UNIT);
      setCustomDoseUnit(recentDose);
    }
  }, [catKey, doseUnitTouched, logs, medName, prefill?.editId, visible]);

  const computedDuration = useMemo(() => {
    if (!isValidClockInput(endTime) || !isValidClockInput(time)) return duration;
    return String(elapsedClockMinutes(time, endTime));
  }, [endTime, time, duration]);

  const durationMinutes = Number.parseInt(computedDuration || duration, 10);
  const durationValue = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null;
  const leftDurationValue = Number.parseInt(leftDuration, 10) || null;
  const rightDurationValue = Number.parseInt(rightDuration, 10) || null;
  const sideDurationTotal = (leftDurationValue ?? 0) + (rightDurationValue ?? 0);
  const sideAmountTotal = (Number.parseFloat(leftAmount) || 0) + (Number.parseFloat(rightAmount) || 0);
  const resolvedAmountUnit = amountUnit === CUSTOM_AMOUNT_UNIT ? customAmountUnit.trim() : amountUnit;
  const hasValidAmount = isPositiveAmount(amount) && Boolean(resolvedAmountUnit);
  const hasValidLeftAmount = isPositiveAmount(leftAmount) && Boolean(resolvedAmountUnit);
  const hasValidRightAmount = isPositiveAmount(rightAmount) && Boolean(resolvedAmountUnit);
  const convertibleVolumeUnit = resolvedAmountUnit === "ml" || resolvedAmountUnit === "oz" ? resolvedAmountUnit : null;
  const storedMilkConsumedMl = convertibleVolumeUnit && isPositiveAmount(amount) ? Number.parseFloat(volumeToMl(amount, convertibleVolumeUnit)) || 0 : 0;
  const editingStoredMilkMl = prefill?.editId && prefill.cat === "storedMilk" ? Number.parseFloat(prefill.amount ?? "0") || 0 : 0;
  const storedMilkEstimatedRemainingMl = storedMilkEstimatedAvailableMl == null
    ? undefined
    : Math.max(0, storedMilkEstimatedAvailableMl + editingStoredMilkMl - storedMilkConsumedMl);
  const nextAtMatch = /(?:^|\s)(\d{1,2}):(\d{2})$/.exec(nextAt.trim());
  const nextAtTime = nextAtMatch ? formatHHmm(Number(nextAtMatch[1]), Number(nextAtMatch[2])) : "";
  const nextAtDate = nextAtMatch ? nextAt.slice(0, nextAtMatch.index).trim() : nextAt;
  const customReminderMatch = /(?:^|\s)(\d{1,2}):(\d{2})$/.exec(vaccinationCustomReminderAt.trim());
  const customReminderTime = customReminderMatch ? formatHHmm(Number(customReminderMatch[1]), Number(customReminderMatch[2])) : "";
  const customReminderDate = customReminderMatch ? vaccinationCustomReminderAt.slice(0, customReminderMatch.index).trim() : vaccinationCustomReminderAt;
  const normalizedDoseValue = doseValue.trim().replace(",", ".");
  const resolvedDoseUnit = doseUnit === CUSTOM_DOSE_UNIT ? customDoseUnit.trim() : doseUnit;
  const numericDoseValue = Number.parseFloat(normalizedDoseValue);
  const hasStructuredDose = /^(?:\d+\.?\d*|\.\d+)$/.test(normalizedDoseValue)
    && Number.isFinite(numericDoseValue)
    && numericDoseValue > 0
    && Boolean(resolvedDoseUnit);
  const medicationDoseText = hasStructuredDose
    ? `${normalizedDoseValue} ${resolvedDoseUnit}`
    : legacyDoseText.trim();
  const ingredientNames = useMemo(() => {
    const all = [...STARTER_INGREDIENTS, ...foodIngredients.map((item) => item.name)];
    for (const entry of logs) {
      if (entry.cat !== "food" && entry.cat !== "snack") continue;
      if (Array.isArray(entry.ingredients)) all.push(...entry.ingredients);
      else {
        const legacyNames = (entry.notes?.split(" · ")[0] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        all.push(...legacyNames);
      }
    }
    const unique = [...new Map(all.filter(Boolean).map((name) => [name.toLocaleLowerCase(), name])).values()];
    return unique.sort((a, b) => {
      const aHistory = ingredientHistory(a);
      const bHistory = ingredientHistory(b);
      return (bHistory.lastDate ?? "").localeCompare(aHistory.lastDate ?? "") || bHistory.count - aHistory.count;
    });
  // History is intentionally recalculated from current care logs when the sheet opens/updates.
  }, [foodIngredients, logs]);

  function ingredientHistory(name: string) {
    const key = name.toLocaleLowerCase();
    const matches = logs.filter((entry) => {
      if (entry.id === prefill?.editId) return false;
      if (entry.cat !== "food" && entry.cat !== "snack") return false;
      const names = Array.isArray(entry.ingredients)
        ? entry.ingredients
        : (entry.notes?.split(" · ")[0] ?? "").split(",").map((item) => item.trim());
      return names.some((item) => item.toLocaleLowerCase() === key);
    });
    const sorted = [...matches].sort((a, b) => (b.dateKey ?? "").localeCompare(a.dateKey ?? ""));
    return {
      count: matches.length,
      lastDate: sorted[0]?.dateKey,
      hasMemo: matches.some((entry) => Boolean(entry.notes?.split(" · ").slice(1).join(" · ").trim() || entry.chip)),
    };
  }

  function formatIngredientDate(dateKey?: string) {
    if (!dateKey) return "날짜 없음";
    const [, month, day] = dateKey.split("-").map(Number);
    return Number.isFinite(month) && Number.isFinite(day) ? `${month}월 ${day}일` : dateKey;
  }

  const confirmTimePicker = (valueHHmm: string) => {
    const target = timePickerTarget;
    setTimePickerTarget(null);
    setTimeError("");
    if (target === "nextAt") {
      setNextAt([nextAtDate, valueHHmm].filter(Boolean).join(" "));
    } else if (target === "vaccinationReminder") {
      setVaccinationCustomReminderAt([customReminderDate, valueHHmm].filter(Boolean).join(" "));
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
  const pregnancyCat = builtinId ? isPregnancyLogCategoryId(builtinId) : false;
  const isEdit = Boolean(prefill?.editId);

  const confirmDelete = () => {
    const editId = prefill?.editId;
    if (!editId || !onDelete) return;
    Alert.alert("기록 삭제", "이 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => onDelete(editId) },
    ]);
  };

  const handleSave = () => {
    if (!isValidClockInput(time) || (endTime && !isValidClockInput(endTime))) {
      setTimeError("시간을 00:00부터 23:59 사이로 입력해 주세요.");
      return;
    }
    setTimeError("");
    if (builtinId === "diaper" && !["소변", "대변", "소변+대변"].includes(chip)) {
      setDiaperError("소변, 대변 또는 소변+대변 중 하나를 선택해 주세요.");
      return;
    }
    setDiaperError("");
    if ((builtinId === "formula" || builtinId === "storedMilk") && !hasValidAmount) {
      setFeedingAmountError("0보다 큰 값과 단위를 함께 입력해 주세요.");
      return;
    }
    if ((builtinId === "water" || builtinId === "milk") && !hasValidAmount) {
      Alert.alert("양을 확인해 주세요", "0보다 큰 값과 단위를 함께 입력해 주세요.");
      return;
    }
    if (builtinId === "pump" && ((leftAmount && !hasValidLeftAmount) || (rightAmount && !hasValidRightAmount))) {
      Alert.alert("유축량을 확인해 주세요", "값과 단위를 함께 입력해 주세요.");
      return;
    }
    setFeedingAmountError("");
    if ((builtinId === "food" || builtinId === "snack") && !selectedIngredients.length && !notes.trim()) {
      setIngredientError("재료를 하나 이상 선택하거나 메모를 입력해 주세요.");
      return;
    }
    setIngredientError("");
    if (builtinId === "temp" && !(Number.parseFloat(amount) > 0)) {
      Alert.alert("온도를 입력해 주세요", "측정한 체온을 숫자로 입력해 주세요.");
      return;
    }
    if (builtinId === "med" && (!medicationType || !medName.trim() || !medicationStatus || !medicationDoseText)) {
      Alert.alert("투약 정보를 확인해 주세요", "약 종류, 약 이름, 0보다 큰 용량과 단위, 복용 상태를 입력해 주세요.");
      return;
    }
    if (builtinId === "med" && (doseValue || doseUnit) && !hasStructuredDose) {
      Alert.alert("용량을 확인해 주세요", "0보다 큰 숫자와 단위를 함께 입력해 주세요.");
      return;
    }
    if (builtinId === "doctor" && (!visitType || !recordTitle.trim() || !details.trim())) {
      Alert.alert("진료 정보를 확인해 주세요", "방문 유형, 병원 이름과 진료 내용을 입력해 주세요.");
      return;
    }
    if ((medicationReminderEnabled || cautionReminderEnabled) && (!nextAtDate || !nextAtTime)) {
      Alert.alert("알림 시간을 확인해 주세요", "알림을 사용하려면 날짜와 시간을 모두 선택해 주세요.");
      return;
    }
    if (builtinId === "memo" && !notes.trim()) {
      Alert.alert("메모를 입력해 주세요");
      return;
    }
    if (builtinId === "other" && !recordTitle.trim()) {
      Alert.alert("기록 이름을 입력해 주세요");
      return;
    }
    if (builtinId === "vaccination" && (!vaccineName.trim() || !vaccinationRound || (vaccinationRound === "other" && !vaccinationRoundText.trim()))) {
      Alert.alert("예방접종 정보를 확인해 주세요", "백신 이름과 접종 회차를 입력해 주세요.");
      return;
    }
    if (builtinId === "vaccination" && injectionSite === "other" && !injectionSiteText.trim()) {
      Alert.alert("접종 부위를 입력해 주세요");
      return;
    }
    if (builtinId === "vaccination" && vaccinationReminderSetting !== "none" && (!nextAtDate || !nextAtTime)) {
      Alert.alert("다음 접종 일정을 확인해 주세요", "알림을 사용하려면 다음 접종 날짜와 시간을 모두 선택해 주세요.");
      return;
    }
    if (builtinId === "vaccination" && vaccinationReminderSetting === "custom" && (!customReminderDate || !customReminderTime)) {
      Alert.alert("직접 알림 시간을 확인해 주세요", "알림 날짜와 시간을 모두 선택해 주세요.");
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
      isFood && selectedIngredients.length ? selectedIngredients.join(", ") : null,
      notes.trim() || null,
    ]
      .filter(Boolean)
      .join(" · ");
    const canonicalAmount =
      (LIQUID_CATEGORIES as readonly string[]).includes(effectiveCat)
        ? convertibleVolumeUnit ? volumeToMl(amount, convertibleVolumeUnit) : amount
        : effectiveCat === "temp"
          ? temperatureToCelsius(amount, settings.units.temperature)
          : effectiveCat === "med"
            ? medicationDoseText
            : amount;
    const canonicalLeftAmount = leftAmount ? convertibleVolumeUnit ? volumeToMl(leftAmount, convertibleVolumeUnit) : leftAmount : "";
    const canonicalRightAmount = rightAmount ? convertibleVolumeUnit ? volumeToMl(rightAmount, convertibleVolumeUnit) : rightAmount : "";
    const sideTotalDuration = sideDurationTotal ? String(sideDurationTotal) : "";
    const finalDuration = ["breast", "pump"].includes(effectiveCat)
      ? sideTotalDuration || timedDuration
      : timedDuration;
    const finalAmount = effectiveCat === "pump" && sideAmountTotal > 0
      ? convertibleVolumeUnit ? volumeToMl(String(sideAmountTotal), convertibleVolumeUnit) : String(sideAmountTotal)
      : canonicalAmount;
    const diaperType = builtinId === "diaper" ? chip : "";
    if (!activeBabyId) {
      Alert.alert("아기를 선택해 주세요", "기록할 아기를 선택한 뒤 다시 시도해 주세요.");
      return;
    }
    const entryToSave: Omit<BabyLogEntry, "id"> = {
        babyId: activeBabyId,
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
            : finalAmount || undefined,
        amountValue: (LIQUID_CATEGORIES as readonly string[]).includes(effectiveCat) && amount ? amount : undefined,
        amountUnit: (LIQUID_CATEGORIES as readonly string[]).includes(effectiveCat) && amount ? resolvedAmountUnit || undefined : undefined,
        amountText: (LIQUID_CATEGORIES as readonly string[]).includes(effectiveCat) && amount && resolvedAmountUnit ? `${amount} ${resolvedAmountUnit}` : undefined,
        duration: finalDuration || undefined,
        feedingMethod: effectiveCat === "breast" ? feedingMethod : undefined,
        leftDuration: ["breast", "pump"].includes(effectiveCat) ? leftDuration || undefined : undefined,
        rightDuration: ["breast", "pump"].includes(effectiveCat) ? rightDuration || undefined : undefined,
        leftAmount: effectiveCat === "pump" ? canonicalLeftAmount || undefined : undefined,
        rightAmount: effectiveCat === "pump" ? canonicalRightAmount || undefined : undefined,
        leftAmountValue: effectiveCat === "pump" && leftAmount ? leftAmount : undefined,
        leftAmountUnit: effectiveCat === "pump" && leftAmount ? resolvedAmountUnit || undefined : undefined,
        leftAmountText: effectiveCat === "pump" && leftAmount && resolvedAmountUnit ? `${leftAmount} ${resolvedAmountUnit}` : undefined,
        rightAmountValue: effectiveCat === "pump" && rightAmount ? rightAmount : undefined,
        rightAmountUnit: effectiveCat === "pump" && rightAmount ? resolvedAmountUnit || undefined : undefined,
        rightAmountText: effectiveCat === "pump" && rightAmount && resolvedAmountUnit ? `${rightAmount} ${resolvedAmountUnit}` : undefined,
        burped: effectiveCat === "breast" ? burped : undefined,
        spitUp: ["breast", "formula", "storedMilk"].includes(effectiveCat) ? spitUp : undefined,
        supplement: ["formula", "storedMilk"].includes(effectiveCat) ? supplement.trim() || undefined : undefined,
        feedingNote: effectiveCat === "breast" ? feedingNote || undefined : undefined,
        ingredients: isFood ? selectedIngredients : undefined,
        notes: composedNotes || undefined,
        title: recordTitle.trim() || undefined,
        details: details.trim() || undefined,
        nextAt: nextAt.trim() || undefined,
        medicationType: isMed ? medicationType || undefined : undefined,
        medicationName: isMed ? medName.trim() || undefined : undefined,
        medicationStatus: isMed ? medicationStatus || undefined : undefined,
        doseValue: isMed && hasStructuredDose ? normalizedDoseValue : undefined,
        doseUnit: isMed && hasStructuredDose ? resolvedDoseUnit : undefined,
        doseText: isMed ? medicationDoseText || undefined : undefined,
        medicationReminderEnabled: isMed ? medicationReminderEnabled : undefined,
        visitType: builtinId === "doctor" ? visitType : undefined,
        doctorName: builtinId === "doctor" ? doctorName.trim() || undefined : undefined,
        cautions: builtinId === "doctor" ? cautions.trim() || undefined : undefined,
        cautionReminderEnabled: builtinId === "doctor" ? cautionReminderEnabled : undefined,
        vaccineName: builtinId === "vaccination" ? vaccineName.trim() : undefined,
        vaccinationRound: builtinId === "vaccination" ? vaccinationRound : undefined,
        vaccinationRoundText: builtinId === "vaccination" && vaccinationRound === "other" ? vaccinationRoundText.trim() || undefined : undefined,
        vaccinationHospitalName: builtinId === "vaccination" ? vaccinationHospitalName.trim() || undefined : undefined,
        vaccinationDoctorName: builtinId === "vaccination" ? vaccinationDoctorName.trim() || undefined : undefined,
        injectionSite: builtinId === "vaccination" ? injectionSite : undefined,
        injectionSiteText: builtinId === "vaccination" && injectionSite === "other" ? injectionSiteText.trim() || undefined : undefined,
        aftercareNotes: builtinId === "vaccination" && aftercareNotes.length ? aftercareNotes : undefined,
        vaccinationReminderSetting: builtinId === "vaccination" ? vaccinationReminderSetting : undefined,
        vaccinationCustomReminderAt: builtinId === "vaccination" && vaccinationReminderSetting === "custom" ? vaccinationCustomReminderAt || undefined : undefined,
        voice,
        source: prefill?.source ?? (voice ? "voice" : "manual"),
        rawTranscript: prefill?.rawTranscript,
        confidence: prefill?.confidence,
        flags: prefill?.flags,
        createdBy: prefill?.createdBy,
        dateKey: builtinId === "vaccination" ? vaccinationDateKey : prefill?.dateKey,
      };
    const commit = () => {
      onSave(entryToSave, prefill?.editId);
      onClose();
    };
    const matchedFoods = isFood ? matchCautionFoods(selectedIngredients, cautionFoods) : [];
    if (matchedFoods.length) {
      Alert.alert(
        "주의 식품이 포함되어 있어요",
        `${matchedFoods.join(", ")}은(는) ${babyName}의 주의 식품으로 등록되어 있어요. 그래도 기록할까요?`,
        [{ text: "취소", style: "cancel" }, { text: "기록하기", onPress: commit }],
      );
      return;
    }
    commit();
  };

  const sheet = (
    <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
            {c.label} 기록 {isEdit ? "수정" : "추가"}
          </Text>
          {sessionLabel ? <Text style={styles.sessionBadge}>{sessionLabel}</Text> : null}
        </View>
        <Text style={styles.activeBabyLabel}>기록 대상 · {babyName}</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(builtinId === "breast" || builtinId === "formula" || builtinId === "storedMilk") && (
            <>
              {builtinId === "breast" ? (
                <>
                  <DurationPickerField label="왼쪽 시간" valueMinutes={leftDurationValue} onPress={() => setSideDurationTarget("left")} />
                  <DurationPickerField label="오른쪽 시간" valueMinutes={rightDurationValue} onPress={() => setSideDurationTarget("right")} />
                  <View style={styles.calculatedCard}>
                    <Text style={styles.calculatedLabel}>총 수유 시간</Text>
                    <Text style={styles.calculatedValue}>{sideDurationTotal || durationValue || 0}분</Text>
                  </View>
                </>
              ) : null}
              {builtinId !== "breast" ? (
                <>
                  <AmountInput label="먹은 양" value={amount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={(value) => { setAmount(value); setFeedingAmountError(""); }} onChangeUnit={(unit) => { setAmountUnit(unit); setFeedingAmountError(""); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} error={feedingAmountError || undefined} />
                  <DurationPickerField label="소요 시간 (선택)" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
                  <Text style={styles.fieldLabel}>영양제 (선택)</Text>
                  <TextInput style={styles.input} value={supplement} onChangeText={setSupplement} placeholder="예: 비타민D" placeholderTextColor={colors.faint} />
                </>
              ) : null}
              {builtinId === "breast" ? (
                <>
                  <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
                  <TimeOfDayPickerField label="종료 시간" valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>게워냄 여부</Text>
              <ChipRow options={["있었어요", "없었어요"]} value={spitUp === "yes" ? "있었어요" : spitUp === "no" ? "없었어요" : ""} onChange={(value) => setSpitUp(value === "있었어요" ? "yes" : value === "없었어요" ? "no" : undefined)} />
              {builtinId === "breast" ? (
                <>
                  <Text style={styles.fieldLabel}>트림 여부</Text>
                  <ChipRow options={["했어요", "안 했어요"]} value={burped === "yes" ? "했어요" : burped === "no" ? "안 했어요" : ""} onChange={(value) => setBurped(value === "했어요" ? "yes" : value === "안 했어요" ? "no" : undefined)} />
                  <Text style={styles.fieldLabel}>수유 메모 (선택)</Text>
                  <ChipRow options={["졸려했어요", "잘 먹었어요", "조금 먹었어요", "보챘어요", "기타"]} value={feedingNote} onChange={setFeedingNote} />
                </>
              ) : null}
              {builtinId === "storedMilk" ? (
                storedMilkEstimatedRemainingMl == null ? (
                  <Text style={styles.readOnlyHint}>저장 모유 재고 관리는 후속 기능으로 준비 중이에요.</Text>
                ) : (
                  <View style={styles.estimatedStockCard}>
                    <Text style={styles.calculatedLabel}>예상 남은 양</Text>
                    <Text style={styles.calculatedValue}>{formatVolume(String(storedMilkEstimatedRemainingMl), settings.units.volume)}</Text>
                    <Text style={styles.estimatedStockHint}>기존 유축 기록과 입력한 먹은 양을 기준으로 계산한 예상이에요.</Text>
                  </View>
                )
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
              <ChipRow
                options={["소변", "대변", "소변+대변"]}
                value={chip}
                onChange={(value) => { setChip(value); setDiaperError(""); }}
              />
              {diaperError ? <Text style={styles.inputError}>{diaperError}</Text> : null}
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
              <Text style={styles.fieldLabel}>{builtinId === "snack" ? "재료/음식 선택" : "재료 선택"}</Text>
              <View style={styles.ingredientGrid}>
                {ingredientNames.map((name) => {
                  const selected = selectedIngredients.includes(name);
                  const history = ingredientHistory(name);
                  return (
                    <Pressable
                      key={name}
                      style={[styles.ingredientChip, selected && styles.ingredientChipSelected]}
                      onPress={() => {
                        setIngredientError("");
                        setSelectedIngredients((current) => selected ? current.filter((item) => item !== name) : [...current, name]);
                      }}
                    >
                      <Text style={[styles.ingredientName, selected && styles.ingredientNameSelected]}>{name}</Text>
                      <Text style={[styles.ingredientHistory, selected && styles.ingredientHistorySelected]}>{history.count ? `지난 기록 ${history.count}회` : "처음 기록"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {addingIngredient ? (
                <View style={styles.newIngredientRow}>
                  <TextInput
                    style={[styles.input, styles.newIngredientInput]}
                    value={newIngredientName}
                    onChangeText={(value) => { setNewIngredientName(value); setIngredientError(""); }}
                    maxLength={30}
                    placeholder="재료명 입력"
                    placeholderTextColor={colors.faint}
                    autoFocus
                  />
                  <Pressable
                    style={styles.newIngredientSave}
                    onPress={() => {
                      const clean = newIngredientName.trim().replace(/\s+/g, " ");
                      if (!clean) { setIngredientError("재료명을 입력해 주세요."); return; }
                      const existing = ingredientNames.find((name) => name.toLocaleLowerCase() === clean.toLocaleLowerCase());
                      if (existing) {
                        setSelectedIngredients((current) => current.includes(existing) ? current : [...current, existing]);
                        setIngredientError("이미 있는 재료를 선택했어요.");
                        setNewIngredientName("");
                        setAddingIngredient(false);
                        return;
                      }
                      const created = onAddFoodIngredient?.(clean, builtinId === "snack" ? "snack" : "baby_food");
                      if (!created) { setIngredientError("재료를 추가하지 못했어요."); return; }
                      setSelectedIngredients((current) => [...current, created.name]);
                      setNewIngredientName("");
                      setAddingIngredient(false);
                    }}
                  >
                    <Text style={styles.newIngredientSaveText}>추가</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.addIngredientButton} onPress={() => setAddingIngredient(true)}>
                  <Text style={styles.addIngredientText}>+ 새 재료 추가</Text>
                </Pressable>
              )}
              {ingredientError ? <Text style={styles.inputError}>{ingredientError}</Text> : null}
              {selectedIngredients.map((name) => {
                const history = ingredientHistory(name);
                return (
                  <View key={`history-${name}`} style={styles.historyRow}>
                    <Text style={styles.historyName}>{name}</Text>
                    <Text style={styles.historyText}>
                      {history.count === 0 ? "처음 기록하는 재료예요." : `총 ${history.count}회 · 최근 ${formatIngredientDate(history.lastDate)}${history.hasMemo ? " · 메모 있음" : ""}`}
                    </Text>
                  </View>
                );
              })}
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
            </>
          )}

          {(builtinId === "pump") && (
            <>
              <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <TimeOfDayPickerField label="종료 시간" valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
              <DurationPickerField label="왼쪽 시간" valueMinutes={leftDurationValue} onPress={() => setSideDurationTarget("left")} />
              <DurationPickerField label="오른쪽 시간" valueMinutes={rightDurationValue} onPress={() => setSideDurationTarget("right")} />
              <AmountInput label="왼쪽 유축량" value={leftAmount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setLeftAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
              <AmountInput label="오른쪽 유축량" value={rightAmount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setRightAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
              <View style={styles.calculatedRow}>
                <View style={styles.calculatedCard}><Text style={styles.calculatedLabel}>총 시간</Text><Text style={styles.calculatedValue}>{sideDurationTotal || durationValue || 0}분</Text></View>
                <View style={styles.calculatedCard}><Text style={styles.calculatedLabel}>총 유축량</Text><Text style={styles.calculatedValue}>{sideAmountTotal}{resolvedAmountUnit ? ` ${resolvedAmountUnit}` : ""}</Text></View>
              </View>
            </>
          )}

          {(builtinId === "water" || builtinId === "milk") && (
            <AmountInput label="양" value={amount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
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
              <Text style={styles.fieldLabel}>약 종류</Text>
              <LabeledChipRow
                options={[
                  { value: "medicine", label: "의약품" },
                  { value: "supplement", label: "영양제" },
                  { value: "ointment", label: "연고" },
                  { value: "eye_drop", label: "안약" },
                  { value: "other", label: "기타" },
                ]}
                value={medicationType}
                onChange={setMedicationType}
              />
              <Text style={styles.fieldLabel}>약 이름</Text>
              <TextInput
                style={styles.input}
                value={medName}
                onChangeText={setMedName}
                placeholder="예: 비타민D"
                placeholderTextColor={colors.faint}
              />
              <AmountInput label="용량" value={doseValue} unit={doseUnit} unitOptions={MEDICATION_DOSE_UNITS} customUnit={customDoseUnit} onChangeValue={(value) => { setDoseValue(value); setLegacyDoseText(""); }} onChangeUnit={(value) => { setDoseUnit(value); setDoseUnitTouched(true); setLegacyDoseText(""); if (value !== CUSTOM_DOSE_UNIT) setCustomDoseUnit(""); }} onChangeCustomUnit={(value) => { setCustomDoseUnit(value); setDoseUnitTouched(true); setLegacyDoseText(""); }} />
              {legacyDoseText ? (
                <View style={styles.legacyDoseCard}>
                  <Text style={styles.legacyDoseLabel}>기존 용량 기록</Text>
                  <Text style={styles.legacyDoseValue}>{legacyDoseText}</Text>
                  <Text style={styles.legacyDoseHint}>기존 값을 그대로 저장하거나 새 용량과 단위를 입력할 수 있어요.</Text>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>복용 상태</Text>
              <LabeledChipRow
                options={[
                  { value: "given", label: "복용 완료" },
                  { value: "partial", label: "일부 복용" },
                  { value: "refused", label: "복용 안 함" },
                ]}
                value={medicationStatus}
                onChange={setMedicationStatus}
              />
              <TimeOfDayPickerField label="시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DatePickerField label="다음 투약 날짜 (선택)" valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label="다음 투약 시간 (선택)" valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>다음 투약 알림</Text>
                  <Text style={styles.toggleBody}>다음 투약 날짜와 시간이 있을 때 알림 요청을 저장해요.</Text>
                </View>
                <Switch value={medicationReminderEnabled} onValueChange={setMedicationReminderEnabled} disabled={!nextAtDate || !nextAtTime} trackColor={{ false: colors.border, true: colors.amber }} />
              </View>
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
              <Text style={styles.fieldLabel}>측정 부위 (선택)</Text>
              <ChipRow options={["겨드랑이", "귀", "이마", "구강"]} value={chip} onChange={setChip} />
            </>
          )}

          {builtinId === "vaccination" && (
            <>
              <Text style={styles.fieldLabel}>백신 이름</Text>
              <TextInput style={styles.input} value={vaccineName} onChangeText={setVaccineName} placeholder="예: B형간염, DTaP, Hib, 폐렴구균" placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>접종 회차</Text>
              <LabeledChipRow options={[
                { value: "first", label: "1차" }, { value: "second", label: "2차" }, { value: "third", label: "3차" }, { value: "booster", label: "추가" }, { value: "other", label: "기타" },
              ]} value={vaccinationRound ?? ""} onChange={(value) => setVaccinationRound(value as BabyLogEntry["vaccinationRound"] || undefined)} />
              {vaccinationRound === "other" ? <TextInput style={[styles.input, { marginTop: 8 }]} value={vaccinationRoundText} onChangeText={setVaccinationRoundText} placeholder="회차를 입력해 주세요" placeholderTextColor={colors.faint} /> : null}
              <DatePickerField label="접종일" valueDateKey={vaccinationDateKey} onPress={() => setVaccinationDatePickerOpen(true)} />
              <TimeOfDayPickerField label="접종 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <Text style={styles.fieldLabel}>병원 이름 (선택)</Text>
              <TextInput style={styles.input} value={vaccinationHospitalName} onChangeText={setVaccinationHospitalName} placeholder="예: ○○소아과" placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>의사 이름 (선택)</Text>
              <TextInput style={styles.input} value={vaccinationDoctorName} onChangeText={setVaccinationDoctorName} placeholder="의사 이름" placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>접종 부위 (선택)</Text>
              <LabeledChipRow options={[
                { value: "left_thigh", label: "왼쪽 허벅지" }, { value: "right_thigh", label: "오른쪽 허벅지" }, { value: "left_arm", label: "왼쪽 팔" }, { value: "right_arm", label: "오른쪽 팔" }, { value: "other", label: "기타" },
              ]} value={injectionSite ?? ""} onChange={(value) => setInjectionSite(value as BabyLogEntry["injectionSite"] || undefined)} />
              {injectionSite === "other" ? <TextInput style={[styles.input, { marginTop: 8 }]} value={injectionSiteText} onChangeText={setInjectionSiteText} placeholder="접종 부위를 입력해 주세요" placeholderTextColor={colors.faint} /> : null}
              <Text style={styles.fieldLabel}>접종 후 메모 (선택)</Text>
              <View style={styles.chipRow}>
                {["미열", "붓기", "보챔", "평소와 같음", "잘 먹음", "잠이 많음"].map((item) => {
                  const selected = aftercareNotes.includes(item);
                  return <Pressable key={item} style={[styles.chip, selected && styles.chipSel]} onPress={() => setAftercareNotes((current) => selected ? current.filter((value) => value !== item) : [...current, item])}><Text style={[styles.chipText, selected && styles.chipTextSel]}>{item}</Text></Pressable>;
                })}
              </View>
              <DatePickerField label="다음 접종 날짜 (선택)" valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label="다음 접종 시간 (선택)" valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <Text style={styles.fieldLabel}>다음 접종 알림</Text>
              <LabeledChipRow options={[
                { value: "none", label: "없음" }, { value: "one_day_before", label: "하루 전" }, { value: "three_days_before", label: "3일 전" }, { value: "custom", label: "직접 설정" },
              ]} value={vaccinationReminderSetting ?? "none"} onChange={(value) => {
                const next = (value || "none") as BabyLogEntry["vaccinationReminderSetting"];
                if (next !== "none" && (!nextAtDate || !nextAtTime)) {
                  Alert.alert("다음 접종 일정을 먼저 선택해 주세요");
                  return;
                }
                setVaccinationReminderSetting(next);
              }} />
              {!nextAtDate || !nextAtTime ? <Text style={styles.readOnlyHint}>다음 접종 날짜와 시간을 선택하면 알림 옵션을 사용할 수 있어요.</Text> : null}
              {vaccinationReminderSetting === "custom" ? (
                <>
                  <DatePickerField label="알림 날짜" valueDateKey={customReminderDate} onPress={() => setVaccinationReminderDatePickerOpen(true)} />
                  <TimeOfDayPickerField label="알림 시간" valueHHmm={customReminderTime} onPress={() => setTimePickerTarget("vaccinationReminder")} />
                </>
              ) : null}
            </>
          )}

          {builtinId === "doctor" && (
            <>
              <Text style={styles.fieldLabel}>방문 유형</Text>
              <View style={styles.chipRow}>
                {(["checkup", "illness"] as const).map((option) => (
                  <Pressable key={option} style={[styles.chip, visitType === option && styles.chipSel]} onPress={() => setVisitType(visitType === option ? undefined : option)}>
                    <Text style={[styles.chipText, visitType === option && styles.chipTextSel]}>{option === "checkup" ? "검진" : "질환"}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>병원 이름</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder="예: 다린소아과"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>의사 이름</Text>
              <TextInput
                style={styles.input}
                value={doctorName}
                onChangeText={setDoctorName}
                placeholder="예: 김다린 선생님"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{visitType === "illness" ? "질환 또는 증상 이름" : "검진 내용"}</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={details}
                onChangeText={setDetails}
                multiline
                placeholder={visitType === "illness" ? "질환명이나 증상을 입력하세요" : "검진 내용을 입력하세요"}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>주의해야 할 점</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={cautions}
                onChangeText={setCautions}
                multiline
                placeholder="의료진에게 안내받은 주의사항을 기록하세요"
                placeholderTextColor={colors.faint}
              />
              <TimeOfDayPickerField label="진료 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DatePickerField label="다음 예약 날짜 (선택)" valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label="다음 예약 시간 (선택)" valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>주의사항 확인 알림</Text>
                  <Text style={styles.toggleBody}>다음 예약 날짜와 시간이 있을 때 알림 요청을 저장해요.</Text>
                </View>
                <Switch value={cautionReminderEnabled} onValueChange={setCautionReminderEnabled} disabled={!nextAtDate || !nextAtTime} trackColor={{ false: colors.border, true: colors.amber }} />
              </View>
            </>
          )}

          {builtinId === "other" && (
            <>
              <Text style={styles.fieldLabel}>기록 이름</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder="예: 발진, 토함, 마사지"
                placeholderTextColor={colors.faint}
              />
              <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DurationPickerField label="지속 시간 (선택)" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId === "memo" && (
            <>
              <Text style={styles.fieldLabel}>제목 (선택)</Text>
              <TextInput style={styles.input} value={recordTitle} onChangeText={setRecordTitle} placeholder="메모 제목" placeholderTextColor={colors.faint} />
              <TimeOfDayPickerField label="시작 시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DurationPickerField label="지속 시간 (선택)" valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId !== "sleep" && builtinId !== "breast" && builtinId !== "pump" && builtinId !== "med" && builtinId !== "doctor" && builtinId !== "vaccination" && builtinId !== "memo" && builtinId !== "other" && !(c.isCustom && (c.inputMode ?? "memo") === "duration") && (
            <TimeOfDayPickerField label="시간" valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
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
          ) : pregnancyCat ? (
            <>
              {c.chips ? (
                <>
                  <Text style={styles.fieldLabel}>상태</Text>
                  <ChipRow options={c.chips} value={chip} onChange={setChip} />
                </>
              ) : null}
              {c.amount ? (
                <>
                  <Text style={styles.fieldLabel}>{builtinId === "pregWeight" ? "체중 (kg)" : builtinId === "pregBp" ? "혈압" : `양 (${c.amount})`}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType={builtinId === "pregBp" ? "default" : "numeric"}
                    placeholder={builtinId === "pregWeight" ? "예: 62.4" : builtinId === "pregBp" ? "예: 120/80" : "예: 150"}
                    placeholderTextColor={colors.faint}
                  />
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
            <Pressable
              style={styles.deleteBtn}
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel="이 기록 삭제하기"
            >
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
        valueHHmm={timePickerTarget === "end" ? endTime : timePickerTarget === "nextAt" ? nextAtTime : timePickerTarget === "vaccinationReminder" ? customReminderTime : time}
        title={timePickerTarget === "end" ? "종료 시간" : timePickerTarget === "nextAt" ? (builtinId === "med" ? "다음 투약 시간" : builtinId === "vaccination" ? "다음 접종 시간" : "다음 예약 시간") : timePickerTarget === "vaccinationReminder" ? "알림 시간" : "시간 선택"}
        onCancel={() => setTimePickerTarget(null)}
        onConfirm={confirmTimePicker}
        onClear={timePickerTarget === "end"
          ? () => { setEndTime(""); setDuration(""); setTimePickerTarget(null); }
          : timePickerTarget === "nextAt"
            ? () => { setNextAt(nextAtDate); setMedicationReminderEnabled(false); setCautionReminderEnabled(false); setVaccinationReminderSetting("none"); setVaccinationCustomReminderAt(""); setTimePickerTarget(null); }
            : undefined}
      />
      <DatePickerSheet
        visible={nextDatePickerOpen}
        valueDateKey={nextAtDate}
        title={builtinId === "med" ? "다음 투약 날짜" : builtinId === "vaccination" ? "다음 접종 날짜" : "다음 예약 날짜"}
        minYear={new Date().getFullYear() - 1}
        maxYear={new Date().getFullYear() + 10}
        onCancel={() => setNextDatePickerOpen(false)}
        onConfirm={(dateKey) => {
          setNextAt([dateKey, nextAtTime].filter(Boolean).join(" "));
          setNextDatePickerOpen(false);
        }}
        onClear={() => {
          setNextAt(nextAtTime);
          setMedicationReminderEnabled(false);
          setCautionReminderEnabled(false);
          setVaccinationReminderSetting("none");
          setVaccinationCustomReminderAt("");
          setNextDatePickerOpen(false);
        }}
      />
      <DatePickerSheet
        visible={vaccinationDatePickerOpen}
        valueDateKey={vaccinationDateKey}
        title="접종일 선택"
        minYear={1900}
        maxYear={new Date().getFullYear()}
        onCancel={() => setVaccinationDatePickerOpen(false)}
        onConfirm={(dateKey) => { setVaccinationDateKey(dateKey); setVaccinationDatePickerOpen(false); }}
      />
      <DatePickerSheet
        visible={vaccinationReminderDatePickerOpen}
        valueDateKey={customReminderDate}
        title="알림 날짜"
        minYear={new Date().getFullYear() - 1}
        maxYear={new Date().getFullYear() + 10}
        onCancel={() => setVaccinationReminderDatePickerOpen(false)}
        onConfirm={(dateKey) => { setVaccinationCustomReminderAt([dateKey, customReminderTime].filter(Boolean).join(" ")); setVaccinationReminderDatePickerOpen(false); }}
      />
      <DurationPickerSheet
        visible={durationPickerOpen}
        valueMinutes={durationValue}
        onCancel={() => setDurationPickerOpen(false)}
        onConfirm={confirmDurationPicker}
        onClear={() => { setDuration(""); setEndTime(""); setDurationPickerOpen(false); }}
      />
      <DurationPickerSheet
        visible={sideDurationTarget !== null}
        valueMinutes={sideDurationTarget === "left" ? leftDurationValue : rightDurationValue}
        title={sideDurationTarget === "left" ? "왼쪽 시간" : "오른쪽 시간"}
        maxMinutes={180}
        onCancel={() => setSideDurationTarget(null)}
        onConfirm={(minutes) => {
          if (sideDurationTarget === "left") setLeftDuration(String(minutes));
          if (sideDurationTarget === "right") setRightDuration(String(minutes));
          setSideDurationTarget(null);
        }}
        onClear={() => {
          if (sideDurationTarget === "left") setLeftDuration("");
          if (sideDurationTarget === "right") setRightDuration("");
          setSideDurationTarget(null);
        }}
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
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  activeBabyLabel: { marginTop: -4, marginBottom: 10, fontSize: 11.5, fontWeight: "700", color: colors.amberText },
  sessionBadge: { color: colors.amberText, fontSize: 10.5, fontWeight: "800", backgroundColor: colors.amberSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
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
  calculatedRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  calculatedCard: { flex: 1, marginTop: 14, minHeight: 54, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, justifyContent: "center" },
  calculatedLabel: { color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  calculatedValue: { marginTop: 3, color: colors.text, fontSize: 15, fontWeight: "800" },
  readOnlyHint: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  estimatedStockCard: { marginTop: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  estimatedStockHint: { marginTop: 3, color: colors.faint, fontSize: 10.5, lineHeight: 15 },
  ingredientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ingredientChip: { minWidth: 92, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 11, paddingVertical: 8, justifyContent: "center" },
  ingredientChipSelected: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  ingredientName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  ingredientNameSelected: { color: colors.amberText },
  ingredientHistory: { marginTop: 3, color: colors.faint, fontSize: 9.5, fontWeight: "600" },
  ingredientHistorySelected: { color: colors.amberText },
  addIngredientButton: { alignSelf: "flex-start", minHeight: 44, marginTop: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  addIngredientText: { color: colors.amberText, fontSize: 12.5, fontWeight: "800" },
  newIngredientRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  newIngredientInput: { flex: 1 },
  newIngredientSave: { minWidth: 58, minHeight: 44, borderRadius: 12, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  newIngredientSaveText: { color: colors.amberDark, fontSize: 13, fontWeight: "800" },
  historyRow: { marginTop: 8, borderRadius: 10, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  historyName: { color: colors.text, fontSize: 11.5, fontWeight: "800" },
  historyText: { marginTop: 2, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
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
  legacyDoseCard: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  legacyDoseLabel: { color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  legacyDoseValue: { marginTop: 3, color: colors.text, fontSize: 14, fontWeight: "800" },
  legacyDoseHint: { marginTop: 3, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
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
  growthLinkTitle: { color: colors.amberText, fontSize: 13.5, fontWeight: "800" },
  growthLinkBody: { color: colors.muted, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  growthLinkArrow: { color: colors.amberText, fontSize: 24, fontWeight: "400" },
  toggleRow: { minHeight: 58, marginTop: 14, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 12 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  toggleBody: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  deleteBtn: { paddingVertical: 10, marginTop: 8 },
  deleteText: { color: colors.dangerText, fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 8 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
});
