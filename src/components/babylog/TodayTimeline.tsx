import { useMemo, useRef, useState } from "react";
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { ExpandableSectionHeader } from "./ExpandableSectionHeader";
import { BabyLogIcon } from "./BabyLogIcon";
import { LogCategoryIcon } from "./LogCategoryIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import type { CustomCategory } from "../../types/logCategory";
import { formatDisplayTime, formatTimelineLabel, sortLogsNewest } from "../../utils/logSummary";
import { formatLogProvenance } from "../../utils/logProvenance";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { colors, radius } from "../../theme";

type Props = {
  logs: BabyLogEntry[];
  customCategories: CustomCategory[];
  onPress: (entry: BabyLogEntry) => void;
  onDelete?: (entry: BabyLogEntry) => void;
  highlightId?: string | null;
  limit?: number;
};

export function TodayTimeline({
  logs,
  customCategories,
  onPress,
  onDelete,
  highlightId,
  limit = 3,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortLogsNewest(logs);
  const visible = expanded ? sorted : sorted.slice(0, limit);

  return (
    <View style={styles.section}>
      <ExpandableSectionHeader
        title="오늘 기록"
        expanded={expanded}
        canExpand={sorted.length > limit}
        onToggle={() => setExpanded((v) => !v)}
      />

      {visible.length === 0 ? (
        <Text style={styles.empty}>아직 기록이 없어요. 위에서 빠르게 기록해 보세요.</Text>
      ) : (
        <View style={styles.timeline}>
          {visible.map((entry, index) => (
            <SwipeableTimelineRow
              key={entry.id}
              entry={entry}
              customCategories={customCategories}
              isLast={index === visible.length - 1}
              highlighted={highlightId === entry.id}
              onPress={() => onPress(entry)}
              onDelete={onDelete ? () => onDelete(entry) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SwipeableTimelineRow({
  entry,
  customCategories,
  isLast,
  highlighted,
  onPress,
  onDelete,
}: {
  entry: BabyLogEntry;
  customCategories: CustomCategory[];
  isLast: boolean;
  highlighted?: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const category = resolveLogCategory(entry.cat, customCategories);
  const reset = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();

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
            duration: 140,
            useNativeDriver: true,
          }).start(() => {
            Alert.alert("기록 삭제", "이 기록을 삭제할까요?", [
              { text: "취소", style: "cancel", onPress: reset },
              { text: "삭제", style: "destructive", onPress: onDelete },
            ]);
          });
        },
        onPanResponderTerminate: reset,
      }),
    [onDelete, translateX],
  );

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.deleteUnderlay}>
        <Text style={styles.deleteText}>삭제</Text>
      </View>
      <Animated.View
        style={[
          styles.rowSurface,
          highlighted && styles.rowHighlight,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.row} onPress={onPress}>
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
              <Text style={styles.entryText}>{formatTimelineLabel(entry, customCategories)}</Text>
            </View>
            {formatLogProvenance(entry) ? (
              <Text style={styles.actor}>{formatLogProvenance(entry)}</Text>
            ) : null}
          </View>
          <BabyLogIcon kind="chevron" size={16} color={colors.faint} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  empty: {
    textAlign: "center",
    color: colors.faint,
    fontSize: 13,
    paddingVertical: 20,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeline: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    overflow: "hidden",
    shadowColor: "#2E2A26",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  swipeWrap: { position: "relative" },
  rowSurface: { backgroundColor: colors.card, paddingHorizontal: 14 },
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
    gap: 10,
    paddingVertical: 12,
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
    width: 62,
    fontSize: 12,
    color: colors.faint,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  body: { flex: 1 },
  entryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  actor: { fontSize: 11, color: colors.faint, marginTop: 3 },
});
