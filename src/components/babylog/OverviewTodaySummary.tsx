import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../LanguageContext";
import { colors } from "../../theme";
import type { BabyLogEntry } from "../../types/babyLog";
import {
  buildOverviewHeadlineKind,
  formatOverviewAmount,
  formatOverviewDelta,
  overviewStatPills,
  sleepMinutesFor,
} from "../../utils/overviewRhythm";
import { OverviewSpriteSheet } from "./OverviewSprite";
import { overviewAssets } from "./overviewAssets";

type Props = {
  todayLogs: BabyLogEntry[];
  yesterdayLogs: BabyLogEntry[];
};

export function OverviewTodaySummary({ todayLogs, yesterdayLogs }: Props) {
  const { t } = useLanguage();
  const [playToken, setPlayToken] = useState(1);
  const pills = overviewStatPills(todayLogs);
  const yesterdayPills = overviewStatPills(yesterdayLogs);
  const kind = buildOverviewHeadlineKind(todayLogs, yesterdayLogs);
  const feedDelta = formatOverviewDelta(pills.feed.numeric - yesterdayPills.feed.numeric, pills.feed.unit, t);
  const sleepDelta = formatOverviewDelta(pills.sleepMin - sleepMinutesFor(yesterdayLogs), "min", t);
  const feedText = formatOverviewAmount(pills.feed.numeric, pills.feed.unit, t);
  const sleepText = formatOverviewAmount(pills.sleepMin, "min", t);
  const headline = kind === "empty"
    ? t("report.critical.011")
    : kind === "feedUpSleepDown"
      ? t("report.critical.160")
      : t("report.critical.006");
  const body = kind === "empty"
    ? ""
    : kind === "feedUpSleepDown"
      ? t("report.critical.161", { feed: feedText, feedDiff: feedDelta.signed, sleep: sleepText, sleepDiff: sleepDelta.signed })
      : t("report.critical.162", { feed: feedText, feedDiff: feedDelta.signed, sleep: sleepText });

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <OverviewSpriteSheet
          key={playToken}
          source={overviewAssets.todaySummaryDuck}
          width={58}
          height={82}
          columns={4}
          rows={2}
          playing={playToken > 0}
          onPress={() => setPlayToken((token) => token + 1)}
          accessibilityLabel={t("report.critical.006")}
        />
        <View style={styles.copy}>
          <Text style={styles.title}>{headline}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>{t("report.critical.008")} <Text style={styles.strong}>{sleepText}</Text></Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.stat}>{t("report.critical.007")} <Text style={styles.strong}>{feedText}</Text></Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.stat}>{t("report.critical.009")} <Text style={styles.strong}>{formatOverviewAmount(pills.diaperCount, "count", t)}</Text></Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.stat}>{t("report.critical.130")} <Text style={styles.strong}>{formatOverviewAmount(pills.tummyMin, "min", t)}</Text></Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 112, paddingHorizontal: 4, paddingTop: 7, paddingBottom: 16, marginBottom: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "800", letterSpacing: -0.2 },
  body: { marginTop: 4, color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
  },
  stat: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  strong: { color: colors.text, fontWeight: "800" },
  dot: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});
