import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { OverviewSpriteSheet } from "./OverviewSprite";
import { overviewAssets } from "./overviewAssets";
import { useLanguage } from "../../LanguageContext";
import type { BabyLogEntry, DiaryEntry } from "../../types/babyLog";
import type { Insight } from "../../utils/careInsights";
import type { InsightPhrases } from "../../utils/insightPhrase";
import {
  formatMonthDay,
  formatWeekOfMonth,
  formatWeeklyAmount,
  localizeInsight,
  weeklyMetricLabel,
} from "../../utils/insightDisplay";
import { insightKey } from "../../utils/insightPhrasePrompt";
import { buildAllReport, buildMonthReport } from "../../utils/periodReport";
import type { WeeklyFeatureTable, WeeklyMetric } from "../../utils/weeklyFeatureTable";
import { colors, fontScaleCap } from "../../theme";
import { EmptyState, ErrorState, LoadingState } from "../states/FeedbackStates";

const TOUCH = 48;
const WATCH = "#69C3AE";
const KEY_METRICS = ["feedCount", "sleepMinutes", "diaperCount", "longestSleepMinutes", "tummyMinutes"] as const;

type Tab = "week" | "month" | "all";

type Props = {
  visible: boolean;
  table: WeeklyFeatureTable | null;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  insights: Insight[];
  insightPhrases: InsightPhrases;
  headline: string;
  body: string;
  dataState?: "loading" | "ready" | "partial" | "error";
  babyName: string;
  birthDate?: string;
  onClose: () => void;
  onAskAi: (question: string) => void;
};

function metricValue(metric: WeeklyMetric | undefined, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  if (!metric) return t("report.critical.017");
  return formatWeeklyAmount(metric.key, metric.unit, metric.thisWeek.avg, t, locale);
}

function amount(key: string, value: number | null, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string {
  if (value === null) return t("report.critical.017");
  const unit = key.includes("Count") ? "count" : key.includes("Volume") || key === "feedVolume" ? "ml" : "minutes";
  return formatWeeklyAmount(key, unit, value, t, locale);
}

export function OverviewReportScreen({
  visible,
  table,
  logs,
  diaryEntries,
  insights,
  insightPhrases,
  headline,
  body,
  dataState = "ready",
  babyName,
  birthDate,
  onClose,
  onAskAi,
}: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  const [tab, setTab] = useState<Tab>("week");
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);
  const [play, setPlay] = useState({ week: 0, month: 0, all: 0 });
  useEffect(() => {
    if (!visible) return;
    setTab("week");
    setOpenEvidence(null);
    setPlay((current) => ({ ...current, week: current.week + 1 }));
  }, [visible]);

  const showTab = (value: Tab) => {
    if (value === tab) return;
    setTab(value);
    setPlay((current) => ({ ...current, [value]: current[value] + 1 }));
  };
  const monthReport = useMemo(() => buildMonthReport(logs), [logs]);
  const allReport = useMemo(
    () => buildAllReport(logs, diaryEntries, birthDate, t),
    [birthDate, diaryEntries, logs, t],
  );
  const canShowReport = dataState === "ready" && logs.length > 0;

  const weekMetrics = KEY_METRICS
    .map((key) => table?.metrics.find((metric) => metric.key === key))
    .filter((metric): metric is WeeklyMetric => Boolean(metric));
  const compares = weekMetrics.filter((metric) => metric.lastWeek);
  const weekLabel = table ? formatWeekOfMonth(table.meta.dateKeys[table.meta.dateKeys.length - 1], t) : "";
  const questions = [
    t("report.critical.215"),
    t("report.critical.216"),
    t("report.critical.217"),
  ];
  const weekWatches = [
    compares.some((metric) => metric.key === "longestSleepMinutes" && metric.lastWeek && metric.thisWeek.avg > metric.lastWeek.avg)
      ? t("report.critical.221")
      : null,
    (table?.metrics.find((metric) => metric.key === "tummyMinutes")?.thisWeek.days ?? 0) < 4
      ? t("report.critical.222")
      : null,
    compares.some((metric) => metric.key === "feedIntervalAvg" && metric.changeRatio !== null && Math.abs(metric.changeRatio) < 0.1)
      ? t("report.critical.223")
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("report.critical.207")}
          >
            <ChevronLeft size={27} color={colors.text} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.title} maxFontSizeMultiplier={fontScaleCap.chrome}>{t("report.critical.175")}</Text>
          <View style={styles.back} />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={t("report.critical.179")}>
          {([
            ["week", "report.critical.176"],
            ["month", "report.critical.177"],
            ["all", "report.critical.178"],
          ] as const).map(([value, key]) => {
            const selected = tab === value;
            return (
              <Pressable
                key={value}
                style={[styles.tab, selected && styles.tabOn]}
                onPress={() => showTab(value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextOn]} maxFontSizeMultiplier={fontScaleCap.chrome}>
                  {t(key)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
          {dataState === "loading" ? <LoadingState label={t("report.critical.237")} /> : null}
          {dataState === "partial" ? <EmptyState title={t("report.critical.225")} body={t("report.critical.206")} /> : null}
          {dataState === "error" ? <ErrorState title={t("report.critical.016")} body={t("home.storage.offlineError")} /> : null}
          {dataState === "ready" && !logs.length ? <EmptyState title={t("report.critical.225")} body={t("report.critical.206")} /> : null}
          {canShowReport && tab === "week" && table ? (
            <>
              <Text style={styles.period}>{t("report.critical.180", { label: weekLabel })}</Text>
              <Hero
                source={overviewAssets.weeklyDuck}
                columns={4}
                rows={2}
                playToken={play.week}
                onPlay={() => setPlay((current) => ({ ...current, week: current.week + 1 }))}
                playLabel={t("report.critical.218")}
                title={headline}
                copy={body}
              />
              <Section title={t("report.critical.183")}>
                {weekMetrics.map((metric) => (
                  <View key={metric.key} style={styles.metric}>
                    <Text style={styles.metricLabel}>{weeklyMetricLabel(metric.key, t)}</Text>
                    <Text style={styles.metricValue}>{metricValue(metric, t, locale)}</Text>
                  </View>
                ))}
              </Section>
              {compares.length ? (
                <Section title={t("report.critical.184")}>
                  {compares.map((metric) => (
                    <CompareRow
                      key={metric.key}
                      label={weeklyMetricLabel(metric.key, t)}
                      before={formatWeeklyAmount(metric.key, metric.unit, metric.lastWeek!.avg, t, locale)}
                      after={formatWeeklyAmount(metric.key, metric.unit, metric.thisWeek.avg, t, locale)}
                      trend={metric.lastWeek && metric.thisWeek.avg > metric.lastWeek.avg ? "up" : metric.lastWeek && metric.thisWeek.avg < metric.lastWeek.avg ? "down" : "same"}
                    />
                  ))}
                </Section>
              ) : null}
              {insights.length ? (
                <Section title={t("report.critical.185", { babyName })}>
                  {insights.map((insight) => {
                    const key = insightKey(insight);
                    const phrase = insightPhrases[insightKey(insight)];
                    const copy = localizeInsight(insight, t, locale);
                    const open = openEvidence === key;
                    return (
                      <View key={key} style={styles.insight}>
                        <Text style={styles.insightTitle}>{phrase ?? copy.headline}</Text>
                        <Text style={styles.insightBody}>{copy.lead}{copy.gapText} {copy.tail}</Text>
                        <Pressable
                          style={styles.evidenceBtn}
                          onPress={() => setOpenEvidence(open ? null : key)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: open }}
                        >
                          <Text style={styles.evidenceBtnText}>{open ? t("report.critical.199") : t("report.critical.198")}</Text>
                        </Pressable>
                        {open ? (
                          <Text style={styles.evidence}>
                            {t("report.critical.113", { window: 28, days: insight.n })}
                            {"\n"}
                            {copy.buckets.map((bucket) => `${bucket.name} · ${bucket.valueLabel}`).join("\n")}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  <Text style={styles.note}>{t("report.critical.107")}</Text>
                </Section>
              ) : null}
              {weekWatches.length ? (
                <Section title={t("report.critical.186")}>
                  {weekWatches.map((item) => <Watch key={item} text={item} />)}
                </Section>
              ) : null}
              <Section title={t("report.critical.187")}>
                {questions.map((question) => (
                  <Pressable key={question} style={styles.question} onPress={() => onAskAi(question)}>
                    <Text style={styles.questionText}>{question}</Text>
                  </Pressable>
                ))}
              </Section>
            </>
          ) : null}

          {canShowReport && tab === "month" ? (
            <>
              <Text style={styles.period}>{t("report.critical.181", { label: t("report.critical.224", { month: monthReport.monthLabel }) })}</Text>
              <Hero
                source={overviewAssets.monthlyDuck}
                columns={4}
                rows={2}
                playToken={play.month}
                onPlay={() => setPlay((current) => ({ ...current, month: current.month + 1 }))}
                playLabel={t("report.critical.219")}
                title={t(monthReport.headlineKey)}
                copy={t(monthReport.bodyKey)}
              />
              <Section title={t("report.critical.188")}>
                {monthReport.weekTrends.some((trend) => trend.points.some((point) => point.value !== null)) ? (
                  monthReport.weekTrends.map((trend) => (
                    <TrendCard key={trend.key} title={weeklyMetricLabel(trend.key, t)}>
                      {trend.points.map((point) => (
                        <View key={point.labelKey} style={styles.trendCell}>
                          <Text style={styles.trendLabel}>{t(point.labelKey)}</Text>
                          <Text style={styles.trendValue}>{amount(trend.key, point.value, t, locale)}</Text>
                        </View>
                      ))}
                    </TrendCard>
                  ))
                ) : (
                  <Text style={styles.empty}>{t("report.critical.206")}</Text>
                )}
              </Section>
              {monthReport.compares.length ? (
                <Section title={t("report.critical.189")}>
                  {monthReport.compares.map((row) => (
                    <CompareRow
                      key={row.key}
                      label={weeklyMetricLabel(row.key, t)}
                      before={amount(row.key, row.before, t, locale)}
                      after={amount(row.key, row.after, t, locale)}
                      trend={row.trend}
                    />
                  ))}
                  <Text style={styles.note}>{t("report.critical.112", { days: monthReport.recordedDays })}</Text>
                </Section>
              ) : (
                <Text style={styles.empty}>{t("report.critical.206")}</Text>
              )}
              <Section title={t("report.critical.190")}>
                <Watch text={t("report.critical.221")} />
                <Watch text={t("report.critical.222")} />
              </Section>
            </>
          ) : null}

          {canShowReport && tab === "all" ? (
            <>
              <Text style={styles.period}>
                {t("report.critical.182", { babyName, days: allReport.ageDays ?? allReport.recordedDays })}
              </Text>
              <Hero
                source={overviewAssets.allReportDuck}
                columns={5}
                rows={1}
                playToken={play.all}
                onPlay={() => setPlay((current) => ({ ...current, all: current.all + 1 }))}
                playLabel={t("report.critical.220")}
                title={t("report.critical.211", { babyName })}
                copy={t("report.critical.212")}
              />
              <View style={styles.story}>
                <StoryCell label={t("report.critical.191")} value={String(allReport.logCount)} />
                <StoryCell label={t("report.critical.192")} value={String(allReport.recordedDays)} />
                <StoryCell
                  label={t("report.critical.193")}
                  value={allReport.firstDateKey ? formatMonthDay(allReport.firstDateKey, t) : t("report.critical.017")}
                />
              </View>
              <Section title={t("report.critical.194")}>
                {allReport.monthTrends.some((trend) => trend.points.some((point) => point.value !== null)) ? (
                  allReport.monthTrends.map((trend) => (
                    <TrendCard key={trend.key} title={weeklyMetricLabel(trend.key, t)}>
                      {trend.points.map((point, index) => (
                        <View key={`${point.labelKey}-${index}`} style={styles.trendCell}>
                          <Text style={styles.trendLabel}>
                            {point.labelValue !== undefined ? t(point.labelKey, { count: point.labelValue }) : t(point.labelKey)}
                          </Text>
                          <Text style={styles.trendValue}>{amount(trend.key, point.value, t, locale)}</Text>
                        </View>
                      ))}
                    </TrendCard>
                  ))
                ) : (
                  <Text style={styles.empty}>{t("report.critical.206")}</Text>
                )}
              </Section>
              {allReport.milestones.length ? (
                <Section title={t("report.critical.195", { babyName })}>
                  <View style={styles.timeline}>
                    {allReport.milestones.map((item) => (
                      <View key={`${item.dateKey}-${item.label}`} style={styles.milestone}>
                        <Text style={styles.milestoneTime}>
                          {item.ageDays !== null ? `D+${item.ageDays}` : formatMonthDay(item.dateKey, t)}
                        </Text>
                        <Text style={styles.milestoneCopy}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}
              <Section title={t("report.critical.196")}>
                <View style={styles.insight}>
                  <Text style={styles.insightTitle}>{t("report.critical.213", { babyName })}</Text>
                  <Text style={styles.insightBody}>
                    {allReport.recentVsEarlier.length
                      ? allReport.recentVsEarlier
                        .map((row) => `${weeklyMetricLabel(row.key, t)} ${amount(row.key, row.before, t, locale)} → ${amount(row.key, row.after, t, locale)}`)
                        .join("\n")
                      : t("report.critical.214")}
                  </Text>
                </View>
                <View style={styles.insight}>
                  <Text style={styles.insightTitle}>{t("report.critical.214")}</Text>
                  <Text style={styles.insightBody}>{t("report.critical.108")}</Text>
                </View>
                <Text style={styles.note}>{t("report.critical.037")}</Text>
              </Section>
              <Section title={t("report.critical.197")}>
                <Watch text={t("report.critical.221")} />
                <Watch text={t("report.critical.222")} />
              </Section>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Hero({
  source,
  columns,
  rows,
  playToken,
  onPlay,
  playLabel,
  title,
  copy,
}: {
  source: ImageSourcePropType;
  columns: number;
  rows: number;
  playToken: number;
  onPlay: () => void;
  playLabel: string;
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.hero} accessible accessibilityRole="image" accessibilityValue={{ text: `${title} ${copy}` }}>
      <OverviewSpriteSheet
        key={playToken}
        source={source}
        width={54}
        height={66}
        columns={columns}
        rows={rows}
        durationMs={2600}
        playing={playToken > 0}
        onPress={onPlay}
        accessibilityLabel={playLabel}
      />
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CompareRow({
  label,
  before,
  after,
  trend,
}: {
  label: string;
  before: string;
  after: string;
  trend: "up" | "down" | "same";
}) {
  return (
    <View style={styles.compare}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareValues}>
        <Text style={styles.before}>{before}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.after}>{after}</Text>
        <Text style={trend === "up" ? styles.trendUp : trend === "down" ? styles.trendDown : styles.trendSame}>{trend === "up" ? "↑" : trend === "down" ? "↓" : "≈"}</Text>
      </View>
    </View>
  );
}

function TrendCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendTitle}>{title}</Text>
      <View style={styles.trendRow}>{children}</View>
    </View>
  );
}

function Watch({ text }: { text: string }) {
  return (
    <View style={styles.watch}>
      <Text style={styles.watchText}>{text}</Text>
    </View>
  );
}

function StoryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.storyCell}>
      <Text style={styles.storyLabel}>{label}</Text>
      <Text style={styles.storyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 44, height: TOUCH, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 18, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
  },
  tabText: { color: colors.faint, fontSize: 12, fontWeight: "800" },
  tabTextOn: { color: colors.primaryForeground },
  scroll: { paddingHorizontal: 18, paddingTop: 18, gap: 4 },
  period: { color: colors.amberText, fontSize: 11, fontWeight: "800", marginBottom: 7 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.card,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  heroCopy: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18 },
  section: { marginTop: 23 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  compare: {
    padding: 12,
    borderRadius: 13,
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 9,
  },
  compareLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  compareValues: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 5 },
  before: { color: colors.faint, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  arrow: { color: colors.muted, fontSize: 14 },
  after: { color: colors.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
  trendUp: { color: "#6c9d8e", fontWeight: "800" },
  trendDown: { color: colors.dangerText, fontWeight: "800" },
  trendSame: { color: colors.faint, fontWeight: "800" },
  insight: {
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    marginBottom: 9,
  },
  insightTitle: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  insightBody: { marginTop: 4, color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  evidenceBtn: { minHeight: TOUCH, justifyContent: "center" },
  evidenceBtnText: { color: "#9b5a32", fontSize: 11, fontWeight: "800" },
  evidence: { marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: colors.cardHi, color: colors.muted, fontSize: 10.5, lineHeight: 17 },
  note: { marginTop: 9, color: colors.faint, fontSize: 10, lineHeight: 16 },
  watch: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: WATCH,
    borderRadius: 11,
    backgroundColor: "rgba(105,195,174,0.09)",
    marginBottom: 8,
  },
  watchText: { color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  question: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.cardHi,
    marginBottom: 8,
    justifyContent: "center",
  },
  questionText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  trendCard: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 9,
  },
  trendTitle: { color: colors.text, fontSize: 12, fontWeight: "800", marginBottom: 10 },
  trendRow: { flexDirection: "row" },
  trendCell: { flex: 1, alignItems: "center" },
  trendLabel: { color: colors.faint, fontSize: 9.5 },
  trendValue: { marginTop: 4, color: colors.text, fontSize: 12, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  story: { flexDirection: "row", gap: 7, marginTop: 12 },
  storyCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
  },
  storyLabel: { color: colors.faint, fontSize: 10, fontWeight: "700" },
  storyValue: { marginTop: 4, color: colors.text, fontSize: 12, fontWeight: "800" },
  timeline: { paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: colors.amberSoft },
  milestone: { position: "relative", paddingLeft: 13, paddingBottom: 17 },
  milestoneTime: { color: colors.amberText, fontSize: 10.5, fontWeight: "800" },
  milestoneCopy: { marginTop: 3, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
});
