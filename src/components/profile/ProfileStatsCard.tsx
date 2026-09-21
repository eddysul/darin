import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon, type MiscIconKey } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import type { MyProfileStatKey } from "../../types/myProfileShowcase";
import { colors, fontScaleCap, radius } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const STATS: Array<{ key: MyProfileStatKey; icon: MiscIconKey; labelKey: "memory.critical.213" | "memory.critical.215" | "memory.critical.216" }> = [
  { key: "baby", icon: "baby", labelKey: "memory.critical.213" },
  { key: "family", icon: "family", labelKey: "memory.critical.215" },
  { key: "friend", icon: "handshake", labelKey: "memory.critical.216" },
];

type Props = {
  babyCount: number;
  familyCount: number | null;
  friendCount: number | null;
  loading?: boolean;
  onPressStat: (key: MyProfileStatKey) => void;
};

export function ProfileStatsCard({
  babyCount,
  familyCount,
  friendCount,
  loading,
  onPressStat,
}: Props) {
  const { t } = useLanguage();
  const counts: Record<MyProfileStatKey, number | null> = {
    baby: babyCount,
    family: familyCount,
    friend: friendCount,
  };

  return (
    <View style={styles.card}>
      {STATS.map((stat, index) => (
        <View key={stat.key} style={styles.cellWrap}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <Pressable
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
            onPress={() => onPressStat(stat.key)}
            accessibilityRole="button"
            accessibilityLabel={`${t(stat.labelKey)} ${loading || counts[stat.key] === null ? "–" : counts[stat.key]}`}
          >
            <View style={styles.iconRow}>
              <BabyLogIcon kind={stat.icon} size={15} color={colors.iconNeutral} strokeWidth={2} />
              <Text style={styles.label} maxFontSizeMultiplier={fontScaleCap.chrome}>
                {t(stat.labelKey)}
              </Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.value} maxFontSizeMultiplier={fontScaleCap.chrome}>
                {loading || counts[stat.key] === null ? "–" : counts[stat.key]}
              </Text>
              <BabyLogIcon kind="chevron" size={16} color={colors.faint} strokeWidth={2.1} />
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    paddingVertical: 6,
  },
  cellWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cell: {
    flex: 1,
    minHeight: TOUCH_MIN + 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.lg,
  },
  cellPressed: {
    backgroundColor: colors.accentSoft,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  value: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
});
