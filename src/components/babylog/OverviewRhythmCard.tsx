import { useEffect, useMemo, useRef, useState } from "react";
import {
  DynamicColorIOS,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ColorValue,
  type LayoutChangeEvent,
} from "react-native";
import { useLanguage } from "../../LanguageContext";
import { colors } from "../../theme";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { DefaultFeedingMethod } from "../../types/careSetup";
import { formatDisplayTime } from "../../utils/logSummary";
import { customCategoryDisplayLabel, recordCategoryLabel } from "../../utils/recordDisplay";
import { buildOverviewCategoryCardsAtCutoff, buildOverviewInspectionRows, buildOverviewTimelineRows } from "../../utils/overviewCategoryCards";
import {
  OVERVIEW_RHYTHM_COLORS,
  buildDayRhythm,
  coveringKind,
  formatOverviewAmount,
  lastFeedTime,
  minutesNow,
  percentAt,
  sleepElapsedAt,
} from "../../utils/overviewRhythm";
import { buildOverviewRhythmSegments, type RhythmTrackSegment } from "../../utils/overviewRhythmSegments";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { OverviewCategoryCarousel } from "./OverviewCategoryCarousel";
import { overviewAssets } from "./overviewAssets";

function rhythmSurface(light: string, dark: string): ColorValue {
  return Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : light;
}

type Props = {
  todayLogs: BabyLogEntry[];
  yesterdayLogs: BabyLogEntry[];
  customCategories?: CustomCategory[];
  defaultFeedingMethod?: DefaultFeedingMethod;
};

function hourLabel(hour: number, locale: string) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatSegmentDuration(minutes: number, locale: string): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) {
    if (locale === "ko") return `${rounded}분`;
    if (locale === "ja") return `${rounded}分`;
    if (locale === "zh-CN") return `${rounded}分钟`;
    return `${rounded}m`;
  }
  const hours = Number((rounded / 60).toFixed(1));
  if (locale === "ko") return `${hours}시간`;
  if (locale === "ja") return `${hours}時間`;
  if (locale === "zh-CN") return `${hours}小时`;
  return `${hours}h`;
}

function segmentLabel(segment: RhythmTrackSegment, locale: string): string | null {
  if (segment.kind === "sleep" && segment.duration >= 180) {
    return formatSegmentDuration(segment.duration, locale);
  }
  if (segment.kind === "event" && segment.eventKinds.length === 1 && segment.eventKinds[0] === "activity" && segment.duration >= 180) {
    return formatSegmentDuration(segment.duration, locale);
  }
  return null;
}

function TimeGuides({ muted }: { muted: boolean }) {
  return (
    <View pointerEvents="none" style={styles.guideLayer}>
      {[0, 6, 12, 18].map((hour) => (
        <View key={hour} style={[styles.timeGuide, muted && styles.timeGuideMuted, { left: `${(hour / 24) * 100}%` }]} />
      ))}
    </View>
  );
}

function TrackSegments({ segments, muted, locale }: { segments: RhythmTrackSegment[]; muted: boolean; locale: string }) {
  return (
    <>
      {segments.map((segment, index) => {
        const position = { left: `${percentAt(segment.start)}%`, width: `${percentAt(segment.duration)}%` } as const;
        const label = segmentLabel(segment, locale);
        if (segment.kind === "sleep") return (
          <View
            key={`sleep-${segment.start}-${index}`}
            pointerEvents="none"
            style={[styles.trackSleep, muted && styles.trackSleepMuted, position]}
          >
            {label ? <Text style={styles.segmentLabel} numberOfLines={1}>{label}</Text> : null}
          </View>
        );
        return (
          <View
            key={`event-${segment.start}-${index}`}
            pointerEvents="none"
            style={[
              styles.trackEvent,
              segment.eventKinds.includes("activity") && segment.duration > 12
                ? styles.trackEventDuration
                : styles.trackEventPoint,
              { borderColor: muted ? "#F1F2F8" : "#F4F5FA" },
              position,
            ]}
          >
            {segment.eventKinds.map((kind) => (
              <View
                key={kind}
                style={[
                  styles.trackEventStripe,
                  segment.eventKinds.includes("activity") && segment.duration > 12
                    ? styles.trackEventStripeDuration
                    : styles.trackEventStripePoint,
                  { backgroundColor: muted
                    ? kind === "feed" ? "#EBC789" : kind === "diaper" ? "#8AC9B9" : "#A5C3ED"
                    : OVERVIEW_RHYTHM_COLORS[kind],
                  },
                ]}
              />
            ))}
            {label ? <Text style={styles.segmentLabel} numberOfLines={1}>{label}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

export function OverviewRhythmCard({
  todayLogs,
  yesterdayLogs,
  customCategories = [],
  defaultFeedingMethod,
}: Props) {
  const { locale, t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.4;
  const [compareOn, setCompareOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(minutesNow);
  const [inspection, setInspection] = useState<{ day: "today" | "yesterday"; minutes: number } | null>(null);
  const [trackWidth, setTrackWidth] = useState(320);
  const liveNowRef = useRef(minutesNow());
  const trackWidthRef = useRef(0);
  liveNowRef.current = now;

  useEffect(() => {
    const timer = setInterval(() => {
      const next = minutesNow();
      setNow(next);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const todayPan = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: (event) => {
        const width = trackWidthRef.current;
        const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
        const next = width ? Math.max(0, Math.min(liveNowRef.current, Math.round((x / width) * 1440))) : liveNowRef.current;
        setInspection({ day: "today", minutes: next });
      },
      onPanResponderMove: (event) => {
        const width = trackWidthRef.current;
        const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
        const next = width ? Math.max(0, Math.min(liveNowRef.current, Math.round((x / width) * 1440))) : liveNowRef.current;
        setInspection({ day: "today", minutes: next });
      },
    }), []);
  const yesterdayPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (event) => {
      const width = trackWidthRef.current;
      const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
      setInspection({ day: "yesterday", minutes: width ? Math.round((x / width) * 1440) : 0 });
    },
    onPanResponderMove: (event) => {
      const width = trackWidthRef.current;
      const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
      setInspection({ day: "yesterday", minutes: width ? Math.round((x / width) * 1440) : 0 });
    },
  }), []);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    if (width > 0 && Math.abs(trackWidth - width) > 1) setTrackWidth(width);
  };

  const inspectedMinutes = inspection?.minutes ?? now;
  const todayRhythm = useMemo(() => buildDayRhythm(todayLogs, now), [now, todayLogs]);
  const yesterdayRhythm = useMemo(() => buildDayRhythm(yesterdayLogs, 1440), [yesterdayLogs]);
  const todaySegments = useMemo(
    () => buildOverviewRhythmSegments(todayRhythm, now, trackWidth),
    [now, todayRhythm, trackWidth],
  );
  const yesterdaySegments = useMemo(
    () => buildOverviewRhythmSegments(yesterdayRhythm, 1440, trackWidth),
    [trackWidth, yesterdayRhythm],
  );
  const cards = useMemo(
    () => buildOverviewCategoryCardsAtCutoff(todayLogs, yesterdayLogs, now, { customCategories, defaultFeedingMethod }),
    [customCategories, defaultFeedingMethod, now, todayLogs, yesterdayLogs],
  );
  const timelineRows = useMemo(
    () => buildOverviewTimelineRows(todayLogs, { customCategories, defaultFeedingMethod }),
    [customCategories, defaultFeedingMethod, todayLogs],
  );
  const legendRows = useMemo(() => {
    const extras = timelineRows.filter((row) => row.id !== "feed" && row.id !== "sleep" && row.id !== "diaper");
    return [
      timelineRows.find((row) => row.id === "sleep"),
      timelineRows.find((row) => row.id === "feed"),
      timelineRows.find((row) => row.id === "diaper"),
      ...extras,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [timelineRows]);
  const inspectionRows = useMemo(
    () => inspection
      ? buildOverviewInspectionRows(inspection.day === "today" ? todayLogs : yesterdayLogs, inspection.minutes, { customCategories, defaultFeedingMethod })
      : [],
    [customCategories, defaultFeedingMethod, inspection, todayLogs, yesterdayLogs],
  );
  const poseMinutes = inspection?.day === "today" ? inspection.minutes : now;
  const pose = coveringKind(todayLogs, poseMinutes);
  const nap = sleepElapsedAt(todayLogs, now);
  const feedAt = lastFeedTime(todayLogs);
  const duckSource = pose === "feeding"
    ? overviewAssets.rhythmFeed
    : pose === "diapered"
      ? overviewAssets.rhythmDiaper
      : pose === "resting"
        ? overviewAssets.rhythmRest
        : pose === "sleeping"
          ? overviewAssets.rhythmRest
          : overviewAssets.rhythmIdle;
  const nowPercent = percentAt(now);
  const inspectionPercent = inspection ? percentAt(inspection.minutes) : 0;
  const inspectionTime = inspection
    ? formatDisplayTime(`${String(Math.floor(inspection.minutes / 60)).padStart(2, "0")}:${String(inspection.minutes % 60).padStart(2, "0")}`)
    : "";
  const status = nap
    ? t("report.critical.134", { minutes: nap.elapsed })
    : feedAt
      ? `${t("report.critical.132")} · ${t("report.critical.133", { time: formatDisplayTime(feedAt) })}`
      : t("report.critical.132");

  const labelForRow = (id: (typeof timelineRows)[number]["id"]) => {
    if (id === "feed") return t("report.critical.007");
    if (id === "sleep") return t("report.critical.008");
    if (id === "diaper") return t("report.critical.009");
    if (isCustomCategoryKey(String(id))) {
      const custom = customCategories.find((item) => `custom:${item.id}` === id);
      return custom ? customCategoryDisplayLabel(t, custom) : t("chrome.critical.007");
    }
    return recordCategoryLabel(t, id as BabyLogCategoryId);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.head, largeText && styles.headLargeText]}>
        <Text style={styles.title}>{t("report.critical.030")}</Text>
        <View style={styles.modes}>
          <Pressable
            style={[styles.mode, !compareOn && styles.modeSelected]}
            onPress={() => setCompareOn(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: !compareOn }}
          >
            <Text style={[styles.modeText, !compareOn && styles.modeSelectedText]}>{t("report.critical.069")}</Text>
          </Pressable>
          <Pressable
            style={[styles.mode, compareOn && styles.modeSelected]}
            onPress={() => setCompareOn(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: compareOn }}
          >
            {compareOn ? <View style={styles.modeIco}><View style={styles.modeBarA} /><View style={styles.modeBarB} /><View style={styles.modeBarC} /></View> : null}
            <Text style={[styles.modeText, compareOn && styles.modeSelectedText]}>
              {compareOn ? t("report.critical.127") : t("report.critical.126")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sky} accessibilityLabel={t("report.critical.096")}>
        <View style={[styles.plot, compareOn && styles.plotCompare]}>
          <View style={styles.axis}>
            {(largeText ? [0, 12, 24] : [0, 6, 12, 18, 24]).map((hour) => (
              <Text
                key={hour}
                style={[
                  styles.axisLabel,
                  hour === 0 && styles.axisFirst,
                  hour === 24 && styles.axisLast,
                  hour === 24 ? { right: 0 } : { left: `${(hour / 24) * 100}%` },
                ]}
              >
                {hourLabel(hour, locale)}
              </Text>
            ))}
          </View>

          <View style={styles.tracks}>
            {compareOn ? (
              <View style={styles.yesterdayRow}>
                <View style={styles.trackLabelSlot}>
                  <Text style={styles.trackLabel}>{t("report.critical.139")}</Text>
                </View>
                <View
                  style={styles.yesterdayRail}
                  onLayout={onTrackLayout}
                  {...yesterdayPan.panHandlers}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={t("report.critical.262", { day: t("report.critical.139"), time: inspection?.day === "yesterday" ? inspectionTime : "" })}
                  accessibilityValue={{ text: inspection?.day === "yesterday" ? inspectionTime : t("report.critical.159") }}
                  accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                  onAccessibilityAction={(event) => {
                    const base = inspection?.day === "yesterday" ? inspection.minutes : now;
                    const delta = event.nativeEvent.actionName === "increment" ? 15 : -15;
                    setInspection({ day: "yesterday", minutes: Math.max(0, Math.min(1440, base + delta)) });
                  }}
                >
                  <TimeGuides muted />
                  <TrackSegments segments={yesterdaySegments} muted locale={locale} />
                  {inspection?.day === "yesterday" ? <View pointerEvents="none" style={[styles.inspectLine, { left: `${inspectionPercent}%` }]} /> : null}
                </View>
              </View>
            ) : null}

            <View style={styles.todayRow}>
              {compareOn ? (
                <View style={styles.trackLabelSlot}>
                  <View style={styles.todayLabelWrap}>
                    <Text style={styles.todayLabelText}>{t("report.critical.069")}</Text>
                  </View>
                </View>
              ) : null}
              <View
                style={styles.todayRail}
                onLayout={onTrackLayout}
                {...todayPan.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("report.critical.262", { day: t("report.critical.069"), time: inspection?.day === "today" ? inspectionTime : "" })}
                accessibilityValue={{ text: inspection?.day === "today" ? inspectionTime : t("report.critical.159") }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(event) => {
                  const base = inspection?.day === "today" ? inspection.minutes : now;
                  const delta = event.nativeEvent.actionName === "increment" ? 15 : -15;
                  setInspection({ day: "today", minutes: Math.max(0, Math.min(now, base + delta)) });
                }}
              >
                <TimeGuides muted={false} />
                <TrackSegments segments={todaySegments} muted={false} locale={locale} />
                <View pointerEvents="none" style={[styles.todayNowDot, { left: `${nowPercent}%` }]} />
                {inspection?.day === "today" ? <View pointerEvents="none" style={[styles.inspectLine, { left: `${inspectionPercent}%` }]} /> : null}
              </View>
            </View>

            <View pointerEvents="none" style={[styles.nowLine, { left: `${nowPercent}%` }]} />
            <View pointerEvents="none" style={[styles.nowScrubber, { left: `${nowPercent}%` }]}>
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeText} numberOfLines={1}>
                  {t("report.critical.159")}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.dock}>
            {inspection ? (
              <View style={styles.tooltipSlot} pointerEvents="none">
                <View style={styles.tooltip}>
                  <Text style={styles.tipKicker}>
                    {t("report.critical.262", {
                      day: inspection.day === "today" ? t("report.critical.069") : t("report.critical.139"),
                      time: inspectionTime,
                    })}
                  </Text>
                  {inspectionRows.length ? inspectionRows.map((row) => {
                    const cumulative = formatOverviewAmount(row.cumulative, row.unit, t);
                    const value = row.eventValue == null ? null : formatOverviewAmount(row.eventValue, row.unit, t);
                    return (
                      <View key={String(row.id)} style={styles.tipRow}>
                        <Text style={styles.tipLabel} numberOfLines={1}>{labelForRow(row.id)}</Text>
                        <Text style={[styles.tipValue, row.id === "sleep" ? styles.tipSleep : styles.tipFeed]}>
                          {value
                            ? t("report.critical.263", { value, total: cumulative })
                            : t("report.critical.264", { total: cumulative })}
                        </Text>
                      </View>
                    );
                  }) : <Text style={styles.tipEmpty}>{t("report.critical.225")}</Text>}
                </View>
              </View>
            ) : null}
            <Image source={duckSource} style={styles.duck} resizeMode="contain" />
          </View>
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>

      <OverviewCategoryCarousel
        cards={cards}
        customCategories={customCategories}
      />

      {expanded ? (
        <View style={styles.timelineRows}>
          {timelineRows.map((row) => {
            const label = labelForRow(row.id);
            return (
              <View key={String(row.id)} style={styles.timelineRow}>
                <View
                  style={styles.timelineIcon}
                  accessibilityRole="image"
                  accessibilityLabel={label}
                >
                  <LogCategoryIcon
                    categoryKey={row.recordCategory}
                    customCategories={customCategories}
                    size={18}
                    color={row.iconColor}
                  />
                </View>
                <View style={styles.eventTrack}>
                  {row.asBar
                    ? row.events.map((event, index) => (
                        <View
                          key={`${String(row.id)}-${event.start}-${index}`}
                          style={[
                            styles.timelineSleep,
                            { left: `${percentAt(event.start)}%`, width: `${Math.max(percentAt(event.duration ?? 5), 1.2)}%` },
                          ]}
                        />
                      ))
                    : row.events.map((event, index) => (
                        <View key={`${String(row.id)}-${event.start}-${index}`} style={[styles.timelineEvent, { left: `${percentAt(event.start)}%` }]}>
                          <View style={[styles.timelineDot, { backgroundColor: row.color }]} />
                        </View>
                      ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.foot}>
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
          <Text style={styles.toggle}>{expanded ? t("report.critical.129") : t("report.critical.128")}</Text>
        </Pressable>
        <View style={styles.legend}>
          {legendRows.map((row) => (
            <View key={`legend-${String(row.id)}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: row.color }]} />
              <Text style={styles.legendText}>{labelForRow(row.id)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginBottom: 12,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 13 },
  headLargeText: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  modes: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 6 },
  mode: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: rhythmSurface(OVERVIEW_RHYTHM_COLORS.mode, "#332C27"),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  modeSelected: {
    backgroundColor: OVERVIEW_RHYTHM_COLORS.sleep,
    shadowColor: OVERVIEW_RHYTHM_COLORS.sleep,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  modeText: { color: rhythmSurface(OVERVIEW_RHYTHM_COLORS.modeText, "#C7BCB3"), fontSize: 11, fontWeight: "800" },
  modeSelectedText: { color: "#fff" },
  modeIco: { flexDirection: "row", alignItems: "flex-end", gap: 1.5, height: 12 },
  modeBarA: { width: 2.2, height: 5, borderRadius: 1, backgroundColor: "#fff" },
  modeBarB: { width: 2.2, height: 8, borderRadius: 1, backgroundColor: "#fff" },
  modeBarC: { width: 2.2, height: 10, borderRadius: 1, backgroundColor: "#fff" },
  sky: { paddingTop: 2, overflow: "visible" },
  plot: { minWidth: 0, overflow: "visible" },
  plotCompare: { paddingLeft: 42 },
  axis: { height: 16, marginBottom: 8 },
  axisLabel: { position: "absolute", top: 0, width: 64, marginLeft: -32, textAlign: "center", color: colors.faint, fontSize: 10, fontWeight: "700" },
  axisFirst: { marginLeft: 0, textAlign: "left" },
  axisLast: { marginLeft: 0, textAlign: "right" },
  tracks: { position: "relative", paddingTop: 34, paddingBottom: 12, gap: 14, overflow: "visible" },
  yesterdayRow: { position: "relative", minHeight: 30, justifyContent: "center", overflow: "visible" },
  todayRow: { position: "relative", minHeight: 34, justifyContent: "center", overflow: "visible" },
  trackLabelSlot: {
    position: "absolute",
    left: -42,
    top: 0,
    bottom: 0,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    overflow: "visible",
  },
  trackLabel: {
    width: 34,
    textAlign: "center",
    color: colors.faint,
    fontSize: 9,
    fontWeight: "800",
  },
  todayLabelWrap: {
    minHeight: 18,
    minWidth: 34,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: OVERVIEW_RHYTHM_COLORS.sleep,
    alignItems: "center",
    justifyContent: "center",
  },
  todayLabelText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  yesterdayRail: { height: 30, borderRadius: 999, backgroundColor: rhythmSurface("#F1F2F8", "#312F39"), overflow: "hidden" },
  todayRail: { height: 34, borderRadius: 999, backgroundColor: rhythmSurface("#F4F5FA", "#373541"), overflow: "hidden" },
  guideLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  timeGuide: { position: "absolute", top: 5, bottom: 5, width: 1, backgroundColor: "rgba(124,131,253,0.10)" },
  timeGuideMuted: { backgroundColor: "rgba(124,131,253,0.07)" },
  trackSleep: { position: "absolute", top: 5, bottom: 5, borderRadius: 999, borderWidth: 1, borderColor: "#F4F5FA", backgroundColor: "#5E6CC4", zIndex: 1, alignItems: "center", justifyContent: "center" },
  trackSleepMuted: { backgroundColor: "#DCE0F1", borderColor: "#F1F2F8" },
  trackEvent: { position: "absolute", borderWidth: 1, flexDirection: "row", alignItems: "stretch", justifyContent: "center", zIndex: 2 },
  trackEventPoint: { top: 6, bottom: 6, gap: 1, overflow: "visible" },
  trackEventDuration: { top: 5, bottom: 5, borderRadius: 999, overflow: "hidden", gap: 1 },
  trackEventStripe: { borderRadius: 999 },
  trackEventStripePoint: { flex: 1, marginHorizontal: 1 },
  trackEventStripeDuration: { flex: 1 },
  segmentLabel: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: -0.1, textAlign: "center", paddingHorizontal: 4 },
  todayNowDot: { position: "absolute", top: 1, width: 7, height: 7, marginLeft: -3.5, borderRadius: 999, backgroundColor: "#6C83E8", zIndex: 5 },
  inspectLine: { position: "absolute", top: 2, bottom: 2, width: 2, marginLeft: -1, borderRadius: 99, backgroundColor: "#4E67D8", zIndex: 6 },
  nowLine: { position: "absolute", top: 28, bottom: 2, width: 1.5, marginLeft: -0.75, borderRadius: 99, backgroundColor: "rgba(124,131,253,0.82)", zIndex: 2 },
  nowScrubber: { position: "absolute", top: 2, width: 120, marginLeft: -60, alignItems: "center", zIndex: 6, overflow: "visible" },
  nowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: OVERVIEW_RHYTHM_COLORS.sleep,
    shadowColor: OVERVIEW_RHYTHM_COLORS.sleep,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  nowBadgeTime: { paddingHorizontal: 10, paddingVertical: 5 },
  nowBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", flexShrink: 0 },
  dock: { minHeight: 72, marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" },
  tooltipSlot: {
    flex: 1,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    width: 186,
    maxWidth: "100%",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  tipKicker: { marginBottom: 5, color: colors.text, fontSize: 9.5, fontWeight: "800" },
  tipRow: { flexDirection: "row", alignItems: "center", marginBottom: 3, gap: 5 },
  tipLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", flexShrink: 1 },
  tipValue: { marginLeft: "auto", fontSize: 10, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  tipEmpty: { color: colors.faint, fontSize: 10, fontWeight: "700" },
  tipFeed: { color: OVERVIEW_RHYTHM_COLORS.feed },
  tipSleep: { color: OVERVIEW_RHYTHM_COLORS.sleep },
  tipSame: { color: colors.faint },
  duck: { width: 46, height: 54 },
  status: { marginTop: 8, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" },
  timelineRows: { gap: 7, marginTop: 14 },
  timelineRow: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6 },
  timelineIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  eventTrack: { flex: 1, minHeight: 36, borderBottomWidth: 1, borderBottomColor: "rgba(237,229,220,0.62)" },
  timelineEvent: { position: "absolute", top: 6, width: 20, height: 24, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  timelineSleep: { position: "absolute", top: 11, height: 14, borderRadius: 999, backgroundColor: OVERVIEW_RHYTHM_COLORS.sleepFill },
  timelineDot: { width: 5, height: 12, borderRadius: 999 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, paddingRight: 8 },
  toggle: { minHeight: 48, color: colors.muted, fontSize: 11, fontWeight: "800", paddingVertical: 5 },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 99 },
  legendText: { color: colors.faint, fontSize: 10 },
});
