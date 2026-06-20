import { Calendar, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CaregiverMatch } from "../demo/caregivers";
import { useLanguage } from "../LanguageContext";
import type { InterviewSlot, ScheduledInterview } from "../types/interview";
import {
  buildInterviewSlot,
  CALENDAR_ANCHOR,
  formatMonthTitle,
  getMonthMatrix,
  INTERVIEW_TIMES,
  isBeforeDay,
  isSameDay,
  parseSlotId,
  startOfDay,
} from "../utils/interviewCalendar";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  caregiver: CaregiverMatch;
  existingInterview?: ScheduledInterview;
  onClose: () => void;
  onConfirm: (slot: InterviewSlot) => void;
};

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function ScheduleInterviewModal({ open, caregiver, existingInterview, onClose, onConfirm }: Props) {
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const minDate = startOfDay(CALENDAR_ANCHOR);

  const [viewYear, setViewYear] = useState(CALENDAR_ANCHOR.getFullYear());
  const [viewMonth, setViewMonth] = useState(CALENDAR_ANCHOR.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeId, setSelectedTimeId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<InterviewSlot | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmed(false);
    setConfirmedSlot(null);

    if (existingInterview?.slotId) {
      const { date, timeId } = parseSlotId(existingInterview.slotId);
      if (date) {
        setSelectedDate(date);
        setViewYear(date.getFullYear());
        setViewMonth(date.getMonth());
        setSelectedTimeId(timeId);
        return;
      }
    }

    setSelectedDate(null);
    setSelectedTimeId(null);
    setViewYear(CALENDAR_ANCHOR.getFullYear());
    setViewMonth(CALENDAR_ANCHOR.getMonth());
  }, [open, existingInterview?.slotId]);

  const monthCells = useMemo(() => getMonthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekdays = ko ? WEEKDAYS_KO : WEEKDAYS_EN;

  const selectedTime = INTERVIEW_TIMES.find((t) => t.id === selectedTimeId);
  const canConfirm = selectedDate && selectedTime;

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const slot = buildInterviewSlot(selectedDate, selectedTime);
    setConfirmedSlot(slot);
    setConfirmed(true);
    onConfirm(slot);
    setTimeout(onClose, 1400);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {confirmed && confirmedSlot ? (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <CheckCircle size={32} color={colors.sage} />
              </View>
              <Text style={styles.successTitle}>{t("interview.confirmed")}</Text>
              <Text style={styles.successBody}>
                {caregiver.name} · {ko ? confirmedSlot.labelKo : confirmedSlot.labelEn}
              </Text>
              <Text style={styles.successHint}>{t("interview.addedToHome")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Calendar size={20} color={colors.gold} />
                <Text style={styles.title}>{t("interview.title")}</Text>
              </View>
              <Text style={styles.subtitle}>
                {t("interview.subtitle")} {caregiver.name}
              </Text>

              <View style={styles.monthRow}>
                <Pressable style={styles.monthBtn} onPress={() => shiftMonth(-1)}>
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.monthTitle}>{formatMonthTitle(viewYear, viewMonth, ko)}</Text>
                <Pressable style={styles.monthBtn} onPress={() => shiftMonth(1)}>
                  <ChevronRight size={20} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {weekdays.map((d) => (
                  <Text key={d} style={styles.weekday}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {monthCells.map((date, idx) => {
                  if (!date) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  const disabled = isBeforeDay(date, minDate);
                  const selected = selectedDate ? isSameDay(date, selectedDate) : false;
                  const isToday = isSameDay(date, minDate);
                  return (
                    <Pressable
                      key={date.toISOString()}
                      style={[
                        styles.dayCell,
                        selected && styles.daySelected,
                        isToday && !selected && styles.dayToday,
                        disabled && styles.dayDisabled,
                      ]}
                      onPress={() => !disabled && setSelectedDate(date)}
                      disabled={disabled}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                          disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.timeLabel}>{t("interview.pickTime")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.times}>
                {INTERVIEW_TIMES.map((time) => {
                  const active = time.id === selectedTimeId;
                  return (
                    <Pressable
                      key={time.id}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                      onPress={() => setSelectedTimeId(time.id)}
                    >
                      <Text style={[styles.timeText, active && styles.timeTextActive]}>
                        {ko ? time.labelKo : time.labelEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{t("profile.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!canConfirm}
                >
                  <Text style={styles.confirmText}>{t("interview.confirm")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "88%",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  monthBtn: { padding: 8, borderRadius: radius.md, backgroundColor: colors.champagne },
  monthTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  daySelected: { backgroundColor: colors.gold, borderRadius: radius.md },
  dayToday: { borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.md },
  dayDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, fontWeight: "500", color: colors.text },
  dayTextSelected: { fontWeight: "700", color: colors.text },
  dayTextDisabled: { color: colors.muted },
  timeLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 8 },
  times: { marginBottom: 16, maxHeight: 44 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    marginRight: 8,
  },
  timeChipActive: { borderColor: colors.gold, backgroundColor: colors.champagne },
  timeText: { fontSize: 13, fontWeight: "500", color: colors.muted },
  timeTextActive: { color: colors.text, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, fontWeight: "700", color: colors.text },
  success: { alignItems: "center", paddingVertical: 24 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEF5F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  successBody: { fontSize: 14, color: colors.text, textAlign: "center", lineHeight: 20, fontWeight: "600" },
  successHint: { fontSize: 13, color: colors.muted, marginTop: 8, textAlign: "center" },
});
