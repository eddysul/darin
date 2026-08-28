import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import { GrowthRecordModal } from "../../components/babylog/GrowthRecordModal";
import { BABY_LOG_CATEGORIES, getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import { formatLogMeta, toMinutes } from "../../utils/formatLog";
import { useBabyLog } from "../../context/BabyLogContext";
import { useConsultFabBehavior } from "../../hooks/useConsultFabBehavior";
import type { BabyLogEntry } from "../../types/babyLog";
import { isCustomCategoryKey } from "../../types/logCategory";
import { formatDateKey } from "../../utils/dateKey";
import {
  buildTodaySummary,
  FEEDING_CATS,
  getLogsForDay,
} from "../../utils/reportAggregates";
import { colors, radius } from "../../theme";
import { formatDisplayTime } from "../../utils/logSummary";
import type { GrowthRecord } from "../../types/growthRecord";
import { findInsights } from "../../utils/careInsights";
import { GrowthChart, type GrowthPoint } from "../../components/babylog/GrowthChart";
import { ageDaysBetween, type WhoMeasure, type WhoSex } from "../../utils/growthPercentile";
import { displayKey, displayMeta, hasDuration, isDisplayableCat } from "../../utils/logCategoryDisplay";
import { WeeklyReportSheet } from "../../components/babylog/WeeklyReportSheet";
import { buildWeeklyFeatureTable } from "../../utils/weeklyFeatureTable";
import { buildRuleNarrative } from "../../utils/weeklyRuleNarrative";
import { chartCategoryLabel, formatWeekOfMonth } from "../../utils/insightDisplay";
import { buildWeeklyNarrative } from "../../utils/weeklyNarrative";
import {
  getWeeklyNarrative,
  hydrateWeeklyNarrative,
  saveWeeklyNarrative,
} from "../../utils/weeklyNarrativeStore";
import {
  buildInsightPhrases,
  getInsightPhrases,
  hydrateInsightPhrases,
  type InsightPhrases,
} from "../../utils/insightPhrase";
import { useLanguage } from "../../LanguageContext";
import type { ReportCriticalKey } from "../../i18nReportCriticalMessages";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  onOpenShared?: () => void;
  onOpenRecord?: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
};
export function BabyReportScreen({
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onOpenShared,
  onOpenConsult,
}: Props) {
  const { locale, t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const rhythmDialSize = Math.max(232, Math.min(316, windowWidth - 68));
  const { logs, babyName, careSetup, growthRecords, addGrowthRecord, updateGrowthRecord } = useBabyLog();
  const [growthModalOpen, setGrowthModalOpen] = useState(false);
  const [editingGrowthRecord, setEditingGrowthRecord] = useState<GrowthRecord | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(
    growthModalOpen || reportOpen,
  );

  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);
  const summary = useMemo(() => buildTodaySummary(logs), [logs]);
  const sortedGrowthRecords = useMemo(
    () => [...growthRecords].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [growthRecords],
  );
  const latestGrowthRecord = useMemo(() => {
    const hospital = sortedGrowthRecords.filter((record) => record.source === "hospital");
    return hospital[hospital.length - 1] ?? sortedGrowthRecords[sortedGrowthRecords.length - 1] ?? null;
  }, [sortedGrowthRecords]);
  const insights = useMemo(() => findInsights(logs, todayKey), [logs, todayKey]);

  const weekTable = useMemo(() => buildWeeklyFeatureTable(logs, careSetup), [logs, careSetup]);
  const ruleNarrative = useMemo(() => buildRuleNarrative(weekTable, t, locale), [locale, t, weekTable]);
  const [narrative, setNarrative] = useState({ headline: "", body: "" });

  // 주 1회만 AI 를 부른다. 캐시가 있으면 그대로 쓰고, 실패하면 규칙 문장이 남는다.
  useEffect(() => {
    let active = true;
    if (!ruleNarrative.headline) {
      setNarrative({ headline: "", body: "" });
      return;
    }
    const cacheKey = `${weekTable.meta.periodLabel}:${locale}`;
    const fallback = { headline: ruleNarrative.headline, body: ruleNarrative.body, fromAI: false };
    setNarrative(fallback);

    void (async () => {
      await hydrateWeeklyNarrative();
      if (!active) return;
      const cached = getWeeklyNarrative(cacheKey);
      if (cached) {
        setNarrative({ headline: cached.headline, body: cached.body });
        return;
      }
      const result = await buildWeeklyNarrative(weekTable, fallback, locale);
      if (!active) return;
      setNarrative({ headline: result.headline, body: result.body });
      if (result.fromAI) {
        void saveWeeklyNarrative({ periodLabel: cacheKey, ...result });
      }
    })();

    return () => {
      active = false;
    };
  }, [locale, ruleNarrative, weekTable]);

  // 발견 문장 다듬기. 상관은 이미 기기에서 찾았고 여기서는 표현만 바꾼다.
  // 실패하면 빈 객체라 우리 문장이 그대로 나간다.
  const [insightPhrases, setInsightPhrases] = useState<InsightPhrases>({});
  useEffect(() => {
    let active = true;
    if (!insights.length) {
      setInsightPhrases({});
      return;
    }
    const periodLabel = `${weekTable.meta.periodLabel}:${locale}`;

    void (async () => {
      await hydrateInsightPhrases();
      if (!active) return;
      const cached = getInsightPhrases(periodLabel);
      if (cached) {
        setInsightPhrases(cached);
        return;
      }
      const phrases = await buildInsightPhrases(insights, periodLabel, locale, t);
      if (active) setInsightPhrases(phrases);
    })();

    return () => {
      active = false;
    };
  }, [insights, locale, t, weekTable.meta.periodLabel]);

  // 백분위는 성별 기준이 달라서, 성별을 모르면 그리지 않는다.
  const growthSex: WhoSex | null =
    careSetup.child.gender === "boy" ? "boy" : careSetup.child.gender === "girl" ? "girl" : null;

  const growthPoints = useMemo(() => {
    const birthDate = careSetup.child.birthDate;
    const empty = { weight: [], height: [], head: [] } as Record<WhoMeasure, GrowthPoint[]>;
    if (!birthDate) return empty;
    for (const record of sortedGrowthRecords) {
      const ageDays = ageDaysBetween(birthDate, record.measuredAt);
      if (ageDays === null) continue;
      const dateKey = record.measuredAt.slice(0, 10);
      if (record.weightKg !== undefined) empty.weight.push({ ageDays, dateKey, value: record.weightKg });
      if (record.heightCm !== undefined) empty.height.push({ ageDays, dateKey, value: record.heightCm });
      if (record.headCircumferenceCm !== undefined) {
        empty.head.push({ ageDays, dateKey, value: record.headCircumferenceCm });
      }
    }
    return empty;
  }, [sortedGrowthRecords, careSetup.child.birthDate]);

  const dialSeries = useMemo(() => buildDialSeries(todayLogs), [todayLogs]);
  const hasRhythmData = dialSeries.legend.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} {...scrollProps}>
        <AppHeader
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onOpenNotifications={onOpenNotifications}
          onOpenShared={onOpenShared}
        />
                  <View style={styles.pad}>
            <DashboardCard title={t("report.critical.030")}>
              {hasRhythmData ? (
                <>
                  <View style={styles.rhythmContent}>
                    <RhythmDial series={dialSeries} displaySize={rhythmDialSize} />
                  </View>
                  <View style={styles.rhythmLegend}>
                    {dialSeries.legend.map((item) => (
                      <LegendDot key={item.key} color={item.color} label={chartCategoryLabel(item.key, t)} />
                    ))}
                  </View>
                </>
              ) : <DashboardEmpty title={t("report.critical.033")} compact />}
            </DashboardCard>

            {narrative.headline ? (
              <Pressable
                style={styles.weeklyCard}
                onPress={() => setReportOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("report.critical.110", { headline: narrative.headline })}
              >
                <View style={styles.weeklyTop}>
                  <Text style={styles.weeklyKicker}>{t("report.critical.091")}</Text>
                  <Text style={styles.weeklyBadge}>{formatWeekOfMonth(weekTable.meta.dateKeys[weekTable.meta.dateKeys.length - 1], t)}</Text>
                </View>

                <Text style={styles.weeklyHeadline}>{narrative.headline}</Text>
                <TeaserBody text={narrative.body} />

                {insights.length > 0 ? (
                  <View style={styles.weeklyTease}>
                    <BabyLogIcon kind="sparkles" size={12} color={colors.amber} strokeWidth={2.2} />
                    <Text style={styles.weeklyTeaseText}>
                      {t("report.critical.123", { count: insights.length })}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.weeklyFoot}>
                  <Text style={styles.weeklyMore}>{t("report.critical.093")}</Text>
                </View>
              </Pressable>
            ) : (
              <DashboardCard title={t("report.critical.091")}>
                <DashboardEmpty title={t("report.critical.014")} compact />
              </DashboardCard>
            )}

            <DashboardCard title={t("report.critical.015")} caption={latestGrowthRecord ? t("report.critical.111", { date: formatGrowthDate(latestGrowthRecord.measuredAt) }) : undefined}>
              {latestGrowthRecord ? (
                growthSex ? (
                  <>
                    {GROWTH_CHARTS.map((chart, index) => (
                      <View key={chart.measure} style={index > 0 ? styles.growthChartNext : undefined}>
                        <GrowthChart
                          measure={chart.measure}
                          label={t(chart.labelKey)}
                          unit={chart.unit}
                          color={chart.color}
                          sex={growthSex}
                          points={growthPoints[chart.measure]}
                        />
                      </View>
                    ))}
                    <Text style={styles.growthSource}>
                      {t("report.critical.094")}
                    </Text>
                  </>
                ) : (
                  <DashboardEmpty
                    title={t("report.critical.095")}
                    compact
                  />
                )
              ) : (
                <View style={styles.growthEmpty}>
                  <View style={styles.growthEmptyIcon}><BabyLogIcon kind="tab" tab="report" size={24} color="#69AFA0" /></View>
                  <Text style={styles.growthEmptyTitle}>{t("report.critical.027")}</Text>
                  <Text style={styles.growthEmptyBody}>{t("report.critical.028")}</Text>
                  <Pressable style={styles.growthEmptyBtn} onPress={() => { setEditingGrowthRecord(null); setGrowthModalOpen(true); }}><Text style={styles.growthEmptyBtnText}>{t("report.critical.029")}</Text></Pressable>
                </View>
              )}
            </DashboardCard>

          </View>
      </ScrollView>

      <WeeklyReportSheet
        visible={reportOpen}
        table={weekTable}
        logs={logs}
        insights={insights}
        insightPhrases={insightPhrases}
        babyName={babyName}
        onClose={() => setReportOpen(false)}
      />
      <GrowthRecordModal
        visible={growthModalOpen}
        record={editingGrowthRecord}
        onClose={() => { setGrowthModalOpen(false); setEditingGrowthRecord(null); }}
        onSave={(draft, editId) => {
          if (editId) updateGrowthRecord(editId, draft);
          else addGrowthRecord(draft);
        }}
      />

      <ConsultFab hidden={fabHidden} onPress={() => setPromptOpen(true)} />
      <ConsultPromptSheet
        visible={promptOpen}
        todayLogCount={summary.totalCount}
        onClose={() => setPromptOpen(false)}
        onSelectQuestion={(question) => {
          setPromptOpen(false);
          onOpenConsult(question);
        }}
        onAskFreely={() => {
          setPromptOpen(false);
          onOpenConsult();
        }}
      />
    </View>
  );
}


/** 성장 카드에 세로로 쌓을 세 그래프. 색은 기존 성장 지표에서 쓰던 것을 그대로 쓴다. */
const GROWTH_CHARTS: { measure: WhoMeasure; labelKey: ReportCriticalKey; unit: string; color: string }[] = [
  { measure: "weight", labelKey: "report.critical.016", unit: "kg", color: "#E8918A" },
  { measure: "height", labelKey: "report.critical.021", unit: "cm", color: "#9B82D7" },
  { measure: "head", labelKey: "report.critical.022", unit: "cm", color: "#69C3AE" },
];

function isFeedingLog(entry: BabyLogEntry): boolean {
  return !entry.cat.startsWith("custom:") && FEEDING_CATS.includes(entry.cat as BabyLogCategoryId);
}

/**
 * "4시간 51분 → 6시간 42분" 처럼 앞뒤 값을 이은 구간. 이 부분만 굵게 쓴다.
 * 단위를 열거해 두는 이유는 뒤에 붙는 조사("10회로")까지 삼키지 않게 하기 위해서다.
 */
const VALUE = String.raw`\d[\d.]*\s*(?:\uC2DC\uAC04(?:\s*\d+\uBD84)?|\uBD84|\uD68C|ml|g)`;
// 화살표 뒤에 "이번주" 같은 짧은 말이 끼기도 한다. 그때도 구간 전체를 굵게 잡는다.
const ARROW_RUN = new RegExp(`(${VALUE}\\s*→\\s*(?:[\\uAC00-\\uD7A3]{1,4}\\s*)?${VALUE})`);

/** 카드 본문. 숫자가 바뀐 구간에만 눈이 먼저 가도록 한다. */
function TeaserBody({ text }: { text: string }) {
  // 캡처 그룹이 하나라 홀수 자리가 곧 일치한 구간이다.
  const parts = text.split(ARROW_RUN);
  return (
    <Text style={styles.weeklyLine}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} style={styles.weeklyStrong}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function DashboardCard({
  title,
  caption,
  icon,
  tone,
  children,
}: {
  title: string;
  caption?: string;
  icon?: "sparkles";
  tone?: "warning";
  children: ReactNode;
}) {
  const warning = tone === "warning";
  return (
    <View style={[styles.dashboardCard, warning && styles.dashboardCardWarning]}>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardTitleRow}>
          {icon ? <BabyLogIcon kind={icon} size={16} color={colors.amber} strokeWidth={2.1} /> : null}
          <Text style={[styles.dashboardTitle, warning && styles.dashboardTitleWarning]}>{title}</Text>
        </View>
        {caption ? <Text style={styles.dashboardCaption}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function DashboardEmpty({ icon, title, actionLabel, onPress, compact }: { icon?: "record"; title: string; actionLabel?: string; onPress?: () => void; compact?: boolean }) {
  return (
    <View style={[styles.dashboardEmpty, compact && styles.dashboardEmptyCompact]}>
      {icon ? <View style={styles.dashboardEmptyIcon}><BabyLogIcon kind="tab" tab={icon} size={21} color={colors.amber} /></View> : null}
      <Text style={styles.dashboardEmptyText}>{title}</Text>
      {actionLabel && onPress ? <Pressable style={styles.dashboardEmptyBtn} onPress={onPress}><Text style={styles.dashboardEmptyBtnText}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

function formatGrowthDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}



function dialPoint(minutes: number, radiusValue: number, center: number) {
  const angle = (minutes / 1440) * Math.PI * 2 - Math.PI / 2;
  return { x: center + radiusValue * Math.cos(angle), y: center + radiusValue * Math.sin(angle) };
}

function sleepArcPath(startMinutes: number, durationMinutes: number, radiusValue: number, center: number): string {
  const safeDuration = Math.max(3, Math.min(durationMinutes, 1439));
  const start = dialPoint(startMinutes, radiusValue, center);
  const end = dialPoint(startMinutes + safeDuration, radiusValue, center);
  return `M ${start.x} ${start.y} A ${radiusValue} ${radiusValue} 0 ${safeDuration > 720 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

/**
 * 오늘 기록된 카테고리를 모두 그린다.
 * 지속 시간이 있는 것(수면·모유수유·터미타임·놀이)은 호로, 나머지는 점으로.
 * 점이 겹치지 않게 카테고리마다 반지름을 조금씩 안쪽으로 옮긴다.
 */
function buildDialSeries(logs: BabyLogEntry[]): {
  arcs: { id: string; key: string; start: number; minutes: number }[];
  dots: { id: string; key: string; minutes: number }[];
  legend: { key: string; label: string; color: string }[];
} {
  const arcs: { id: string; key: string; start: number; minutes: number }[] = [];
  const dotsByKey = new Map<string, { id: string; minutes: number }[]>();
  const seen: string[] = [];

  for (const entry of logs) {
    if (!isDisplayableCat(entry.cat)) continue;
    const catId = entry.cat as BabyLogCategoryId;
    const key = displayKey(entry.cat);
    const minutes = toMinutes(entry.time);
    if (!Number.isFinite(minutes)) continue;
    if (!seen.includes(key)) seen.push(key);

    // 수유로 묶여도 모유수유처럼 시간이 있는 기록은 호로 남긴다.
    if (hasDuration(catId)) {
      arcs.push({ id: entry.id, key, start: minutes, minutes: Number.parseInt(entry.duration ?? "0", 10) || 5 });
    } else {
      const list = dotsByKey.get(key) ?? [];
      list.push({ id: entry.id, minutes });
      dotsByKey.set(key, list);
    }
  }

  // 호와 점을 모두 링 위에 올린다. 시각을 같은 기준선에서 읽을 수 있다.
  const dots = [...dotsByKey.entries()].flatMap(([key, list]) =>
    list.map((dot) => ({ ...dot, key })),
  );

  const legend = seen
    .filter((key) => arcs.some((a) => a.key === key) || dotsByKey.has(key))
    .map((key) => ({ key, ...displayMeta(key) }));

  return { arcs, dots, legend };
}

function RhythmDial({ series, displaySize }: { series: ReturnType<typeof buildDialSeries>; displaySize: number }) {
  const { t } = useLanguage();
  const size = 316;
  const center = size / 2;
  // 호와 점을 모두 같은 링 위에 올린다.
  const trackRadius = 110;
  const trackWidth = 15;
  const tickInner = trackRadius + trackWidth / 2 + 2;
  const labelRadius = tickInner + 17;

  return (
    <View style={{ width: displaySize, height: displaySize }} accessibilityLabel={t("report.critical.096")}>
      <Svg width={displaySize} height={displaySize} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={trackRadius} fill="#FFFDFC" stroke={colors.border} strokeWidth={trackWidth} />

        {/* 매시 눈금. 3시간마다 길고 진하게 해서 시각을 짚기 쉽게 한다. */}
        {Array.from({ length: 24 }, (_, hour) => {
          const major = hour % 3 === 0;
          const a = dialPoint(hour * 60, tickInner, center);
          const b = dialPoint(hour * 60, tickInner + (major ? 7 : 3.5), center);
          return (
            <Line
              key={`tick-${hour}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={major ? colors.faint : colors.border}
              strokeWidth={major ? 1.6 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => {
          const point = dialPoint(hour * 60, labelRadius, center);
          return (
            <SvgText
              key={`label-${hour}`}
              x={point.x}
              y={point.y + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight={hour === 0 ? "700" : "400"}
              fill={hour === 0 ? colors.muted : colors.faint}
            >
              {hour}
            </SvgText>
          );
        })}

        {series.arcs.map((arc) => (
          <Path
            key={arc.id}
            d={sleepArcPath(arc.start, arc.minutes, trackRadius, center)}
            fill="none"
            stroke={displayMeta(arc.key).color}
            strokeWidth={trackWidth}
            strokeLinecap="round"
          />
        ))}

        {series.dots.map((dot) => {
          const point = dialPoint(dot.minutes, trackRadius, center);
          return (
            <Circle
              key={dot.id}
              cx={point.x}
              cy={point.y}
              r="5"
              fill={displayMeta(dot.key).color}
              stroke="#FFF"
              strokeWidth="2"
            />
          );
        })}

        <SvgText x={center} y={center + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill={colors.text}>{t("report.critical.069")}</SvgText>
      </Svg>
    </View>
  );
}

function SummaryCard({ tag, text, icon }: { tag: string; text: string; icon?: ReactNode }) {
  return (
    <View style={styles.aiSummary}>
      <View style={styles.aiTag}>
        {icon}
        <Text style={styles.aiTagText}>{tag}</Text>
      </View>
      <Text style={styles.aiText}>{text}</Text>
    </View>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
  onPressIn,
  onPressOut,
}: {
  label: string;
  icon?: ReactNode;
  active: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View style={styles.filterChipInner}>
        {icon}
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function BarRow({
  day,
  width,
  color,
  marginBottom,
}: {
  day: string;
  width: number;
  color: string;
  marginBottom?: boolean;
}) {
  return (
    <View style={[styles.barRow, marginBottom && { marginBottom: 14 }]}>
      <Text style={styles.barDay}>{day}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: 18, paddingBottom: 164 },
  dashboardCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#8A735F",
    shadowOpacity: 0.055,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dashboardCardWarning: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  dashboardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 13 },
  dashboardTitleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  dashboardTitle: { flexShrink: 1, fontSize: 15.5, fontWeight: "800", color: colors.text },
  dashboardTitleWarning: { color: colors.dangerText },
  dashboardCaption: { maxWidth: "46%", flexShrink: 1, textAlign: "right", fontSize: 10.5, fontWeight: "600", color: colors.faint },
  dashboardEmpty: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 14 },
  dashboardEmptyCompact: { paddingVertical: 12 },
  dashboardEmptyIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, marginBottom: 9 },
  dashboardEmptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 19, textAlign: "center" },
  dashboardEmptyBtn: { marginTop: 12, minWidth: 140, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.amber },
  dashboardEmptyBtnText: { flexShrink: 1, textAlign: "center", lineHeight: 17, color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  growthChartNext: { marginTop: 22, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  growthSource: { fontSize: 10, lineHeight: 16, color: colors.faint, marginTop: 16 },
  growthEmpty: { alignItems: "center", paddingHorizontal: 12, paddingBottom: 4 },
  growthEmptyIcon: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F5F0", marginBottom: 10 },
  growthEmptyTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  growthEmptyBody: { maxWidth: 300, marginTop: 6, fontSize: 11.5, lineHeight: 17, textAlign: "center", color: colors.faint },
  growthEmptyBtn: { marginTop: 13, minWidth: 150, alignItems: "center", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 13, backgroundColor: colors.amber },
  growthEmptyBtnText: { flexShrink: 1, textAlign: "center", lineHeight: 18, fontSize: 12.5, fontWeight: "800", color: colors.amberDark },
  weeklyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#8A735F",
    shadowOpacity: 0.055,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weeklyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  weeklyKicker: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: "800", color: colors.muted },
  weeklyBadge: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.amber,
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden",
  },
  weeklyHeadline: { fontSize: 16.5, fontWeight: "800", color: colors.text, lineHeight: 25, marginTop: 12 },
  weeklyLine: { fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 9 },
  weeklyStrong: { fontWeight: "800", color: colors.text },
  weeklyFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 11,
  },
  weeklyTease: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  weeklyTeaseText: { flexShrink: 1, fontSize: 12, fontWeight: "800", color: colors.amber },
  weeklyMore: { flexShrink: 1, textAlign: "right", fontSize: 11.5, fontWeight: "800", color: colors.amber },
  rhythmContent: { alignItems: "center" },
  rhythmLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 14, rowGap: 7, marginTop: 8 },
  filterRow: { paddingHorizontal: 18, paddingVertical: 2, gap: 8, paddingBottom: 14 },
  filterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  filterChipTextActive: { color: colors.amberDark },
  aiSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  aiTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.amberSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 10,
  },
  aiTagText: { fontSize: 10.5, fontWeight: "700", color: colors.amber },
  aiText: { fontSize: 13, lineHeight: 22, color: colors.muted },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20, marginTop: 8 },
  insightCard: {
    width: "48%",
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 },
  insightTopText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  insightVal: { fontSize: 15, fontWeight: "700", color: colors.text },
  insightSub: { fontSize: 10.5, color: colors.faint, marginTop: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  barDay: { fontSize: 10.5, color: colors.faint, width: 28 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.card, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  legend: { flexDirection: "row", gap: 14, marginTop: 6, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10.5, color: colors.faint },
});
