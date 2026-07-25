import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import { BABY_LOG_CATEGORIES, getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import { formatLogMeta, toMinutes } from "../../utils/formatLog";
import { useBabyLog } from "../../context/BabyLogContext";
import { useConsultFabBehavior } from "../../hooks/useConsultFabBehavior";
import type { BabyLogEntry } from "../../types/babyLog";
import { formatDateKey } from "../../utils/dateKey";
import {
  buildSummaryCards,
  buildTodaySummary,
  categoryCountsLast7,
  currentWeekTrend,
  getLogsForDay,
  toBarPercent,
} from "../../utils/reportAggregates";
import { EmptyState } from "../../components/states/FeedbackStates";
import { colors } from "../../theme";
import { formatDisplayTime } from "../../utils/logSummary";
import { useAppSettings } from "../../context/AppSettingsContext";

type Props = {
  onOpenProfile: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
};

type ReportCat = "all" | BabyLogCategoryId;

export function BabyReportScreen({ onOpenProfile, onOpenConsult }: Props) {
  const { logs, babyName } = useBabyLog();
  const { settings } = useAppSettings();
  const [reportCat, setReportCat] = useState<ReportCat>("all");
  const [chipPressing, setChipPressing] = useState(false);
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(chipPressing);

  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);
  const summary = useMemo(() => buildTodaySummary(logs), [logs]);
  const cards = useMemo(() => buildSummaryCards(summary, babyName), [summary, babyName]);
  const week = useMemo(
    () => currentWeekTrend(logs, new Date(), settings.time.weekStart),
    [logs, settings.time.weekStart],
  );

  const maxFeed = Math.max(...week.map((d) => d.feedingCount), 1);
  const maxSleep = Math.max(...week.map((d) => d.sleepMinutes), 1);
  const maxDiaper = Math.max(...week.map((d) => d.diaperCount), 1);
  const weekHasData = week.some((d) => d.totalCount > 0);

  const todayFor = (catId: BabyLogCategoryId) => todayLogs.filter((l) => l.cat === catId);

  return (
    <View style={styles.root}>
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView showsVerticalScrollIndicator={false} {...scrollProps}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip
            label="전체"
            icon={<BabyLogIcon kind="folder" size={14} color={reportCat === "all" ? colors.amberDark : colors.muted} />}
            active={reportCat === "all"}
            onPressIn={() => setChipPressing(true)}
            onPressOut={() => setChipPressing(false)}
            onPress={() => setReportCat("all")}
          />
          {BABY_LOG_CATEGORIES.map((c) => (
            <FilterChip
              key={c.id}
              label={c.label}
              icon={<BabyLogIcon catId={c.id} size={14} />}
              active={reportCat === c.id}
              onPressIn={() => setChipPressing(true)}
              onPressOut={() => setChipPressing(false)}
              onPress={() => setReportCat(c.id)}
            />
          ))}
        </ScrollView>

        {reportCat === "all" ? (
          <View style={styles.pad}>
            <SummaryCard
              tag="기록 요약"
              text={cards.overview}
              icon={<BabyLogIcon kind="sparkles" size={12} color={colors.amber} strokeWidth={2.2} />}
            />
            <SummaryCard tag="오늘 주요 변화" text={cards.changes} />
            <SummaryCard tag="다음에 체크할 것" text={cards.checklist} />

            {summary.totalCount === 0 && (
              <EmptyState
                title="아직 오늘 기록이 없어요."
                body="수유, 수면, 배변을 기록하면 한눈에 요약해드릴게요."
              />
            )}

            <View style={styles.insightGrid}>
              {(["breast", "formula", "food", "diaper", "sleep", "tummy"] as BabyLogCategoryId[]).map((id) => {
                const c = getCategory(id);
                const todays = todayFor(id);
                const lastTime = todays.length
                  ? formatDisplayTime(todays[todays.length - 1].time)
                  : "-";
                return (
                  <Pressable
                    key={id}
                    style={styles.insightCard}
                    onPressIn={() => setChipPressing(true)}
                    onPressOut={() => setChipPressing(false)}
                    onPress={() => setReportCat(id)}
                  >
                    <View style={styles.insightTop}>
                      <BabyLogIcon catId={id} size={14} />
                      <Text style={styles.insightTopText}>{c.label}</Text>
                    </View>
                    <Text style={styles.insightVal}>{todays.length}회</Text>
                    <Text style={styles.insightSub}>마지막 {lastTime}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.chartTitle}>이번 주 한눈에 보기</Text>
            {!weekHasData ? (
              <EmptyState
                title="최근 7일 기록이 없어요."
                body="기록을 남기면 주간 트렌드가 보여요."
              />
            ) : (
              <>
                {week.map((d) => (
                  <View key={d.dateKey}>
                    <BarRow day={d.label} width={toBarPercent(d.feedingCount, maxFeed)} color="#f0a93c" />
                    <BarRow day="" width={toBarPercent(d.sleepMinutes, maxSleep)} color="#7c83fd" />
                    <BarRow day="" width={toBarPercent(d.diaperCount, maxDiaper)} color="#c98a54" marginBottom />
                  </View>
                ))}
                <View style={styles.legend}>
                  <LegendDot color="#f0a93c" label="수유(회)" />
                  <LegendDot color="#7c83fd" label="수면(분)" />
                  <LegendDot color="#c98a54" label="배변(회)" />
                </View>
              </>
            )}
          </View>
        ) : (
          <CategoryDetail catId={reportCat} todayLogs={todayFor(reportCat)} allLogs={logs} />
        )}
      </ScrollView>

      <ConsultFab hidden={fabHidden} onPress={() => setPromptOpen(true)} />
      <ConsultPromptSheet
        visible={promptOpen}
        todayLogCount={summary.totalCount}
        onClose={() => setPromptOpen(false)}
        onSelectQuestion={(question) => {
          setPromptOpen(false);
          onOpenConsult(question);
        }}
      />
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

function CategoryDetail({
  catId,
  todayLogs,
  allLogs,
}: {
  catId: BabyLogCategoryId;
  todayLogs: BabyLogEntry[];
  allLogs: BabyLogEntry[];
}) {
  const c = getCategory(catId);
  const lastTime = todayLogs.length
    ? formatDisplayTime(todayLogs[todayLogs.length - 1].time)
    : "없음";
  const trend = categoryCountsLast7(allLogs, catId);
  const values = trend.map((t) => (catId === "sleep" ? (t.sleepMinutes ?? 0) : t.count));
  const pastVals = values.slice(0, 6);
  const pastAvg = pastVals.length ? pastVals.reduce((a, b) => a + b, 0) / pastVals.length : 0;
  const todayVal = values[values.length - 1] ?? 0;
  const isAnomaly = pastAvg > 0 && Math.abs(todayVal - pastAvg) >= Math.max(1, pastAvg * 0.4);
  const isLow = todayVal < pastAvg;
  const max = Math.max(...values, 1);
  const weekHas = values.some((v) => v > 0);

  let avgGapStr = "-";
  let gaps: number[] = [];
  if (todayLogs.length >= 2) {
    gaps = todayLogs.slice(1).map((l, i) => toMinutes(l.time) - toMinutes(todayLogs[i].time));
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    avgGapStr = `${Math.floor(avg / 60)}시간 ${Math.round(avg % 60)}분`;
  }

  return (
    <View style={styles.pad}>
      <View style={styles.statRow}>
        <StatCard
          icon={<BabyLogIcon catId={catId} size={18} />}
          num={catId === "sleep" ? `${todayVal}분` : `${todayLogs.length}회`}
          lbl={catId === "sleep" ? "오늘 수면" : "오늘 횟수"}
        />
        <StatCard icon={<BabyLogIcon kind="clock" size={18} color={colors.muted} />} num={lastTime} lbl="마지막 기록" />
        <StatCard icon={<BabyLogIcon kind="interval" size={18} color={colors.muted} />} num={avgGapStr} lbl="평균 간격" />
      </View>

      <Text style={styles.chartTitle}>
        오늘의 간격<Text style={styles.chartSub}>이벤트 사이 시간 차이</Text>
      </Text>
      {todayLogs.length === 0 ? (
        <Text style={styles.hint}>오늘 {c.label} 기록이 아직 없어요.</Text>
      ) : todayLogs.length === 1 ? (
        <Text style={styles.hint}>기록이 2건 이상일 때 간격을 보여드려요. (현재 1건: {formatDisplayTime(todayLogs[0].time)})</Text>
      ) : (
        <>
          <IntervalRow entry={todayLogs[0]} c={c} />
          {todayLogs.slice(1).map((entry, i) => {
            const gap = gaps[i];
            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const isShort = gap < avgGap * 0.5;
            const isLong = gap > avgGap * 1.8;
            const gapTxt = gap >= 60 ? `${Math.floor(gap / 60)}시간 ${gap % 60}분` : `${gap}분`;
            const flag = isShort ? "⚠️ 평소보다 짧아요" : isLong ? "⚠️ 평소보다 길어요" : "";
            return (
              <View key={entry.id}>
                <View style={styles.gapRow}>
                  <Text style={[styles.gapPill, isShort && styles.gapShort, isLong && styles.gapLong]}>{gapTxt}</Text>
                  <Text style={styles.gapFlag}>{flag}</Text>
                </View>
                <IntervalRow entry={entry} c={c} />
              </View>
            );
          })}
        </>
      )}

      <Text style={[styles.chartTitle, { marginTop: 20 }]}>
        7일 트렌드<Text style={styles.chartSub}>{catId === "sleep" ? "수면 분" : "횟수"} · 이상치는 강조</Text>
      </Text>
      {!weekHas ? (
        <Text style={styles.empty}>최근 7일 {c.label} 기록이 없어요.</Text>
      ) : (
        <>
          <View style={styles.trendChart}>
            {trend.map((d, i) => {
              const v = values[i];
              const h = Math.max(6, Math.round((v / max) * 100));
              const isToday = i === trend.length - 1;
              const flagAnomaly = isToday && isAnomaly;
              return (
                <View key={d.dateKey} style={styles.trendCol}>
                  <Text style={styles.trendFlag}>{flagAnomaly ? "⚠️" : ""}</Text>
                  <View style={styles.trendTrack}>
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: `${h}%`,
                          backgroundColor: c.color,
                          borderWidth: flagAnomaly ? 2 : 0,
                          borderColor: colors.danger,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.trendDay}>{d.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.trendNote}>
            {isAnomaly
              ? `오늘 ${c.label}이(가) 최근 6일 평균(약 ${pastAvg.toFixed(1)})보다 ${isLow ? "적어요" : "많아요"}.`
              : `오늘 ${c.label}은(는) 최근 6일 평균과 비슷한 수준이에요.`}
          </Text>
        </>
      )}
    </View>
  );
}

function StatCard({ icon, num, lbl }: { icon: ReactNode; num: string; lbl: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIco}>{icon}</View>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{lbl}</Text>
    </View>
  );
}

function IntervalRow({ entry, c }: { entry: BabyLogEntry; c: ReturnType<typeof getCategory> }) {
  const meta = formatLogMeta(entry);
  return (
    <View style={styles.intervalRow}>
      <Text style={styles.intervalTime}>{formatDisplayTime(entry.time)}</Text>
      <View style={[styles.intervalDot, { backgroundColor: c.color }]} />
      <View style={styles.intervalLabelRow}>
        {!entry.cat.startsWith("custom:") && <BabyLogIcon catId={entry.cat as BabyLogCategoryId} size={15} />}
        <Text style={styles.intervalLabel}>{meta === "기록됨" ? c.label : meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: 18, paddingBottom: 24 },
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
  empty: {
    textAlign: "center",
    color: colors.faint,
    fontSize: 12.5,
    paddingVertical: 8,
    lineHeight: 18,
  },
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
  chartTitle: { fontSize: 12.5, fontWeight: "700", color: colors.text, marginBottom: 10 },
  chartSub: { fontSize: 10.5, color: colors.faint, fontWeight: "500" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  barDay: { fontSize: 10.5, color: colors.faint, width: 28 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.card, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  legend: { flexDirection: "row", gap: 14, marginTop: 6, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10.5, color: colors.faint },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  statIco: { height: 22, alignItems: "center", justifyContent: "center" },
  statNum: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 4 },
  statLbl: { fontSize: 10, color: colors.faint, marginTop: 1 },
  hint: { textAlign: "center", color: colors.faint, fontSize: 12.5, paddingVertical: 20 },
  intervalRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  intervalTime: { fontSize: 12.5, color: colors.muted, width: 42, fontVariant: ["tabular-nums"] },
  intervalDot: { width: 9, height: 9, borderRadius: 5 },
  intervalLabelRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  intervalLabel: { fontSize: 13, fontWeight: "700", color: colors.text, flex: 1 },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 18, paddingVertical: 2 },
  gapPill: {
    fontSize: 11,
    backgroundColor: colors.card,
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  gapShort: { backgroundColor: colors.dangerSoft, color: colors.dangerText },
  gapLong: { backgroundColor: "rgba(232,163,61,0.2)", color: colors.amber },
  gapFlag: { fontSize: 10.5, color: colors.faint },
  trendChart: { flexDirection: "row", alignItems: "flex-end", gap: 7, height: 118, paddingVertical: 16 },
  trendCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  trendFlag: { fontSize: 11, height: 16 },
  trendTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 5, minHeight: 4 },
  trendDay: { fontSize: 10, color: colors.faint, fontWeight: "600", marginTop: 6 },
  trendNote: { fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 18 },
});
