import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "../../components/states/FeedbackStates";
import { AppHeader } from "../../components/babylog/AppHeader";
import { ConsultFab } from "../../components/babylog/ConsultFab";
import { ConsultPromptSheet } from "../../components/babylog/ConsultPromptSheet";
import { GrowthRecordModal } from "../../components/babylog/GrowthRecordModal";
import { OverviewGrowthSection } from "../../components/babylog/OverviewGrowthSection";
import { OverviewRhythmCard } from "../../components/babylog/OverviewRhythmCard";
import { OverviewTodaySummary } from "../../components/babylog/OverviewTodaySummary";
import { OverviewWeeklyCard } from "../../components/babylog/OverviewWeeklyCard";
import { OverviewReportScreen } from "../../components/babylog/OverviewReportScreen";
import { PregnancyOverview } from "../../components/babylog/PregnancyOverview";
import { useBabyLog } from "../../context/BabyLogContext";
import { useConsultFabBehavior } from "../../hooks/useConsultFabBehavior";
import { formatDateKey, offsetDateKey, yesterdayDateKey } from "../../utils/dateKey";
import { careLogCoverageContains } from "../../utils/careLogHistory";
import { buildTodaySummary, getLogsForDay } from "../../utils/reportAggregates";
import { colors } from "../../theme";
import type { GrowthRecord } from "../../types/growthRecord";
import { findInsights, insightSourceDateKeys } from "../../utils/careInsights";
import type { GrowthPoint } from "../../components/babylog/GrowthChart";
import { ageDaysBetween, type WhoMeasure, type WhoSex } from "../../utils/growthPercentile";
import { buildWeeklyFeatureTable, WEEK_DAYS } from "../../utils/weeklyFeatureTable";
import { reportHistoryFromKey } from "../../utils/periodReport";
import { buildRuleNarrative } from "../../utils/weeklyRuleNarrative";
import { formatWeekOfMonth } from "../../utils/insightDisplay";
import { buildWeeklyNarrative, type WeeklyNarrative } from "../../utils/weeklyNarrative";
import {
  getWeeklyNarrative,
  hydrateWeeklyNarrative,
  saveWeeklyNarrative,
} from "../../utils/weeklyNarrativeStore";
import {
  buildInsightPhraseInput,
  buildInsightPhrases,
  getInsightPhrases,
  hydrateInsightPhrases,
  saveInsightPhrases,
  type InsightPhrases,
} from "../../utils/insightPhrase";
import {
  INSIGHT_PHRASE_INPUT_SCHEMA_VERSION,
  INSIGHT_PHRASE_VERSION,
} from "../../utils/insightPhrasePrompt";
import {
  createWeeklyAiDisplayState,
  createWeeklyAiCacheIdentity,
  getCurrentWeeklyAiDisplayValue,
  runWeeklyAiRequestOnce,
  weeklyAiCacheIdentityKey,
  type WeeklyAiDisplayState,
} from "../../utils/weeklyAiCache";
import {
  describeTable,
  NARRATIVE_VERSION,
  WEEKLY_NARRATIVE_INPUT_SCHEMA_VERSION,
} from "../../utils/weeklyNarrativePrompt";
import { useLanguage } from "../../LanguageContext";
import type { MainTabParamList } from "../../navigation/types";
import { isPregnancyStage } from "../../utils/childDisplay";
import { reportLogsForDisplay } from "../../utils/reportLogSelection";

const EMPTY_INSIGHT_PHRASES: InsightPhrases = {};

type Props = {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  onOpenShared?: () => void;
  onOpenRecord?: (params?: MainTabParamList["Record"]) => void;
  onOpenDiary?: (params?: MainTabParamList["Diary"]) => void;
  onOpenConsult: (initialQuestion?: string) => void;
};
export function BabyReportScreen({
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onOpenShared,
  onOpenRecord,
  onOpenDiary,
  onOpenConsult,
}: Props) {
  const { locale, t } = useLanguage();
  const {
    logs,
    babyName,
    careSetup,
    growthRecords,
    growthRecordsHydrated,
    diaryEntries,
    customCategories,
    addGrowthRecord,
    updateGrowthRecord,
    storageReady,
    careLogCoverage,
    ensureCareLogsForRange,
    localDataScope,
  } = useBabyLog();
  const pregnancy = isPregnancyStage(careSetup.child);
  const [growthModalOpen, setGrowthModalOpen] = useState(false);
  const [editingGrowthRecord, setEditingGrowthRecord] = useState<GrowthRecord | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const { fabHidden, promptOpen, setPromptOpen, scrollProps } = useConsultFabBehavior(
    growthModalOpen || reportOpen,
  );

  const todayKey = formatDateKey();
  const pregnancyStartDateKey = careSetup.child.dueDate
    ? offsetDateKey(careSetup.child.dueDate, -280)
    : offsetDateKey(todayKey, -280);
  const reportFromDateKey = pregnancy ? pregnancyStartDateKey : offsetDateKey(todayKey, -14);
  const historyFromDateKey = reportHistoryFromKey(careSetup.child.birthDate, todayKey);
  const reportRangeCovered = Boolean(
    careLogCoverage && careLogCoverageContains(careLogCoverage, reportFromDateKey, todayKey),
  );
  const [reportHistoryComplete, setReportHistoryComplete] = useState(false);
  const [reportDataState, setReportDataState] = useState<"loading" | "ready" | "partial" | "error">("loading");
  const [reportHistoryState, setReportHistoryState] = useState<"loading" | "ready" | "partial" | "error">("loading");

  useEffect(() => {
    let active = true;
    if (!storageReady) {
      setReportHistoryComplete(false);
      setReportDataState("loading");
      return () => {
        active = false;
      };
    }
    if (reportRangeCovered) {
      setReportHistoryComplete(true);
      setReportDataState("ready");
      return () => {
        active = false;
      };
    }
    setReportHistoryComplete(false);
    setReportDataState("loading");
    void ensureCareLogsForRange(reportFromDateKey, todayKey).then((result) => {
      if (active) {
        setReportHistoryComplete(result.complete);
        setReportDataState(result.complete ? "ready" : "partial");
      }
    }).catch(() => {
      if (active) setReportDataState("error");
    });
    return () => {
      active = false;
    };
  }, [ensureCareLogsForRange, reportFromDateKey, reportRangeCovered, storageReady, todayKey]);

  useEffect(() => {
    if (!reportOpen || !storageReady) return;
    let active = true;
    setReportHistoryState("loading");
    void ensureCareLogsForRange(historyFromDateKey, todayKey).then((result) => {
      if (active) {
        setReportHistoryComplete(result.complete);
        setReportHistoryState(result.complete ? "ready" : "partial");
      }
    }).catch(() => {
      if (active) setReportHistoryState("error");
    });
    return () => {
      active = false;
    };
  }, [ensureCareLogsForRange, historyFromDateKey, reportOpen, storageReady, todayKey]);

  const reportLogs = reportLogsForDisplay(logs, reportRangeCovered, reportHistoryComplete);
  const yesterdayKey = yesterdayDateKey();
  const todayLogs = useMemo(() => getLogsForDay(reportLogs, todayKey, todayKey), [reportLogs, todayKey]);
  const yesterdayLogs = useMemo(() => getLogsForDay(reportLogs, yesterdayKey, todayKey), [reportLogs, todayKey, yesterdayKey]);
  const summary = useMemo(() => buildTodaySummary(reportLogs), [reportLogs]);
  const sortedGrowthRecords = useMemo(
    () => [...growthRecords].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [growthRecords],
  );
  const insights = useMemo(() => findInsights(reportLogs, todayKey), [reportLogs, todayKey]);

  const weekTable = useMemo(() => buildWeeklyFeatureTable(reportLogs, careSetup), [reportLogs, careSetup]);
  const ruleNarrative = useMemo(() => buildRuleNarrative(weekTable, t, locale), [locale, t, weekTable]);
  const narrativePromptInput = useMemo(() => describeTable(weekTable), [weekTable]);
  const narrativeFromDateKey = weekTable.meta.dateKeys[0]
    ? offsetDateKey(weekTable.meta.dateKeys[0], -WEEK_DAYS)
    : "";
  const narrativeToDateKey = weekTable.meta.dateKeys[weekTable.meta.dateKeys.length - 1] ?? "";
  const narrativeCacheIdentity = useMemo(() => pregnancy ? null : createWeeklyAiCacheIdentity({
    operation: "weekly_narrative",
    scope: localDataScope,
    fromDateKey: narrativeFromDateKey,
    toDateKey: narrativeToDateKey,
    locale,
    inputFacts: narrativePromptInput,
    inputSchemaVersion: WEEKLY_NARRATIVE_INPUT_SCHEMA_VERSION,
    promptVersion: NARRATIVE_VERSION,
  }), [
    localDataScope?.babyId,
    localDataScope?.userId,
    locale,
    narrativeFromDateKey,
    narrativePromptInput,
    narrativeToDateKey,
    pregnancy,
  ]);
  const narrativeRequestKey = narrativeCacheIdentity
    ? weeklyAiCacheIdentityKey(narrativeCacheIdentity)
    : null;
  const narrativeRequestKeyRef = useRef(narrativeRequestKey);
  narrativeRequestKeyRef.current = narrativeRequestKey;
  const [narrativeDisplay, setNarrativeDisplay] =
    useState<WeeklyAiDisplayState<WeeklyNarrative> | null>(null);
  const narrative = getCurrentWeeklyAiDisplayValue(
    narrativeCacheIdentity,
    narrativeDisplay,
  ) ?? ruleNarrative;
  const weeklyHeadline = narrative.headline || t("report.critical.013");
  const weeklyBody = narrative.body || t("report.critical.014");

  // 같은 계정·아기·기간·사실에는 한 번만 AI 를 부른다. 실패하면 규칙 문장이 남는다.
  useEffect(() => {
    let active = true;
    if (pregnancy || !ruleNarrative.headline || !narrativeCacheIdentity) return;
    const fallback = { headline: ruleNarrative.headline, body: ruleNarrative.body, fromAI: false };
    const requestKey = weeklyAiCacheIdentityKey(narrativeCacheIdentity);

    void (async () => {
      await hydrateWeeklyNarrative(narrativeCacheIdentity);
      if (!active || narrativeRequestKeyRef.current !== requestKey) return;
      const cached = getWeeklyNarrative(narrativeCacheIdentity);
      if (cached) {
        setNarrativeDisplay(createWeeklyAiDisplayState(narrativeCacheIdentity, cached));
        return;
      }
      const result = await runWeeklyAiRequestOnce(
        narrativeCacheIdentity,
        () => buildWeeklyNarrative(weekTable, fallback, locale),
      );
      if (!active || narrativeRequestKeyRef.current !== requestKey) return;
      if (result.fromAI) {
        setNarrativeDisplay(createWeeklyAiDisplayState(narrativeCacheIdentity, result));
        void saveWeeklyNarrative(narrativeCacheIdentity, result);
      }
    })();

    return () => {
      active = false;
    };
  }, [locale, narrativeCacheIdentity, pregnancy, ruleNarrative, weekTable]);

  // 발견 문장 다듬기. 상관은 이미 기기에서 찾았고 여기서는 표현만 바꾼다.
  // 실패하면 빈 객체라 우리 문장이 그대로 나간다.
  const [insightPhraseDisplay, setInsightPhraseDisplay] =
    useState<WeeklyAiDisplayState<InsightPhrases> | null>(null);
  const insightDateKeys = useMemo(
    () => insightSourceDateKeys(reportLogs, todayKey),
    [reportLogs, todayKey],
  );
  const insightPromptInput = useMemo(
    () => buildInsightPhraseInput(insights, locale, t),
    [insights, locale, t],
  );
  const insightCacheIdentity = useMemo(() => pregnancy ? null : createWeeklyAiCacheIdentity({
    operation: "insight_phrase",
    scope: localDataScope,
    fromDateKey: insightDateKeys[0] ?? "",
    toDateKey: insightDateKeys[insightDateKeys.length - 1] ?? "",
    locale,
    inputFacts: insightPromptInput,
    inputSchemaVersion: INSIGHT_PHRASE_INPUT_SCHEMA_VERSION,
    promptVersion: INSIGHT_PHRASE_VERSION,
  }), [
    insightDateKeys,
    insightPromptInput,
    localDataScope?.babyId,
    localDataScope?.userId,
    locale,
    pregnancy,
  ]);
  const insightRequestKey = insightCacheIdentity
    ? weeklyAiCacheIdentityKey(insightCacheIdentity)
    : null;
  const insightRequestKeyRef = useRef(insightRequestKey);
  insightRequestKeyRef.current = insightRequestKey;
  const displayedInsightPhrases = getCurrentWeeklyAiDisplayValue(
    insightCacheIdentity,
    insightPhraseDisplay,
  ) ?? EMPTY_INSIGHT_PHRASES;
  useEffect(() => {
    let active = true;
    if (!insights.length || !insightCacheIdentity) {
      setInsightPhraseDisplay((current) => current === null ? current : null);
      return;
    }
    const requestKey = weeklyAiCacheIdentityKey(insightCacheIdentity);

    void (async () => {
      await hydrateInsightPhrases(insightCacheIdentity);
      if (!active || insightRequestKeyRef.current !== requestKey) return;
      const cached = getInsightPhrases(insightCacheIdentity);
      if (cached) {
        setInsightPhraseDisplay(createWeeklyAiDisplayState(insightCacheIdentity, cached));
        return;
      }
      const phrases = await runWeeklyAiRequestOnce(
        insightCacheIdentity,
        () => buildInsightPhrases(insights, insightPromptInput, locale),
      );
      if (!active || insightRequestKeyRef.current !== requestKey) return;
      if (Object.keys(phrases).length) {
        setInsightPhraseDisplay(createWeeklyAiDisplayState(insightCacheIdentity, phrases));
        void saveInsightPhrases(insightCacheIdentity, phrases);
      } else {
        setInsightPhraseDisplay(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [insightCacheIdentity, insightPromptInput, insights, locale]);

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

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} {...scrollProps}>
        <AppHeader
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onOpenNotifications={onOpenNotifications}
          onOpenShared={onOpenShared}
        />
        <View
          style={styles.pad}
          accessibilityValue={{ text: reportDataState === "loading"
            ? t("report.critical.237")
            : pregnancy
              ? t("pregnancy.overview.progressKicker")
              : narrative.headline || t("report.critical.225") }}
        >
          {pregnancy ? (
            <PregnancyOverview
              child={careSetup.child}
              logs={reportLogs}
              diaryEntries={diaryEntries}
              customCategories={customCategories}
              dataState={reportDataState}
              onOpenRecord={(params) => onOpenRecord?.(params)}
              onOpenDiary={(params) => onOpenDiary?.(params)}
            />
          ) : (
            <>
              {reportDataState === "loading" ? <LoadingState label={t("report.critical.227")} /> : null}
              {reportDataState === "partial" ? <EmptyState title={t("report.critical.225")} body={t("report.critical.206")} /> : null}
              {reportDataState === "error" ? <ErrorState title={t("report.critical.016")} body={t("home.storage.offlineError")} /> : null}
              {reportDataState === "ready" && reportLogs.length === 0 ? <EmptyState title={t("report.critical.225")} body={t("report.critical.206")} /> : null}
              {reportDataState === "ready" ? (
                <>
                  <OverviewTodaySummary todayLogs={todayLogs} yesterdayLogs={yesterdayLogs} />
                  <OverviewRhythmCard
                    todayLogs={todayLogs}
                    yesterdayLogs={yesterdayLogs}
                    customCategories={customCategories}
                    defaultFeedingMethod={careSetup.preferences.defaultFeedingMethod}
                  />
                </>
              ) : null}
              {reportDataState === "ready" ? (
                <OverviewWeeklyCard
                  kicker={t("report.critical.091")}
                  badge={formatWeekOfMonth(weekTable.meta.dateKeys[weekTable.meta.dateKeys.length - 1], t)}
                  headline={weeklyHeadline}
                  body={weeklyBody}
                  finding={insights.length ? t("report.critical.123", { count: insights.length }) : undefined}
                  moreLabel={t("report.critical.093")}
                  accessibilityLabel={t("report.critical.110", { headline: weeklyHeadline })}
                  onPress={() => setReportOpen(true)}
                />
              ) : null}
              {!storageReady ? <LoadingState label={t("report.critical.227")} /> : null}
              {storageReady && !growthRecordsHydrated ? (
                <ErrorState title={t("report.critical.016")} body={t("home.storage.offlineError")} />
              ) : null}
              {growthRecordsHydrated ? (
                <OverviewGrowthSection
                  records={sortedGrowthRecords}
                  points={growthPoints}
                  sex={growthSex}
                  babyName={babyName}
                  locale={locale}
                  diaryEntries={diaryEntries}
                  onAddMeasurement={() => { setEditingGrowthRecord(null); setGrowthModalOpen(true); }}
                  onOpenGrowthBook={() => onOpenDiary?.({ openGrowthBookVault: true })}
                  onAskAi={onOpenConsult}
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <OverviewReportScreen
        visible={reportOpen}
        table={weekTable}
        logs={reportLogs}
        diaryEntries={diaryEntries}
        insights={insights}
        insightPhrases={displayedInsightPhrases}
        headline={narrative.headline}
        body={narrative.body}
        dataState={reportHistoryState}
        babyName={babyName}
        birthDate={careSetup.child.birthDate}
        onClose={() => setReportOpen(false)}
        onAskAi={(question) => {
          setReportOpen(false);
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: 18, paddingBottom: 164 },
});
