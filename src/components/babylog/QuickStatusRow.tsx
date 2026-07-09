import { StyleSheet, Text, View } from "react-native";
import { BabyLogIcon, type QuickStatusIconKey } from "./BabyLogIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import { countTodayLogs, findLastLog, minutesAgoLabel } from "../../utils/logSummary";
import { colors, radius } from "../../theme";

type Props = {
  logs: BabyLogEntry[];
};

const FEEDING_CATS = ["breast", "formula", "food", "snack", "pump"] as const;
const SLEEP_CATS = ["sleep"] as const;
const DIAPER_CATS = ["diaper"] as const;

export function QuickStatusRow({ logs }: Props) {
  const lastFeed = findLastLog(logs, [...FEEDING_CATS]);
  const lastSleep = findLastLog(logs, [...SLEEP_CATS]);
  const diaperCount = countTodayLogs(logs, [...DIAPER_CATS]);

  const cards: {
    key: QuickStatusIconKey;
    label: string;
    value: string;
    accent: string;
    bg: string;
  }[] = [
    {
      key: "feed",
      label: "마지막 수유",
      value: lastFeed ? minutesAgoLabel(lastFeed.time) : "기록 없음",
      accent: "#E8918A",
      bg: "rgba(232,145,138,0.12)",
    },
    {
      key: "sleep",
      label: "마지막 수면",
      value: lastSleep ? minutesAgoLabel(lastSleep.time) : "기록 없음",
      accent: "#7c83fd",
      bg: "rgba(124,131,253,0.12)",
    },
    {
      key: "diaper",
      label: "마지막 배변",
      value: diaperCount > 0 ? `오늘 ${diaperCount}회` : "기록 없음",
      accent: "#5CB87A",
      bg: "rgba(92,184,122,0.12)",
    },
  ];

  return (
    <View style={styles.row}>
      {cards.map((card) => (
        <View key={card.key} style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: card.bg }]}>
            <BabyLogIcon kind="quick" icon={card.key} size={18} color={card.accent} />
          </View>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={[styles.value, { color: card.accent }]} numberOfLines={1}>
            {card.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 22 },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#2E2A26",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  label: { fontSize: 10.5, color: colors.faint, fontWeight: "600", marginBottom: 3 },
  value: { fontSize: 12.5, fontWeight: "800" },
});
