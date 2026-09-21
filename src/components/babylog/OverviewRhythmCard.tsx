import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
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
import { useAppSettings } from "../../context/AppSettingsContext";
import { colors } from "../../theme";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { DefaultFeedingMethod } from "../../types/careSetup";
import { formatDisplayTime } from "../../utils/logSummary";
import { formatTemperature, formatVolume } from "../../utils/measurementFormat";
import type { OverviewCompareUnit } from "../../utils/overviewCategoryCards";
import { customCategoryDisplayLabel, recordCategoryLabel } from "../../utils/recordDisplay";
import {
  buildOverviewCategoryCardsAtCursors,
  buildOverviewCategoryCardsAtCutoff,
  buildOverviewIndependentCompareRows,
  buildOverviewInspectionRows,
  buildOverviewTimelineRows,
} from "../../utils/overviewCategoryCards";
import {
  OVERVIEW_RHYTHM_COLORS,
  buildDayRhythm,
  clampRhythmMinutes,
  clockFromMinutes,
  coveringKind,
  formatOverviewAmount,
  lastFeedTime,
  localDateKey,
  minutesNow,
  percentAt,
  sleepElapsedAt,
} from "../../utils/overviewRhythm";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { buildOverviewRhythmSegments, type RhythmTrackSegment } from "../../utils/overviewRhythmSegments";
import { BabyLogIcon } from "./BabyLogIcon";
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

function formatCursorClock(minutes: number, clock: "12h" | "24h") {
  return formatDisplayTime(clockFromMinutes(minutes), clock);
}

function formatRhythmAmount(
  numeric: number,
  unit: OverviewCompareUnit,
  t: Parameters<typeof formatOverviewAmount>[2],
  volumeUnit: "ml" | "oz",
) {
  if (unit === "temp") return formatTemperature(numeric);
  if (unit === "ml") return formatVolume(numeric, volumeUnit);
  return formatOverviewAmount(numeric, unit, t);
}

function formatRhythmDelta(
  delta: number,
  unit: OverviewCompareUnit,
  t: Parameters<typeof formatOverviewAmount>[2],
  volumeUnit: "ml" | "oz",
) {
  if (delta === 0) return t("report.critical.167");
  const signed = `${delta > 0 ? "+" : "-"}${formatRhythmAmount(Math.abs(delta), unit, t, volumeUnit)}`;
  return signed;
}

function CursorMark({ minutes, label, tone }: { minutes: number; label: string; tone: "today" | "yesterday" }) {
  return (
    <View pointerEvents="none" style={[styles.cursorMark, { left: `${percentAt(minutes)}%` }]}>
      <View style={[styles.cursorPill, tone === "yesterday" && styles.cursorPillYesterday]}>
        <Text style={styles.cursorPillText} numberOfLines={1}>{label}</Text>
      </View>
      <View style={[styles.cursorLine, tone === "yesterday" && styles.cursorLineYesterday]} />
    </View>
  );
}

export function OverviewRhythmCard({
  todayLogs,
  yesterdayLogs,
  customCategories = [],
  defaultFeedingMethod,
}: Props) {
  const { locale, t } = useLanguage();
  const { settings } = useAppSettings();
  const clock = settings.time.clock;
  const volumeUnit = settings.units.volume;
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.4;
  const [compareOn, setCompareOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(minutesNow);
  const [todayCursor, setTodayCursor] = useState<number | null>(null);
  const [yesterdayCursor, setYesterdayCursor] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(320);
  const liveNowRef = useRef(minutesNow());
  const dateKeyRef = useRef(localDateKey());
  const todayWidthRef = useRef(0);
  const yesterdayWidthRef = useRef(0);
  liveNowRef.current = now;
  const todayCursorTime = todayCursor ?? now;
  const yesterdayCursorTime = yesterdayCursor ?? now;

  useEffect(() => {
    const tick = () => {
      const nextNow = minutesNow();
      const nextDate = localDateKey();
      setNow(nextNow);
      if (dateKeyRef.current !== nextDate) {
        dateKeyRef.current = nextDate;
        setTodayCursor(null);
        setYesterdayCursor(null);
      }
    };
    const timer = setInterval(tick, 30_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (todayCursor != null && todayCursor > now) setTodayCursor(now);
  }, [now, todayCursor]);

  const todayPan = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: (event) => {
        const width = todayWidthRef.current;
        const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
        const next = width
          ? clampRhythmMinutes((x / width) * 1440, liveNowRef.current)
          : liveNowRef.current;
        setTodayCursor(next);
      },
      onPanResponderMove: (event) => {
        const width = todayWidthRef.current;
        const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
        const next = width
          ? clampRhythmMinutes((x / width) * 1440, liveNowRef.current)
          : liveNowRef.current;
        setTodayCursor(next);
      },
    }), []);
  const yesterdayPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (event) => {
      const width = yesterdayWidthRef.current;
      const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
      setYesterdayCursor(width ? clampRhythmMinutes((x / width) * 1440) : 0);
    },
    onPanResponderMove: (event) => {
      const width = yesterdayWidthRef.current;
      const x = Math.max(0, Math.min(width, event.nativeEvent.locationX));
      setYesterdayCursor(width ? clampRhythmMinutes((x / width) * 1440) : 0);
    },
  }), []);

  const onTodayLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    todayWidthRef.current = width;
    if (width > 0 && Math.abs(trackWidth - width) > 1) setTrackWidth(width);
  };
  const onYesterdayLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    yesterdayWidthRef.current = width;
    if (width > 0 && Math.abs(trackWidth - width) > 1) setTrackWidth(width);
  };

  const resetComparison = () => {
    setTodayCursor(null);
    setYesterdayCursor(null);
  };

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
    () => compareOn
      ? buildOverviewCategoryCardsAtCursors(todayLogs, yesterdayLogs, todayCursorTime, yesterdayCursorTime, { customCategories, defaultFeedingMethod })
      : buildOverviewCategoryCardsAtCutoff(todayLogs, yesterdayLogs, todayCursorTime, { customCategories, defaultFeedingMethod }),
    [compareOn, customCategories, defaultFeedingMethod, todayCursorTime, todayLogs, yesterdayCursorTime, yesterdayLogs],
  );
  const timelineRows = useMemo(
    () => buildOverviewTimelineRows(todayLogs, { customCategories, defaultFeedingMethod }),
    [customCategories, defaultFeedingMethod, todayLogs],
  );
  const legendRows = useMemo(() => {
    const recorded = timelineRows.filter((row) => row.events.length > 0);
    const extras = recorded.filter((row) => row.id !== "feed" && row.id !== "sleep" && row.id !== "diaper");
    return [
      recorded.find((row) => row.id === "sleep"),
      recorded.find((row) => row.id === "feed"),
      recorded.find((row) => row.id === "diaper"),
      ...extras,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [timelineRows]);
  const todayInspectRows = useMemo(
    () => buildOverviewInspectionRows(todayLogs, todayCursorTime, { customCategories, defaultFeedingMethod }),
    [customCategories, defaultFeedingMethod, todayCursorTime, todayLogs],
  );
  const compareRows = useMemo(
    () => compareOn
      ? buildOverviewIndependentCompareRows(todayLogs, yesterdayLogs, todayCursorTime, yesterdayCursorTime, { customCategories, defaultFeedingMethod })
      : [],
    [compareOn, customCategories, defaultFeedingMethod, todayCursorTime, todayLogs, yesterdayCursorTime, yesterdayLogs],
  );
  const pose = coveringKind(todayLogs, todayCursorTime);
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
  const todayTimeLabel = formatCursorClock(todayCursorTime, clock);
  const yesterdayTimeLabel = formatCursorClock(yesterdayCursorTime, clock);
  const status = nap
    ? t("report.critical.134", { minutes: nap.elapsed })
    : feedAt
      ? `${t("report.critical.132")} · ${t("report.critical.133", { time: formatDisplayTime(feedAt, clock) })}`
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

  const accentForRow = (id: (typeof timelineRows)[number]["id"], recordCategory: (typeof timelineRows)[number]["recordCategory"]) => {
    if (id === "feed") return OVERVIEW_RHYTHM_COLORS.feed;
    if (id === "sleep") return OVERVIEW_RHYTHM_COLORS.sleep;
    if (id === "diaper") return OVERVIEW_RHYTHM_COLORS.diaper;
    return resolveLogCategory(recordCategory, customCategories).color;
  };

  const resetButton = (
    <Pressable
      onPress={resetComparison}
      hitSlop={8}
      style={styles.resetBtn}
      accessibilityRole="button"
      accessibilityLabel={t("report.critical.269")}
    >
      <BabyLogIcon kind="refresh" size={18} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <View style={[styles.head, largeText && styles.headLargeText]}>
        <View style={styles.headCopy}>
          <Text style={styles.title}>{t("report.critical.030")}</Text>
        </View>
        <View style={styles.headActions}>
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
                  style={styles.railHit}
                  onLayout={onYesterdayLayout}
                  {...yesterdayPan.panHandlers}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={t("report.critical.268", { time: yesterdayTimeLabel })}
                  accessibilityValue={{ text: yesterdayTimeLabel }}
                  accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                  onAccessibilityAction={(event) => {
                    const delta = event.nativeEvent.actionName === "increment" ? 15 : -15;
                    setYesterdayCursor(clampRhythmMinutes(yesterdayCursorTime + delta));
                  }}
                >
                  <View style={styles.yesterdayRail}>
                    <TimeGuides muted />
                    <TrackSegments segments={yesterdaySegments} muted locale={locale} />
                  </View>
                  <CursorMark minutes={yesterdayCursorTime} label={yesterdayTimeLabel} tone="yesterday" />
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
                style={styles.railHit}
                onLayout={onTodayLayout}
                {...todayPan.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("report.critical.267", { time: todayTimeLabel })}
                accessibilityValue={{ text: todayTimeLabel }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(event) => {
                  const delta = event.nativeEvent.actionName === "increment" ? 15 : -15;
                  setTodayCursor(clampRhythmMinutes(todayCursorTime + delta, now));
                }}
              >
                <View style={styles.todayRail}>
                  <TimeGuides muted={false} />
                  <TrackSegments segments={todaySegments} muted={false} locale={locale} />
                </View>
                <CursorMark minutes={todayCursorTime} label={todayTimeLabel} tone="today" />
              </View>
            </View>
          </View>

          <View style={styles.dock}>
            <View style={styles.comparePanel}>
              <View style={styles.compareHead}>
                <Text style={styles.compareTimes} numberOfLines={1}>
                  {compareOn
                    ? `${t("report.critical.069")} ${todayTimeLabel} · ${t("report.critical.139")} ${yesterdayTimeLabel}`
                    : `${t("report.critical.069")} ${todayTimeLabel}`}
                </Text>
                {resetButton}
              </View>
              {compareOn ? (
                compareRows.length ? compareRows.map((row) => {
                  const todayValue = row.hasToday && row.todayCumulative != null
                    ? formatRhythmAmount(row.todayCumulative, row.unit, t, volumeUnit)
                    : t("report.critical.017");
                  const yesterdayValue = row.hasYesterday && row.yesterdayCumulative != null
                    ? formatRhythmAmount(row.yesterdayCumulative, row.unit, t, volumeUnit)
                    : t("report.critical.017");
                  const delta = row.delta == null || !row.hasToday || !row.hasYesterday
                    ? null
                    : formatRhythmDelta(row.delta, row.unit, t, volumeUnit);
                  const accent = accentForRow(row.id, row.recordCategory);
                  return (
                    <View key={String(row.id)} style={styles.compareRow}>
                      <View style={styles.compareName}>
                        <LogCategoryIcon
                          categoryKey={row.recordCategory}
                          customCategories={customCategories}
                          size={16}
                          color={accent}
                        />
                        <Text style={styles.compareLabel} numberOfLines={1}>{labelForRow(row.id)}</Text>
                      </View>
                      <View style={styles.compareValues}>
                        <Text style={styles.compareNumber} numberOfLines={1}>
                          {t("report.critical.069")} {todayValue}
                        </Text>
                        <Text style={styles.compareNumber} numberOfLines={1}>
                          {t("report.critical.139")} {yesterdayValue}
                        </Text>
                      </View>
                      {delta ? (
                        <Text style={[styles.compareDelta, !row.semanticDelta && styles.compareDeltaNeutral]}>{delta}</Text>
                      ) : null}
                    </View>
                  );
                }) : <Text style={styles.tipEmpty}>{t("report.critical.272")}</Text>
              ) : (
                todayInspectRows.length ? todayInspectRows.map((row) => (
                  <View key={String(row.id)} style={styles.compareRow}>
                    <View style={styles.compareName}>
                      <LogCategoryIcon
                        categoryKey={row.recordCategory}
                        customCategories={customCategories}
                        size={16}
                        color={accentForRow(row.id, row.recordCategory)}
                      />
                      <Text style={styles.compareLabel} numberOfLines={1}>{labelForRow(row.id)}</Text>
                    </View>
                    <Text style={styles.compareNumber}>{formatRhythmAmount(row.cumulative, row.unit, t, volumeUnit)}</Text>
                  </View>
                )) : <Text style={styles.tipEmpty}>{t("report.critical.272")}</Text>
              )}
            </View>
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
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 13 },
  headLargeText: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  headCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  headActions: { alignItems: "flex-end", gap: 8 },
  resetBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
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
  tracks: { position: "relative", paddingTop: 8, paddingBottom: 12, gap: 18, overflow: "visible" },
  yesterdayRow: { position: "relative", minHeight: 44, justifyContent: "center", overflow: "visible" },
  todayRow: { position: "relative", minHeight: 48, justifyContent: "center", overflow: "visible" },
  railHit: { minHeight: 48, justifyContent: "center", overflow: "visible" },
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
  cursorMark: { position: "absolute", top: -16, bottom: 0, width: 72, marginLeft: -36, alignItems: "center", zIndex: 6 },
  cursorPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: OVERVIEW_RHYTHM_COLORS.sleep,
  },
  cursorPillYesterday: { backgroundColor: "#8B92C9" },
  cursorPillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cursorLine: { flex: 1, width: 2, marginTop: 2, borderRadius: 99, backgroundColor: "#4E67D8" },
  cursorLineYesterday: { backgroundColor: "#8B92C9" },
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
  dock: { minHeight: 72, marginTop: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" },
  comparePanel: { flex: 1, minWidth: 0, marginRight: 8, gap: 8 },
  compareHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  compareTimes: { flex: 1, minWidth: 0, color: colors.text, fontSize: 12, fontWeight: "800" },
  compareRow: { gap: 3 },
  compareName: { flexDirection: "row", alignItems: "center", gap: 6 },
  compareLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", flexShrink: 1 },
  compareValues: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  compareNumber: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: "800" },
  compareDelta: { color: colors.amberText, fontSize: 11, fontWeight: "700" },
  compareDeltaNeutral: { color: colors.muted },
  tipEmpty: { color: colors.faint, fontSize: 12, fontWeight: "700", lineHeight: 18 },
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
