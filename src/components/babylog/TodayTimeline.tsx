import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  limit?: number;
};

export function TodayTimeline({ logs, customCategories, onPress, limit = 3 }: Props) {
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
          {visible.map((entry, index) => {
            const c = resolveLogCategory(entry.cat, customCategories);
            const isLast = index === visible.length - 1;
            return (
              <Pressable key={entry.id} style={styles.row} onPress={() => onPress(entry)}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
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
            );
          })}
        </View>
      )}
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
    paddingHorizontal: 14,
    shadowColor: "#2E2A26",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
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
