import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useApp } from "../context/AppContext";
import { useCareFlow } from "../context/CareFlowContext";
import { useSchedule } from "../context/ScheduleContext";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { useLanguage } from "../LanguageContext";
import type { CareScheduleEvent, ScheduleParticipantRole } from "../types/schedule";
import {
  formatDateISO,
  formatWeekdayShort,
  getWeekDays,
  isSameScheduleDay,
} from "../utils/scheduleCalendar";
import {
  CALENDAR_ANCHOR,
  formatMonthTitle,
  getMonthMatrix,
  isSameDay,
  startOfDay,
} from "../utils/trialCalendar";
import { ScheduleProposalCard } from "./ScheduleProposalCard";
import { ScheduleProposalModal } from "./ScheduleProposalModal";
import { colors, radius } from "../theme";

type FilterMode = "all" | "pending" | "accepted";

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  open: boolean;
  onClose: () => void;
  caregiverName?: string;
  childName?: string;
  linkedCaregiverId?: number;
};

export function CareScheduleModal({
  open,
  onClose,
  caregiverName = "Ji-yeon Park",
  childName = "Emma",
  linkedCaregiverId = 1,
}: Props) {
  const { profile } = useApp();
  const { activeRelationship, carePlan } = useCareFlow();
  const {
    events,
    proposeSchedule,
    acceptSchedule,
    declineSchedule,
    counterSchedule,
    getEventsForDate,
  } = useSchedule();
  const { locale, t } = useLanguage();
  const topInset = useScreenTopInset(8);
  const ko = locale === "ko";
  const today = startOfDay(CALENDAR_ANCHOR);

  const userRole: ScheduleParticipantRole = profile.role === "caregiver" ? "caregiver" : "parent";
  const [showWeekDetail, setShowWeekDetail] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedDate, setSelectedDate] = useState(CALENDAR_ANCHOR);
  const [viewYear, setViewYear] = useState(CALENDAR_ANCHOR.getFullYear());
  const [viewMonth, setViewMonth] = useState(CALENDAR_ANCHOR.getMonth());
  const [proposalOpen, setProposalOpen] = useState(false);
  const [counterEventId, setCounterEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setShowWeekDetail(false);
    setFilterMode("all");
    setSelectedDate(CALENDAR_ANCHOR);
    setViewYear(CALENDAR_ANCHOR.getFullYear());
    setViewMonth(CALENDAR_ANCHOR.getMonth());
  }, [open]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const selectedIso = formatDateISO(selectedDate);
  const monthCells = useMemo(() => getMonthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekdays = ko ? WEEKDAYS_KO : WEEKDAYS_EN;

  const dayEvents = useMemo(() => {
    let list = getEventsForDate(selectedIso);
    if (filterMode === "pending") list = list.filter((e) => e.status === "proposed");
    if (filterMode === "accepted") list = list.filter((e) => e.status === "accepted");
    return list;
  }, [filterMode, getEventsForDate, selectedIso]);

  const datesWithEvents = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.status !== "cancelled") set.add(e.date);
    });
    return set;
  }, [events]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleMonthDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowWeekDetail(true);
  };

  const handleAccept = (eventId: string) => {
    acceptSchedule(eventId, userRole);
  };

  const handleDecline = (eventId: string) => {
    declineSchedule(eventId, userRole);
  };

  const handleCounterOpen = (eventId: string) => {
    setCounterEventId(eventId);
    setProposalOpen(true);
  };

  const renderEventCard = (event: CareScheduleEvent) => (
    <ScheduleProposalCard
      key={event.id}
      event={event}
      currentUserRole={userRole}
      onAccept={() => handleAccept(event.id)}
      onCounter={() => handleCounterOpen(event.id)}
      onDecline={() => handleDecline(event.id)}
    />
  );

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
            <X size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t("schedule.title")}</Text>
            <Text style={styles.subtitle}>
              {t("schedule.subtitle").replace("{caregiver}", caregiverName.split(" ")[0])}
            </Text>
            <Text style={styles.subtitleSmall}>
              {childName} · {caregiverName}
            </Text>
          </View>
          <View style={styles.iconBtn} />
        </View>

        {activeRelationship && (
          <View style={styles.relationshipCard}>
            <Text style={styles.relLabel}>{t("schedule.activeCare")}</Text>
            <Text style={styles.relLine}>
              {t("schedule.caregiver")}: {caregiverName}
            </Text>
            <Text style={styles.relLine}>
              {t("schedule.child")}: {childName}
            </Text>
            <Text style={styles.relLine}>
              {t("schedule.currentPlan")}: {activeRelationship.schedule}
            </Text>
          </View>
        )}

        {!activeRelationship && carePlan && (
          <View style={styles.relationshipCard}>
            <Text style={styles.relLine}>
              {t("schedule.currentPlan")}: {carePlan.schedule}
            </Text>
          </View>
        )}

        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
          {!showWeekDetail && (
            <Text style={styles.monthHint}>{t("schedule.selectDateHint")}</Text>
          )}

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

          <View style={styles.monthGrid}>
            {monthCells.map((date, idx) => {
              if (!date) return <View key={`empty-${idx}`} style={styles.monthDayCell} />;
              const iso = formatDateISO(date);
              const hasEvents = datesWithEvents.has(iso);
              const isToday = isSameDay(date, today);
              const selected = showWeekDetail && isSameScheduleDay(date, selectedDate);
              return (
                <Pressable
                  key={iso}
                  style={[
                    styles.monthDayCell,
                    isToday && !selected && styles.monthDayToday,
                    selected && styles.monthDaySelected,
                  ]}
                  onPress={() => handleMonthDateSelect(date)}
                >
                  <Text
                    style={[
                      styles.monthDayText,
                      isToday && !selected && styles.monthDayTextToday,
                      selected && styles.monthDayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {hasEvents && <View style={[styles.monthDot, selected && styles.monthDotSelected]} />}
                </Pressable>
              );
            })}
          </View>

          {showWeekDetail && (
            <View style={styles.weekSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
                {weekDays.map((day) => {
                  const iso = formatDateISO(day);
                  const selected = isSameScheduleDay(day, selectedDate);
                  const hasEvents = datesWithEvents.has(iso);
                  return (
                    <Pressable
                      key={iso}
                      style={[styles.dayCell, selected && styles.dayCellActive]}
                      onPress={() => setSelectedDate(day)}
                    >
                      <Text style={[styles.dayWeek, selected && styles.dayWeekActive]}>
                        {formatWeekdayShort(day, ko)}
                      </Text>
                      <Text style={[styles.dayNum, selected && styles.dayNumActive]}>{day.getDate()}</Text>
                      {hasEvents && <View style={[styles.dot, selected && styles.dotActive]} />}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.filterRow}>
                {(["all", "pending", "accepted"] as FilterMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={[styles.filterChip, filterMode === mode && styles.filterChipActive]}
                    onPress={() => setFilterMode(mode)}
                  >
                    <Text style={[styles.filterText, filterMode === mode && styles.filterTextActive]}>
                      {mode === "all"
                        ? t("schedule.filterAll")
                        : mode === "pending"
                          ? t("schedule.filterPending")
                          : t("schedule.filterAccepted")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {dayEvents.length === 0 ? (
                <View style={styles.empty}>
                  <Calendar size={28} color={colors.muted} />
                  <Text style={styles.emptyText}>{t("schedule.noEvents")}</Text>
                </View>
              ) : (
                <View style={styles.eventList}>{dayEvents.map(renderEventCard)}</View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.askDarinBtn} onPress={() => {}}>
            <Sparkles size={14} color={colors.yellow} />
            <Text style={styles.askDarinText}>{t("schedule.askDarinPlaceholder")}</Text>
          </Pressable>
          <Pressable style={styles.newBtn} onPress={() => { setCounterEventId(null); setProposalOpen(true); }}>
            <Text style={styles.newBtnText}>{t("schedule.newSchedule")}</Text>
          </Pressable>
        </View>

        <ScheduleProposalModal
          open={proposalOpen}
          onClose={() => {
            setProposalOpen(false);
            setCounterEventId(null);
          }}
          defaultRole={userRole}
          caregiverName={caregiverName}
          childName={childName}
          linkedCaregiverId={linkedCaregiverId}
          counterMode={Boolean(counterEventId)}
          onCounterSubmit={(input) => {
            if (counterEventId) counterSchedule(counterEventId, input, userRole);
          }}
          onSubmit={(input) => {
            proposeSchedule(input);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  subtitleSmall: { fontSize: 11, color: colors.muted, marginTop: 2 },
  relationshipCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    gap: 4,
  },
  relLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginBottom: 2 },
  relLine: { fontSize: 12, color: colors.muted },
  mainScroll: { flex: 1 },
  mainContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  monthHint: { fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 16 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  monthBtn: { padding: 8, borderRadius: radius.md, backgroundColor: colors.yellowSoft },
  monthTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.muted },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthDayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  monthDayToday: { borderWidth: 1.5, borderColor: colors.yellow, borderRadius: radius.md },
  monthDaySelected: { backgroundColor: colors.yellowSoft, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.yellow },
  monthDayText: { fontSize: 15, fontWeight: "500", color: colors.text },
  monthDayTextToday: { fontWeight: "700" },
  monthDayTextSelected: { fontWeight: "700" },
  monthDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.yellow,
    marginTop: 4,
  },
  monthDotSelected: { backgroundColor: colors.text },
  weekSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  weekRow: { gap: 8 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  filterChipActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  filterText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  filterTextActive: { color: colors.text },
  dayCell: {
    width: 52,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  dayCellActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  dayWeek: { fontSize: 10, fontWeight: "600", color: colors.muted },
  dayWeekActive: { color: colors.text },
  dayNum: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },
  dayNumActive: { color: colors.text },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.yellow,
    marginTop: 6,
  },
  dotActive: { backgroundColor: colors.text },
  eventList: { gap: 10 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  askDarinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  askDarinText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground },
});
