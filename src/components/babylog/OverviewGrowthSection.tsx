import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../LanguageContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { DIARY_GROWTH_MOMENTS } from "../../constants/diaryCompose";
import { colors } from "../../theme";
import type { DiaryEntry } from "../../types/babyLog";
import type { GrowthRecord } from "../../types/growthRecord";
import { diaryHasMilestone, diaryMilestoneLabel } from "../../utils/diaryModel";
import { formatMonthDay } from "../../utils/insightDisplay";
import { formatLocalizedDate } from "../../utils/localeFormat";
import { parseDateKey } from "../../utils/dateKey";
import { GrowthChart, type GrowthPoint } from "./GrowthChart";
import { OverviewMotionFrames, OverviewSpriteSheet } from "./OverviewSprite";
import { OverviewMilestoneSheet } from "./OverviewMilestoneSheet";
import { overviewAssets } from "./overviewAssets";
import type { WhoMeasure, WhoSex } from "../../utils/growthPercentile";
import {
  latestPair,
  monthKey,
  monthSpan,
  previousMonthKey,
} from "../../utils/overviewRhythm";
import type { ReportCriticalKey } from "../../i18nReportCriticalMessages";
import {
  growthDirection,
  resolveGrowthSummaryState,
  resolveGrowthTrend,
  type GrowthTrend,
} from "../../utils/overviewGrowth";
import { formatLocalizedNumber } from "../../utils/localeFormat";
import type { HeightUnit, WeightUnit } from "../../types/appSettings";

type MeasureId = "weight" | "height" | "head";

const MEASURES: {
  id: MeasureId;
  measure: WhoMeasure;
  labelKey: ReportCriticalKey;
  unit: string;
  color: string;
  soft: string;
  captionKey: ReportCriticalKey;
}[] = [
  { id: "weight", measure: "weight", labelKey: "report.critical.016", unit: "kg", color: "#d97872", soft: "rgba(232,145,138,0.15)", captionKey: "report.critical.142" },
  { id: "height", measure: "height", labelKey: "report.critical.021", unit: "cm", color: "#8d74c8", soft: "rgba(155,130,215,0.15)", captionKey: "report.critical.143" },
  { id: "head", measure: "head", labelKey: "report.critical.022", unit: "cm", color: "#4eaa94", soft: "rgba(105,195,174,0.16)", captionKey: "report.critical.144" },
];

function pickValue(record: GrowthRecord, id: MeasureId) {
  if (id === "weight") return record.weightKg;
  if (id === "height") return record.heightCm;
  return record.headCircumferenceCm;
}

function formatValue(id: MeasureId, value: number, units: { weight: WeightUnit; height: HeightUnit }, locale: Props["locale"]) {
  if (id === "weight") {
    const shown = units.weight === "lb" ? value * 2.20462 : value;
    return `${formatLocalizedNumber(shown, locale, { maximumFractionDigits: 1 })}${units.weight}`;
  }
  const shown = units.height === "inch" ? value / 2.54 : value;
  return `${formatLocalizedNumber(shown, locale, { maximumFractionDigits: 1 })}${units.height === "inch" ? "in" : "cm"}`;
}

function formatDelta(id: MeasureId, delta: number, units: { weight: WeightUnit; height: HeightUnit }, locale: Props["locale"]) {
  if (id === "weight") {
    if (units.weight === "lb") {
      const pounds = delta * 2.20462;
      return `${pounds > 0 ? "+" : ""}${formatLocalizedNumber(pounds, locale, { maximumFractionDigits: 1 })}lb`;
    }
    const grams = Math.round(delta * 1000);
    return `${grams > 0 ? "+" : ""}${formatLocalizedNumber(grams, locale)}g`;
  }
  const shown = units.height === "inch" ? delta / 2.54 : delta;
  const rounded = Math.round(shown * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${formatLocalizedNumber(rounded, locale, { maximumFractionDigits: 1 })}${units.height === "inch" ? "in" : "cm"}`;
}

function formatCaptionDelta(id: MeasureId, delta: number, units: { weight: WeightUnit; height: HeightUnit }, locale: Props["locale"]) {
  if (id === "weight") {
    if (units.weight === "lb") return `${formatLocalizedNumber(Math.abs(delta * 2.20462), locale, { maximumFractionDigits: 1 })}lb`;
    return `${formatLocalizedNumber(Math.round(Math.abs(delta) * 1000), locale)}g`;
  }
  const shown = units.height === "inch" ? Math.abs(delta / 2.54) : Math.abs(delta);
  return `${formatLocalizedNumber(Math.round(shown * 10) / 10, locale, { maximumFractionDigits: 1 })}${units.height === "inch" ? "in" : "cm"}`;
}

type Props = {
  records: GrowthRecord[];
  points: Record<WhoMeasure, GrowthPoint[]>;
  sex: WhoSex | null;
  babyName: string;
  locale: "ko" | "en" | "ja" | "es" | "zh-CN";
  diaryEntries: DiaryEntry[];
  onAddMeasurement: () => void;
  onOpenGrowthBook: () => void;
  onAskAi: (question: string) => void;
};

function MeasureCard({
  spec,
  records,
  points,
  sex,
  locale,
  onAdd,
}: {
  spec: (typeof MEASURES)[number];
  records: GrowthRecord[];
  points: GrowthPoint[];
  sex: WhoSex | null;
  locale: Props["locale"];
  onAdd: () => void;
}) {
  const { t } = useLanguage();
  const { settings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const pair = latestPair(records, (record) => pickValue(record, spec.id));
  const frames = spec.id === "weight" ? overviewAssets.weightMotion : spec.id === "height" ? overviewAssets.heightMotion : overviewAssets.headMotion;
  const dateLabel = pair.current ? formatMonthDay(pair.current.record.measuredAt.slice(0, 10), t) : "";
  const delta = pair.current && pair.previous ? pair.current.value - pair.previous.value : null;
  const trend = resolveGrowthTrend(pair.current?.value, pair.previous?.value);
  const units = { weight: settings.units.weight, height: settings.units.height };
  const displayUnit = spec.id === "weight" ? units.weight : units.height === "inch" ? "in" : "cm";

  return (
    <View style={styles.measureOuter}>
      <View style={styles.measureCard} collapsable={false}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{t(spec.labelKey)}</Text>
        {dateLabel ? <Text style={styles.cardDate}>{t("report.critical.141", { date: dateLabel })}</Text> : null}
      </View>
      <View style={styles.summary}>
        <View style={styles.readout}>
          {pair.current ? (
            <>
              <View style={styles.compare}>
                {pair.previous ? <Text style={styles.from}>{formatValue(spec.id, pair.previous.value, units, locale)}</Text> : null}
                {pair.previous ? <Text style={styles.arrow}>→</Text> : null}
                <Text style={styles.to}>{formatValue(spec.id, pair.current.value, units, locale)}</Text>
              </View>
              {delta != null ? (
                <Text style={[styles.delta, { color: colors.text }]}>
                  {growthDirection(trend)}  {formatDelta(spec.id, delta, units, locale)}
                </Text>
              ) : null}
              {delta != null ? (
                <Text style={styles.caption}>
                  {t(
                    trend === "increase" ? spec.captionKey : trend === "decrease" ? "report.critical.228" : "report.critical.229",
                    { delta: formatCaptionDelta(spec.id, delta, units, locale) },
                  )}
                </Text>
              ) : pair.current ? (
                <Text style={styles.caption}>{t("report.critical.230")}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.empty}>{t("report.critical.017")}</Text>
          )}
        </View>
        <Pressable
          style={styles.scene}
          onPress={() => setPlaying((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={t("report.critical.145")}
          accessibilityState={{ selected: playing }}
        >
          <OverviewMotionFrames frames={frames} playing={playing} />
        </Pressable>
      </View>
      <View style={styles.moreRow}>
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.moreHit}
        >
          <Text style={[styles.more, { color: spec.color }]}>{t("report.critical.145")}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.detail}>
          <View style={styles.chartWrap}>
            <View style={styles.chartHead}>
              <Text style={styles.chartHeadLabel}>{t("report.critical.146")}</Text>
              {points.length ? <Text style={styles.chartHeadSmall}>{t("report.critical.147")}</Text> : null}
            </View>
            {points.length === 0 ? (
              <>
                <Text style={styles.inlineNote}>{t("report.critical.027")}</Text>
                <Text style={styles.emptyHint}>{t("report.critical.028")}</Text>
              </>
            ) : sex ? (
              <GrowthChart
                measure={spec.measure}
                label={t(spec.labelKey)}
                unit={displayUnit}
                color={spec.color}
                sex={sex}
                points={points}
                compact
              />
            ) : (
              <Text style={styles.inlineNote}>{t("report.critical.095")}</Text>
            )}
          </View>
          {pair.recent.length ? (
            <View style={[styles.inline, { backgroundColor: spec.soft }]}>
              <Text style={styles.inlineTitle}>{t("report.critical.149", { label: t(spec.labelKey) })}</Text>
              <View style={styles.inlineValues}>
                {pair.recent.map((item) => (
                  <View key={item.record.id} style={styles.inlineValue}>
                    <Text style={styles.inlineDate}>{formatMonthDay(item.record.measuredAt.slice(0, 10), t)}</Text>
                    <Text style={styles.inlineAmount}>{formatValue(spec.id, item.value, units, locale)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.inlineNote}>{t("report.critical.148")}</Text>
            </View>
          ) : null}
          <Pressable style={[styles.add, { backgroundColor: spec.soft }]} onPress={onAdd} accessibilityRole="button">
            <Text style={[styles.addText, { color: spec.color }]}>{t("report.critical.150")}</Text>
          </Pressable>
        </View>
      ) : null}
      </View>
    </View>
  );
}

export function OverviewGrowthSection({
  records,
  points,
  sex,
  babyName,
  locale,
  diaryEntries,
  onAddMeasurement,
  onOpenGrowthBook,
  onAskAi,
}: Props) {
  const { t } = useLanguage();
  const { settings } = useAppSettings();
  const [monthOpen, setMonthOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [aiPlay, setAiPlay] = useState(1);
  const [milestonePlay, setMilestonePlay] = useState(1);
  const [milestoneAllOpen, setMilestoneAllOpen] = useState(false);
  const latest = records[records.length - 1];
  const thisMonth = monthKey(new Date().toISOString());
  const lastMonth = previousMonthKey(thisMonth);
  const monthDate = parseDateKey(`${thisMonth}-01`);
  const monthLabel = formatLocalizedDate(monthDate, locale, { month: "long" });
  const heightSpan = monthSpan(records, thisMonth, (record) => record.heightCm);
  const weightSpan = monthSpan(records, thisMonth, (record) => record.weightKg);
  const headSpan = monthSpan(records, thisMonth, (record) => record.headCircumferenceCm);
  const lastHeight = monthSpan(records, lastMonth, (record) => record.heightCm);

  const milestones = useMemo(() => {
    const tagged = diaryEntries.filter(diaryHasMilestone);
    const byTag = new Map<string, DiaryEntry>();
    for (const entry of tagged) {
      const label = diaryMilestoneLabel(entry, t) ?? "";
      if (label && !byTag.has(label)) byTag.set(label, entry);
    }
    const catalog = DIARY_GROWTH_MOMENTS.map((tag) => {
      const match = tagged.find((entry) => entry.milestoneTag === tag);
      return {
        key: tag,
        name: diaryMilestoneLabel({ milestoneTag: tag, customMilestoneTag: null }, t) ?? tag,
        state: match ? "done" as const : "empty" as const,
        dateKey: match?.dateKey,
      };
    });
    const extras = [...byTag.entries()]
      .filter(([label]) => !DIARY_GROWTH_MOMENTS.some((tag) => (diaryMilestoneLabel({ milestoneTag: tag, customMilestoneTag: null }, t) ?? tag) === label))
      .map(([label, entry]) => ({ key: label, name: label, state: "done" as const, dateKey: entry.dateKey }));
    return [...catalog.filter((item) => item.state === "done"), ...extras, ...catalog.filter((item) => item.state === "empty")].slice(0, 4);
  }, [diaryEntries, t]);

  const newestMilestone = useMemo(() => {
    return diaryEntries
      .filter((entry) => diaryHasMilestone(entry) && (entry.dateKey ?? "").startsWith(thisMonth))
      .sort((a, b) => (a.dateKey ?? "").localeCompare(b.dateKey ?? "") || a.createdAt.localeCompare(b.createdAt))
      .at(-1);
  }, [diaryEntries, thisMonth]);

  const units = { weight: settings.units.weight, height: settings.units.height };
  const growthTrends: GrowthTrend[] = [heightSpan, weightSpan, headSpan].map((span) =>
    resolveGrowthTrend(span?.last.value, span?.first.value),
  );
  const allThreeIncrease = growthTrends.every((trend) => trend === "increase");
  const growthSummaryState = resolveGrowthSummaryState(growthTrends, Boolean(newestMilestone));
  const heightIsDominantIncrease = growthTrends[0] === "increase" && heightSpan && Math.abs(heightSpan.delta) >= Math.max(
    Math.abs(weightSpan?.delta ?? 0),
    Math.abs(headSpan?.delta ?? 0),
  );

  const evidenceLines = [
    heightSpan ? `${t("report.critical.021")} ${formatMonthDay(heightSpan.first.record.measuredAt.slice(0, 10), t)} ${formatValue("height", heightSpan.first.value, units, locale)} → ${formatValue("height", heightSpan.last.value, units, locale)} (${formatDelta("height", heightSpan.delta, units, locale)})` : null,
    weightSpan ? `${t("report.critical.016")} ${formatMonthDay(weightSpan.first.record.measuredAt.slice(0, 10), t)} ${formatValue("weight", weightSpan.first.value, units, locale)} → ${formatValue("weight", weightSpan.last.value, units, locale)} (${formatDelta("weight", weightSpan.delta, units, locale)})` : null,
    headSpan ? `${t("report.critical.022")} ${formatMonthDay(headSpan.first.record.measuredAt.slice(0, 10), t)} ${formatValue("head", headSpan.first.value, units, locale)} → ${formatValue("head", headSpan.last.value, units, locale)} (${formatDelta("head", headSpan.delta, units, locale)})` : null,
    newestMilestone ? `${diaryMilestoneLabel(newestMilestone, t)} · ${newestMilestone.dateKey ? formatMonthDay(newestMilestone.dateKey, t) : ""}` : null,
  ].filter(Boolean) as string[];

  return (
    <View>
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>{t("report.critical.015")}</Text>
        <Text style={styles.headingCaption}>
          {latest ? t("report.critical.140", { date: latest.measuredAt.slice(0, 10).replaceAll("-", ".") }) : t("report.critical.017")}
        </Text>
      </View>

      {MEASURES.map((spec) => (
        <MeasureCard
          key={spec.id}
          spec={spec}
          records={records}
          points={points[spec.measure]}
          sex={sex}
          locale={locale}
          onAdd={onAddMeasurement}
        />
      ))}

      <Text style={styles.source}>{t("report.critical.094")}</Text>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t("report.critical.226", { babyName })}</Text>
          <Text style={styles.sectionMeta}>{monthLabel}</Text>
        </View>
        <View style={styles.monthlyTop}>
          <OverviewSpriteSheet source={overviewAssets.monthlyDuck} width={54} height={66} columns={4} rows={2} playing />
          <View style={styles.monthNums}>
            <View style={styles.monthNum}><Text style={styles.monthNumLabel}>{t("report.critical.021")}</Text><Text style={styles.monthNumValue}>{heightSpan ? formatDelta("height", heightSpan.delta, units, locale) : "—"}</Text></View>
            <View style={styles.monthNum}><Text style={styles.monthNumLabel}>{t("report.critical.016")}</Text><Text style={styles.monthNumValue}>{weightSpan ? formatDelta("weight", weightSpan.delta, units, locale) : "—"}</Text></View>
            <View style={styles.monthNum}><Text style={styles.monthNumLabel}>{t("report.critical.022")}</Text><Text style={styles.monthNumValue}>{headSpan ? formatDelta("head", headSpan.delta, units, locale) : "—"}</Text></View>
          </View>
        </View>
        <View style={styles.monthFoot}>
          <Text style={styles.monthFootText}>{latest ? t("report.critical.140", { date: formatMonthDay(latest.measuredAt.slice(0, 10), t) }) : t("report.critical.017")}</Text>
          <Pressable style={styles.actionHit} onPress={() => setMonthOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: monthOpen }}>
            <Text style={styles.textAction}>{t("report.critical.152")}</Text>
          </Pressable>
        </View>
        {monthOpen ? (
          <Text style={styles.monthCompare}>
            {lastHeight && heightSpan
              ? `${t("report.critical.021")} ${formatDelta("height", lastHeight.delta, units, locale)} → ${formatDelta("height", heightSpan.delta, units, locale)}`
              : t("report.critical.101")}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t("report.critical.153")}</Text>
          <Pressable style={styles.actionHit} onPress={() => setMilestoneAllOpen(true)} accessibilityRole="button">
            <Text style={styles.textAction}>{t("report.critical.154")}</Text>
          </Pressable>
        </View>
        <View style={styles.milestoneIntro}>
          <OverviewSpriteSheet
            key={milestonePlay}
            source={overviewAssets.milestoneDuck}
            width={54}
            height={66}
            columns={4}
            rows={2}
            durationMs={2600}
            playing={milestonePlay > 0}
            onPress={() => setMilestonePlay((token) => token + 1)}
          />
          <Text style={styles.milestoneIntroCopy}>{t("report.critical.164")}</Text>
        </View>
        <View style={styles.rail}>
          {milestones.map((item) => (
            <View key={item.key} style={styles.milestoneItem}>
              <View style={[styles.symbol, item.state === "done" ? styles.symbolDone : styles.symbolEmpty]}>
                <Text style={[styles.symbolText, item.state === "done" ? styles.symbolDoneText : styles.symbolEmptyText]}>{item.state === "done" ? "✓" : "○"}</Text>
              </View>
              <Text style={styles.milestoneName}>{item.name}</Text>
              <Text style={styles.milestoneState}>{item.state === "done" && item.dateKey ? item.dateKey.slice(5).replace("-", "/") : t("report.critical.166")}</Text>
            </View>
          ))}
        </View>
        {newestMilestone ? (
          <View style={styles.newMilestone}>
            <Text style={styles.newKicker}>{t("report.critical.174")}</Text>
            <Text style={styles.newTitle}>“{diaryMilestoneLabel(newestMilestone, t)}”</Text>
            <Text style={styles.newMeta}>{newestMilestone.dateKey ? formatMonthDay(newestMilestone.dateKey, t) : ""}</Text>
            <Pressable style={styles.actionHit} onPress={onOpenGrowthBook} accessibilityRole="button">
              <Text style={styles.textAction}>{t("report.critical.163")}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.source}>{t("report.critical.173")}</Text>
      </View>

      <View style={[styles.card, styles.aiCard]}>
        <View style={styles.aiTop}>
          <OverviewSpriteSheet
            key={aiPlay}
            source={overviewAssets.growthAiDuck}
            width={54}
            height={60}
            columns={3}
            rows={2}
            durationMs={2400}
            playing={aiPlay > 0}
            onPress={() => setAiPlay((token) => token + 1)}
          />
          <Text style={styles.aiTitle}>{t("report.critical.155", { babyName })}</Text>
        </View>
        <Text style={styles.aiCopy}>
          <Text style={styles.aiStrong}>
            {growthSummaryState === "insufficient"
              ? t("report.critical.230")
              : heightIsDominantIncrease
                ? t("report.critical.170")
                : t("report.critical.231")}
          </Text>
          {"\n"}
          {growthSummaryState === "insufficient"
            ? t("report.critical.227")
            : growthSummaryState === "decrease"
              ? t("report.critical.234")
              : growthSummaryState === "unchanged"
                ? t("report.critical.235")
                : growthSummaryState === "mixed"
                  ? t("report.critical.236")
                  : newestMilestone && allThreeIncrease
                    ? t("report.critical.171")
                    : t("report.critical.233")}
        </Text>
        <View style={styles.aiActions}>
          <Pressable style={styles.actionHit} onPress={() => setEvidenceOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: evidenceOpen }}>
            <Text style={styles.textAction}>{t("report.critical.156")}</Text>
          </Pressable>
          <Pressable style={styles.actionHit} onPress={() => onAskAi(t("report.critical.124", { babyName }))} accessibilityRole="button">
            <Text style={styles.textAction}>{t("report.critical.157")}</Text>
          </Pressable>
        </View>
        {evidenceOpen ? (
          <View style={styles.evidence}>
            <Text style={styles.evidenceTitle}>{t("report.critical.158", { babyName })}</Text>
            {evidenceLines.map((line) => <Text key={line} style={styles.evidenceLine}>{line}</Text>)}
          </View>
        ) : null}
      </View>

      <OverviewMilestoneSheet
        visible={milestoneAllOpen}
        babyName={babyName}
        onClose={() => setMilestoneAllOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, marginBottom: 10, marginHorizontal: 1 },
  headingTitle: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  headingCaption: { color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  measureOuter: {
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    shadowColor: "#5D4331",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  measureCard: {
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  card: {
    overflow: "hidden",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
    shadowColor: "#5D4331",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  cardTitle: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  cardDate: { color: colors.faint, fontSize: 10, fontWeight: "700" },
  summary: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, overflow: "hidden" },
  readout: { flex: 1, minWidth: 0 },
  compare: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 5 },
  from: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  arrow: { color: colors.faint, fontSize: 13, fontWeight: "700" },
  to: { color: colors.text, fontSize: 24, lineHeight: 26, fontWeight: "900", letterSpacing: -0.6 },
  delta: { marginTop: 6, fontSize: 12, fontWeight: "800" },
  caption: { marginTop: 6, color: colors.text, fontSize: 11.5, fontWeight: "800" },
  empty: { color: colors.faint, fontSize: 13, fontWeight: "700" },
  scene: { width: 108, height: 96, flexShrink: 0, borderRadius: 18, overflow: "hidden" },
  moreRow: { alignItems: "flex-end", marginTop: 1, zIndex: 1 },
  moreHit: { minHeight: 48, justifyContent: "center" },
  more: { paddingLeft: 12, paddingRight: 2, fontSize: 12, fontWeight: "800" },
  detail: { marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  chartWrap: { paddingHorizontal: 10, paddingTop: 11, paddingBottom: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.cardHi },
  chartHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 5 },
  chartHeadLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  chartHeadSmall: { color: colors.faint, fontSize: 9.5 },
  inline: { marginTop: 9, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 13 },
  inlineTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  inlineValues: { flexDirection: "row", gap: 6, marginTop: 9 },
  inlineValue: { flex: 1, minWidth: 0, paddingHorizontal: 6, paddingVertical: 8, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.76)", alignItems: "center" },
  inlineDate: { color: colors.faint, fontSize: 9.5, fontWeight: "700" },
  inlineAmount: { marginTop: 2, color: colors.text, fontSize: 11.5, fontWeight: "900" },
  inlineNote: { marginTop: 4, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  emptyHint: { marginTop: 6, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  add: { marginTop: 10, minHeight: 48, borderRadius: 11, alignItems: "flex-start", justifyContent: "center", paddingHorizontal: 10 },
  addText: { fontSize: 11, fontWeight: "800" },
  source: { marginHorizontal: 3, marginBottom: 22, color: colors.faint, fontSize: 10, lineHeight: 16 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
  sectionMeta: { color: colors.faint, fontSize: 10.5, fontWeight: "800" },
  monthlyTop: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  monthNums: { flex: 1, flexDirection: "row", gap: 5 },
  monthNum: { flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.cardHi, alignItems: "center" },
  monthNumLabel: { color: colors.faint, fontSize: 8.5, fontWeight: "700" },
  monthNumValue: { marginTop: 4, color: colors.text, fontSize: 11, fontWeight: "900" },
  monthFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border },
  monthFootText: { color: colors.muted, fontSize: 10.5, flex: 1 },
  textAction: { color: colors.primaryCoral, fontSize: 10.5, fontWeight: "800", minHeight: 48, textAlignVertical: "center" },
  actionHit: { minHeight: 48, justifyContent: "center" },
  monthCompare: { marginTop: 10, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cardHi, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  milestoneIntro: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 15 },
  milestoneIntroCopy: { flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 18, fontWeight: "700" },
  rail: { flexDirection: "row", gap: 3 },
  milestoneItem: { flex: 1, minWidth: 0, minHeight: 100, paddingHorizontal: 2, paddingVertical: 5, alignItems: "center" },
  symbol: { width: 28, height: 28, marginBottom: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  symbolDone: { backgroundColor: "rgba(105,195,174,0.15)", borderColor: "rgba(105,195,174,0.35)" },
  symbolEmpty: {},
  symbolText: { fontSize: 13, fontWeight: "900" },
  symbolDoneText: { color: "#4e9d89" },
  symbolEmptyText: { color: colors.faint },
  milestoneName: { color: colors.text, fontSize: 10, fontWeight: "800", textAlign: "center" },
  milestoneState: { marginTop: 3, color: colors.faint, fontSize: 8.5, textAlign: "center" },
  newMilestone: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, backgroundColor: "rgba(232,145,138,0.11)" },
  newKicker: { color: "#9b5a32", fontSize: 10, fontWeight: "800" },
  newTitle: { marginTop: 5, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  newMeta: { marginTop: 2, color: colors.muted, fontSize: 10 },
  aiCard: { backgroundColor: colors.card },
  aiTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  aiTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text },
  aiCopy: { marginTop: 9, color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  aiStrong: { color: colors.text, fontWeight: "800" },
  aiActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 9 },
  evidence: { marginTop: 9, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cardHi },
  evidenceTitle: { color: colors.text, fontSize: 10, fontWeight: "800", marginBottom: 4 },
  evidenceLine: { color: colors.muted, fontSize: 10, lineHeight: 16 },
});
