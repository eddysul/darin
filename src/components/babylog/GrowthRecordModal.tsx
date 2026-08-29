import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import type {
  GrowthLengthUnit,
  GrowthRecord,
  GrowthRecordDraft,
  GrowthRecordSource,
  GrowthWeightUnit,
} from "../../types/growthRecord";
import { colors } from "../../theme";
import { lengthFromCm, lengthToCm, weightFromKg, weightToKg } from "../../utils/measurementFormat";
import { BabyLogIcon } from "./BabyLogIcon";
import { DatePickerField, DatePickerSheet } from "../inputs/TimePickerFields";
import { useLanguage } from "../../LanguageContext";

type Props = {
  visible: boolean;
  record?: GrowthRecord | null;
  initialSource?: GrowthRecordSource;
  initialMeasuredAt?: string;
  onClose: () => void;
  onDismiss?: () => void;
  onSave: (draft: GrowthRecordDraft, editId?: string) => void;
};

function todayDate(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function UnitToggle<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <View style={styles.unitToggle}>
      {options.map((option) => (
        <Pressable key={option} style={[styles.unitBtn, value === option && styles.unitBtnActive]} onPress={() => onChange(option)}>
          <Text style={[styles.unitText, value === option && styles.unitTextActive]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function GrowthRecordModal({ visible, record, initialSource = "hospital", initialMeasuredAt, onClose, onDismiss, onSave }: Props) {
  const { t } = useLanguage();
  const { settings } = useAppSettings();
  const preferredWeightUnit: GrowthWeightUnit = settings.units.weight;
  const preferredLengthUnit: GrowthLengthUnit = settings.units.height === "inch" ? "in" : "cm";
  const [measuredAt, setMeasuredAt] = useState(todayDate());
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<GrowthWeightUnit>(preferredWeightUnit);
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<GrowthLengthUnit>(preferredLengthUnit);
  const [head, setHead] = useState("");
  const [headUnit, setHeadUnit] = useState<GrowthLengthUnit>(preferredLengthUnit);
  const [source, setSource] = useState<GrowthRecordSource>(initialSource);
  const [note, setNote] = useState("");
  const [initialFormKey, setInitialFormKey] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const nextMeasuredAt = record?.measuredAt ?? initialMeasuredAt ?? todayDate();
    const nextWeight = record?.weightKg === undefined ? "" : weightFromKg(record.weightKg, preferredWeightUnit);
    const nextHeight = record?.heightCm === undefined ? "" : lengthFromCm(record.heightCm, preferredLengthUnit);
    const nextHead = record?.headCircumferenceCm === undefined ? "" : lengthFromCm(record.headCircumferenceCm, preferredLengthUnit);
    const nextSource = record?.source ?? initialSource;
    const nextNote = record?.note ?? "";
    setMeasuredAt(nextMeasuredAt);
    // Supabase stores canonical kg/cm only; always reopen in the user's current display units.
    setWeightUnit(preferredWeightUnit);
    setHeightUnit(preferredLengthUnit);
    setHeadUnit(preferredLengthUnit);
    setWeight(nextWeight);
    setHeight(nextHeight);
    setHead(nextHead);
    setSource(nextSource);
    setNote(nextNote);
    setDatePickerOpen(false);
    setInitialFormKey(JSON.stringify({
      measuredAt: nextMeasuredAt,
      weight: nextWeight,
      weightUnit: preferredWeightUnit,
      height: nextHeight,
      heightUnit: preferredLengthUnit,
      head: nextHead,
      headUnit: preferredLengthUnit,
      source: nextSource,
      note: nextNote,
    }));
  }, [initialMeasuredAt, initialSource, preferredLengthUnit, preferredWeightUnit, record, visible]);

  const formKey = JSON.stringify({
    measuredAt,
    weight,
    weightUnit,
    height,
    heightUnit,
    head,
    headUnit,
    source,
    note,
  });
  const dirty = visible && initialFormKey !== "" && formKey !== initialFormKey;

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(t("growth.critical.086"), t("growth.critical.087"), [
      { text: t("growth.critical.088"), style: "cancel" },
      { text: t("growth.critical.089"), style: "destructive", onPress: onClose },
    ]);
  };

  const changeWeightUnit = (next: GrowthWeightUnit) => {
    const canonical = weightToKg(weight, weightUnit);
    setWeightUnit(next);
    if (canonical !== undefined) setWeight(weightFromKg(canonical, next));
  };

  const changeLengthUnit = (field: "height" | "head", next: GrowthLengthUnit) => {
    const current = field === "height" ? height : head;
    const unit = field === "height" ? heightUnit : headUnit;
    const canonical = lengthToCm(current, unit);
    if (field === "height") {
      setHeightUnit(next);
      if (canonical !== undefined) setHeight(lengthFromCm(canonical, next));
    } else {
      setHeadUnit(next);
      if (canonical !== undefined) setHead(lengthFromCm(canonical, next));
    }
  };

  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
      Alert.alert(t("growth.critical.090"), t("growth.critical.091"));
      return;
    }
    const weightKg = weightToKg(weight, weightUnit);
    const heightCm = lengthToCm(height, heightUnit);
    const headCircumferenceCm = lengthToCm(head, headUnit);
    if (weightKg === undefined && heightCm === undefined && headCircumferenceCm === undefined) {
      Alert.alert(t("growth.critical.092"), t("growth.critical.093"));
      return;
    }
    onSave({
      measuredAt,
      weightKg,
      weightUnit,
      heightCm,
      heightUnit,
      headCircumferenceCm,
      headCircumferenceUnit: headUnit,
      source,
      inputMethod: record?.inputMethod ?? "manual",
      userConfirmed: true,
      confidence: record?.confidence,
      originalText: record?.originalText,
      note: note.trim() || undefined,
    }, record?.id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose} onDismiss={onDismiss}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={styles.backdrop} onPress={requestClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}><BabyLogIcon kind="tab" tab="report" size={20} color={colors.amberText} /></View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>{record ? t("growth.critical.094") : t("growth.critical.095")}</Text>
              <Text style={styles.subtitle}>{t("growth.critical.096")}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <DatePickerField label={t("growth.critical.097")} valueDateKey={measuredAt} onPress={() => setDatePickerOpen(true)} />

            <MeasurementField label={t("growth.critical.098")} value={height} onChangeText={setHeight} unit={<UnitToggle value={heightUnit} options={["cm", "in"] as const} onChange={(next) => changeLengthUnit("height", next)} />} placeholder={heightUnit === "cm" ? t("growth.critical.099") : t("growth.critical.100")} />
            <MeasurementField label={t("growth.critical.101")} value={weight} onChangeText={setWeight} unit={<UnitToggle value={weightUnit} options={["kg", "lb"] as const} onChange={changeWeightUnit} />} placeholder={weightUnit === "kg" ? t("growth.critical.102") : t("growth.critical.103")} />
            <MeasurementField label={t("growth.critical.104")} value={head} onChangeText={setHead} unit={<UnitToggle value={headUnit} options={["cm", "in"] as const} onChange={(next) => changeLengthUnit("head", next)} />} placeholder={headUnit === "cm" ? t("growth.critical.105") : t("growth.critical.106")} />

            <Text style={styles.label}>{t("growth.critical.107")}</Text>
            <View style={styles.sourceRow}>
              {(["hospital", "home"] as const).map((option) => (
                <Pressable key={option} style={[styles.sourceBtn, source === option && styles.sourceBtnActive]} onPress={() => setSource(option)}>
                  <Text style={[styles.sourceText, source === option && styles.sourceTextActive]}>{option === "hospital" ? t("growth.critical.108") : t("growth.critical.109")}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t("growth.critical.110")}</Text>
            <TextInput style={[styles.input, styles.noteInput]} value={note} onChangeText={setNote} multiline placeholder={t("growth.critical.111")} placeholderTextColor={colors.faint} />

            <View style={styles.actions}>
              <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={requestClose}><Text style={styles.cancelText}>{t("growth.critical.066")}</Text></Pressable>
              <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={save}><Text style={styles.saveText}>{t("growth.critical.112")}</Text></Pressable>
            </View>
          </ScrollView>
          <DatePickerSheet
            visible={datePickerOpen}
            valueDateKey={measuredAt}
            title={t("growth.critical.113")}
            minYear={1900}
            maxYear={new Date().getFullYear()}
            onCancel={() => setDatePickerOpen(false)}
            onConfirm={(dateKey) => { setMeasuredAt(dateKey); setDatePickerOpen(false); }}
          />
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MeasurementField({ label, value, onChangeText, unit, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; unit: React.ReactNode; placeholder: string }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.measurementRow}>
        <TextInput style={[styles.input, styles.measurementInput]} value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.faint} />
        {unit}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", backgroundColor: colors.backgroundSecondary, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingBottom: 28 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginVertical: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8 },
  titleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  titleCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 2, fontSize: 11.5, color: colors.faint },
  label: { marginTop: 15, marginBottom: 7, fontSize: 12, fontWeight: "700", color: colors.muted },
  input: { minHeight: 46, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, color: colors.text, fontSize: 14 },
  measurementRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  measurementInput: { flex: 1 },
  unitToggle: { flexDirection: "row", padding: 3, borderRadius: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  unitBtn: { minWidth: 42, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, alignItems: "center" },
  unitBtnActive: { backgroundColor: colors.amber },
  unitText: { fontSize: 12, fontWeight: "700", color: colors.faint },
  unitTextActive: { color: colors.brandCoralForeground },
  sourceRow: { flexDirection: "row", gap: 8 },
  sourceBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sourceBtnActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  sourceText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  sourceTextActive: { color: colors.amberText },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22, marginBottom: 8 },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 14 },
  cancelBtn: { backgroundColor: colors.card },
  saveBtn: { backgroundColor: colors.primary },
  cancelText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  saveText: { fontSize: 14, fontWeight: "800", color: colors.primaryForeground },
});
