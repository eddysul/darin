import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { OverviewSpriteSheet } from "./OverviewSprite";
import { overviewAssets } from "./overviewAssets";
import { colors } from "../../theme";
import { useLanguage } from "../../LanguageContext";

type Props = {
  headline: string;
  body: string;
  badge: string;
  kicker: string;
  finding?: string;
  moreLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
};

const VALUE = String.raw`\d[\d.]*\s*(?:\uC2DC\uAC04(?:\s*\d+\uBD84)?|\uBD84|\uD68C|ml|g)`;
const ARROW_RUN = new RegExp(`(${VALUE}\\s*→\\s*(?:[\\uAC00-\\uD7A3]{1,4}\\s*)?${VALUE})`);

function TeaserBody({ text }: { text: string }) {
  const parts = text.split(ARROW_RUN);
  return (
    <Text style={styles.copy}>
      {parts.map((part, index) =>
        index % 2 === 1 ? <Text key={index} style={styles.strong}>{part}</Text> : part,
      )}
    </Text>
  );
}

export function OverviewWeeklyCard({
  headline,
  body,
  badge,
  kicker,
  finding,
  moreLabel,
  accessibilityLabel,
  onPress,
}: Props) {
  const { t } = useLanguage();
  const [playToken, setPlayToken] = useState(0);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.top}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.badge}>{badge}</Text>
      </View>
      <View style={styles.main}>
        <OverviewSpriteSheet
          key={playToken}
          source={overviewAssets.weeklyDuck}
          width={54}
          height={66}
          columns={4}
          rows={2}
          durationMs={2600}
          playing={playToken > 0}
          onPress={() => setPlayToken((token) => token + 1)}
          accessibilityLabel={t("report.critical.218")}
        />
        <View style={styles.text}>
          <Text style={styles.headline}>{headline}</Text>
          <TeaserBody text={body} />
        </View>
      </View>
      {finding ? (
        <View style={styles.finding}>
          <BabyLogIcon kind="sparkles" size={13} color="#9b5a32" strokeWidth={2.2} />
          <Text style={styles.findingText}>{finding}</Text>
        </View>
      ) : null}
      <Text style={styles.link}>{moreLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pressed: { transform: [{ scale: 0.987 }] },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  kicker: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  badge: {
    backgroundColor: colors.chip,
    color: colors.text,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10.5,
    fontWeight: "700",
  },
  main: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 },
  text: { flex: 1, minWidth: 0 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  copy: { marginTop: 7, color: colors.muted, fontSize: 13, lineHeight: 22 },
  strong: { color: colors.text, fontWeight: "800" },
  finding: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  findingText: { flex: 1, color: "#9b5a32", fontSize: 11, fontWeight: "700" },
  link: { marginTop: 14, color: colors.amberText, fontSize: 12, fontWeight: "800" },
});
