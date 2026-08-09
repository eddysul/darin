import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
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
import { formatDateKey } from "../../utils/dateKey";
import {
  buildTodaySummary,
  categoryCountsLast7,
  FEEDING_CATS,
  formatSleepDuration,
  getLogsForDay,
} from "../../utils/reportAggregates";
import { colors, radius } from "../../theme";
import { formatDisplayTime } from "../../utils/logSummary";
import { useAppSettings } from "../../context/AppSettingsContext";
import type { GrowthRecord } from "../../types/growthRecord";
import { formatWeight, lengthFromCm } from "../../utils/measurementFormat";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
  onOpenRecord: () => void;
};

type ReportCat = "all" | BabyLogCategoryId;

export function BabyReportScreen({ onOpenProfile, onOpenSettings, onOpenConsult, onOpenRecord }: Props) {
  const { logs, babyName, careSetup, diaryEntries, growthRecords, addGrowthRecord, updateGrowthRecord } = useBabyLog();
  const { settings } = useAppSettings();
  const [reportCat, setReportCat] = useState<ReportCat>("all");
  const [growthModalOpen, setGrowthModalOpen] = useState(false);
  const [editingGrowthRecord, setEditingGrowthRecord] = useState<GrowthRecord | null>(null);
  const [chipPressing, setChipPressing] = useState(false);
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(chipPressing);

  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);
  const summary = useMemo(() => buildTodaySummary(logs), [logs]);
  const dashboard = useMemo(
    () => buildDashboardData({ logs, todayLogs, summary, birthDate: careSetup.child.birthDate }),
    [careSetup.child.birthDate, logs, summary, todayLogs],
  );
  const latestMilestone = useMemo(
    () => diaryEntries
      .filter((entry) => entry.milestoneTag || entry.customMilestoneTag)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0],
    [diaryEntries],
  );
  const sortedGrowthRecords = useMemo(
    () => [...growthRecords].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [growthRecords],
  );
  const latestGrowthRecord = useMemo(() => {
    const hospital = sortedGrowthRecords.filter((record) => record.source === "hospital");
    return hospital[hospital.length - 1] ?? sortedGrowthRecords[sortedGrowthRecords.length - 1] ?? null;
  }, [sortedGrowthRecords]);
  const growthDisplayRecords = useMemo(() => {
    const hospital = sortedGrowthRecords.filter((record) => record.source === "hospital");
    return hospital.length ? hospital : sortedGrowthRecords;
  }, [sortedGrowthRecords]);
  const latestWeightRecord = useMemo(
    () => [...growthDisplayRecords].reverse().find((record) => record.weightKg !== undefined),
    [growthDisplayRecords],
  );
  const latestHeightRecord = useMemo(
    () => [...growthDisplayRecords].reverse().find((record) => record.heightCm !== undefined),
    [growthDisplayRecords],
  );
  const latestHeadRecord = useMemo(
    () => [...growthDisplayRecords].reverse().find((record) => record.headCircumferenceCm !== undefined),
    [growthDisplayRecords],
  );
  const hasRhythmData = useMemo(
    () => todayLogs.some((entry) => entry.cat === "sleep" || entry.cat === "diaper" || isFeedingLog(entry)),
    [todayLogs],
  );
  const recordedDayCount = useMemo(
    () => new Set(logs.map((entry) => entry.dateKey).filter(Boolean)).size,
    [logs],
  );

  const todayFor = (catId: BabyLogCategoryId) => todayLogs.filter((l) => l.cat === catId);

  return (
    <View style={styles.root}>
      <AppHeader onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />
      <ScrollView showsVerticalScrollIndicator={false} {...scrollProps}>
        {reportCat === "all" ? (
          <View style={styles.pad}>
            <DashboardCard title="오늘 요약" caption={`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 기준`}>
              {summary.totalCount > 0 ? (
                <View style={styles.summaryGrid}>
                  <SummaryMetric icon="formula" label="수유" value={`${summary.feedCount}회`} sub={dashboard.feedMl > 0 ? `총 ${dashboard.feedMl}ml` : "총량 기록 없음"} onPress={() => setReportCat("formula")} />
                  <SummaryMetric icon="sleep" label="수면" value={formatSleepDuration(summary.totalSleepMinutes)} sub={`낮잠 ${summary.sleepCount}회`} onPress={() => setReportCat("sleep")} />
                  <SummaryMetric icon="diaper" label="기저귀" value={`${summary.diaperCount}회`} sub={`대변 ${dashboard.stoolCount}회`} onPress={() => setReportCat("diaper")} />
                  <SummaryMetric icon="clock" label="마지막 수유" value={dashboard.lastFeedAgo} sub={summary.lastFeedAt ? formatDisplayTime(summary.lastFeedAt) : "기록 없음"} onPress={() => setReportCat("formula")} last />
                </View>
              ) : (
                <DashboardEmpty
                  icon="record"
                  title="오늘 기록을 남기면 하루가 자동으로 정리돼요."
                  actionLabel="첫 기록 남기기"
                  onPress={onOpenRecord}
                />
              )}
            </DashboardCard>

            <DashboardCard title="성장" caption={latestGrowthRecord ? `${formatGrowthDate(latestGrowthRecord.measuredAt)} 업데이트` : undefined}>
              {latestGrowthRecord ? (
                <>
                  <View style={styles.growthGrid}>
                    <GrowthMetric label="몸무게" value={latestWeightRecord?.weightKg === undefined ? "기록 없음" : formatWeight(latestWeightRecord.weightKg, settings.units.weight)} note={latestWeightRecord ? (latestWeightRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color="#E8918A" values={sortedGrowthRecords.flatMap((record) => record.weightKg === undefined ? [] : [record.weightKg])} />
                    <GrowthMetric label="키" value={latestHeightRecord?.heightCm === undefined ? "기록 없음" : formatGrowthLength(latestHeightRecord.heightCm, settings.units.height)} note={latestHeightRecord ? (latestHeightRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color="#9B82D7" values={sortedGrowthRecords.flatMap((record) => record.heightCm === undefined ? [] : [record.heightCm])} />
                    <GrowthMetric label="머리둘레" value={latestHeadRecord?.headCircumferenceCm === undefined ? "기록 없음" : formatGrowthLength(latestHeadRecord.headCircumferenceCm, settings.units.height)} note={latestHeadRecord ? (latestHeadRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color="#69C3AE" values={sortedGrowthRecords.flatMap((record) => record.headCircumferenceCm === undefined ? [] : [record.headCircumferenceCm])} last />
                  </View>
                  <View style={styles.growthActions}>
                    <Pressable style={styles.growthSecondaryBtn} onPress={() => { setEditingGrowthRecord(null); setGrowthModalOpen(true); }}><Text style={styles.growthSecondaryText}>+ 성장 기록 추가</Text></Pressable>
                    <Pressable style={styles.growthEditBtn} onPress={() => { setEditingGrowthRecord(latestGrowthRecord); setGrowthModalOpen(true); }}><Text style={styles.growthEditText}>최근 기록 수정</Text></Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.growthEmpty}>
                  <View style={styles.growthEmptyIcon}><BabyLogIcon kind="tab" tab="report" size={24} color="#69AFA0" /></View>
                  <Text style={styles.growthEmptyTitle}>아직 성장 기록이 없어요.</Text>
                  <Text style={styles.growthEmptyBody}>병원에서 받은 키·몸무게·머리둘레를 입력하면 성장 흐름을 볼 수 있어요.</Text>
                  <Pressable style={styles.growthEmptyBtn} onPress={() => { setEditingGrowthRecord(null); setGrowthModalOpen(true); }}><Text style={styles.growthEmptyBtnText}>성장 기록 추가</Text></Pressable>
                </View>
              )}
            </DashboardCard>

            <DashboardCard title="오늘 하이라이트" icon="sparkles">
              {todayLogs.length > 0 ? (
                <View style={styles.highlightList}>
                  {dashboard.highlights.map((text, index) => (
                    <HighlightRow key={`${index}-${text}`} text={text} color={["#9B82D7", "#E8918A", "#69C3AE"][index] ?? colors.amber} />
                  ))}
                </View>
              ) : <DashboardEmpty title="오늘 기록을 조금만 남겨주시면, 평소와 달라진 흐름을 알려드릴게요." compact />}
            </DashboardCard>

            <DashboardCard title="오늘의 리듬">
              {hasRhythmData ? (
                <>
                  <View style={styles.rhythmContent}>
                    <RhythmDial logs={todayLogs} />
                    <View style={styles.rhythmNotes}>
                      {dashboard.rhythmNotes.map((text) => <Text key={text} style={styles.rhythmNote}>• {text}</Text>)}
                    </View>
                  </View>
                  <View style={styles.rhythmLegend}>
                    <LegendDot color="#9B82D7" label="수면" />
                    <LegendDot color="#E8918A" label="수유" />
                    <LegendDot color="#69C3AE" label="기저귀" />
                  </View>
                </>
              ) : <DashboardEmpty title="수유/수면/기저귀 기록이 쌓이면 하루 리듬을 보여드릴게요." compact />}
            </DashboardCard>

            <DashboardCard title="최근 경향" icon="sparkles">
              <View style={styles.compactInsight}>
                <View style={styles.trendIcon}><Text style={styles.trendIconText}>↗</Text></View>
                <Text style={styles.compactInsightText}>{recordedDayCount < 3 ? "최근 3일 이상 기록이 쌓이면 변화 흐름을 알려드릴게요." : dashboard.trend}</Text>
                {recordedDayCount >= 3 ? <Pressable style={styles.detailBtn} onPress={() => setReportCat("sleep")}>
                  <Text style={styles.detailBtnText}>자세히 보기</Text>
                </Pressable> : null}
              </View>
            </DashboardCard>

            <DashboardCard title="마일스톤">
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneIcon}><Text style={styles.milestoneEmoji}>🐻</Text></View>
                <View style={styles.milestoneBody}>
                  <View style={styles.badge}><Text style={styles.badgeText}>현재</Text></View>
                  <Text style={styles.milestoneCurrent}>{latestMilestone?.milestoneTag ?? latestMilestone?.customMilestoneTag ?? dashboard.milestone.current}</Text>
                  <Text style={styles.milestoneTip}>다음 단계: {latestMilestone ? "아이가 즐거워하는 동작을 짧게 반복해보세요." : dashboard.milestone.tip}</Text>
                </View>
                <Pressable style={styles.tipBtn} onPress={() => onOpenConsult(`${babyName}의 월령에 맞는 발달 놀이 팁을 알려줘`)}>
                  <Text style={styles.tipBtnText}>팁 보기</Text>
                </Pressable>
              </View>
            </DashboardCard>
          </View>
        ) : (
          <>
            <Pressable style={styles.backToOverview} onPress={() => setReportCat("all")}>
              <Text style={styles.backToOverviewText}>‹ 한눈에 돌아가기</Text>
            </Pressable>
            <CategoryDetail catId={reportCat} todayLogs={todayFor(reportCat)} allLogs={logs} />
          </>
        )}
      </ScrollView>

      <ConsultFab hidden={fabHidden || reportCat === "all"} onPress={() => setPromptOpen(true)} />
      <ConsultPromptSheet
        visible={promptOpen}
        todayLogCount={summary.totalCount}
        onClose={() => setPromptOpen(false)}
        onSelectQuestion={(question) => {
          setPromptOpen(false);
          onOpenConsult(question);
        }}
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
    </View>
  );
}

type DashboardData = {
  feedMl: number;
  stoolCount: number;
  lastFeedAgo: string;
  highlights: string[];
  rhythmNotes: string[];
  trend: string;
  milestone: { current: string; tip: string };
};

function isFeedingLog(entry: BabyLogEntry): boolean {
  return !entry.cat.startsWith("custom:") && FEEDING_CATS.includes(entry.cat as BabyLogCategoryId);
}

function elapsedLabel(time?: string): string {
  if (!time) return "기록 없음";
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const recorded = toMinutes(time);
  const diff = Math.max(0, current - recorded);
  if (diff < 60) return `${diff}분 전`;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return minutes ? `${hours}시간 ${minutes}분 전` : `${hours}시간 전`;
}

function ageInMonths(birthDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth());
}

function milestoneCopy(months: number | null): DashboardData["milestone"] {
  if (months === null) return { current: "아이의 작은 변화를 천천히 관찰하고 있어요.", tip: "프로필에 생년월일을 입력하면 월령별 팁을 볼 수 있어요." };
  if (months < 3) return { current: "소리와 얼굴을 따라보는 시기예요.", tip: "가까이에서 천천히 눈을 맞추고 이야기해보세요." };
  if (months < 6) return { current: "고개 들기와 몸 뒤집기를 연습하는 시기예요.", tip: "바닥 놀이 중 손이 닿는 곳에 장난감을 놓아보세요." };
  if (months < 9) return { current: "앉기와 주변 탐색이 활발해지는 시기예요.", tip: "안전한 자리에서 짧게 앉기 놀이를 해보세요." };
  if (months < 13) return { current: "기어가기와 일어서기를 시도하는 시기예요.", tip: "잡고 일어설 수 있는 안전한 지지대를 마련해보세요." };
  return { current: "움직임과 표현이 빠르게 다양해지는 시기예요.", tip: "아이가 좋아하는 동작과 말을 함께 반복해보세요." };
}

function buildDashboardData(input: {
  logs: BabyLogEntry[];
  todayLogs: BabyLogEntry[];
  summary: ReturnType<typeof buildTodaySummary>;
  birthDate?: string;
}): DashboardData {
  const { todayLogs, summary } = input;
  const feeds = todayLogs.filter(isFeedingLog);
  const feedMl = feeds.reduce((sum, entry) => sum + (Number.parseFloat(entry.amount ?? "0") || 0), 0);
  const stoolCount = todayLogs.filter((entry) => entry.cat === "diaper" && ["대변", "둘다"].includes(entry.chip ?? "")).length;
  const highlights: string[] = [];

  const sleepDiff = summary.totalSleepMinutes - summary.yesterdaySleepMinutes;
  if (summary.yesterdaySleepMinutes > 0 && Math.abs(sleepDiff) >= 20) {
    highlights.push(`오늘 수면이 어제보다 ${formatSleepDuration(Math.abs(sleepDiff))} ${sleepDiff > 0 ? "길었어요" : "짧았어요"}.`);
  } else if (summary.sleepCount > 0) {
    highlights.push(`오늘 낮잠은 ${summary.sleepCount}회, 모두 ${formatSleepDuration(summary.totalSleepMinutes)}였어요.`);
  }
  if (summary.flags.includes("feeding_up")) highlights.push("오늘 수유 횟수가 최근 평균보다 조금 많았어요.");
  else if (summary.flags.includes("feeding_down")) highlights.push("오늘 수유 횟수가 최근 평균보다 조금 적었어요.");
  else if (summary.feedCount > 0) highlights.push("오늘 수유 횟수는 최근 흐름과 비슷해요.");
  if (stoolCount > 0) highlights.push(`오늘 대변 기록이 ${stoolCount}회 있었어요.`);
  else if (summary.diaperCount > 0) highlights.push(`기저귀 교체가 ${summary.diaperCount}회 기록됐어요.`);
  if (highlights.length === 0) highlights.push("오늘 기록이 쌓이면 평소와 달라진 흐름을 알려드릴게요.");

  const feedTimes = feeds.map((entry) => toMinutes(entry.time));
  const gaps = feedTimes.slice(1).map((time, index) => time - feedTimes[index]).filter((gap) => gap >= 0);
  const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null;
  const rhythmNotes = [
    avgGap === null ? "수유 기록이 2회 이상이면 평균 간격을 보여드려요." : `수유 간격은 평균 ${formatSleepDuration(avgGap)}이에요.`,
    summary.sleepCount > 0 ? `오늘 낮잠은 총 ${summary.sleepCount}회였어요.` : "아직 오늘 수면 기록이 없어요.",
  ];

  let trend = "최근 기록이 더 쌓이면 3일·7일 흐름을 비교해드릴게요.";
  if (!summary.flags.includes("sparse_week")) {
    if (summary.flags.includes("feeding_normal") && summary.flags.includes("diaper_normal")) trend = "최근 7일 동안 수유와 기저귀 패턴이 비교적 일정해요.";
    else if (summary.flags.includes("sleep_more_than_yesterday")) trend = "최근 흐름과 비교해 오늘 수면 시간이 조금 길었어요.";
    else if (summary.flags.includes("sleep_less_than_yesterday")) trend = "최근 흐름과 비교해 오늘 수면 시간이 조금 짧았어요.";
    else trend = "최근 7일 기록이 큰 변화 없이 이어지고 있어요.";
  }

  return {
    feedMl: Math.round(feedMl),
    stoolCount,
    lastFeedAgo: elapsedLabel(summary.lastFeedAt),
    highlights: highlights.slice(0, 3),
    rhythmNotes,
    trend,
    milestone: milestoneCopy(ageInMonths(input.birthDate)),
  };
}

function DashboardCard({
  title,
  caption,
  icon,
  children,
}: {
  title: string;
  caption?: string;
  icon?: "sparkles";
  children: ReactNode;
}) {
  return (
    <View style={styles.dashboardCard}>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardTitleRow}>
          {icon ? <BabyLogIcon kind={icon} size={16} color={colors.amber} strokeWidth={2.1} /> : null}
          <Text style={styles.dashboardTitle}>{title}</Text>
        </View>
        {caption ? <Text style={styles.dashboardCaption}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  sub,
  onPress,
  last,
}: {
  icon: BabyLogCategoryId | "clock";
  label: string;
  value: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.summaryMetric, last && styles.metricLast]} onPress={onPress}>
      <View style={[styles.summaryIcon, icon === "sleep" ? styles.summaryIconPurple : icon === "diaper" ? styles.summaryIconMint : undefined]}>
        {icon === "clock" ? <BabyLogIcon kind="clock" size={19} color="#E9A353" /> : <BabyLogIcon catId={icon} size={20} />}
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.summarySub} numberOfLines={1}>{sub}</Text>
    </Pressable>
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

function formatGrowthLength(value: number, unit: "cm" | "inch"): string {
  return `${lengthFromCm(value, unit)}${unit === "inch" ? "in" : "cm"}`;
}

function growthTrendPath(values: number[]): string {
  if (values.length === 0) return "M4 18 L68 18";
  if (values.length === 1) return "M4 14 L68 14";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  return values.map((value, index) => {
    const x = 4 + (64 * index) / (values.length - 1);
    const y = 20 - ((value - min) / range) * 14;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function growthTrendLastPoint(values: number[]): { x: number; y: number } | null {
  if (!values.length) return null;
  if (values.length === 1) return { x: 68, y: 14 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  return { x: 68, y: 20 - ((values[values.length - 1] - min) / range) * 14 };
}

function GrowthMetric({ label, value, note, color, values, last }: { label: string; value: string; note: string; color: string; values: number[]; last?: boolean }) {
  const hasValue = value !== "기록 없음";
  const lastPoint = growthTrendLastPoint(values);
  return (
    <View style={[styles.growthMetric, last && styles.metricLast]}>
      <Text style={styles.growthLabel}>{label}</Text>
      <Text style={[styles.growthValue, !hasValue && styles.growthValueEmpty]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Svg width="72" height="25" viewBox="0 0 72 25">
        <Path d={growthTrendPath(values)} fill="none" stroke={hasValue ? color : colors.border} strokeWidth="2" strokeDasharray={hasValue ? undefined : "3 4"} />
        {hasValue && lastPoint ? <Circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill="#FFF" stroke={color} strokeWidth="2" /> : null}
      </Svg>
      <Text style={styles.growthNote}>{note}</Text>
    </View>
  );
}

function HighlightRow({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.highlightRow}>
      <View style={[styles.highlightDot, { backgroundColor: color }]} />
      <Text style={styles.highlightText}>{text}</Text>
    </View>
  );
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

function RhythmDial({ logs }: { logs: BabyLogEntry[] }) {
  const size = 224;
  const center = size / 2;
  const dialRadius = 78;
  const sleepLogs = logs.filter((entry) => entry.cat === "sleep");
  const feedingLogs = logs.filter(isFeedingLog);
  const diaperLogs = logs.filter((entry) => entry.cat === "diaper");
  return (
    <View style={styles.dialWrap} accessibilityLabel="오늘 24시간 수면, 수유, 기저귀 리듬">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={dialRadius} fill="#FFFDFC" stroke={colors.border} strokeWidth="10" />
        {sleepLogs.map((entry) => (
          <Path key={entry.id} d={sleepArcPath(toMinutes(entry.time), Number.parseInt(entry.duration ?? "0", 10) || 5, dialRadius, center)} fill="none" stroke="#9B82D7" strokeWidth="11" strokeLinecap="round" />
        ))}
        {feedingLogs.map((entry) => {
          const point = dialPoint(toMinutes(entry.time), dialRadius, center);
          return <Circle key={entry.id} cx={point.x} cy={point.y} r="5" fill="#E8918A" stroke="#FFF" strokeWidth="2" />;
        })}
        {diaperLogs.map((entry) => {
          const point = dialPoint(toMinutes(entry.time), dialRadius - 15, center);
          return <Circle key={entry.id} cx={point.x} cy={point.y} r="4.5" fill="#69C3AE" stroke="#FFF" strokeWidth="2" />;
        })}
        <SvgText x={center} y={center - 2} textAnchor="middle" fontSize="13" fontWeight="700" fill={colors.text}>오늘</SvgText>
        <SvgText x={center} y={center + 16} textAnchor="middle" fontSize="11" fill={colors.faint}>24h</SvgText>
        <SvgText x={center - 11} y="16" textAnchor="middle" fontSize="10" fill={colors.faint}>0</SvgText>
        <SvgText x={center + 13} y="16" textAnchor="middle" fontSize="10" fill={colors.faint}>24</SvgText>
        <SvgText x={size - 15} y={center + 4} textAnchor="middle" fontSize="10" fill={colors.faint}>6</SvgText>
        <SvgText x={center} y={size - 7} textAnchor="middle" fontSize="10" fill={colors.faint}>12</SvgText>
        <SvgText x="15" y={center + 4} textAnchor="middle" fontSize="10" fill={colors.faint}>18</SvgText>
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
  dashboardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 13 },
  dashboardTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  dashboardTitle: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  dashboardCaption: { fontSize: 10.5, fontWeight: "600", color: colors.faint },
  summaryGrid: { flexDirection: "row", alignItems: "stretch" },
  summaryMetric: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: colors.border },
  summaryIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, marginBottom: 7 },
  summaryIconPurple: { backgroundColor: "rgba(155,130,215,0.14)" },
  summaryIconMint: { backgroundColor: "rgba(105,195,174,0.14)" },
  summaryLabel: { fontSize: 10.5, color: colors.muted, fontWeight: "600" },
  summaryValue: { width: "100%", textAlign: "center", fontSize: 15, color: colors.text, fontWeight: "900", marginTop: 4 },
  summarySub: { maxWidth: "100%", fontSize: 9.5, color: colors.faint, fontWeight: "600", marginTop: 4 },
  dashboardEmpty: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 14 },
  dashboardEmptyCompact: { paddingVertical: 12 },
  dashboardEmptyIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, marginBottom: 9 },
  dashboardEmptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 19, textAlign: "center" },
  dashboardEmptyBtn: { marginTop: 12, minWidth: 140, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.amber },
  dashboardEmptyBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  growthGrid: { flexDirection: "row" },
  growthMetric: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 7, borderRightWidth: 1, borderRightColor: colors.border },
  metricLast: { borderRightWidth: 0 },
  growthLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, alignSelf: "flex-start" },
  growthValue: { width: "100%", fontSize: 16, fontWeight: "900", color: colors.text, marginTop: 6 },
  growthValueEmpty: { fontSize: 12, color: colors.faint, fontWeight: "700" },
  growthNote: { width: "100%", fontSize: 9.5, color: colors.faint, marginTop: 3 },
  growthActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  growthSecondaryBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft },
  growthSecondaryText: { fontSize: 11.5, fontWeight: "800", color: colors.amber },
  growthEditBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  growthEditText: { fontSize: 11.5, fontWeight: "700", color: colors.text },
  growthEmpty: { alignItems: "center", paddingHorizontal: 12, paddingBottom: 4 },
  growthEmptyIcon: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F5F0", marginBottom: 10 },
  growthEmptyTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  growthEmptyBody: { maxWidth: 300, marginTop: 6, fontSize: 11.5, lineHeight: 17, textAlign: "center", color: colors.faint },
  growthEmptyBtn: { marginTop: 13, minWidth: 150, alignItems: "center", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 13, backgroundColor: colors.amber },
  growthEmptyBtnText: { fontSize: 12.5, fontWeight: "800", color: colors.amberDark },
  highlightList: { gap: 10 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  highlightDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  highlightText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  rhythmContent: { flexDirection: "row", alignItems: "center", gap: 2 },
  dialWrap: { width: 224, height: 224, marginLeft: -12 },
  rhythmNotes: { flex: 1, gap: 10, paddingRight: 2 },
  rhythmNote: { fontSize: 11.5, lineHeight: 17, color: colors.muted },
  rhythmLegend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: -4 },
  compactInsight: { flexDirection: "row", alignItems: "center", gap: 10 },
  trendIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber },
  trendIconText: { fontSize: 22, fontWeight: "800", color: "#FFF" },
  compactInsightText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  detailBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.cardHi },
  detailBtnText: { fontSize: 10.5, fontWeight: "700", color: colors.text },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  milestoneIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(233,163,83,0.18)" },
  milestoneEmoji: { fontSize: 23 },
  milestoneBody: { flex: 1, minWidth: 0 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "rgba(233,163,83,0.15)", marginBottom: 4 },
  badgeText: { fontSize: 9.5, fontWeight: "800", color: "#D49347" },
  milestoneCurrent: { fontSize: 12.5, fontWeight: "800", color: colors.text, lineHeight: 18 },
  milestoneTip: { fontSize: 10.5, color: colors.faint, lineHeight: 16, marginTop: 3 },
  tipBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.cardHi },
  tipBtnText: { fontSize: 10.5, fontWeight: "700", color: colors.text },
  backToOverview: { alignSelf: "flex-start", marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 10, paddingVertical: 6 },
  backToOverviewText: { color: colors.amber, fontSize: 12.5, fontWeight: "800" },
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
