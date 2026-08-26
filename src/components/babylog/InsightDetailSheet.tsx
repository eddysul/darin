import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../LanguageContext";
import type { Insight } from "../../utils/careInsights";
import { localizeInsight } from "../../utils/insightDisplay";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  insight: Insight | null;
  babyName: string;
  onClose: () => void;
};

export function InsightDetailSheet({ visible, insight, babyName, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  if (!insight) return null;

  const copy = localizeInsight(insight, t, locale);
  const { distribution: dist } = insight;
  const first = dist.buckets[0];
  const last = dist.buckets[dist.buckets.length - 1];
  const firstHigher = first.value >= last.value;
  const firstCopy = copy.buckets[0];
  const lastCopy = copy.buckets[copy.buckets.length - 1];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel={t("report.critical.104")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {copy.lead}
              {t("report.critical.122", { babyName })}
              <Text style={styles.gap}>{copy.gapText}</Text> {copy.tail}
            </Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>

            <View style={styles.compare}>
              <View style={styles.compareCol}>
                <Text style={styles.compareRange}>{firstCopy.range}</Text>
                <Text style={[styles.compareValue, firstHigher && styles.compareStrong]}>
                  {firstCopy.valueLabel}
                </Text>
                <Text style={styles.compareDays}>{firstCopy.daysLabel}</Text>
              </View>
              <Text style={styles.compareArrow}>→</Text>
              <View style={styles.compareCol}>
                <Text style={styles.compareRange}>{lastCopy.range}</Text>
                <Text style={[styles.compareValue, !firstHigher && styles.compareStrong]}>
                  {lastCopy.valueLabel}
                </Text>
                <Text style={styles.compareDays}>{lastCopy.daysLabel}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>{t("insight.critical.080")}</Text>
            {copy.buckets.map((bucket) => (
              <View key={bucket.name} style={styles.row}>
                <Text style={styles.rowName}>{bucket.name}</Text>
                <Text style={styles.rowRange}>{bucket.range}</Text>
                <Text style={styles.rowValue}>{bucket.valueLabel}</Text>
                <Text style={styles.rowDays}>{bucket.daysLabel}</Text>
              </View>
            ))}

            <View style={styles.caution}>
              <Text style={styles.cautionTitle}>{t("insight.critical.081")}</Text>
              <Text style={styles.cautionText}>{t("insight.critical.082")}</Text>
            </View>
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t("report.critical.104")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  backdropFill: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "84%",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, lineHeight: 27 },
  gap: { color: colors.amber },
  subtitle: { fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 8 },
  compare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardHi,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  compareCol: { flex: 1, alignItems: "center" },
  compareRange: { fontSize: 10.5, color: colors.faint, marginBottom: 6 },
  compareValue: { fontSize: 19, fontWeight: "800", color: colors.faint, textAlign: "center" },
  compareStrong: { color: colors.amber },
  compareDays: { fontSize: 9.5, color: colors.faint, marginTop: 6 },
  compareArrow: { fontSize: 16, color: colors.border },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.faint,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { width: 58, fontSize: 12, fontWeight: "700", color: colors.text },
  rowRange: { flex: 1, fontSize: 10.5, color: colors.faint, fontVariant: ["tabular-nums"] },
  rowValue: { fontSize: 12.5, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  rowDays: { width: 34, textAlign: "right", fontSize: 10, color: colors.faint },
  caution: {
    marginTop: 22,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.cardHi,
  },
  cautionTitle: { fontSize: 11.5, fontWeight: "800", color: colors.muted, marginBottom: 5 },
  cautionText: { fontSize: 11.5, lineHeight: 18, color: colors.faint },
  closeBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.amber,
  },
  closeText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
