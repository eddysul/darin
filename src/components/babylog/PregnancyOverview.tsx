import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLanguage } from "../../LanguageContext";
import type { BabyLogEntry, DiaryEntry } from "../../types/babyLog";
import type { ChildProfile } from "../../types/careSetup";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { customCategoryKey, resolveCustomCategoryStage } from "../../types/logCategory";
import { colors, fontScaleCap, radius } from "../../theme";
import { formatLocalizedDate } from "../../utils/localeFormat";
import { formatDateKey, parseDateKey } from "../../utils/dateKey";
import { getMonthMatrix } from "../../utils/trialCalendar";
import { formatGestationalAge, pregnancyProgressFromDueDate } from "../../utils/childDisplay";
import { formatTimelineLabel, formatTimelineSubtitle } from "../../utils/logSummary";
import { storedRecordValueLabel } from "../../utils/recordDisplay";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import {
  buildPregnancyDayItems,
  buildPregnancyRecentItems,
  buildPregnancyTodayStatus,
  buildPregnancyUpcomingEvents,
  pregnancyCalendarMarkedDates,
  PREGNANCY_WEEK_CONTENT,
  type PregnancyDayItem,
} from "../../utils/pregnancyOverview";
import { BabyLogIcon } from "./BabyLogIcon";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { LoadingState } from "../states/FeedbackStates";

const TOUCH = 48;
const WEEKDAY_KEYS = ["record.date.weekday.sun", "record.date.weekday.mon", "record.date.weekday.tue", "record.date.weekday.wed", "record.date.weekday.thu", "record.date.weekday.fri", "record.date.weekday.sat"] as const;

type Props = {
  child: ChildProfile;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  customCategories: CustomCategory[];
  dataState: "loading" | "ready" | "partial" | "error";
  onOpenRecord: (params?: { logId?: string; category?: LogCategoryKey }) => void;
  onOpenDiary: (params?: { diaryEntryId?: string }) => void;
};

function monthTitle(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(year, month, 1));
}

export function PregnancyOverview({
  child, logs, diaryEntries, customCategories, dataState, onOpenRecord, onOpenDiary,
}: Props) {
  const { locale, t } = useLanguage();
  const todayKey = formatDateKey();
  const today = parseDateKey(todayKey);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const pregnancyCustomCategories = useMemo(() => new Set<LogCategoryKey>(
    customCategories
      .filter((category) => resolveCustomCategoryStage(category) === "pregnancy")
      .map((category) => customCategoryKey(category.id)),
  ), [customCategories]);
  const progress = pregnancyProgressFromDueDate(child.dueDate, todayKey);
  const upcoming = useMemo(
    () => buildPregnancyUpcomingEvents(logs, todayKey, pregnancyCustomCategories),
    [logs, pregnancyCustomCategories, todayKey],
  );
  const todayStatus = useMemo(() => buildPregnancyTodayStatus(logs, diaryEntries, todayKey), [diaryEntries, logs, todayKey]);
  const recent = useMemo(() => buildPregnancyRecentItems({
    logs, diaries: diaryEntries, pregnancyCustomCategories, limit: 5,
  }), [diaryEntries, logs, pregnancyCustomCategories]);
  const markedDates = useMemo(() => pregnancyCalendarMarkedDates({
    logs, diaries: diaryEntries, events: upcoming, pregnancyCustomCategories,
  }), [diaryEntries, logs, pregnancyCustomCategories, upcoming]);
  const dayItems = useMemo(() => buildPregnancyDayItems({
    dateKey: selectedDateKey, logs, diaries: diaryEntries, events: upcoming, pregnancyCustomCategories,
  }), [diaryEntries, logs, pregnancyCustomCategories, selectedDateKey, upcoming]);
  const calendarDays = useMemo(() => getMonthMatrix(year, month), [month, year]);
  const weekContent = progress ? PREGNANCY_WEEK_CONTENT.find((item) => item.week === progress.weeks) : undefined;

  const dateLabel = (dateKey: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
    formatLocalizedDate(parseDateKey(dateKey), locale, options);
  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDateKey(formatDateKey(next, "midnight"));
  };
  const openItem = (item: PregnancyDayItem) => {
    if (item.kind === "diary") onOpenDiary({ diaryEntryId: item.diary.id });
    else onOpenRecord({ logId: item.log.id });
  };
  const logTitle = (log: BabyLogEntry) => formatTimelineLabel(log, customCategories, t);
  const compactDday = progress
    ? progress.remainingDays >= 0 ? `D-${progress.remainingDays}` : `D+${Math.abs(progress.remainingDays)}`
    : "—";
  const gestationalAge = formatGestationalAge(child.dueDate, todayKey, locale) ?? "—";

  return (
    <View style={styles.page}>
      <View
        style={styles.progressCard}
        accessibilityLabel={progress
          ? t("pregnancy.overview.progressMeta", { age: gestationalAge, percent: progress.percent })
          : t("pregnancy.overview.progressUnavailable")}
      >
        <View style={styles.progressHero}>
          <View style={styles.progressCopy}>
            <Text style={styles.kicker}>{t("pregnancy.overview.progressKicker")}</Text>
            <Text style={styles.dday}>{compactDday}</Text>
            <Text style={styles.due}>{child.dueDate
              ? t("pregnancy.overview.dueDate", { date: dateLabel(child.dueDate, { year: "numeric", month: "short", day: "numeric" }) })
              : t("pregnancy.overview.dueDateMissing")}</Text>
            <Text style={styles.progressMeta}>{progress
              ? t("pregnancy.overview.progressMeta", { age: gestationalAge, percent: progress.percent })
              : t("pregnancy.overview.progressUnavailable")}</Text>
          </View>
          <PregnancyRestDuck />
        </View>
        <View style={styles.progressTrack}>
          {progress ? <View style={[styles.progressFill, { width: `${progress.percent}%` }]} /> : null}
        </View>
      </View>

      {dataState === "partial" || dataState === "error" ? (
        <Text style={styles.stateNote}>{t("pregnancy.overview.incomplete")}</Text>
      ) : null}

      {dataState === "loading" ? <LoadingState label={t("report.critical.227")} /> : <>
      <SectionTitle text={t("pregnancy.overview.todayTitle")} />
      <View style={styles.statusGrid}>
        <StatusCard icon="heart" label={t("pregnancy.overview.condition")} value={todayStatus.condition?.chip ? storedRecordValueLabel(t, todayStatus.condition.chip) : t("pregnancy.overview.noCondition")} />
        <StatusCard icon="alert" label={t("pregnancy.overview.symptoms")} value={t("pregnancy.overview.count", { count: todayStatus.symptomCount })} />
        <StatusCard icon="baby" label={t("pregnancy.overview.kicks")} value={t("pregnancy.overview.count", { count: todayStatus.kickCount })} />
        <StatusCard icon="edit" label={t("pregnancy.overview.memos")} value={t("pregnancy.overview.count", { count: todayStatus.memoCount })} />
      </View>

      <SectionTitle text={t("pregnancy.overview.scheduleTitle")} />
      <View style={styles.card}>
        {upcoming.length ? upcoming.slice(0, 3).map((event, index) => (
          <Pressable
            key={event.id}
            style={({ pressed }) => [styles.scheduleRow, index > 0 && styles.separator, pressed && styles.pressed]}
            onPress={() => onOpenRecord({ logId: event.source.id })}
            accessibilityRole="button"
            accessibilityLabel={`${dateLabel(event.dateKey)} ${logTitle(event.source)}`}
          >
            <View style={styles.scheduleIcon}><LogCategoryIcon categoryKey={event.source.cat} customCategories={customCategories} size={18} color={colors.amberText} /></View>
            <View style={styles.flex}>
              <Text style={styles.rowEyebrow}>{index === 0 ? t("pregnancy.overview.nextAppointment") : dateLabel(event.dateKey)}</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>{event.source.title?.trim() || logTitle(event.source)}</Text>
              <Text style={styles.rowBody}>{dateLabel(event.dateKey, { weekday: "short", month: "short", day: "numeric" })}{event.time ? ` · ${event.time}` : ""}</Text>
            </View>
            <ChevronRight size={18} color={colors.faint} />
          </Pressable>
        )) : <Text style={styles.emptyText}>{t("pregnancy.overview.scheduleEmpty")}</Text>}
      </View>

      <SectionTitle text={t("pregnancy.overview.calendarTitle")} />
      <View style={styles.card}>
        <View style={styles.calendarHeader}>
          <Pressable style={styles.iconButton} onPress={() => moveMonth(-1)} accessibilityRole="button" accessibilityLabel={t("pregnancy.overview.previousMonth")}>
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.calendarTitle}>{monthTitle(year, month, locale)}</Text>
          <Pressable style={styles.iconButton} onPress={() => moveMonth(1)} accessibilityRole="button" accessibilityLabel={t("pregnancy.overview.nextMonth")}>
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.calendarGrid}>
          {WEEKDAY_KEYS.map((key) => <Text key={key} style={styles.weekday}>{t(key)}</Text>)}
          {calendarDays.map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const dateKey = formatDateKey(day, "midnight");
            const selected = dateKey === selectedDateKey;
            const todayDate = dateKey === todayKey;
            return (
              <Pressable
                key={dateKey}
                style={styles.dayCell}
                onPress={() => setSelectedDateKey(dateKey)}
                accessibilityRole="button"
                accessibilityLabel={dateLabel(dateKey, { weekday: "long", month: "long", day: "numeric" })}
                accessibilityState={{ selected }}
              >
                <View style={[styles.dayNumberWrap, selected && styles.daySelected, todayDate && !selected && styles.dayToday]}>
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{day.getDate()}</Text>
                </View>
                {markedDates.has(dateKey) ? <View style={[styles.marker, selected && styles.markerSelected]} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedTitle}>{t("pregnancy.overview.selectedDate", { date: dateLabel(selectedDateKey, { month: "long", day: "numeric" }) })}</Text>
        {dayItems.length ? dayItems.map((item) => (
          <RecordRow key={item.id} item={item} customCategories={customCategories} onPress={() => openItem(item)} />
        )) : <Text style={styles.emptyText}>{t("pregnancy.overview.dayEmpty")}</Text>}
      </View>

      {weekContent ? (
        <View style={styles.weekCard}>
          <Text style={styles.kicker}>{t("pregnancy.overview.weeklyTitle")}</Text>
          <Text style={styles.weekTitle}>{weekContent.title}</Text>
          <Text style={styles.weekBody}>{weekContent.body}</Text>
        </View>
      ) : null}

      <SectionTitle text={t("pregnancy.overview.recentTitle")} />
      <View style={styles.card}>
        {recent.length ? recent.map((item, index) => (
          <RecordRow key={item.id} item={item} customCategories={customCategories} onPress={() => openItem(item)} separator={index > 0} showDate />
        )) : <Text style={styles.emptyText}>{t("pregnancy.overview.recentEmpty")}</Text>}
      </View>
      </>}
    </View>
  );
}

function PregnancyRestDuck() {
  const reduceMotion = useReduceMotion();
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breath.stopAnimation();
    breath.setValue(0);
    if (reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, {
        toValue: 1,
        duration: 2_800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breath, {
        toValue: 0,
        duration: 2_800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breath, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.duckWrap,
        {
          transform: [
            { translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
            { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
          ],
        },
      ]}
    >
      <Image
        source={require("../../../assets/duck-pregnancy-rest.png")}
        style={styles.duckImage}
        contentFit="contain"
        transition={reduceMotion ? 0 : 120}
        accessible={false}
      />
    </Animated.View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle} maxFontSizeMultiplier={fontScaleCap.chrome}>{text}</Text>;
}

function StatusCard({ icon, label, value }: { icon: "heart" | "alert" | "baby" | "edit"; label: string; value: string }) {
  return (
    <View style={styles.statusCard} accessible accessibilityLabel={`${label}, ${value}`}>
      <View style={styles.statusIcon}><BabyLogIcon kind={icon} size={18} color={colors.amberText} /></View>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function RecordRow({
  item, customCategories, onPress, separator = false, showDate = false,
}: {
  item: PregnancyDayItem;
  customCategories: CustomCategory[];
  onPress: () => void;
  separator?: boolean;
  showDate?: boolean;
}) {
  const { locale, t } = useLanguage();
  const diary = item.kind === "diary" ? item.diary : null;
  const log = item.kind === "diary" ? null : item.log;
  const title = diary ? t("pregnancy.overview.diary") : log ? formatTimelineLabel(log, customCategories, t) : "";
  const subtitle = diary
    ? diary.comment.trim() || (diary.photos.length ? t("pregnancy.overview.photoCount", { count: diary.photos.length }) : "")
    : log ? formatTimelineSubtitle(log, t) : null;
  const image = diary?.photos[0];
  return (
    <Pressable
      style={({ pressed }) => [styles.recordRow, separator && styles.separator, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ""}`}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.thumbnail} contentFit="cover" transition={120} accessibilityLabel={t("pregnancy.overview.diary")} />
      ) : (
        <View style={styles.scheduleIcon}>
          {log ? <LogCategoryIcon categoryKey={log.cat} customCategories={customCategories} size={18} color={colors.amberText} /> : <BabyLogIcon kind="edit" size={18} color={colors.amberText} />}
        </View>
      )}
      <View style={styles.flex}>
        {showDate ? <Text style={styles.rowEyebrow}>{formatLocalizedDate(parseDateKey(item.dateKey), locale, { month: "short", day: "numeric" })}</Text> : null}
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowBody} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.rowTime}>{item.time}</Text>
      <ChevronRight size={17} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 14 },
  progressCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 18 },
  progressHero: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressCopy: { flex: 1, minWidth: 0 },
  kicker: { color: colors.muted, fontSize: 11.5, fontWeight: "800" },
  dday: { marginTop: 4, color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5 },
  due: { marginTop: 1, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  progressMeta: { marginTop: 8, color: colors.text, fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 999, backgroundColor: colors.chip, marginTop: 11 },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.amber },
  duckWrap: { width: 86, height: 86, alignItems: "center", justifyContent: "center" },
  duckImage: { width: 84, height: 84 },
  stateNote: { marginBottom: 12, borderRadius: radius.md, backgroundColor: colors.cardHi, color: colors.muted, fontSize: 12, lineHeight: 18, padding: 12 },
  sectionTitle: { marginTop: 6, marginBottom: 10, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  statusGrid: { flexDirection: "row", gap: 7, marginBottom: 20 },
  statusCard: { flex: 1, minWidth: 0, minHeight: 102, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 5, paddingVertical: 10 },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft, marginBottom: 6 },
  statusLabel: { color: colors.muted, fontSize: 10.5, lineHeight: 15, fontWeight: "700", textAlign: "center" },
  statusValue: { marginTop: 2, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 20 },
  scheduleRow: { minHeight: TOUCH, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  recordRow: { minHeight: TOUCH, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  scheduleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  rowEyebrow: { color: colors.amberText, fontSize: 10.5, lineHeight: 14, fontWeight: "800" },
  rowTitle: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontWeight: "800" },
  rowBody: { marginTop: 2, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  rowTime: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 13, textAlign: "center" },
  calendarHeader: { height: TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  calendarTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -2 },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: colors.faint, fontSize: 10.5, lineHeight: 24, fontWeight: "700" },
  dayCell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
  dayNumberWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.amber },
  dayToday: { borderWidth: 1, borderColor: colors.amber },
  dayNumber: { color: colors.text, fontSize: 12, fontWeight: "600" },
  dayNumberSelected: { color: colors.onDark, fontWeight: "800" },
  marker: { position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.amberText },
  markerSelected: { backgroundColor: colors.onDark },
  selectedTitle: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, color: colors.text, fontSize: 13, fontWeight: "800" },
  weekCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, padding: 16, marginBottom: 20 },
  weekTitle: { marginTop: 7, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  weekBody: { marginTop: 5, color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  thumbnail: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.cardHi },
});
