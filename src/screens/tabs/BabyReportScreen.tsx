import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from "react-native";
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
  buildWeeklySummary,
  categoryCountsLast7,
  FEEDING_CATS,
  formatSleepDuration,
  getLogsForDay,
  summarizeFeedingVolumes,
  weeklyTrend,
} from "../../utils/reportAggregates";
import { colors, categoryColors, radius } from "../../theme";
import { formatDisplayTime } from "../../utils/logSummary";
import { useAppSettings } from "../../context/AppSettingsContext";
import type { GrowthRecord } from "../../types/growthRecord";
import { formatTemperature, formatWeight, lengthFromCm } from "../../utils/measurementFormat";
import {
  formatScheduleTiming,
  nextByKind,
  type ResolvedScheduleItem,
  type ScheduleKind,
} from "../../constants/childCareSchedule";
import {
  buildLastFeedSleepDistribution,
  type DistributionBucket,
} from "../../utils/careInsights";

/** 가장 큰 값을 100%로 두되, 짧은 막대도 보이게 최소폭을 준다. */
function barPercent(value: number, buckets: DistributionBucket[]): number {
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  return Math.max(8, Math.round((value / max) * 100));
}

/** 실제 일정이거나, 데이터 확정 전 자리만 잡은 행이거나. */
type CareScheduleRow =
  | { kind: ScheduleKind; item: ResolvedScheduleItem }
  | { kind: "checkup" | "vaccine"; pendingLabel: string };

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenShared?: () => void;
  onOpenConsult: (initialQuestion?: string) => void;
  onOpenRecord: () => void;
};

type ReportCat = "all" | "feeding" | BabyLogCategoryId;

export function BabyReportScreen({ onOpenProfile, onOpenSettings, onOpenNotifications, onOpenShared, onOpenConsult, onOpenRecord }: Props) {
  const { logs, babyName, careSetup, diaryEntries, growthRecords, addGrowthRecord, updateGrowthRecord } = useBabyLog();
  const { settings } = useAppSettings();
  const [reportCat, setReportCat] = useState<ReportCat>("all");
  const [growthModalOpen, setGrowthModalOpen] = useState(false);
  const [editingGrowthRecord, setEditingGrowthRecord] = useState<GrowthRecord | null>(null);
  const [chipPressing, setChipPressing] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(
    chipPressing || growthModalOpen,
  );

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
  const weekly = useMemo(() => buildWeeklySummary(logs), [logs]);
  const distribution = useMemo(() => buildLastFeedSleepDistribution(logs, todayKey), [logs, todayKey]);
  const healthSignals = useMemo(() => buildHealthSignals(todayLogs), [todayLogs]);
  const schedule = useMemo<CareScheduleRow[]>(() => {
    const birthDate = careSetup.child.birthDate;
    if (!birthDate) return [];
    const kinds: { kind: ScheduleKind; pending: string }[] = [
      { kind: "checkup", pending: "다음 건강검진" },
      { kind: "vaccine", pending: "다음 예방접종" },
      { kind: "safety", pending: "" },
    ];
    return kinds.flatMap(({ kind, pending }): CareScheduleRow[] => {
      const item = nextByKind(birthDate, kind);
      if (item) return [{ kind, item }];
      return kind === "safety" || !pending ? [] : [{ kind, pendingLabel: pending }];
    });
  }, [careSetup.child.birthDate]);
  const isBirthday = useMemo(() => {
    const birthDate = careSetup.child.birthDate;
    if (!birthDate) return false;
    const today = formatDateKey();
    return birthDate.slice(5) === today.slice(5);
  }, [careSetup.child.birthDate]);

  const medicalSchedule = schedule.filter((row) => row.kind === "checkup" || row.kind === "vaccine");
  const safetySchedule = schedule.filter((row): row is { kind: "safety"; item: ResolvedScheduleItem } => (
    row.kind === "safety" && "item" in row
  ));

  const todayFor = (catId: Exclude<ReportCat, "all">) => todayLogs.filter((entry) => (
    catId === "feeding" ? isFeedingLog(entry) : entry.cat === catId
  ));

  return (
    <View style={styles.root}>
      <AppHeader onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} onOpenNotifications={onOpenNotifications} onOpenShared={onOpenShared} />
      <ScrollView showsVerticalScrollIndicator={false} {...scrollProps}>
        {reportCat === "all" ? (
          <View style={styles.pad}>
            {healthSignals.length > 0 ? (
              <DashboardCard title="건강 신호" tone="warning">
                <View style={styles.signalList}>
                  {healthSignals.map((signal) => (
                    <View key={signal.id} style={styles.signalRow}>
                      <Text style={styles.signalTime}>{signal.time}</Text>
                      <Text style={styles.signalText}>{signal.text}</Text>
                    </View>
                  ))}
                </View>
              </DashboardCard>
            ) : null}

            <DashboardCard title="오늘 요약" caption={`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 기준`}>
              {summary.totalCount > 0 ? (
                <>
                  <View style={styles.summaryGrid}>
                    <SummaryMetric icon="formula" label="수유" value={`${summary.feedCount}회`} sub={dashboard.feedVolumeLabel} onPress={() => setReportCat("feeding")} />
                    <SummaryMetric icon="sleep" label="수면" value={formatSleepDuration(summary.totalSleepMinutes)} sub={`낮잠 ${summary.sleepCount}회`} onPress={() => setReportCat("sleep")} />
                    <SummaryMetric icon="diaper" label="기저귀" value={`${summary.diaperCount}회`} sub={`대변 ${dashboard.stoolCount}회`} onPress={() => setReportCat("diaper")} last />
                  </View>
                  <Pressable
                    style={styles.lastFeedRow}
                    onPress={() => setReportCat("feeding")}
                    accessibilityRole="button"
                    accessibilityLabel={`마지막 수유 ${dashboard.lastFeedAgo}`}
                  >
                    <BabyLogIcon kind="clock" size={16} color="#E9A353" />
                    <Text style={styles.lastFeedLabel}>마지막 수유</Text>
                    <Text style={styles.lastFeedValue}>{dashboard.lastFeedAgo}</Text>
                    {summary.lastFeedAt ? (
                      <Text style={styles.lastFeedTime}>{formatDisplayTime(summary.lastFeedAt)}</Text>
                    ) : null}
                  </Pressable>
                </>
              ) : (
                <DashboardEmpty
                  icon="record"
                  title="오늘 기록을 남기면 하루가 자동으로 정리돼요."
                  actionLabel="첫 기록 남기기"
                  onPress={onOpenRecord}
                />
              )}
            </DashboardCard>

            <DashboardCard
              title="주간 요약"
              caption={weekly.lines.length > 0 ? `최근 6일 중 ${weekly.recordedDays}일 기록 기준` : undefined}
            >
              {weekly.lines.length > 0 ? (
                <View style={styles.weeklyList}>
                  {weekly.lines.map((line) => (
                    <Text key={line} style={styles.weeklyLine}>{line}</Text>
                  ))}
                </View>
              ) : (
                <DashboardEmpty title="3일 이상 기록이 쌓이면 요즘 흐름을 문장으로 정리해드릴게요." compact />
              )}
            </DashboardCard>

            <DashboardCard title="성장" caption={latestGrowthRecord ? `${formatGrowthDate(latestGrowthRecord.measuredAt)} 업데이트` : undefined}>
              {latestGrowthRecord ? (
                <>
                  <View style={styles.growthGrid}>
                    <GrowthMetric label="몸무게" value={latestWeightRecord?.weightKg === undefined ? "기록 없음" : formatWeight(latestWeightRecord.weightKg, settings.units.weight)} note={latestWeightRecord ? (latestWeightRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color={colors.amber} points={sortedGrowthRecords.flatMap((record) => record.weightKg === undefined ? [] : [{ value: record.weightKg, source: record.source }])} />
                    <GrowthMetric label="키" value={latestHeightRecord?.heightCm === undefined ? "기록 없음" : formatGrowthLength(latestHeightRecord.heightCm, settings.units.height)} note={latestHeightRecord ? (latestHeightRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color={categoryColors.play} points={sortedGrowthRecords.flatMap((record) => record.heightCm === undefined ? [] : [{ value: record.heightCm, source: record.source }])} />
                    <GrowthMetric label="머리둘레" value={latestHeadRecord?.headCircumferenceCm === undefined ? "기록 없음" : formatGrowthLength(latestHeadRecord.headCircumferenceCm, settings.units.height)} note={latestHeadRecord ? (latestHeadRecord.source === "hospital" ? "최근 병원 기록" : "최근 집 기록") : "측정값을 기다려요"} color={categoryColors.bath} points={sortedGrowthRecords.flatMap((record) => record.headCircumferenceCm === undefined ? [] : [{ value: record.headCircumferenceCm, source: record.source }])} last />
                  </View>
                  <View style={styles.growthLegend}><Text style={styles.growthLegendText}>● 병원 기록</Text><Text style={styles.growthLegendText}>○ 집 기록</Text></View>
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

            <DashboardCard title="오늘의 리듬">
              {hasRhythmData ? (
                <>
                  <View style={styles.rhythmNotes}>
                    {dashboard.rhythmNotes.map((text) => (
                      <Text key={text} style={styles.rhythmNote}>{text}</Text>
                    ))}
                  </View>
                  <Pressable
                    style={styles.rhythmToggle}
                    onPress={() => setRhythmOpen((open) => !open)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: rhythmOpen }}
                    accessibilityLabel={rhythmOpen ? "24시간 그림 접기" : "24시간 그림 보기"}
                  >
                    <Text style={styles.rhythmToggleText}>{rhythmOpen ? "24시간 그림 접기" : "24시간 그림 보기"}</Text>
                  </Pressable>
                  {rhythmOpen ? (
                    <>
                      <View style={styles.rhythmContent}>
                        <RhythmDial logs={todayLogs} />
                      </View>
                      <View style={styles.rhythmLegend}>
                        <LegendDot color={categoryColors.sleep} label="수면" />
                        <LegendDot color={categoryColors.formula} label="수유" />
                        <LegendDot color={categoryColors.diaper} label="기저귀" />
                      </View>
                    </>
                  ) : null}
                </>
              ) : <DashboardEmpty title="수유/수면/기저귀 기록이 쌓이면 하루 리듬을 보여드릴게요." compact />}
            </DashboardCard>

            {distribution ? (
              <DashboardCard
                title="수유 시각과 잠"
                icon="sparkles"
                caption={`${distribution.totalDays}일 기록 기준`}
              >
                <Text style={styles.distSubtitle}>
                  {distribution.bucketLabel}별 {distribution.valueLabel}
                </Text>
                {distribution.buckets.map((bucket) => (
                  <View key={bucket.name} style={styles.distRow}>
                    <View style={styles.distLabelCol}>
                      <Text style={styles.distName}>{bucket.name}</Text>
                      <Text style={styles.distRange}>{bucket.range}</Text>
                    </View>
                    <View style={styles.distBarTrack}>
                      <View style={[styles.distBarFill, { width: `${barPercent(bucket.value, distribution.buckets)}%` }]} />
                    </View>
                    <View style={styles.distValueCol}>
                      <Text style={styles.distValue}>{formatSleepDuration(Math.round(bucket.value))}</Text>
                      <Text style={styles.distDays}>{bucket.days}일</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.distNote}>관찰된 기록일 뿐, 원인을 뜻하지는 않아요.</Text>
              </DashboardCard>
            ) : null}

            <DashboardCard title="발달">
              {isBirthday ? (
                <View style={styles.birthdayBanner}>
                  <BabyLogIcon kind="cake" size={16} color={colors.amberText} />
                  <Text style={styles.birthdayText}>오늘은 {babyName}의 생일이에요.</Text>
                </View>
              ) : null}
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneIcon}><BabyLogIcon kind="baby" size={22} color={colors.amberText} /></View>
                <View style={styles.milestoneBody}>
                  <View style={styles.badge}><Text style={styles.badgeText}>현재</Text></View>
                  <Text style={styles.milestoneCurrent}>{latestMilestone?.milestoneTag ?? latestMilestone?.customMilestoneTag ?? dashboard.milestone.current}</Text>
                  <Text style={styles.milestoneTip}>다음 단계: {latestMilestone ? "아이가 즐거워하는 동작을 짧게 반복해보세요." : dashboard.milestone.tip}</Text>
                </View>
                <Pressable
                  style={styles.tipBtn}
                  onPress={() => onOpenConsult(`${babyName}의 월령에 맞는 발달 놀이 팁을 알려줘`)}
                  accessibilityRole="button"
                  accessibilityLabel="발달 놀이 팁 보기"
                >
                  <Text style={styles.tipBtnText}>팁 보기</Text>
                </Pressable>
              </View>
            </DashboardCard>

            {medicalSchedule.length > 0 || !careSetup.child.birthDate ? (
              <DashboardCard title="일정">
                {medicalSchedule.length > 0 ? (
                  <View style={styles.scheduleListTight}>
                    {medicalSchedule.map((row) => (
                      <CareScheduleItem
                        key={"item" in row ? row.item.id : row.pendingLabel}
                        row={row}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.scheduleHintInline}>생년월일을 입력하면 검진·접종 일정을 알려드릴게요.</Text>
                )}
              </DashboardCard>
            ) : null}

            {safetySchedule.length > 0 ? (
              <DashboardCard title="안전">
                <View style={styles.scheduleListTight}>
                  {safetySchedule.map((row) => (
                    <CareScheduleItem key={row.item.id} row={row} />
                  ))}
                </View>
              </DashboardCard>
            ) : null}
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
  feedVolumeLabel: string;
  stoolCount: number;
  lastFeedAgo: string;
  rhythmNotes: string[];
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
  const feedingVolumes = summarizeFeedingVolumes(feeds);
  const stoolCount = todayLogs.filter((entry) => entry.cat === "diaper" && ["대변", "둘다", "소변+대변"].includes(entry.chip ?? "")).length;

  const feedTimes = feeds.map((entry) => toMinutes(entry.time));
  const gaps = feedTimes.slice(1).map((time, index) => time - feedTimes[index]).filter((gap) => gap >= 0);
  const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null;
  const rhythmNotes = [
    avgGap === null ? "수유 기록이 2회 이상이면 평균 간격을 보여드려요." : `수유 간격은 평균 ${formatSleepDuration(avgGap)}이에요.`,
    summary.sleepCount > 0 ? `오늘 낮잠은 총 ${summary.sleepCount}회였어요.` : "아직 오늘 수면 기록이 없어요.",
  ];

  return {
    feedVolumeLabel: feedingVolumes.label,
    stoolCount,
    lastFeedAgo: elapsedLabel(summary.lastFeedAt),
    rhythmNotes,
    milestone: milestoneCopy(ageInMonths(input.birthDate)),
  };
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
          {icon ? <BabyLogIcon kind={icon} size={16} color={colors.amberText} strokeWidth={2.1} /> : null}
          <Text style={[styles.dashboardTitle, warning && styles.dashboardTitleWarning]}>{title}</Text>
        </View>
        {caption ? <Text style={styles.dashboardCaption}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** 체온 주의 임계 (℃). MVP 임시값 — 의학적 기준 확정 시 교체. */
const HEALTH_TEMP_THRESHOLD = 37.5;

type HealthSignal = { id: string; time: string; text: string };

function buildHealthSignals(todayLogs: BabyLogEntry[]): HealthSignal[] {
  return todayLogs
    .filter((entry) => entry.cat === "temp")
    .flatMap((entry) => {
      const value = Number.parseFloat(String(entry.amountValue ?? entry.amount ?? ""));
      if (!Number.isFinite(value) || value < HEALTH_TEMP_THRESHOLD) return [];
      return [{
        id: entry.id,
        time: formatDisplayTime(entry.time),
        text: `체온 ${formatTemperature(value)} — 평소보다 높아요.`,
      }];
    });
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
    <Pressable
      style={[styles.summaryMetric, last && styles.metricLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
    >
      <View style={[styles.summaryIcon, icon === "sleep" ? styles.summaryIconPurple : icon === "diaper" ? styles.summaryIconMint : undefined]}>
        {icon === "clock" ? <BabyLogIcon kind="clock" size={19} color="#E9A353" /> : <BabyLogIcon catId={icon} size={20} />}
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.summarySub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{sub}</Text>
    </Pressable>
  );
}

function ScheduleKindIcon({ kind, muted }: { kind: ScheduleKind; muted?: boolean }) {
  const color = muted ? colors.faint : colors.amberText;
  if (kind === "checkup") return <BabyLogIcon catId="doctor" size={18} color={color} />;
  if (kind === "vaccine") return <BabyLogIcon catId="vaccination" size={18} color={color} />;
  return <BabyLogIcon kind="alert" size={18} color={color} />;
}

function CareScheduleItem({ row }: { row: CareScheduleRow }) {
  const muted = !("item" in row);
  return (
    <View style={styles.careScheduleRow}>
      <View style={styles.scheduleIconWrap}>
        <ScheduleKindIcon kind={row.kind} muted={muted} />
      </View>
      {"item" in row ? (
        <>
          <View style={styles.scheduleBody}>
            <Text style={styles.careScheduleLabel} numberOfLines={2}>{row.item.label}</Text>
            <Text style={styles.scheduleWindow}>{row.item.window}</Text>
          </View>
          {row.item.kind === "safety" ? null : (
            <Text style={[styles.scheduleTiming, row.item.active && styles.scheduleTimingActive]}>
              {formatScheduleTiming(row.item)}
            </Text>
          )}
        </>
      ) : (
        <>
          <View style={styles.scheduleBody}>
            <Text style={[styles.careScheduleLabel, styles.schedulePending]}>{row.pendingLabel}</Text>
            <Text style={styles.scheduleWindow}>준비 중</Text>
          </View>
          <Text style={[styles.scheduleTiming, styles.schedulePending]}>—</Text>
        </>
      )}
    </View>
  );
}

function DashboardEmpty({ icon, title, actionLabel, onPress, compact }: { icon?: "record"; title: string; actionLabel?: string; onPress?: () => void; compact?: boolean }) {
  return (
    <View style={[styles.dashboardEmpty, compact && styles.dashboardEmptyCompact]}>
      {icon ? <View style={styles.dashboardEmptyIcon}><BabyLogIcon kind="tab" tab={icon} size={21} color={colors.amberText} /></View> : null}
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

function growthTrendPoints(values: number[]): { x: number; y: number }[] {
  if (!values.length) return [];
  if (values.length === 1) return [{ x: 68, y: 14 }];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  return values.map((value, index) => ({
    x: 4 + (64 * index) / (values.length - 1),
    y: 20 - ((value - min) / range) * 14,
  }));
}

function GrowthMetric({ label, value, note, color, points, last }: { label: string; value: string; note: string; color: string; points: { value: number; source: GrowthRecord["source"] }[]; last?: boolean }) {
  const hasValue = value !== "기록 없음";
  const values = points.map((point) => point.value);
  const chartPoints = growthTrendPoints(values);
  return (
    <View style={[styles.growthMetric, last && styles.metricLast]}>
      <Text style={styles.growthLabel}>{label}</Text>
      <Text style={[styles.growthValue, !hasValue && styles.growthValueEmpty]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Svg width="72" height="25" viewBox="0 0 72 25">
        <Path d={growthTrendPath(values)} fill="none" stroke={hasValue ? color : colors.border} strokeWidth="2" strokeDasharray={hasValue ? undefined : "3 4"} />
        {hasValue ? chartPoints.map((point, index) => (
          <Circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="2.7" fill={points[index].source === "hospital" ? color : "#FFF"} stroke={color} strokeWidth="1.7" />
        )) : null}
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
          <Path key={entry.id} d={sleepArcPath(toMinutes(entry.time), Number.parseInt(entry.duration ?? "0", 10) || 5, dialRadius, center)} fill="none" stroke={categoryColors.sleep} strokeWidth="11" strokeLinecap="round" />
        ))}
        {feedingLogs.map((entry) => {
          const point = dialPoint(toMinutes(entry.time), dialRadius, center);
          return <Circle key={entry.id} cx={point.x} cy={point.y} r="5" fill={categoryColors.formula} stroke="#FFF" strokeWidth="2" />;
        })}
        {diaperLogs.map((entry) => {
          const point = dialPoint(toMinutes(entry.time), dialRadius - 15, center);
          return <Circle key={entry.id} cx={point.x} cy={point.y} r="4.5" fill={categoryColors.diaper} stroke="#FFF" strokeWidth="2" />;
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
  catId: BabyLogCategoryId | "feeding";
  todayLogs: BabyLogEntry[];
  allLogs: BabyLogEntry[];
}) {
  const isFeedingGroup = catId === "feeding";
  const c = isFeedingGroup ? { ...getCategory("formula"), label: "수유" } : getCategory(catId);
  const lastTime = todayLogs.length
    ? formatDisplayTime(todayLogs[todayLogs.length - 1].time)
    : "없음";
  const trend: { dateKey: string; label: string; count: number; sleepMinutes?: number }[] = isFeedingGroup
    ? weeklyTrend(allLogs).map((day) => ({ dateKey: day.dateKey, label: day.label, count: day.feedingCount }))
    : categoryCountsLast7(allLogs, catId);
  const values = trend.map((item) => (catId === "sleep" ? (item.sleepMinutes ?? 0) : item.count));
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
          icon={<BabyLogIcon catId={isFeedingGroup ? "formula" : catId} size={18} />}
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
            const flag = isShort ? "평소보다 짧아요" : isLong ? "평소보다 길어요" : "";
            return (
              <View key={entry.id}>
                <View style={styles.gapRow}>
                  <Text style={[styles.gapPill, isShort && styles.gapShort, isLong && styles.gapLong]}>{gapTxt}</Text>
                  {flag ? (
                    <View style={styles.gapFlagRow}>
                      <BabyLogIcon kind="alert" size={12} color={colors.dangerText} />
                      <Text style={styles.gapFlag}>{flag}</Text>
                    </View>
                  ) : null}
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
                  <View style={styles.trendFlag}>
                    {flagAnomaly ? <BabyLogIcon kind="alert" size={12} color={colors.danger} /> : null}
                  </View>
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
  dashboardTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  dashboardTitleWarning: { color: colors.dangerText },
  dashboardCardWarning: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  dashboardCaption: { fontSize: 12, fontWeight: "600", color: colors.faint },
  weeklyList: { gap: 9 },
  weeklyLine: { fontSize: 13, lineHeight: 20, color: colors.muted },
  signalList: { gap: 9 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  signalTime: { fontSize: 12, fontWeight: "700", color: colors.dangerText, width: 46, fontVariant: ["tabular-nums"] },
  signalText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.dangerText },
  distSubtitle: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 12 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  distLabelCol: { width: 72 },
  distName: { fontSize: 13, fontWeight: "700", color: colors.text },
  distRange: { fontSize: 12, color: colors.faint, marginTop: 1 },
  distBarTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: colors.cardHi, overflow: "hidden" },
  distBarFill: { height: "100%", borderRadius: 5, backgroundColor: colors.amber },
  distValueCol: { width: 68, alignItems: "flex-end" },
  distValue: { fontSize: 13, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  distDays: { fontSize: 12, color: colors.faint, marginTop: 1 },
  distNote: { fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 3 },
  careScheduleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scheduleIconWrap: { width: 28, alignItems: "center" },
  scheduleBody: { flex: 1, minWidth: 0 },
  scheduleListTight: { gap: 12 },
  scheduleHintInline: { fontSize: 13, lineHeight: 20, color: colors.faint },
  careScheduleLabel: { fontSize: 13, fontWeight: "700", color: colors.text, lineHeight: 20 },
  scheduleWindow: { fontSize: 12, color: colors.faint, marginTop: 2 },
  scheduleTiming: { fontSize: 12, fontWeight: "800", color: colors.muted, fontVariant: ["tabular-nums"] },
  scheduleTimingActive: { color: colors.amberText },
  schedulePending: { color: colors.faint },
  scheduleHint: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, fontSize: 12, lineHeight: 18, color: colors.faint },
  summaryGrid: { flexDirection: "row", alignItems: "stretch" },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    minHeight: Platform.OS === "android" ? 48 : 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  lastFeedRow: {
    marginTop: 12,
    minHeight: Platform.OS === "android" ? 48 : 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lastFeedLabel: { fontSize: 13, fontWeight: "700", color: colors.muted },
  lastFeedValue: { marginLeft: "auto", fontSize: 15, fontWeight: "800", color: colors.text },
  lastFeedTime: { fontSize: 12, fontWeight: "600", color: colors.faint },
  summaryIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, marginBottom: 7 },
  summaryIconPurple: { backgroundColor: "rgba(155,130,215,0.14)" },
  summaryIconMint: { backgroundColor: "rgba(105,195,174,0.14)" },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  summaryValue: { width: "100%", textAlign: "center", fontSize: 17, color: colors.text, fontWeight: "900", marginTop: 4 },
  summarySub: { maxWidth: "100%", fontSize: 12, color: colors.faint, fontWeight: "600", marginTop: 4 },
  dashboardEmpty: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 14 },
  dashboardEmptyCompact: { paddingVertical: 12 },
  dashboardEmptyIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft, marginBottom: 9 },
  dashboardEmptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  dashboardEmptyBtn: { marginTop: 12, minWidth: 140, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.amber },
  dashboardEmptyBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  healthSignal: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderRadius: 14, padding: 12, backgroundColor: "rgba(233,163,83,0.10)" },
  healthSignalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  healthSignalBody: { flex: 1, minWidth: 0 },
  healthSignalTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
  healthSignalValue: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 18 },
  healthSignalHelp: { marginTop: 5, fontSize: 12, lineHeight: 18, color: colors.faint },
  weeklyGrid: { flexDirection: "row", alignItems: "stretch" },
  weeklyMetric: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: colors.border },
  weeklyLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  weeklyValue: { width: "100%", marginTop: 7, textAlign: "center", fontSize: 15, fontWeight: "900", color: colors.text },
  evidenceBadge: { alignSelf: "center", marginTop: 13, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.backgroundSecondary },
  evidenceBadgeText: { fontSize: 12, fontWeight: "700", color: colors.faint },
  growthGrid: { flexDirection: "row" },
  growthMetric: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 7, borderRightWidth: 1, borderRightColor: colors.border },
  metricLast: { borderRightWidth: 0 },
  growthLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, alignSelf: "flex-start" },
  growthValue: { width: "100%", fontSize: 17, fontWeight: "900", color: colors.text, marginTop: 6 },
  growthValueEmpty: { fontSize: 12, color: colors.faint, fontWeight: "700" },
  growthNote: { width: "100%", fontSize: 12, color: colors.faint, marginTop: 3 },
  growthLegend: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 10 },
  growthLegendText: { fontSize: 12, fontWeight: "700", color: colors.faint },
  growthActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  growthSecondaryBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft },
  growthSecondaryText: { fontSize: 13, fontWeight: "800", color: colors.amberText },
  growthEditBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  growthEditText: { fontSize: 13, fontWeight: "700", color: colors.text },
  growthEmpty: { alignItems: "center", paddingHorizontal: 12, paddingBottom: 4 },
  growthEmptyIcon: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F5F0", marginBottom: 10 },
  growthEmptyTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  growthEmptyBody: { maxWidth: 300, marginTop: 6, fontSize: 13, lineHeight: 20, textAlign: "center", color: colors.faint },
  growthEmptyBtn: { marginTop: 13, minWidth: 150, alignItems: "center", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 13, backgroundColor: colors.amber },
  growthEmptyBtnText: { fontSize: 13, fontWeight: "800", color: colors.amberDark },
  highlightList: { gap: 10 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  highlightDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  highlightText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.muted },
  rhythmContent: { alignItems: "center", gap: 2, marginTop: 8 },
  dialWrap: { width: 224, height: 224 },
  rhythmNotes: { width: "100%", gap: 8, paddingHorizontal: 2 },
  rhythmNote: { fontSize: 13, lineHeight: 20, color: colors.muted },
  rhythmToggle: {
    alignSelf: "flex-start",
    marginTop: 10,
    minHeight: Platform.OS === "android" ? 48 : 44,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  rhythmToggleText: { fontSize: 13, fontWeight: "800", color: colors.amberText },
  rhythmLegend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 },
  compactInsight: { flexDirection: "row", alignItems: "center", gap: 10 },
  trendIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber },
  trendIconText: { fontSize: 22, fontWeight: "800", color: "#FFF" },
  compactInsightText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.muted },
  detailBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.cardHi },
  detailBtnText: { fontSize: 12, fontWeight: "700", color: colors.text },
  patternIntro: { fontSize: 13, lineHeight: 20, color: colors.muted, marginBottom: 12 },
  patternGrid: { flexDirection: "row", alignItems: "stretch" },
  patternMetric: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 5, borderRightWidth: 1, borderRightColor: colors.border },
  patternLabel: { fontSize: 12, fontWeight: "800", color: colors.muted },
  patternTime: { width: "100%", marginTop: 5, textAlign: "center", fontSize: 13, fontWeight: "800", color: colors.text },
  patternSleep: { width: "100%", marginTop: 4, textAlign: "center", fontSize: 12, color: colors.muted },
  patternCount: { marginTop: 3, fontSize: 12, color: colors.faint },
  patternDisclaimer: { marginTop: 11, fontSize: 12, lineHeight: 18, textAlign: "center", color: colors.faint },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  birthdayBanner: { marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.amberSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  birthdayText: { textAlign: "center", fontSize: 13, fontWeight: "800", color: colors.amberText },
  milestoneIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  milestoneBody: { flex: 1, minWidth: 0 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.amberSoft, marginBottom: 4 },
  badgeText: { fontSize: 12, fontWeight: "800", color: colors.amberText },
  milestoneCurrent: { fontSize: 13, fontWeight: "800", color: colors.text, lineHeight: 20 },
  milestoneTip: { fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 3 },
  tipBtn: { minHeight: Platform.OS === "android" ? 48 : 44, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, justifyContent: "center", backgroundColor: colors.cardHi },
  tipBtnText: { fontSize: 12, fontWeight: "700", color: colors.text },
  scheduleList: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 11 },
  backToOverview: { alignSelf: "flex-start", marginHorizontal: 18, marginBottom: 10, minHeight: Platform.OS === "android" ? 48 : 44, paddingHorizontal: 10, justifyContent: "center" },
  backToOverviewText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
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
  filterChipText: { fontSize: 13, fontWeight: "700", color: colors.muted },
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
  aiTagText: { fontSize: 12, fontWeight: "700", color: colors.amberText },
  aiText: { fontSize: 13, lineHeight: 20, color: colors.muted },
  empty: {
    textAlign: "center",
    color: colors.faint,
    fontSize: 13,
    paddingVertical: 8,
    lineHeight: 20,
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
  insightSub: { fontSize: 12, color: colors.faint, marginTop: 2 },
  chartTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 10 },
  chartSub: { fontSize: 12, color: colors.faint, fontWeight: "500" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  barDay: { fontSize: 12, color: colors.faint, width: 28 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.card, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  legend: { flexDirection: "row", gap: 14, marginTop: 6, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.faint },
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
  statLbl: { fontSize: 12, color: colors.faint, marginTop: 1 },
  hint: { textAlign: "center", color: colors.faint, fontSize: 13, paddingVertical: 20 },
  intervalRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  intervalTime: { fontSize: 13, color: colors.muted, width: 48, fontVariant: ["tabular-nums"] },
  intervalDot: { width: 9, height: 9, borderRadius: 5 },
  intervalLabelRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  intervalLabel: { fontSize: 13, fontWeight: "700", color: colors.text, flex: 1 },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 18, paddingVertical: 2 },
  gapPill: {
    fontSize: 12,
    backgroundColor: colors.card,
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  gapShort: { backgroundColor: colors.dangerSoft, color: colors.dangerText },
  gapLong: { backgroundColor: "rgba(232,163,61,0.2)", color: colors.amberText },
  gapFlagRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  gapFlag: { flex: 1, fontSize: 12, color: colors.faint },
  trendChart: { flexDirection: "row", alignItems: "flex-end", gap: 7, height: 118, paddingVertical: 16 },
  trendCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  trendFlag: { height: 16, alignItems: "center", justifyContent: "center" },
  trendTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 5, minHeight: 4 },
  trendDay: { fontSize: 12, color: colors.faint, fontWeight: "600", marginTop: 6 },
  trendNote: { fontSize: 12, color: colors.faint, marginTop: 10, lineHeight: 18 },
});
