import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InsightDetailSheet } from "./InsightDetailSheet";
import type { WeeklyFeatureTable, WeeklyMetric } from "../../utils/weeklyFeatureTable";
import { buildWeekStrip, stripHasData } from "../../utils/weekStrip";
import { displayMeta } from "../../utils/logCategoryDisplay";
import { INSIGHT_WINDOW_DAYS, type Insight } from "../../utils/careInsights";
import type { InsightPhrases } from "../../utils/insightPhrase";
import { insightKey } from "../../utils/insightPhrasePrompt";
import type { BabyLogEntry } from "../../types/babyLog";
import { colors, radius } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import type { ReportCriticalKey } from "../../i18nReportCriticalMessages";
import {
  chartCategoryLabel,
  formatPeriodRange,
  formatWeeklyAmount,
  localizeInsight,
  stripDayLabel,
  weeklyMetricLabel,
} from "../../utils/insightDisplay";

type Props = {
  visible: boolean;
  table: WeeklyFeatureTable | null;
  logs: BabyLogEntry[];
  /** 통계 검정을 통과한 관계. 예전에는 한눈에 탭의 별도 카드였다. */
  insights: Insight[];
  /** AI 가 다듬은 문장. 없는 발견은 우리 문장으로 나간다. */
  insightPhrases: InsightPhrases;
  babyName: string;
  onClose: () => void;
};

/**
 * 상세 기록의 묶음과 순서. 표에 있는 지표만 그려지므로
 * 여기 없는 키가 생기면 조용히 빠진다. 마지막 묶음에서 나머지를 주워담는다.
 */
const GROUPS: { titleKey: ReportCriticalKey; keys: string[] }[] = [
  { titleKey: "report.critical.007", keys: ["feedCount", "feedVolume", "feedIntervalAvg", "firstFeedMinutes", "lastFeedMinutes"] },
  { titleKey: "report.critical.097", keys: ["foodAmount", "milkVolume", "waterVolume"] },
  { titleKey: "report.critical.008", keys: ["sleepMinutes", "nightSleepMinutes", "longestSleepMinutes", "sleepCount"] },
  { titleKey: "report.critical.098", keys: ["diaperCount", "stoolCount"] },
  { titleKey: "report.critical.099", keys: ["tummyMinutes", "playMinutes", "bathMinutes"] },
];

/** 길이가 아니라 하루 중의 시각인 지표. 6시간 40분이 아니라 6:40으로 읽어야 한다. */
const CLOCK_KEYS = ["firstFeedMinutes", "lastFeedMinutes", "bathMinutes"];

/** 세로 스트립 높이. 24시간을 여기에 펼친다. */
const STRIP_HEIGHT = 380;

/** 값 자체를 읽는 방식. 시각 지표는 시계로 읽는다. */
function formatMetric(metric: WeeklyMetric, value: number, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  return formatWeeklyAmount(metric.key, metric.unit, value, t, locale);
}

/** 두 값의 차이. 시각 지표라도 차이는 시계가 아니라 길이로 읽어야 한다. */
function formatGap(metric: WeeklyMetric, value: number, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  if (CLOCK_KEYS.includes(metric.key)) {
    return formatWeeklyAmount("sleepMinutes", "minutes", value, t, locale);
  }
  return formatAmount(metric, Math.round(value), t, locale);
}

function formatAmount(metric: WeeklyMetric, rounded: number, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  return formatWeeklyAmount(metric.key, metric.unit, rounded, t, locale);
}

/** 평균 밑에 붙는 줄. 지난주 평균과 이번 주 최소~최대를 같이 보여준다. */
function subLine(metric: WeeklyMetric, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  const range =
    metric.thisWeek.min === metric.thisWeek.max
      ? ""
      : t("report.critical.117", { min: formatMetric(metric, metric.thisWeek.min, t, locale), max: formatMetric(metric, metric.thisWeek.max, t, locale) });
  const previous = metric.lastWeek ? t("report.critical.118", { value: formatMetric(metric, metric.lastWeek.avg, t, locale) }) : t("report.critical.100");
  return range ? `${previous} · ${range}` : previous;
}

function MetricRow({ metric }: { metric: WeeklyMetric }) {
  const { locale, t } = useLanguage();
  const gap = metric.lastWeek !== null ? Math.abs(metric.thisWeek.avg - metric.lastWeek.avg) : 0;
  const changed =
    metric.lastWeek === null
      ? false
      : CLOCK_KEYS.includes(metric.key)
        ? gap >= 30
        : metric.changeRatio !== null && Math.abs(metric.changeRatio) >= 0.15;
  const up = metric.lastWeek !== null && metric.thisWeek.avg > metric.lastWeek.avg;

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{weeklyMetricLabel(metric.key, t)}</Text>
        <Text style={styles.rowValue}>{formatMetric(metric, metric.thisWeek.avg, t, locale)}</Text>
        {metric.lastWeek === null ? (
          <Text style={styles.badgeFlat}>{t("report.critical.101")}</Text>
        ) : changed ? (
          <Text style={[styles.badge, up ? styles.badgeUp : styles.badgeDown]}>
            {up ? "▲" : "▼"} {formatGap(metric, gap, t, locale)}
          </Text>
        ) : (
          <Text style={styles.badgeFlat}>{t("report.critical.102")}</Text>
        )}
      </View>
      <Text style={styles.rowSub}>{subLine(metric, t, locale)}</Text>
    </View>
  );
}

/**
 * 발견 한 줄.
 *
 * AI 가 다듬은 문장이 오면 그걸 쓰고, 없으면 규칙으로 만든 조각을 이어 붙인다.
 * 어느 쪽이든 차이 값(gapText)에만 색을 준다. 부모가 기억할 숫자는 그거 하나다.
 */
function FindLine({
  insight,
  phrase,
  babyName,
}: {
  insight: Insight;
  phrase?: string;
  babyName: string;
}) {
  const { locale, t } = useLanguage();
  if (!phrase) {
    const copy = localizeInsight(insight, t, locale);
    return (
      <Text style={styles.findHeadline}>
        {copy.lead}
        {babyName ? t("report.critical.122", { babyName }) : ""}
        <Text style={styles.findGap}>{copy.gapText}</Text> {copy.tail}
      </Text>
    );
  }

  const at = phrase.indexOf(insight.gapText);
  if (at < 0) return <Text style={styles.findHeadline}>{phrase}</Text>;
  return (
    <Text style={styles.findHeadline}>
      {phrase.slice(0, at)}
      <Text style={styles.findGap}>{insight.gapText}</Text>
      {phrase.slice(at + insight.gapText.length)}
    </Text>
  );
}

export function WeeklyReportSheet({
  visible,
  table,
  logs,
  insights,
  insightPhrases,
  babyName,
  onClose,
}: Props) {
  const { locale, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [openInsight, setOpenInsight] = useState<Insight | null>(null);
  const strip = useMemo(() => buildWeekStrip(logs), [logs]);
  const showStrip = stripHasData(strip);

  const groups = useMemo(() => {
    if (!table) return [];
    const used = new Set<string>();
    const named = GROUPS.map((group) => {
      const metrics = group.keys.flatMap((key) => {
        const metric = table.metrics.find((item) => item.key === key);
        if (!metric) return [];
        used.add(key);
        return [metric];
      });
      return { title: t(group.titleKey), metrics };
    }).filter((group) => group.metrics.length > 0);

    const rest = table.metrics.filter((metric) => !used.has(metric.key));
    return rest.length > 0 ? [...named, { title: t("report.critical.103"), metrics: rest }] : named;
  }, [t, table]);

  if (!table) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel={t("report.critical.104")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.period}>
              {formatPeriodRange(table.meta.dateKeys, t)}
              {table.meta.ageMonths !== null ? ` · ${t("report.critical.120", { months: table.meta.ageMonths })}` : ""}
            </Text>
            <Text style={styles.title}>{t("report.critical.105")}</Text>
            <Text style={styles.titleSub}>{t("report.critical.112", { days: table.meta.recordedDays })}</Text>

            {groups.map((group) => (
              <View key={group.title}>
                <Text style={styles.sectionLabel}>{group.title}</Text>
                {group.metrics.map((metric) => (
                  <MetricRow key={metric.key} metric={metric} />
                ))}
              </View>
            ))}

            {showStrip ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.majorLabel}>{t("report.critical.106")}</Text>
                <View style={styles.stripDays}>
                  <View style={styles.axisSpacer} />
                  {strip.days.map((day) => (
                    <Text key={day.dateKey} style={styles.stripDay}>{stripDayLabel(day.dateKey, t)}</Text>
                  ))}
                </View>

                <View style={styles.stripBody}>
                  <View style={styles.axis}>
                    {[0, 6, 12, 18, 24].map((hour) => (
                      <Text key={hour} style={[styles.axisLabel, { top: (hour / 24) * STRIP_HEIGHT - 6 }]}>
                        {hour}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.stripCols}>
                    {strip.days.map((day) => (
                      <View key={day.dateKey} style={styles.stripCol}>
                        {day.blocks.map((block, index) => (
                          <View
                            key={`b${index}`}
                            style={[
                              styles.stripBlock,
                              {
                                top: `${block.startPct}%`,
                                height: `${block.widthPct}%`,
                                backgroundColor: displayMeta(block.key).color,
                              },
                            ]}
                          />
                        ))}
                        {day.ticks.map((tick, index) => (
                          <View
                            key={`t${index}`}
                            style={[
                              styles.stripTick,
                              { top: `${tick.pct}%`, backgroundColor: displayMeta(tick.key).color },
                            ]}
                          />
                        ))}
                      </View>
                    ))}

                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      {[6, 12, 18].map((hour) => (
                        <View key={hour} style={[styles.gridLine, { top: (hour / 24) * STRIP_HEIGHT }]} />
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.stripLegendRow}>
                  {strip.legend.map((item) => (
                    <View key={item.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendText}>{chartCategoryLabel(item.key, t)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {insights.length > 0 ? (
              <>
                <View style={styles.divider} />
                <View style={styles.findHead}>
                  <Text style={styles.majorLabel}>{t("report.critical.092")}</Text>
                  <Text style={styles.findDays}>
                    {t("report.critical.113", { window: INSIGHT_WINDOW_DAYS, days: insights[0].distribution.totalDays })}
                  </Text>
                </View>
                {insights.map((item, index) => (
                  <Pressable
                    key={insightKey(item)}
                    style={[styles.findRow, index > 0 && styles.findRowNext]}
                    onPress={() => setOpenInsight(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t("report.critical.121", { headline: insightPhrases[insightKey(item)] ?? localizeInsight(item, t, locale).headline })}
                  >
                    <FindLine
                      insight={item}
                      phrase={insightPhrases[insightKey(item)]}
                      babyName={insights.length === 1 ? babyName : ""}
                    />
                    <Text style={styles.findChevron}>›</Text>
                  </Pressable>
                ))}
                <Text style={styles.findNote}>{t("report.critical.107")}</Text>
              </>
            ) : null}

            <View style={styles.caution}>
              <Text style={styles.cautionText}>
                {t("report.critical.108")}
              </Text>
            </View>
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t("report.critical.104")}</Text>
          </Pressable>
        </View>

        {/*
          발견 상세는 이 모달 "안"에 둔다.
          iOS 에서는 이미 떠 있는 모달의 형제로 둔 모달이 화면에 나오지 않는다.
        */}
        <InsightDetailSheet
          visible={openInsight !== null}
          insight={openInsight}
          babyName={babyName}
          onClose={() => setOpenInsight(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  backdropFill: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "88%",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  period: { fontSize: 10.5, color: colors.faint, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  titleSub: { fontSize: 11.5, lineHeight: 18, color: colors.faint, marginTop: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.faint,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 4,
  },
  /** 큰 단위(상세 기록 / 하루 일과 비교 / 발견)를 가르는 선. */
  divider: { height: 1, backgroundColor: colors.border, marginTop: 26 },
  majorLabel: { fontSize: 14.5, fontWeight: "800", color: colors.text, marginTop: 20, marginBottom: 8 },
  findHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  findDays: { flexShrink: 1, fontSize: 10, color: colors.faint, textAlign: "right" },
  findRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  findRowNext: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 11 },
  findHeadline: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.text, lineHeight: 21 },
  findGap: { color: colors.amber, fontWeight: "800" },
  findChevron: { fontSize: 19, color: colors.faint },
  findNote: { fontSize: 10.5, color: colors.faint, marginTop: 11 },
  row: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowLabel: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: "700", color: colors.text },
  rowValue: { flexShrink: 1, textAlign: "right", fontSize: 14, fontWeight: "800", color: colors.text },
  rowSub: { fontSize: 10.5, color: colors.faint, marginTop: 3 },
  badge: {
    minWidth: 54,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: "hidden",
  },
  badgeUp: { color: "#3F6E51", backgroundColor: "rgba(63,110,81,0.10)" },
  badgeDown: { color: colors.dangerText, backgroundColor: colors.dangerSoft },
  badgeFlat: {
    minWidth: 54,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.faint,
    backgroundColor: colors.cardHi,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: "hidden",
  },
  stripDays: { flexDirection: "row", gap: 5, marginTop: 8, marginBottom: 5 },
  axisSpacer: { width: 18 },
  stripDay: { flex: 1, fontSize: 10, fontWeight: "700", color: colors.faint, textAlign: "center" },
  stripBody: { flexDirection: "row", gap: 5 },
  axis: { width: 18, height: STRIP_HEIGHT },
  axisLabel: { position: "absolute", right: 3, fontSize: 9, color: colors.faint },
  stripCols: { flex: 1, flexDirection: "row", gap: 5, height: STRIP_HEIGHT },
  stripCol: { flex: 1, height: STRIP_HEIGHT, borderRadius: 4, backgroundColor: colors.cardHi, overflow: "hidden" },
  stripBlock: { position: "absolute", left: 0, right: 0, borderRadius: 4 },
  stripTick: { position: "absolute", left: 0, right: 0, height: 3, borderRadius: 1.5 },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.7 },
  stripLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 13,
    rowGap: 6,
    marginTop: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flexShrink: 1, fontSize: 10, color: colors.faint },
  caution: { marginTop: 22, padding: 13, borderRadius: radius.md, backgroundColor: colors.cardHi },
  cautionText: { fontSize: 11.5, lineHeight: 18, color: colors.faint },
  closeBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.amber,
  },
  closeText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
