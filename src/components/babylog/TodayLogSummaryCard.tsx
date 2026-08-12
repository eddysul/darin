import { useMemo, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import { getCategory } from "../../constants/babyLogCategories";
import type { BabyLogEntry } from "../../types/babyLog";
import { dayNavLabel, formatDateKey } from "../../utils/dateKey";
import { FEEDING_CATS } from "../../utils/reportAggregates";
import { toMinutes } from "../../utils/formatLog";
import { isCustomCategoryKey } from "../../types/logCategory";
import { colors, radius } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { formatTemperature, formatVolume } from "../../utils/measurementFormat";
import { diaperCounts } from "../../utils/diaperLog";

type Props = {
  logs: BabyLogEntry[];
  dateKey?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  onPressDate?: () => void;
};

type MetricCard = {
  key: string;
  label: string;
  value: string;
  detail?: string;
  recentTime?: string;
  cat: BabyLogCategoryId;
};

const SCREEN_W = Dimensions.get("window").width;
const CARD_GAP = 8;
const SIDE_PAD = 17;
/** ~3 cards visible like the demo carousel */
const CARD_W = Math.min(112, (SCREEN_W - 40 - SIDE_PAD * 2 - CARD_GAP * 2) / 3);
const PAGE_STRIDE = CARD_W * 3 + CARD_GAP * 3;

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function countCat(logs: BabyLogEntry[], cats: BabyLogCategoryId[]): number {
  return logs.filter(
    (entry) =>
      !isCustomCategoryKey(entry.cat) && cats.includes(entry.cat as BabyLogCategoryId),
  ).length;
}

function sumAmount(logs: BabyLogEntry[], cats: BabyLogCategoryId[]): number {
  return logs
    .filter(
      (entry) =>
        !isCustomCategoryKey(entry.cat)
        && cats.includes(entry.cat as BabyLogCategoryId)
        && (!entry.amountUnit || entry.amountUnit === "ml" || entry.amountUnit === "oz"),
    )
    .reduce((total, entry) => total + (Number.parseFloat(entry.amount ?? "0") || 0), 0);
}

function sumSleepMinutes(logs: BabyLogEntry[]): number {
  return logs
    .filter((entry) => entry.cat === "sleep")
    .reduce((total, entry) => total + (Number.parseInt(entry.duration ?? "0", 10) || 0), 0);
}

function latestTime(logs: BabyLogEntry[], predicate: (entry: BabyLogEntry) => boolean): string | undefined {
  return logs
    .filter(predicate)
    .reduce<BabyLogEntry | undefined>(
      (latest, entry) => (!latest || toMinutes(entry.time) > toMinutes(latest.time) ? entry : latest),
      undefined,
    )?.time;
}

export function TodayLogSummaryCard({
  logs,
  dateKey = formatDateKey(),
  onPrevDay,
  onNextDay,
  canGoNext = true,
  canGoPrev = true,
  onPressDate,
}: Props) {
  const [page, setPage] = useState(0);
  const isToday = dateKey === formatDateKey();
  const title = isToday ? "오늘 요약" : "하루 요약";
  const dateLabel = dayNavLabel(dateKey);

  const metrics = useMemo(() => {
    const feedingCount = countCat(logs, FEEDING_CATS);
    const feedingAmount = sumAmount(logs, FEEDING_CATS);
    const sleepCount = countCat(logs, ["sleep"]);
    const sleepMinutes = sumSleepMinutes(logs);
    const diaper = diaperCounts(logs);
    const lastFeedingTime = latestTime(
      logs,
      (entry) => !isCustomCategoryKey(entry.cat) && FEEDING_CATS.includes(entry.cat as BabyLogCategoryId),
    );
    const lastSleepTime = latestTime(logs, (entry) => entry.cat === "sleep");
    const lastDiaperTime = latestTime(logs, (entry) => entry.cat === "diaper");

    const core: MetricCard[] = [
      {
        key: "feeding",
        label: "수유",
        value: `${feedingCount}회`,
        detail: feedingAmount > 0 ? formatVolume(Math.round(feedingAmount)) : undefined,
        recentTime: lastFeedingTime,
        cat: "formula",
      },
      {
        key: "sleep",
        label: "수면",
        value: `${sleepCount}회`,
        detail: sleepMinutes > 0 ? formatDuration(sleepMinutes) : undefined,
        recentTime: lastSleepTime,
        cat: "sleep",
      },
      {
        key: "diaper",
        label: "기저귀",
        value: `${diaper.total}회`,
        detail:
          diaper.urine || diaper.stool
            ? `소변 ${diaper.urine} · 대변 ${diaper.stool}`
            : undefined,
        recentTime: lastDiaperTime,
        cat: "diaper",
      },
    ];

    const extras: Array<{
      key: string;
      label: string;
      cats: BabyLogCategoryId[];
      cat: BabyLogCategoryId;
      detail?: () => string | undefined;
    }> = [
      { key: "bath", label: "목욕", cats: ["bath"], cat: "bath" },
      {
        key: "pump",
        label: "유축",
        cats: ["pump"],
        cat: "pump",
        detail: () => {
          const ml = sumAmount(logs, ["pump"]);
          return ml > 0 ? formatVolume(Math.round(ml)) : undefined;
        },
      },
      { key: "med", label: "약", cats: ["med"], cat: "med" },
      {
        key: "temp",
        label: "체온",
        cats: ["temp"],
        cat: "temp",
        detail: () => {
          const temps = logs
            .filter((e) => e.cat === "temp" && e.amount)
            .map((e) => e.amount!);
          return temps[0] ? formatTemperature(temps[0]) : undefined;
        },
      },
      { key: "food", label: "이유식", cats: ["food", "snack"], cat: "food" },
      { key: "tummy", label: "터미타임", cats: ["tummy"], cat: "tummy" },
      { key: "play", label: "놀이", cats: ["play"], cat: "play" },
      { key: "doctor", label: "진료", cats: ["doctor"], cat: "doctor" },
      {
        key: "vaccination",
        label: "예방접종",
        cats: ["vaccination"],
        cat: "vaccination",
        detail: () => {
          const latest = [...logs].filter((entry) => entry.cat === "vaccination").sort((a, b) => b.time.localeCompare(a.time))[0];
          if (!latest?.vaccineName) return undefined;
          const round = latest.vaccinationRound === "first" ? "1차" : latest.vaccinationRound === "second" ? "2차" : latest.vaccinationRound === "third" ? "3차" : latest.vaccinationRound === "booster" ? "추가" : latest.vaccinationRoundText;
          return [latest.vaccineName, round].filter(Boolean).join(" · ");
        },
      },
      { key: "water", label: "물", cats: ["water"], cat: "water" },
    ];

    const dynamic: MetricCard[] = [];
    for (const extra of extras) {
      const n = countCat(logs, extra.cats);
      if (n <= 0) continue;
      dynamic.push({
        key: extra.key,
        label: extra.label,
        value: `${n}회`,
        detail: extra.detail?.(),
        cat: extra.cat,
      });
    }

    return [...core, ...dynamic];
  }, [logs]);

  const pageCount = Math.max(1, Math.ceil(metrics.length / 3));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / PAGE_STRIDE);
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.infoBadge}>
            <Text style={styles.infoText}>i</Text>
          </View>
        </View>
        <View style={styles.dateRow}>
          <Pressable
            onPress={onPrevDay}
            disabled={!canGoPrev || !onPrevDay}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="이전 날"
            style={({ pressed }) => [
              styles.arrowBtn,
              (!canGoPrev || !onPrevDay) && styles.arrowDisabled,
              pressed && canGoPrev && onPrevDay && styles.arrowPressed,
            ]}
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Pressable
            onPress={onPressDate}
            disabled={!onPressDate}
            accessibilityRole="button"
            accessibilityLabel="기록 날짜 선택"
            style={styles.dateButton}
          >
            <Text style={styles.date}>{dateLabel}</Text>
            {onPressDate ? <Text style={styles.calendarHint}>▾</Text> : null}
          </Pressable>
          <Pressable
            onPress={onNextDay}
            disabled={!canGoNext || !onNextDay}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="다음 날"
            style={({ pressed }) => [
              styles.arrowBtn,
              (!canGoNext || !onNextDay) && styles.arrowDisabled,
              pressed && canGoNext && onNextDay && styles.arrowPressed,
            ]}
          >
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={PAGE_STRIDE}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={styles.metricsContent}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
      >
        {metrics.map((metric) => {
          const category = getCategory(metric.cat);
          return (
            <View key={metric.key} style={[styles.metricCard, { width: CARD_W }]}>
              <View style={[styles.iconWrap, { backgroundColor: `${category.color}18` }]}>
                <BabyLogIcon catId={metric.cat} size={22} color={category.color} strokeWidth={1.8} />
              </View>
              <Text style={styles.metricLabel} numberOfLines={1}>
                {metric.label}
              </Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={[styles.metricDetail, !metric.detail && styles.metricDetailEmpty]}>
                {metric.detail ?? " "}
              </Text>
              <Text style={[styles.metricRecent, !metric.recentTime && styles.metricRecentEmpty]}>
                {metric.recentTime ? `최근 ${metric.recentTime}` : "최근 없음"}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {pageCount > 1 ? (
        <View style={styles.pageDots}>
          {Array.from({ length: pageCount }).map((_, index) => (
            <View
              key={index}
              style={[styles.pageDot, index === page && styles.pageDotActive]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.pageDotsSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#4A3428",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  header: {
    paddingHorizontal: SIDE_PAD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  infoBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { color: colors.faint, fontSize: 9, lineHeight: 11, fontWeight: "800" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateButton: { minHeight: 32, minWidth: 104, paddingHorizontal: 5, borderRadius: radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  date: { fontSize: 12, color: colors.muted, fontWeight: "700", textAlign: "center" },
  calendarHint: { color: colors.faint, fontSize: 10 },
  arrowBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 20, lineHeight: 22, color: colors.text, fontWeight: "500" },
  arrowPressed: { opacity: 0.55 },
  arrowDisabled: { opacity: 0.28 },
  metricsContent: {
    paddingHorizontal: SIDE_PAD,
    gap: CARD_GAP,
    paddingRight: SIDE_PAD + 8,
  },
  metricCard: {
    minHeight: 134,
    paddingHorizontal: 6,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0E9E1",
    backgroundColor: "#FFFCFA",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: { marginTop: 8, fontSize: 11, color: colors.text, fontWeight: "700" },
  metricValue: { marginTop: 4, fontSize: 17, color: colors.text, fontWeight: "800" },
  metricDetail: {
    marginTop: 2,
    fontSize: 10,
    color: colors.amber,
    fontWeight: "700",
    textAlign: "center",
  },
  metricDetailEmpty: { color: "transparent" },
  metricRecent: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  metricRecentEmpty: { color: "transparent" },
  pageDots: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pageDotsSpacer: { height: 8 },
  pageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  pageDotActive: { width: 14, height: 5, borderRadius: 3, backgroundColor: colors.muted },
});
