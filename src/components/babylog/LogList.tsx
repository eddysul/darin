import { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { formatLogMeta, getCategory } from "../../constants/babyLogCategories";
import type { BabyLogEntry } from "../../types/babyLog";
import { colors } from "../../theme";

type Props = {
  logs: BabyLogEntry[];
  onPress: (entry: BabyLogEntry) => void;
  onDelete: (id: string) => void;
};

function SwipeRow({
  entry,
  onPress,
  onDelete,
}: {
  entry: BabyLogEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const moved = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 6) moved.current = true;
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -80) {
          Animated.timing(translateX, { toValue: -400, duration: 180, useNativeDriver: true }).start(() =>
            onDelete(),
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const c = getCategory(entry.cat);

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.swipeBg}>
        <Text style={styles.deleteIcon}>🗑️</Text>
      </View>
      <Animated.View style={[styles.swipeFg, { transform: [{ translateX }] }]} {...pan.panHandlers}>
        <Pressable
          style={styles.item}
          onPress={() => {
            if (moved.current) {
              moved.current = false;
              return;
            }
            onPress();
          }}
        >
          <Text style={styles.time}>{entry.time}</Text>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {c.emoji} {c.label}
              </Text>
              {entry.voice && (
                <View style={styles.voiceTag}>
                  <Text style={styles.voiceTagText}>🎙️ 음성</Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>{formatLogMeta(entry)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function LogList({ logs, onPress, onDelete }: Props) {
  if (logs.length === 0) {
    return <Text style={styles.empty}>아직 기록이 없어요. 위 카테고리를 눌러보세요.</Text>;
  }

  const sorted = [...logs].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <View>
      {sorted.map((entry) => (
        <SwipeRow key={entry.id} entry={entry} onPress={() => onPress(entry)} onDelete={() => onDelete(entry.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", color: colors.faint, fontSize: 12.5, paddingVertical: 24 },
  swipeWrap: { position: "relative", overflow: "hidden", borderRadius: 10 },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.danger,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 18,
  },
  deleteIcon: { fontSize: 18 },
  swipeFg: { backgroundColor: colors.background },
  item: { flexDirection: "row", gap: 12, paddingVertical: 10, paddingHorizontal: 2, alignItems: "flex-start" },
  time: { fontSize: 12, color: colors.faint, width: 44, fontVariant: ["tabular-nums"], paddingTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  voiceTag: {
    backgroundColor: colors.amberSoft,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  voiceTagText: { fontSize: 10, color: colors.amber, fontWeight: "600" },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chevron: { color: colors.faint, fontSize: 13, alignSelf: "center" },
});
