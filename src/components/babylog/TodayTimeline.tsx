import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LogCategoryIcon } from "./LogCategoryIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory } from "../../types/logCategory";
import { formatDisplayTime, formatTimelineLabel, formatTimelineSubtitle, sortLogsNewest } from "../../utils/logSummary";
import { formatLogProvenance } from "../../utils/logProvenance";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors, fontScaleCap, radius, type } from "../../theme";
import { useLanguage } from "../../LanguageContext";

type ScrollHandlers = {
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: (e?: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollBegin?: () => void;
  onMomentumScrollEnd?: (e?: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
};

type Props = {
  logs: BabyLogEntry[];
  customCategories: CustomCategory[];
  onPress: (entry: BabyLogEntry) => void;
  onDelete?: (entry: BabyLogEntry) => void;
  highlightId?: string | null;
  limit?: number;
  title?: string;
  listHeader?: ReactNode;
  listEmpty?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollHandlers;
};

export function TodayTimeline({
  logs,
  customCategories,
  onPress,
  onDelete,
  highlightId,
  limit = 3,
  title,
  listHeader,
  listEmpty,
  contentContainerStyle,
  scrollProps,
}: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("home.timeline.title");
  const [expanded, setExpanded] = useState(false);
  const sorted = sortLogsNewest(logs);
  const visible = expanded ? sorted : sorted.slice(0, limit);
  const canExpand = sorted.length > limit;

  const header = (
    <View>
      {listHeader}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} maxFontSizeMultiplier={fontScaleCap.chrome}>{resolvedTitle}</Text>
          <View style={styles.countBadge}><Text style={styles.countText}>{t("home.timeline.count", { count: sorted.length })}</Text></View>
        </View>
        {canExpand ? (
          <Pressable style={styles.viewAllBtn} onPress={() => setExpanded((value) => !value)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.viewAll}>{t(expanded ? "home.timeline.collapse" : "home.timeline.more")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const empty =
    listEmpty !== undefined
      ? <View>{listEmpty}</View>
      : sorted.length === 0
        ? <Text style={styles.empty}>{t("home.timeline.empty")}</Text>
        : null;

  return (
    <FlatList
      data={visible.length > 0 ? [{ id: "timeline-card" }] : []}
      keyExtractor={(item) => item.id}
      style={styles.list}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      extraData={`${highlightId ?? ""}-${expanded}-${visible.map((entry) => entry.id).join(",")}`}
      initialNumToRender={1}
      windowSize={3}
      removeClippedSubviews={false}
      renderItem={() => (
        <View style={styles.card}>
          {visible.map((item, index) => (
            <SwipeableTimelineRow
              key={item.id}
              entry={item}
              customCategories={customCategories}
              isFirst={index === 0}
              isLast={index === visible.length - 1}
              highlighted={highlightId === item.id}
              onPress={() => onPress(item)}
              onDelete={onDelete ? () => onDelete(item) : undefined}
            />
          ))}
        </View>
      )}
      {...scrollProps}
    />
  );
}

function SwipeableTimelineRow({
  entry,
  customCategories,
  isFirst,
  isLast,
  highlighted,
  onPress,
  onDelete,
}: {
  entry: BabyLogEntry;
  customCategories: CustomCategory[];
  isFirst: boolean;
  isLast: boolean;
  highlighted?: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const translateX = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const rowOpacity = useRef(new Animated.Value(highlighted && !reduceMotion ? 0 : 1)).current;
  const rowEnterY = useRef(new Animated.Value(highlighted && !reduceMotion ? 8 : 0)).current;
  const category = resolveLogCategory(entry.cat, customCategories);
  const reset = useCallback(
    () =>
      Animated.timing(translateX, { toValue: 0, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start(),
    [reduceMotion, translateX],
  );

  useEffect(() => {
    if (!highlighted) return;
    rowOpacity.stopAnimation();
    rowEnterY.stopAnimation();
    if (reduceMotion) {
      rowOpacity.setValue(1);
      rowEnterY.setValue(0);
      return;
    }
    rowOpacity.setValue(0);
    rowEnterY.setValue(8);
    Animated.parallel([
      Animated.timing(rowOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(rowEnterY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [highlighted, reduceMotion, rowEnterY, rowOpacity]);

  const animateDelete = useCallback(() => {
    if (!onDelete) return;
    if (reduceMotion) {
      onDelete();
      return;
    }
    Animated.parallel([
      Animated.timing(rowOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }),
    ]).start(onDelete);
  }, [onDelete, reduceMotion, rowOpacity, translateX]);

  const confirmDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(t("home.timeline.deleteTitle"), t("home.timeline.deleteBody"), [
      { text: t("home.timeline.cancel"), style: "cancel", onPress: reset },
      { text: t("home.timeline.delete"), style: "destructive", onPress: animateDelete },
    ]);
  }, [animateDelete, onDelete, reset, t]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Boolean(onDelete) && gesture.dx < -8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-96, Math.min(0, gesture.dx)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > -72 || !onDelete) {
            reset();
            return;
          }
          Animated.timing(translateX, {
            toValue: -96,
            duration: reduceMotion ? 0 : 140,
            useNativeDriver: true,
          }).start(confirmDelete);
        },
        onPanResponderTerminate: reset,
      }),
    [confirmDelete, onDelete, reduceMotion, reset, translateX],
  );

  const underlayOpacity = translateX.interpolate({
    inputRange: [-96, -8, 0],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[styles.deleteUnderlay, { opacity: underlayOpacity }]} pointerEvents="none">
        <Text style={styles.deleteText}>{t("home.timeline.delete")}</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.rowSurface,
          isFirst && styles.rowSurfaceFirst,
          isLast && styles.rowSurfaceLast,
          highlighted && styles.rowHighlight,
          { opacity: rowOpacity, transform: [{ translateX }, { translateY: rowEnterY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={styles.row}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${formatDisplayTime(entry.time)} ${formatTimelineLabel(entry, customCategories, t)}`}
          accessibilityHint={onDelete ? t("home.timeline.deleteHint") : undefined}
          accessibilityActions={onDelete ? [{ name: "delete", label: t("home.timeline.delete") }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "delete") confirmDelete();
          }}
        >
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: category.color }]} />
            {!isLast && <View style={styles.line} />}
          </View>
          <Text style={styles.time}>{formatDisplayTime(entry.time)}</Text>
          <View style={styles.body}>
            <View style={styles.entryRow}>
              <LogCategoryIcon
                categoryKey={entry.cat}
                customCategories={customCategories}
                size={16}
              />
              <Text style={styles.entryText}>{formatTimelineLabel(entry, customCategories, t)}</Text>
            </View>
            {formatTimelineSubtitle(entry, t) ? <Text style={styles.entryMeta}>{formatTimelineSubtitle(entry, t)}</Text> : null}
            {formatLogProvenance(entry, t) ? (
              <Text style={styles.actor}>{formatLogProvenance(entry, t)}</Text>
            ) : null}
          </View>
          <View style={[styles.editChip, { borderColor: `${category.color}66` }]}>
            <Text style={[styles.editText, { color: category.color }]}>{t("home.timeline.edit")}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: type.lg, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  countBadge: { minWidth: 34, height: 24, borderRadius: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  countText: { color: colors.amberText, fontSize: type.xs, fontWeight: "800" },
  viewAllBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  viewAll: { fontSize: type.xs, fontWeight: "800", color: colors.amberText },
  empty: {
    textAlign: "center",
    color: colors.faint,
    fontSize: 13,
    paddingVertical: 20,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: 24,
  },
  swipeWrap: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  rowSurface: { backgroundColor: colors.card, paddingHorizontal: 12 },
  rowSurfaceFirst: { paddingTop: 5 },
  rowSurfaceLast: { paddingBottom: 5 },
  rowHighlight: { backgroundColor: "rgba(232,145,138,0.14)" },
  deleteUnderlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 22,
    backgroundColor: "#D85B55",
  },
  deleteText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 52,
    paddingVertical: 9,
  },
  rail: { width: 14, alignItems: "center", alignSelf: "stretch" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  line: {
    position: "absolute",
    top: 18,
    bottom: -12,
    width: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  time: {
    width: 66,
    fontSize: 12.5,
    color: colors.text,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  body: { flex: 1 },
  entryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryText: { flex: 1, fontSize: type.sm, fontWeight: "700", color: colors.text },
  entryMeta: { fontSize: type.xs, lineHeight: 16, color: colors.muted, marginTop: 3 },
  actor: { fontSize: 11, color: colors.faint, marginTop: 3 },
  editChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  editText: { fontSize: 11, fontWeight: "800" },
});
