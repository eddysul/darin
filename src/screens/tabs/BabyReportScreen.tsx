import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import {
  BABY_LOG_CATEGORIES,
  CAT_HISTORY,
  formatLogMeta,
  getCategory,
  HISTORY_DAYS,
  toMinutes,
  type BabyLogCategoryId,
} from "../../constants/babyLogCategories";
import { useBabyLog } from "../../context/BabyLogContext";
import type { BabyLogEntry } from "../../types/babyLog";
import { colors, radius } from "../../theme";

type Props = {
  onOpenProfile: () => void;
};

type ReportCat = "all" | BabyLogCategoryId;

export function BabyReportScreen({ onOpenProfile }: Props) {
  const { logs, feedCount, diaperCount, sleepMinutes } = useBabyLog();
  const [reportCat, setReportCat] = useState<ReportCat>("all");

  const sleepStr =
    sleepMinutes > 0
      ? `${Math.floor(sleepMinutes / 60)}시간 ${sleepMinutes % 60}분`
      : "0분";

  const aiSummary = `오늘 콩이는 ${feedCount}회 수유/식사를 했고, ${sleepStr} 잠들었어요. 기저귀는 ${diaperCount}회 교체했고, 최근 일주일과 비교해 배변 리듬이 안정적이에요. 오후엔 평소보다 낮잠이 짧았으니, 저녁 취침 시간을 조금 당겨보는 걸 추천해요.`;

  const weekBars = useMemo(() => {
    const days = [...HISTORY_DAYS, "오늘"];
    return days.map((day, i) => {
      const isToday = i === days.length - 1;
      const feed = isToday ? Math.min(20 + feedCount * 15, 100) : [62, 70, 55, 80, 65, 58][i];
      const sleep = isToday ? Math.min(sleepMinutes / 6, 100) : [74, 68, 80, 60, 72, 78][i];
      const diaper = isToday ? Math.min(20 + diaperCount * 15, 100) : [50, 60, 45, 70, 55, 48][i];
      return { day, feed, sleep, diaper };
    });
  }, [feedCount, diaperCount, sleepMinutes]);

  const todayFor = (catId: BabyLogCategoryId) =>
    logs.filter((l) => l.cat === catId).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <View style={styles.root}>
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip
            label="전체"
            icon={<BabyLogIcon kind="folder" size={14} color={reportCat === "all" ? colors.amberDark : colors.muted} />}
            active={reportCat === "all"}
            onPress={() => setReportCat("all")}
          />
          {BABY_LOG_CATEGORIES.map((c) => (
            <FilterChip
              key={c.id}
              label={c.label}
              icon={<BabyLogIcon catId={c.id} size={14} />}
              active={reportCat === c.id}
              onPress={() => setReportCat(c.id)}
            />
          ))}
        </ScrollView>

        {reportCat === "all" ? (
          <View style={styles.pad}>
            <View style={styles.aiSummary}>
              <View style={styles.aiTag}>
                <BabyLogIcon kind="sparkles" size={12} color={colors.amber} strokeWidth={2.2} />
                <Text style={styles.aiTagText}>AI 오늘의 요약</Text>
              </View>
              <Text style={styles.aiText}>{aiSummary}</Text>
            </View>

            <View style={styles.insightGrid}>
              {(["breast", "formula", "food", "diaper", "sleep", "tummy"] as BabyLogCategoryId[]).map((id) => {
                const c = getCategory(id);
                const todays = todayFor(id);
                const lastTime = todays.length ? todays[todays.length - 1].time : "-";
                return (
                  <Pressable key={id} style={styles.insightCard} onPress={() => setReportCat(id)}>
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
            {weekBars.map((d) => (
              <View key={d.day}>
                <BarRow day={d.day} width={d.feed} color="#f0a93c" />
                <BarRow day="" width={d.sleep} color="#7c83fd" />
                <BarRow day="" width={d.diaper} color="#c98a54" marginBottom />
              </View>
            ))}
            <View style={styles.legend}>
              <LegendDot color="#f0a93c" label="수유" />
              <LegendDot color="#7c83fd" label="수면(시간)" />
              <LegendDot color="#c98a54" label="배변" />
            </View>
          </View>
        ) : (
          <CategoryDetail catId={reportCat} logs={todayFor(reportCat)} />
        )}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
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

function CategoryDetail({ catId, logs }: { catId: BabyLogCategoryId; logs: ReturnType<typeof useBabyLog>["logs"] }) {
  const c = getCategory(catId);
  const lastTime = logs.length ? logs[logs.length - 1].time : "없음";

  let avgGapStr = "-";
  let gaps: number[] = [];
  if (logs.length >= 2) {
    gaps = logs.slice(1).map((l, i) => toMinutes(l.time) - toMinutes(logs[i].time));
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    avgGapStr = `${Math.floor(avg / 60)}시간 ${Math.round(avg % 60)}분`;
  }

  const history = CAT_HISTORY[catId] ?? [1, 1, 1, 1, 1, 1];
  const todayVal = logs.length;
  const avgHist = history.reduce((a, b) => a + b, 0) / history.length;
  const isAnomaly = Math.abs(todayVal - avgHist) >= Math.max(1, avgHist * 0.4);
  const isLow = todayVal < avgHist;
  const values = [...history, todayVal];
  const max = Math.max(...values, 1);
  const days = [...HISTORY_DAYS, "오늘"];

  return (
    <View style={styles.pad}>
      <View style={styles.statRow}>
        <StatCard icon={<BabyLogIcon catId={catId} size={18} />} num={`${logs.length}회`} lbl="오늘 횟수" />
        <StatCard icon={<BabyLogIcon kind="clock" size={18} color={colors.muted} />} num={lastTime} lbl="마지막 기록" />
        <StatCard icon={<BabyLogIcon kind="interval" size={18} color={colors.muted} />} num={avgGapStr} lbl="평균 간격" />
      </View>

      <Text style={styles.chartTitle}>
        오늘의 간격<Text style={styles.chartSub}>이벤트 사이 시간 차이</Text>
      </Text>
      {logs.length === 0 ? (
        <Text style={styles.hint}>오늘 {c.label} 기록이 아직 없어요.</Text>
      ) : logs.length === 1 ? (
        <Text style={styles.hint}>기록이 2건 이상일 때 간격을 보여드려요. (현재 1건: {logs[0].time})</Text>
      ) : (
        <>
          <IntervalRow entry={logs[0]} c={c} />
          {logs.slice(1).map((entry, i) => {
            const gap = gaps[i];
            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const isShort = gap < avgGap * 0.5;
            const isLong = gap > avgGap * 1.8;
            const gapTxt = gap >= 60 ? `${Math.floor(gap / 60)}시간 ${gap % 60}분` : `${gap}분`;
            const flag = isShort ? "⚠️ 평소보다 짧아요" : isLong ? "⚠️ 평소보다 길어요" : "";
            return (
              <View key={entry.id}>
                <View style={styles.gapRow}>
                  <Text
                    style={[
                      styles.gapPill,
                      isShort && styles.gapShort,
                      isLong && styles.gapLong,
                    ]}
                  >
                    {gapTxt}
                  </Text>
                  <Text style={styles.gapFlag}>{flag}</Text>
                </View>
                <IntervalRow entry={entry} c={c} />
              </View>
            );
          })}
        </>
      )}

      <Text style={[styles.chartTitle, { marginTop: 20 }]}>
        7일 트렌드<Text style={styles.chartSub}>이상치는 강조돼요</Text>
      </Text>
      <View style={styles.trendChart}>
        {days.map((d, i) => {
          const v = values[i];
          const h = Math.max(6, Math.round((v / max) * 100));
          const isToday = i === days.length - 1;
          const flagAnomaly = isToday && isAnomaly;
          return (
            <View key={d} style={styles.trendCol}>
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
              <Text style={styles.trendDay}>{d}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.trendNote}>
        {isAnomaly
          ? `오늘 ${c.label} 기록이 최근 6일 평균(약 ${avgHist.toFixed(1)}회)보다 ${isLow ? "적어요" : "많아요"}. ${isLow ? "컨디션 변화가 있는지 살펴봐 주세요." : "평소보다 자주 기록됐어요."}`
          : `오늘 ${c.label} 기록은 최근 6일 평균과 비슷한 수준이에요.`}
      </Text>
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

function IntervalRow({
  entry,
  c,
}: {
  entry: BabyLogEntry;
  c: ReturnType<typeof getCategory>;
}) {
  const meta = formatLogMeta(entry);
  return (
    <View style={styles.intervalRow}>
      <Text style={styles.intervalTime}>{entry.time}</Text>
      <View style={[styles.intervalDot, { backgroundColor: c.color }]} />
      <View style={styles.intervalLabelRow}>
        {!entry.cat.startsWith("custom:") && (
          <BabyLogIcon catId={entry.cat as BabyLogCategoryId} size={15} />
        )}
        <Text style={styles.intervalLabel}>
          {meta === "기록됨" ? c.label : meta}
        </Text>
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
    marginBottom: 18,
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
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
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
  barDay: { fontSize: 10.5, color: colors.faint, width: 26 },
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
