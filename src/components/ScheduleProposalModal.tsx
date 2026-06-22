import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PressSlide } from "./PressSlide";
import { useLanguage } from "../LanguageContext";
import type { ProposeScheduleInput, ScheduleEventType, ScheduleParticipantRole } from "../types/schedule";
import { formatDateISO } from "../utils/scheduleCalendar";
import { CALENDAR_ANCHOR } from "../utils/trialCalendar";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ProposeScheduleInput) => void;
  defaultRole: ScheduleParticipantRole;
  caregiverName: string;
  childName?: string;
  linkedCaregiverId?: number;
  counterMode?: boolean;
  onCounterSubmit?: (input: { date: string; startTime: string; endTime: string; displayTime: string; note?: string }) => void;
};

const DATE_CHIPS = [
  { id: "today", offset: 0, labelEn: "Today", labelKo: "오늘" },
  { id: "tomorrow", offset: 1, labelEn: "Tomorrow", labelKo: "내일" },
  { id: "friday", offset: 6, labelEn: "Friday", labelKo: "금요일" },
  { id: "monday", offset: 2, labelEn: "Next Monday", labelKo: "다음 월요일" },
] as const;

const TIME_CHIPS = [
  { id: "morning", start: "09:00", end: "12:00", displayEn: "9:00 AM – 12:00 PM", displayKo: "오전 9:00 – 12:00" },
  { id: "afternoon", start: "15:00", end: "20:00", displayEn: "3:00 PM – 8:00 PM", displayKo: "오후 3:00 – 8:00" },
  { id: "trial", start: "16:00", end: "17:00", displayEn: "4:00 PM – 5:00 PM", displayKo: "오후 4:00 – 5:00" },
] as const;

const TYPE_OPTIONS: ScheduleEventType[] = [
  "care_shift",
  "pickup_dropoff",
  "trial_session",
  "clinic_visit",
  "custom",
];

function dateFromOffset(offset: number) {
  const d = new Date(CALENDAR_ANCHOR);
  d.setDate(d.getDate() + offset);
  return formatDateISO(d);
}

export function ScheduleProposalModal({
  open,
  onClose,
  onSubmit,
  defaultRole,
  caregiverName,
  childName = "Emma",
  linkedCaregiverId,
  counterMode = false,
  onCounterSubmit,
}: Props) {
  const { locale, t } = useLanguage();
  const ko = locale === "ko";

  const [type, setType] = useState<ScheduleEventType>("care_shift");
  const [dateOffset, setDateOffset] = useState(2);
  const [timeId, setTimeId] = useState("afternoon");
  const [locationLabel, setLocationLabel] = useState("Family home · Capitol Hill");
  const [note, setNote] = useState("");
  const [proposedBy, setProposedBy] = useState<ScheduleParticipantRole>(defaultRole);
  const [customTime, setCustomTime] = useState("");

  const selectedTime = TIME_CHIPS.find((c) => c.id === timeId) ?? TIME_CHIPS[1];
  const selectedDate = dateFromOffset(dateOffset);
  const displayTime = customTime.trim() || (ko ? selectedTime.displayKo : selectedTime.displayEn);

  const typeLabel = (value: ScheduleEventType) => {
    const map: Record<ScheduleEventType, string> = {
      care_shift: t("schedule.typeCareShift"),
      pickup_dropoff: t("schedule.typePickup"),
      trial_session: t("schedule.typeTrial"),
      clinic_visit: t("schedule.typeClinic"),
      custom: t("schedule.typeCustom"),
    };
    return map[value];
  };

  const handleSubmit = () => {
    if (counterMode && onCounterSubmit) {
      onCounterSubmit({
        date: selectedDate,
        startTime: selectedTime.start,
        endTime: selectedTime.end,
        displayTime,
        note: note.trim() || undefined,
      });
      onClose();
      return;
    }

    const titleMap: Record<ScheduleEventType, string> = {
      care_shift: ko ? `${caregiverName.split(" ")[0]}와 오후 돌봄` : `Afternoon care with ${caregiverName.split(" ")[0]}`,
      pickup_dropoff: ko ? "픽업 / 드롭오프" : "Pickup / drop-off",
      trial_session: ko ? "시범 세션" : "Trial session",
      clinic_visit: ko ? "진료 방문" : "Clinic visit",
      custom: ko ? "케어 일정" : "Care schedule",
    };

    onSubmit({
      title: titleMap[type],
      childName,
      caregiverName,
      type,
      date: selectedDate,
      startTime: selectedTime.start,
      endTime: selectedTime.end,
      displayTime,
      locationLabel,
      note: note.trim() || undefined,
      proposedBy,
      source: "scheduler",
      linkedCaregiverId,
      linkedThreadId: linkedCaregiverId,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {counterMode ? t("schedule.counterTime") : t("schedule.newSchedule")}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!counterMode && (
              <>
                <Text style={styles.label}>{t("schedule.scheduleType")}</Text>
                <View style={styles.chipRow}>
                  {TYPE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt}
                      style={[styles.chip, type === opt && styles.chipActive]}
                      onPress={() => setType(opt)}
                    >
                      <Text style={[styles.chipText, type === opt && styles.chipTextActive]}>
                        {typeLabel(opt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>{t("schedule.date")}</Text>
            <View style={styles.chipRow}>
              {DATE_CHIPS.map((chip) => (
                <Pressable
                  key={chip.id}
                  style={[styles.chip, dateOffset === chip.offset && styles.chipActive]}
                  onPress={() => setDateOffset(chip.offset)}
                >
                  <Text style={[styles.chipText, dateOffset === chip.offset && styles.chipTextActive]}>
                    {ko ? chip.labelKo : chip.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t("schedule.time")}</Text>
            <View style={styles.chipRow}>
              {TIME_CHIPS.map((chip) => (
                <Pressable
                  key={chip.id}
                  style={[styles.chip, timeId === chip.id && styles.chipActive]}
                  onPress={() => {
                    setTimeId(chip.id);
                    setCustomTime("");
                  }}
                >
                  <Text style={[styles.chipText, timeId === chip.id && styles.chipTextActive]}>
                    {ko ? chip.displayKo : chip.displayEn}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder={t("schedule.customTimePlaceholder")}
              placeholderTextColor={colors.muted}
              value={customTime}
              onChangeText={setCustomTime}
            />

            {!counterMode && (
              <>
                <Text style={styles.label}>{t("schedule.location")}</Text>
                <TextInput
                  style={styles.input}
                  value={locationLabel}
                  onChangeText={setLocationLabel}
                  placeholderTextColor={colors.muted}
                />

                <Text style={styles.label}>{t("schedule.proposeTo")}</Text>
                <View style={styles.chipRow}>
                  {(["parent", "caregiver"] as ScheduleParticipantRole[]).map((role) => (
                    <Pressable
                      key={role}
                      style={[styles.chip, proposedBy === role && styles.chipActive]}
                      onPress={() => setProposedBy(role)}
                    >
                      <Text style={[styles.chipText, proposedBy === role && styles.chipTextActive]}>
                        {role === "parent" ? t("schedule.roleParent") : t("schedule.roleCaregiver")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>{t("schedule.note")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder={t("schedule.notePlaceholder")}
              placeholderTextColor={colors.muted}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t("schedule.cancel")}</Text>
            </Pressable>
            <PressSlide style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>
                {counterMode ? t("schedule.sendCounter") : t("schedule.proposeSchedule")}
              </Text>
            </PressSlide>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "88%",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  chipActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    marginTop: 4,
  },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  submitBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  submitText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground },
});
