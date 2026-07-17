import { StyleSheet, Text, View } from "react-native";
import type { BabyLogEntry } from "../../types/babyLog";
import { isCustomCategoryKey } from "../../types/logCategory";
import { colors, radius } from "../../theme";
import { FEEDING_CATS } from "../../utils/reportAggregates";

type Props = { logs: BabyLogEntry[] };

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function TodayLogSummaryCard({ logs }: Props) {
  const feedCount = logs.filter(
    (entry) =>
      !isCustomCategoryKey(entry.cat) &&
      FEEDING_CATS.includes(entry.cat as (typeof FEEDING_CATS)[number]),
  ).length;
  const sleepMinutes = logs
    .filter((entry) => entry.cat === "sleep")
    .reduce((total, entry) => total + (Number.parseInt(entry.duration ?? "0", 10) || 0), 0);
  const diaperCount = logs.filter((entry) => entry.cat === "diaper").length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <Text style={styles.title}>오늘 요약</Text>
      </View>
      {logs.length === 0 ? (
        <Text style={styles.empty}>첫 기록을 남기면 오늘 하루가 여기에 요약돼요.</Text>
      ) : (
        <Text style={styles.summary}>
          오늘 수유 <Text style={styles.strong}>{feedCount}회</Text>
          {" · "}수면 <Text style={styles.strong}>{formatDuration(sleepMinutes)}</Text>
          {" · "}기저귀 <Text style={styles.strong}>{diaperCount}회</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    paddingHorizontal: 17,
    paddingVertical: 16,
    borderRadius: radius.lg,
    backgroundColor: "#FFF8F3",
    borderWidth: 1,
    borderColor: "rgba(232,145,138,0.25)",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.amber,
  },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  summary: { fontSize: 13.5, color: colors.muted, lineHeight: 21 },
  strong: { color: colors.text, fontWeight: "800" },
  empty: { fontSize: 13, color: colors.faint, lineHeight: 20 },
});
