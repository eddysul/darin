import { useEffect, useMemo, useState } from "react";
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
import { formatDateKey, parseDateKey } from "../../utils/dateKey";
import { FEEDING_CATS } from "../../utils/reportAggregates";
import { toMinutes } from "../../utils/formatLog";
import { isCustomCategoryKey } from "../../types/logCategory";
import { colors, fontScaleCap, radius, type } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { formatTemperature, formatVolume } from "../../utils/measurementFormat";
import { diaperCounts } from "../../utils/diaperLog";
import { useCompactLayout } from "../../hooks/useCompactLayout";
import { useLanguage } from "../../LanguageContext";
import { formatDurationMinutes, formatLocalizedDate } from "../../utils/localeFormat";
import { formatContractionSpan, todayContractionSummary } from "../../utils/contractionLog";
import type { MessageKey } from "../../i18n";

type Props = {
  logs: BabyLogEntry[];
  dateKey?: string;
  pregnancy?: boolean;
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

function formatLastAgo(time: string | undefined, isToday: boolean, now: Date, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  if (!time) return t("home.summary.none");
  if (!isToday) return time;
  const current = now.getHours() * 60 + now.getMinutes();
  const recorded = toMinutes(time);
  let diff = current - recorded;
  if (diff < 0) diff += 24 * 60;
  if (diff < 1) return t("home.summary.now");
  if (diff < 60) return t("home.summary.minutesAgo", { count: diff });
  return t("home.summary.hoursAgo", { count: Math.floor(diff / 60) });
}

export function TodayLogSummaryCard({
  logs,
  dateKey = formatDateKey(),
  pregnancy = false,
  onPrevDay,
  onNextDay,
  canGoNext = true,
  canGoPrev = true,
  onPressDate,
}: Props) {
  const compact = useCompactLayout();
  const { t, locale } = useLanguage();
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const isToday = dateKey === formatDateKey();
  const title = t(isToday ? "home.summary.today" : "home.summary.day");
  const dateLabel = formatLocalizedDate(parseDateKey(dateKey), locale, { weekday: "short", month: "numeric", day: "numeric" });

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [isToday]);

  const metrics = useMemo(() => {
    if (pregnancy) {
      const contraction = todayContractionSummary(logs, dateKey);
      const symptomCount = countCat(logs, ["pregSymptom"]);
      const weightCount = countCat(logs, ["pregWeight"]);
      const kickCount = countCat(logs, ["pregKick"]);
      const latestWeight = [...logs]
        .filter((entry) => entry.cat === "pregWeight" && entry.amount)
        .sort((a, b) => b.time.localeCompare(a.time))[0];

      const core: MetricCard[] = [
        {
          key: "contraction",
          label: t("home.metric.contraction"),
          value: t("home.summary.count", { count: contraction.count }),
          detail: contraction.lastDurationSeconds == null
            ? undefined
            : `${t("record.contraction.lastDuration")} ${formatContractionSpan(t, contraction.lastDurationSeconds)}`,
          recentTime: latestTime(logs, (entry) => entry.cat === "contraction"),
          cat: "contraction",
        },
        {
          key: "pregSymptom",
          label: t("home.metric.morningSickness"), value: t("home.summary.count", { count: symptomCount }),
          recentTime: latestTime(logs, (entry) => entry.cat === "pregSymptom"),
          cat: "pregSymptom",
        },
        {
          key: "pregWeight",
          label: t("home.metric.weight"), value: t("home.summary.count", { count: weightCount }),
          detail: latestWeight?.amount ? `${latestWeight.amount}kg` : undefined,
          recentTime: latestTime(logs, (entry) => entry.cat === "pregWeight"),
          cat: "pregWeight",
        },
        {
          key: "pregKick",
          label: t("home.metric.kick"), value: t("home.summary.count", { count: kickCount }),
          recentTime: latestTime(logs, (entry) => entry.cat === "pregKick"),
          cat: "pregKick",
        },
      ];

      const extras: Array<{
        key: string;
        label: string;
        cats: BabyLogCategoryId[];
        cat: BabyLogCategoryId;
        detail?: () => string | undefined;
      }> = [
        { key: "pregMood", label: t("home.metric.condition"), cats: ["pregMood"], cat: "pregMood" },
        {
          key: "pregBp",
          label: t("home.metric.bloodPressure"),
          cats: ["pregBp"],
          cat: "pregBp",
          detail: () => {
            const latest = [...logs]
              .filter((entry) => entry.cat === "pregBp" && (entry.amount || entry.chip))
              .sort((a, b) => b.time.localeCompare(a.time))[0];
            return latest?.amount ? `${latest.amount}${latest.amount.includes("/") ? "" : "mmHg"}` : undefined;
          },
        },
        { key: "pregMed", label: t("home.metric.supplement"), cats: ["pregMed"], cat: "pregMed" },
        { key: "pregHospital", label: t("home.metric.hospital"), cats: ["pregHospital"], cat: "pregHospital" },
      ];
      if (contraction.lastIntervalSeconds != null || contraction.avgIntervalSeconds != null) {
        extras.unshift({
          key: "contractionInterval",
          label: t("record.contraction.interval"),
          cats: ["contraction"],
          cat: "contraction",
          detail: () => {
            const parts = [
              contraction.lastIntervalSeconds != null
                ? `${t("record.contraction.lastInterval")} ${formatContractionSpan(t, contraction.lastIntervalSeconds)}`
                : t("record.contraction.first"),
              contraction.avgIntervalSeconds != null
                ? `${t("record.contraction.avgInterval")} ${formatContractionSpan(t, contraction.avgIntervalSeconds)}`
                : null,
            ].filter(Boolean);
            return parts.join(" · ") || undefined;
          },
        });
      }

      const dynamic: MetricCard[] = [];
      for (const extra of extras) {
        const n = countCat(logs, extra.cats);
        if (n <= 0) continue;
        dynamic.push({
          key: extra.key,
          label: extra.label,
          value: t("home.summary.count", { count: n }),
          detail: extra.detail?.(),
          recentTime: latestTime(
            logs,
            (entry) =>
              !isCustomCategoryKey(entry.cat) && extra.cats.includes(entry.cat as BabyLogCategoryId),
          ),
          cat: extra.cat,
        });
      }

      return [...core, ...dynamic];
    }
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
        label: t("home.metric.feeding"), value: t("home.summary.count", { count: feedingCount }),
        detail: feedingAmount > 0 ? formatVolume(Math.round(feedingAmount)) : undefined,
        recentTime: lastFeedingTime,
        cat: "formula",
      },
      {
        key: "sleep",
        label: t("home.metric.sleep"), value: t("home.summary.count", { count: sleepCount }), detail: sleepMinutes > 0 ? formatDurationMinutes(sleepMinutes, locale) : undefined,
        recentTime: lastSleepTime,
        cat: "sleep",
      },
      {
        key: "diaper",
        label: t("home.metric.diaper"), value: t("home.summary.count", { count: diaper.total }),
        detail:
          diaper.urine || diaper.stool
            ? t("home.summary.diaperDetail", { urine: diaper.urine, stool: diaper.stool })
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
      { key: "bath", label: t("home.metric.bath"), cats: ["bath"], cat: "bath" },
      {
        key: "pump",
        label: t("home.metric.pump"),
        cats: ["pump"],
        cat: "pump",
        detail: () => {
          const ml = sumAmount(logs, ["pump"]);
          return ml > 0 ? formatVolume(Math.round(ml)) : undefined;
        },
      },
      { key: "med", label: t("home.metric.medicine"), cats: ["med"], cat: "med" },
      {
        key: "temp",
        label: t("home.metric.temperature"),
        cats: ["temp"],
        cat: "temp",
        detail: () => {
          const temps = logs
            .filter((e) => e.cat === "temp" && e.amount)
            .map((e) => e.amount!);
          return temps[0] ? formatTemperature(temps[0]) : undefined;
        },
      },
      { key: "food", label: t("home.metric.food"), cats: ["food", "snack"], cat: "food" },
      { key: "tummy", label: t("home.metric.tummy"), cats: ["tummy"], cat: "tummy" },
      { key: "play", label: t("home.metric.play"), cats: ["play"], cat: "play" },
      { key: "doctor", label: t("home.metric.doctor"), cats: ["doctor"], cat: "doctor" },
      {
        key: "vaccination",
        label: t("home.metric.vaccination"),
        cats: ["vaccination"],
        cat: "vaccination",
        detail: () => {
          const latest = [...logs].filter((entry) => entry.cat === "vaccination").sort((a, b) => b.time.localeCompare(a.time))[0];
          if (!latest?.vaccineName) return undefined;
          const round = latest.vaccinationRound === "first" ? t("home.vaccine.first") : latest.vaccinationRound === "second" ? t("home.vaccine.second") : latest.vaccinationRound === "third" ? t("home.vaccine.third") : latest.vaccinationRound === "booster" ? t("home.vaccine.booster") : latest.vaccinationRoundText;
          return [latest.vaccineName, round].filter(Boolean).join(" · ");
        },
      },
      { key: "water", label: t("home.metric.water"), cats: ["water"], cat: "water" },
    ];

    const dynamic: MetricCard[] = [];
    for (const extra of extras) {
      const n = countCat(logs, extra.cats);
      if (n <= 0) continue;
      dynamic.push({
        key: extra.key,
        label: extra.label,
        value: t("home.summary.count", { count: n }),
        detail: extra.detail?.(),
        recentTime: latestTime(
          logs,
          (entry) =>
            !isCustomCategoryKey(entry.cat) && extra.cats.includes(entry.cat as BabyLogCategoryId),
        ),
        cat: extra.cat,
      });
    }

    return [...core, ...dynamic];
  }, [dateKey, locale, logs, pregnancy, t]);

  const pageCount = Math.max(1, Math.ceil(metrics.length / 3));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / PAGE_STRIDE);
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
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
            accessibilityLabel={t("home.a11y.previousDay")}
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
            accessibilityLabel={t("home.a11y.selectDate")}
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
            accessibilityLabel={t("home.a11y.nextDay")}
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
              <Text
                style={styles.metricLabel}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={fontScaleCap.chrome}
              >
                {metric.label}
              </Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text
                style={[styles.metricDetail, !metric.detail && styles.metricDetailEmpty]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {metric.detail ?? " "}
              </Text>
              <Text
                style={[styles.metricRecent, !metric.recentTime && styles.metricRecentEmpty]}
                accessibilityLabel={
                  metric.recentTime
                    ? t("home.summary.last", { label: metric.label, time: formatLastAgo(metric.recentTime, isToday, now, t) })
                    : t("home.summary.noMetric", { label: metric.label })
                }
              >
                {formatLastAgo(metric.recentTime, isToday, now, t)}
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
    marginBottom: 10,
    paddingVertical: 12,
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
  cardCompact: {
    marginBottom: 6,
    paddingVertical: 8,
  },
  header: {
    paddingHorizontal: SIDE_PAD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: type.md, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
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
  dateButton: { minHeight: 44, minWidth: 104, paddingHorizontal: 8, borderRadius: radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  date: { fontSize: type.xs, color: colors.muted, fontWeight: "700", textAlign: "center" },
  calendarHint: { color: colors.faint, fontSize: 10 },
  arrowBtn: {
    width: 44,
    height: 44,
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
    minHeight: 110,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0E9E1",
    backgroundColor: colors.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    marginTop: 6,
    fontSize: type.xs,
    lineHeight: 15,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  metricValue: { marginTop: 2, fontSize: type.md, color: colors.text, fontWeight: "800" },
  metricDetail: {
    marginTop: 2,
    fontSize: type.xs,
    color: colors.amberText,
    fontWeight: "700",
    textAlign: "center",
  },
  metricDetailEmpty: { color: "transparent" },
  metricRecent: {
    marginTop: 2,
    fontSize: type.xs,
    color: colors.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  metricRecentEmpty: { color: colors.faint, fontWeight: "600" },
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
