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
import { useLanguage } from "../../LanguageContext";
import {
  LEGACY_MEDICATION_DOSE_UNITS,
  RECORD_STORED_OPTIONS,
  RECORD_VALUE,
  STARTER_FOOD_INGREDIENTS,
} from "../../constants/recordInternalValues";
import { recordCategoryLabel, storedRecordValueLabel } from "../../utils/recordDisplay";

function normalizeDiaperChip(value: string): string {
  return value === RECORD_VALUE.diaperLegacyBoth || value === RECORD_VALUE.diaperLegacyBothSpaced ? RECORD_VALUE.diaperBoth : value;
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

const STARTER_INGREDIENTS = [...STARTER_FOOD_INGREDIENTS];
const MEDICATION_DOSE_UNITS = ["ml", "drop", ...LEGACY_MEDICATION_DOSE_UNITS, "g", "mg"];
const CUSTOM_DOSE_UNIT = CUSTOM_AMOUNT_UNIT;
const LIQUID_CATEGORIES = ["formula", "storedMilk", "pump", "water", "milk"] as const;

function parseMedicationDose(raw?: string): { value: string; unit: string } | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(\S(?:.*\S)?)\s*$/.exec(raw ?? "");
  if (!match) return null;
  return { value: match[1].replace(",", "."), unit: match[2] };
}

function normalizeMedicationType(value?: string): string {
  if (["medicine", "supplement", "ointment", "eye_drop", "other"].includes(value ?? "")) return value!;
  if (value === RECORD_VALUE.medicineSupplement) return "supplement";
  if (value === RECORD_VALUE.medicineOintment) return "ointment";
  if (value === RECORD_VALUE.medicineEyeDrop) return "eye_drop";
  return value ? "other" : "";
}

function normalizeMedicationStatus(value?: string): string {
  if (["given", "partial", "refused"].includes(value ?? "")) return value!;
  if (value === RECORD_VALUE.medicationGiven) return "given";
  if (value === RECORD_VALUE.medicationPartial) return "partial";
  if (value === RECORD_VALUE.medicationSkipped || value === RECORD_VALUE.medicationRefused) return "refused";
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
  getLabel = (option) => option,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  getLabel?: (option: string) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((ch) => (
        <Pressable
          key={ch}
          style={[styles.chip, value === ch && styles.chipSel]}
          onPress={() => onChange(value === ch ? "" : ch)}
        >
          <Text style={[styles.chipText, value === ch && styles.chipTextSel]}>{getLabel(ch)}</Text>
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
  const { t } = useLanguage();
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

  const storedOptionLabel = (option: string) => storedRecordValueLabel(t, option);

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
    if (!dateKey) return t("record.detail.dateNone");
    const [, month, day] = dateKey.split("-").map(Number);
    return Number.isFinite(month) && Number.isFinite(day) ? t("record.detail.monthDay", { month, day }) : dateKey;
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
    Alert.alert(t("record.detail.deleteTitle"), t("record.detail.deleteBody"), [
      { text: t("record.detail.cancel"), style: "cancel" },
      { text: t("record.detail.delete"), style: "destructive", onPress: () => onDelete(editId) },
    ]);
  };

  const handleSave = () => {
    if (!isValidClockInput(time) || (endTime && !isValidClockInput(endTime))) {
      setTimeError(t("record.detail.invalidTime"));
      return;
    }
    setTimeError("");
    if (builtinId === "diaper" && !(RECORD_STORED_OPTIONS.diaperType as readonly string[]).includes(chip)) {
      setDiaperError(t("record.detail.diaperRequired"));
      return;
    }
    setDiaperError("");
    if ((builtinId === "formula" || builtinId === "storedMilk") && !hasValidAmount) {
      setFeedingAmountError(t("record.detail.positiveValueUnit"));
      return;
    }
    if ((builtinId === "water" || builtinId === "milk") && !hasValidAmount) {
      Alert.alert(t("record.detail.amountCheckTitle"), t("record.detail.positiveValueUnit"));
      return;
    }
    if (builtinId === "pump" && ((leftAmount && !hasValidLeftAmount) || (rightAmount && !hasValidRightAmount))) {
      Alert.alert(t("record.detail.pumpCheckTitle"), t("record.detail.valueUnit"));
      return;
    }
    setFeedingAmountError("");
    if ((builtinId === "food" || builtinId === "snack") && !selectedIngredients.length && !notes.trim()) {
      setIngredientError(t("record.detail.ingredientRequired"));
      return;
    }
    setIngredientError("");
    if (builtinId === "temp" && !(Number.parseFloat(amount) > 0)) {
      Alert.alert(t("record.detail.temperatureTitle"), t("record.detail.temperatureBody"));
      return;
    }
    if (builtinId === "med" && (!medicationType || !medName.trim() || !medicationStatus || !medicationDoseText)) {
      Alert.alert(t("record.detail.medicationTitle"), t("record.detail.medicationBody"));
      return;
    }
    if (builtinId === "med" && (doseValue || doseUnit) && !hasStructuredDose) {
      Alert.alert(t("record.detail.doseTitle"), t("record.detail.doseBody"));
      return;
    }
    if (builtinId === "doctor" && (!visitType || !recordTitle.trim() || !details.trim())) {
      Alert.alert(t("record.detail.doctorTitle"), t("record.detail.doctorBody"));
      return;
    }
    if ((medicationReminderEnabled || cautionReminderEnabled) && (!nextAtDate || !nextAtTime)) {
      Alert.alert(t("record.detail.reminderTitle"), t("record.detail.reminderBody"));
      return;
    }
    if (builtinId === "memo" && !notes.trim()) {
      Alert.alert(t("record.detail.memoRequired"));
      return;
    }
    if (builtinId === "other" && !recordTitle.trim()) {
      Alert.alert(t("record.detail.nameRequired"));
      return;
    }
    if (builtinId === "vaccination" && (!vaccineName.trim() || !vaccinationRound || (vaccinationRound === "other" && !vaccinationRoundText.trim()))) {
      Alert.alert(t("record.detail.vaccineTitle"), t("record.detail.vaccineBody"));
      return;
    }
    if (builtinId === "vaccination" && injectionSite === "other" && !injectionSiteText.trim()) {
      Alert.alert(t("record.detail.siteRequired"));
      return;
    }
    if (builtinId === "vaccination" && vaccinationReminderSetting !== "none" && (!nextAtDate || !nextAtTime)) {
      Alert.alert(t("record.detail.nextVaccineTitle"), t("record.detail.nextVaccineBody"));
      return;
    }
    if (builtinId === "vaccination" && vaccinationReminderSetting === "custom" && (!customReminderDate || !customReminderTime)) {
      Alert.alert(t("record.detail.customReminderTitle"), t("record.detail.customReminderBody"));
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
      Alert.alert(t("record.detail.babyRequiredTitle"), t("record.detail.babyRequiredBody"));
      return;
    }
    const entryToSave: Omit<BabyLogEntry, "id"> = {
        babyId: activeBabyId,
        cat: effectiveCat,
        time,
        chip: chip || undefined,
        // The existing payload fields let us add this without a schema change:
        // amount = urine amount; chip2 = stool amount; stoolState = consistency.
        chip2: builtinId === "diaper" && diaperType === RECORD_VALUE.diaperUrine ? undefined : chip2 || undefined,
        stoolState:
          builtinId === "diaper" && diaperType === RECORD_VALUE.diaperUrine ? undefined : stoolState || undefined,
        amount:
          builtinId === "diaper" && diaperType === RECORD_VALUE.diaperStool
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
        t("record.detail.cautionTitle"),
        t("record.detail.cautionBody", { foods: matchedFoods.join(", "), babyName }),
        [{ text: t("record.detail.cancel"), style: "cancel" }, { text: t("record.detail.logAnyway"), onPress: commit }],
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
            {t("record.detail.logTitle", { label: builtinId ? recordCategoryLabel(t, builtinId) : c.label, action: t(isEdit ? "record.detail.edit" : "record.detail.add") })}
          </Text>
          {sessionLabel ? <Text style={styles.sessionBadge}>{sessionLabel}</Text> : null}
        </View>
        <Text style={styles.activeBabyLabel}>{t("record.detail.target", { babyName })}</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(builtinId === "breast" || builtinId === "formula" || builtinId === "storedMilk") && (
            <>
              {builtinId === "breast" ? (
                <>
                  <DurationPickerField label={t("record.detail.leftTime")} valueMinutes={leftDurationValue} onPress={() => setSideDurationTarget("left")} />
                  <DurationPickerField label={t("record.detail.rightTime")} valueMinutes={rightDurationValue} onPress={() => setSideDurationTarget("right")} />
                  <View style={styles.calculatedCard}>
                    <Text style={styles.calculatedLabel}>{t("record.detail.totalFeedingTime")}</Text>
                    <Text style={styles.calculatedValue}>{t("record.detail.minutes", { count: sideDurationTotal || durationValue || 0 })}</Text>
                  </View>
                </>
              ) : null}
              {builtinId !== "breast" ? (
                <>
                  <AmountInput label={t("record.detail.amountFed")} value={amount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={(value) => { setAmount(value); setFeedingAmountError(""); }} onChangeUnit={(unit) => { setAmountUnit(unit); setFeedingAmountError(""); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} error={feedingAmountError || undefined} />
                  <DurationPickerField label={t("record.detail.optionalDuration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
                  <Text style={styles.fieldLabel}>{t("record.detail.optionalSupplement")}</Text>
                  <TextInput style={styles.input} value={supplement} onChangeText={setSupplement} placeholder={t("record.detail.exampleVitamin")} placeholderTextColor={colors.faint} />
                </>
              ) : null}
              {builtinId === "breast" ? (
                <>
                  <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
                  <TimeOfDayPickerField label={t("record.detail.endTime")} valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>{t("record.detail.spitUp")}</Text>
              <ChipRow options={[RECORD_VALUE.spitUpYes, RECORD_VALUE.spitUpNo]} value={spitUp === "yes" ? RECORD_VALUE.spitUpYes : spitUp === "no" ? RECORD_VALUE.spitUpNo : ""} onChange={(value) => setSpitUp(value === RECORD_VALUE.spitUpYes ? "yes" : value === RECORD_VALUE.spitUpNo ? "no" : undefined)} getLabel={storedOptionLabel} />
              {builtinId === "breast" ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.burp")}</Text>
                  <ChipRow options={[RECORD_VALUE.burpedYes, RECORD_VALUE.burpedNo]} value={burped === "yes" ? RECORD_VALUE.burpedYes : burped === "no" ? RECORD_VALUE.burpedNo : ""} onChange={(value) => setBurped(value === RECORD_VALUE.burpedYes ? "yes" : value === RECORD_VALUE.burpedNo ? "no" : undefined)} getLabel={storedOptionLabel} />
                  <Text style={styles.fieldLabel}>{t("record.detail.feedingNote")}</Text>
                  <ChipRow options={[...RECORD_STORED_OPTIONS.feedingNote]} value={feedingNote} onChange={setFeedingNote} getLabel={storedOptionLabel} />
                </>
              ) : null}
              {builtinId === "storedMilk" ? (
                storedMilkEstimatedRemainingMl == null ? (
                  <Text style={styles.readOnlyHint}>{t("record.detail.stockComingSoon")}</Text>
                ) : (
                  <View style={styles.estimatedStockCard}>
                    <Text style={styles.calculatedLabel}>{t("record.detail.estimatedRemaining")}</Text>
                    <Text style={styles.calculatedValue}>{formatVolume(String(storedMilkEstimatedRemainingMl), settings.units.volume)}</Text>
                    <Text style={styles.estimatedStockHint}>{t("record.detail.estimatedStockHint")}</Text>
                  </View>
                )
              ) : null}
            </>
          )}

          {builtinId === "sleep" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.sleepType")}</Text>
              <ChipRow options={[...RECORD_STORED_OPTIONS.sleep]} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
              <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <TimeOfDayPickerField label={t("record.detail.endTime")} valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
              <DurationPickerField label={t("record.detail.totalTime")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
              {endTime && isValidClockInput(time) && toMinutes(endTime) < toMinutes(time) ? <Text style={styles.overnightHint}>{t("record.detail.overnightHint")}</Text> : null}
            </>
          )}

          {builtinId === "diaper" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.diaperWhat")}</Text>
              <ChipRow
                options={[...RECORD_STORED_OPTIONS.diaperType]}
                value={chip}
                onChange={(value) => { setChip(value); setDiaperError(""); }}
                getLabel={storedOptionLabel}
              />
              {diaperError ? <Text style={styles.inputError}>{diaperError}</Text> : null}
              {(chip === RECORD_VALUE.diaperUrine || chip === RECORD_VALUE.diaperBoth) ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.urineAmount")}</Text>
                  <ChipRow options={[...RECORD_STORED_OPTIONS.amount]} value={amount} onChange={setAmount} getLabel={storedOptionLabel} />
                </>
              ) : null}
              {(chip === RECORD_VALUE.diaperStool || chip === RECORD_VALUE.diaperBoth) ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.stoolState")}</Text>
                  <ChipRow
                    options={[...RECORD_STORED_OPTIONS.stool]}
                    value={stoolState}
                    onChange={setStoolState}
                    getLabel={storedOptionLabel}
                  />
                  <Text style={styles.fieldLabel}>{t("record.detail.stoolAmount")}</Text>
                  <ChipRow options={[...RECORD_STORED_OPTIONS.amount]} value={chip2} onChange={setChip2} getLabel={storedOptionLabel} />
                </>
              ) : null}
            </>
          )}

          {(builtinId === "food" || builtinId === "snack") && (
            <>
              <Text style={styles.fieldLabel}>{builtinId === "snack" ? t("record.detail.foodIngredients") : t("record.detail.ingredients")}</Text>
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
                      <Text style={[styles.ingredientHistory, selected && styles.ingredientHistorySelected]}>{history.count ? t("record.detail.previousCount", { count: history.count }) : t("record.detail.firstLog")}</Text>
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
                    placeholder={t("record.detail.ingredientPlaceholder")}
                    placeholderTextColor={colors.faint}
                    autoFocus
                  />
                  <Pressable
                    style={styles.newIngredientSave}
                    onPress={() => {
                      const clean = newIngredientName.trim().replace(/\s+/g, " ");
                      if (!clean) { setIngredientError(t("record.detail.ingredientNameRequired")); return; }
                      const existing = ingredientNames.find((name) => name.toLocaleLowerCase() === clean.toLocaleLowerCase());
                      if (existing) {
                        setSelectedIngredients((current) => current.includes(existing) ? current : [...current, existing]);
                        setIngredientError(t("record.detail.ingredientExists"));
                        setNewIngredientName("");
                        setAddingIngredient(false);
                        return;
                      }
                      const created = onAddFoodIngredient?.(clean, builtinId === "snack" ? "snack" : "baby_food");
                      if (!created) { setIngredientError(t("record.detail.ingredientAddFailed")); return; }
                      setSelectedIngredients((current) => [...current, created.name]);
                      setNewIngredientName("");
                      setAddingIngredient(false);
                    }}
                  >
                    <Text style={styles.newIngredientSaveText}>{t("record.detail.add")}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.addIngredientButton} onPress={() => setAddingIngredient(true)}>
                  <Text style={styles.addIngredientText}>{t("record.detail.addIngredient")}</Text>
                </Pressable>
              )}
              {ingredientError ? <Text style={styles.inputError}>{ingredientError}</Text> : null}
              {selectedIngredients.map((name) => {
                const history = ingredientHistory(name);
                return (
                  <View key={`history-${name}`} style={styles.historyRow}>
                    <Text style={styles.historyName}>{name}</Text>
                    <Text style={styles.historyText}>
                      {history.count === 0 ? t("record.detail.firstIngredient") : t("record.detail.ingredientHistory", { count: history.count, date: formatIngredientDate(history.lastDate), memo: history.hasMemo ? t("record.detail.hasMemo") : "" })}
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.fieldLabel}>{t("record.detail.amountGrams")}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={t("record.detail.example80")}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{t("record.detail.reaction")}</Text>
              <ChipRow options={[...RECORD_STORED_OPTIONS.foodReaction]} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
            </>
          )}

          {(builtinId === "pump") && (
            <>
              <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <TimeOfDayPickerField label={t("record.detail.endTime")} valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
              <DurationPickerField label={t("record.detail.leftTime")} valueMinutes={leftDurationValue} onPress={() => setSideDurationTarget("left")} />
              <DurationPickerField label={t("record.detail.rightTime")} valueMinutes={rightDurationValue} onPress={() => setSideDurationTarget("right")} />
              <AmountInput label={t("record.detail.leftPump")} value={leftAmount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setLeftAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
              <AmountInput label={t("record.detail.rightPump")} value={rightAmount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setRightAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
              <View style={styles.calculatedRow}>
                <View style={styles.calculatedCard}><Text style={styles.calculatedLabel}>{t("record.detail.totalTime")}</Text><Text style={styles.calculatedValue}>{t("record.detail.minutes", { count: sideDurationTotal || durationValue || 0 })}</Text></View>
                <View style={styles.calculatedCard}><Text style={styles.calculatedLabel}>{t("record.detail.totalPump")}</Text><Text style={styles.calculatedValue}>{sideAmountTotal}{resolvedAmountUnit ? ` ${resolvedAmountUnit}` : ""}</Text></View>
              </View>
            </>
          )}

          {(builtinId === "water" || builtinId === "milk") && (
            <AmountInput label={t("record.detail.amount")} value={amount} unit={amountUnit} unitOptions={["ml", "oz"]} customUnit={customAmountUnit} onChangeValue={setAmount} onChangeUnit={(unit) => { setAmountUnit(unit); if (unit !== CUSTOM_AMOUNT_UNIT) setCustomAmountUnit(""); }} onChangeCustomUnit={setCustomAmountUnit} />
          )}

          {(builtinId === "tummy" || builtinId === "play") && (
            <>
              {builtinId === "play" ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.playDetails")}</Text>
                  <TextInput
                    style={styles.input}
                    value={details}
                    onChangeText={setDetails}
                    placeholder={t("record.detail.examplePlay")}
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              <DurationPickerField label={t("record.detail.duration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId === "bath" ? <DurationPickerField label={t("record.detail.bathDuration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} /> : null}

          {builtinId === "med" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.medicationType")}</Text>
              <LabeledChipRow
                options={[
                  { value: "medicine", label: t("record.detail.medicine") },
                  { value: "supplement", label: t("record.detail.supplement") },
                  { value: "ointment", label: t("record.detail.ointment") },
                  { value: "eye_drop", label: t("record.detail.eyeDrop") },
                  { value: "other", label: t("record.detail.other") },
                ]}
                value={medicationType}
                onChange={setMedicationType}
              />
              <Text style={styles.fieldLabel}>{t("record.detail.medicationName")}</Text>
              <TextInput
                style={styles.input}
                value={medName}
                onChangeText={setMedName}
                placeholder={t("record.detail.exampleVitamin")}
                placeholderTextColor={colors.faint}
              />
              <AmountInput label={t("record.detail.dose")} value={doseValue} unit={doseUnit} unitOptions={MEDICATION_DOSE_UNITS} customUnit={customDoseUnit} onChangeValue={(value) => { setDoseValue(value); setLegacyDoseText(""); }} onChangeUnit={(value) => { setDoseUnit(value); setDoseUnitTouched(true); setLegacyDoseText(""); if (value !== CUSTOM_DOSE_UNIT) setCustomDoseUnit(""); }} onChangeCustomUnit={(value) => { setCustomDoseUnit(value); setDoseUnitTouched(true); setLegacyDoseText(""); }} />
              {legacyDoseText ? (
                <View style={styles.legacyDoseCard}>
                  <Text style={styles.legacyDoseLabel}>{t("record.detail.legacyDose")}</Text>
                  <Text style={styles.legacyDoseValue}>{legacyDoseText}</Text>
                  <Text style={styles.legacyDoseHint}>{t("record.detail.legacyDoseHint")}</Text>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>{t("record.detail.medicationStatus")}</Text>
              <LabeledChipRow
                options={[
                  { value: "given", label: t("record.detail.given") },
                  { value: "partial", label: t("record.detail.partial") },
                  { value: "refused", label: t("record.detail.refused") },
                ]}
                value={medicationStatus}
                onChange={setMedicationStatus}
              />
              <TimeOfDayPickerField label={t("record.detail.time")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DatePickerField label={t("record.detail.nextMedicationDateOptional")} valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label={t("record.detail.nextMedicationTimeOptional")} valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>{t("record.detail.nextMedicationReminder")}</Text>
                  <Text style={styles.toggleBody}>{t("record.detail.nextMedicationReminderHint")}</Text>
                </View>
                <Switch value={medicationReminderEnabled} onValueChange={setMedicationReminderEnabled} disabled={!nextAtDate || !nextAtTime} trackColor={{ false: colors.border, true: colors.amber }} />
              </View>
            </>
          )}

          {builtinId === "temp" && (
            <>
              <Text style={styles.fieldLabel}>
                {t("record.detail.temperature", { unit: settings.units.temperature === "c" ? "C" : "F" })}
              </Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={t("record.detail.exampleTemperature")}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{t("record.detail.measurementSite")}</Text>
              <ChipRow options={[...RECORD_STORED_OPTIONS.temperatureSite]} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
            </>
          )}

          {builtinId === "vaccination" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.vaccineName")}</Text>
              <TextInput style={styles.input} value={vaccineName} onChangeText={setVaccineName} placeholder={t("record.detail.exampleVaccine")} placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>{t("record.detail.vaccineRound")}</Text>
              <LabeledChipRow options={[
                { value: "first", label: t("record.detail.firstDose") }, { value: "second", label: t("record.detail.secondDose") }, { value: "third", label: t("record.detail.thirdDose") }, { value: "booster", label: t("record.detail.add") }, { value: "other", label: t("record.detail.other") },
              ]} value={vaccinationRound ?? ""} onChange={(value) => setVaccinationRound(value as BabyLogEntry["vaccinationRound"] || undefined)} />
              {vaccinationRound === "other" ? <TextInput style={[styles.input, { marginTop: 8 }]} value={vaccinationRoundText} onChangeText={setVaccinationRoundText} placeholder={t("record.detail.roundPlaceholder")} placeholderTextColor={colors.faint} /> : null}
              <DatePickerField label={t("record.detail.vaccinationDate")} valueDateKey={vaccinationDateKey} onPress={() => setVaccinationDatePickerOpen(true)} />
              <TimeOfDayPickerField label={t("record.detail.vaccinationTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} />
              <Text style={styles.fieldLabel}>{t("record.detail.clinicOptional")}</Text>
              <TextInput style={styles.input} value={vaccinationHospitalName} onChangeText={setVaccinationHospitalName} placeholder={t("record.detail.exampleClinic")} placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>{t("record.detail.doctorOptional")}</Text>
              <TextInput style={styles.input} value={vaccinationDoctorName} onChangeText={setVaccinationDoctorName} placeholder={t("record.detail.doctorName")} placeholderTextColor={colors.faint} />
              <Text style={styles.fieldLabel}>{t("record.detail.injectionSite")}</Text>
              <LabeledChipRow options={[
                { value: "left_thigh", label: t("record.detail.leftThigh") }, { value: "right_thigh", label: t("record.detail.rightThigh") }, { value: "left_arm", label: t("record.detail.leftArm") }, { value: "right_arm", label: t("record.detail.rightArm") }, { value: "other", label: t("record.detail.other") },
              ]} value={injectionSite ?? ""} onChange={(value) => setInjectionSite(value as BabyLogEntry["injectionSite"] || undefined)} />
              {injectionSite === "other" ? <TextInput style={[styles.input, { marginTop: 8 }]} value={injectionSiteText} onChangeText={setInjectionSiteText} placeholder={t("record.detail.siteRequired")} placeholderTextColor={colors.faint} /> : null}
              <Text style={styles.fieldLabel}>{t("record.detail.aftercare")}</Text>
              <View style={styles.chipRow}>
                {RECORD_STORED_OPTIONS.vaccinationAftercare.map((item) => {
                  const selected = aftercareNotes.includes(item);
                  return <Pressable key={item} style={[styles.chip, selected && styles.chipSel]} onPress={() => setAftercareNotes((current) => selected ? current.filter((value) => value !== item) : [...current, item])}><Text style={[styles.chipText, selected && styles.chipTextSel]}>{storedOptionLabel(item)}</Text></Pressable>;
                })}
              </View>
              <DatePickerField label={t("record.detail.nextVaccineDateOptional")} valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label={t("record.detail.nextVaccineTimeOptional")} valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <Text style={styles.fieldLabel}>{t("record.detail.nextVaccineReminder")}</Text>
              <LabeledChipRow options={[
                { value: "none", label: t("record.detail.none") }, { value: "one_day_before", label: t("record.detail.oneDayBefore") }, { value: "three_days_before", label: t("record.detail.threeDaysBefore") }, { value: "custom", label: t("record.detail.custom") },
              ]} value={vaccinationReminderSetting ?? "none"} onChange={(value) => {
                const next = (value || "none") as BabyLogEntry["vaccinationReminderSetting"];
                if (next !== "none" && (!nextAtDate || !nextAtTime)) {
                  Alert.alert(t("record.detail.selectNextVaccineFirst"));
                  return;
                }
                setVaccinationReminderSetting(next);
              }} />
              {!nextAtDate || !nextAtTime ? <Text style={styles.readOnlyHint}>{t("record.detail.nextVaccineHint")}</Text> : null}
              {vaccinationReminderSetting === "custom" ? (
                <>
                  <DatePickerField label={t("record.detail.reminderDate")} valueDateKey={customReminderDate} onPress={() => setVaccinationReminderDatePickerOpen(true)} />
                  <TimeOfDayPickerField label={t("record.detail.reminderTime")} valueHHmm={customReminderTime} onPress={() => setTimePickerTarget("vaccinationReminder")} />
                </>
              ) : null}
            </>
          )}

          {builtinId === "doctor" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.visitType")}</Text>
              <View style={styles.chipRow}>
                {(["checkup", "illness"] as const).map((option) => (
                  <Pressable key={option} style={[styles.chip, visitType === option && styles.chipSel]} onPress={() => setVisitType(visitType === option ? undefined : option)}>
                    <Text style={[styles.chipText, visitType === option && styles.chipTextSel]}>{option === "checkup" ? t("record.detail.checkup") : t("record.detail.illness")}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{t("record.detail.clinicName")}</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder={t("record.detail.exampleClinic")}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{t("record.detail.doctorName")}</Text>
              <TextInput
                style={styles.input}
                value={doctorName}
                onChangeText={setDoctorName}
                placeholder={t("record.detail.exampleDoctor")}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{visitType === "illness" ? t("record.detail.conditionName") : t("record.detail.checkupDetails")}</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={details}
                onChangeText={setDetails}
                multiline
                placeholder={visitType === "illness" ? t("record.detail.conditionPlaceholder") : t("record.detail.checkupPlaceholder")}
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.fieldLabel}>{t("record.detail.cautions")}</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={cautions}
                onChangeText={setCautions}
                multiline
                placeholder={t("record.detail.cautionsPlaceholder")}
                placeholderTextColor={colors.faint}
              />
              <TimeOfDayPickerField label={t("record.detail.appointmentTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DatePickerField label={t("record.detail.nextAppointmentDateOptional")} valueDateKey={nextAtDate} onPress={() => setNextDatePickerOpen(true)} />
              <TimeOfDayPickerField label={t("record.detail.nextAppointmentTimeOptional")} valueHHmm={nextAtTime} onPress={() => setTimePickerTarget("nextAt")} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>{t("record.detail.cautionReminder")}</Text>
                  <Text style={styles.toggleBody}>{t("record.detail.cautionReminderHint")}</Text>
                </View>
                <Switch value={cautionReminderEnabled} onValueChange={setCautionReminderEnabled} disabled={!nextAtDate || !nextAtTime} trackColor={{ false: colors.border, true: colors.amber }} />
              </View>
            </>
          )}

          {builtinId === "other" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.logName")}</Text>
              <TextInput
                style={styles.input}
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder={t("record.detail.exampleOther")}
                placeholderTextColor={colors.faint}
              />
              <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DurationPickerField label={t("record.detail.optionalDuration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId === "memo" && (
            <>
              <Text style={styles.fieldLabel}>{t("record.detail.titleOptional")}</Text>
              <TextInput style={styles.input} value={recordTitle} onChangeText={setRecordTitle} placeholder={t("record.detail.memoTitle")} placeholderTextColor={colors.faint} />
              <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
              <DurationPickerField label={t("record.detail.optionalDuration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
            </>
          )}

          {builtinId !== "sleep" && builtinId !== "breast" && builtinId !== "pump" && builtinId !== "med" && builtinId !== "doctor" && builtinId !== "vaccination" && builtinId !== "memo" && builtinId !== "other" && !(c.isCustom && (c.inputMode ?? "memo") === "duration") && (
            <TimeOfDayPickerField label={t("record.detail.time")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
          )}

          {c.isCustom ? (
            <>
              {(c.inputMode ?? "memo") === "duration" ? (
                <>
                  <TimeOfDayPickerField label={t("record.detail.startTime")} valueHHmm={time} onPress={() => setTimePickerTarget("time")} error={timeError || undefined} />
                  <TimeOfDayPickerField label={t("record.detail.endTime")} valueHHmm={endTime} onPress={() => setTimePickerTarget("end")} />
                  <DurationPickerField label={t("record.detail.totalTime")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
                  {endTime && isValidClockInput(time) && toMinutes(endTime) < toMinutes(time) ? (
                    <Text style={styles.overnightHint}>{t("record.detail.overnightHint")}</Text>
                  ) : null}
                </>
              ) : null}
              {(c.inputMode ?? "memo") === "amount" ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.amount")}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder={t("record.detail.exampleGeneric")}
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              {(c.inputMode ?? "memo") === "check" ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.completion")}</Text>
                  <ChipRow options={[...RECORD_STORED_OPTIONS.completion]} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
                </>
              ) : null}
            </>
          ) : pregnancyCat ? (
            <>
              {c.chips ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.status")}</Text>
                  <ChipRow options={c.chips} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
                </>
              ) : null}
              {c.amount ? (
                <>
                  <Text style={styles.fieldLabel}>{builtinId === "pregWeight" ? t("record.detail.weightKg") : builtinId === "pregBp" ? t("record.detail.bloodPressure") : t("record.detail.amountWithUnit", { unit: c.amount })}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType={builtinId === "pregBp" ? "default" : "numeric"}
                    placeholder={builtinId === "pregWeight" ? t("record.detail.exampleWeight") : builtinId === "pregBp" ? t("record.detail.exampleBloodPressure") : t("record.detail.example150")}
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
            </>
          ) : !builtinId ? (
            <>
              {c.chips ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.status")}</Text>
                  <ChipRow options={c.chips} value={chip} onChange={setChip} getLabel={storedOptionLabel} />
                </>
              ) : null}
              {c.amount ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.detail.amountWithUnit", { unit: c.amount })}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder={t("record.detail.example150")}
                    placeholderTextColor={colors.faint}
                  />
                </>
              ) : null}
              {c.duration ? (
                <DurationPickerField label={t("record.detail.duration")} valueMinutes={durationValue} onPress={() => setDurationPickerOpen(true)} />
              ) : null}
            </>
          ) : null}

          <Text style={styles.fieldLabel}>{builtinId === "memo" ? t("record.detail.content") : t("record.detail.memo")}</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={
              builtinId === "memo" || (c.isCustom && (c.inputMode ?? "memo") === "memo")
                ? t("record.detail.memoPlaceholder")
                : builtinId === "food"
                  ? t("record.detail.extraMemo")
                  : t("record.detail.freeMemo")
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
              accessibilityLabel={t("record.detail.deleteA11y")}
            >
              <Text style={styles.deleteText}>{t("record.detail.deleteA11y")}</Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>{t("record.detail.cancel")}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
              <Text style={styles.btnPrimaryText}>{t("record.detail.save")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Pressable>
      </Pressable>
      <TimePickerSheet
        visible={timePickerTarget !== null}
        valueHHmm={timePickerTarget === "end" ? endTime : timePickerTarget === "nextAt" ? nextAtTime : timePickerTarget === "vaccinationReminder" ? customReminderTime : time}
        title={timePickerTarget === "end" ? t("record.detail.endTime") : timePickerTarget === "nextAt" ? (builtinId === "med" ? t("record.detail.nextMedicationTime") : builtinId === "vaccination" ? t("record.detail.nextVaccineTime") : t("record.detail.nextAppointmentTime")) : timePickerTarget === "vaccinationReminder" ? t("record.detail.reminderTime") : t("record.detail.pickTime")}
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
        title={builtinId === "med" ? t("record.detail.nextMedicationDate") : builtinId === "vaccination" ? t("record.detail.nextVaccineDate") : t("record.detail.nextAppointmentDate")}
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
        title={t("record.detail.pickVaccinationDate")}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        onCancel={() => setVaccinationDatePickerOpen(false)}
        onConfirm={(dateKey) => { setVaccinationDateKey(dateKey); setVaccinationDatePickerOpen(false); }}
      />
      <DatePickerSheet
        visible={vaccinationReminderDatePickerOpen}
        valueDateKey={customReminderDate}
        title={t("record.detail.reminderDate")}
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
        title={sideDurationTarget === "left" ? t("record.detail.leftTime") : t("record.detail.rightTime")}
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
