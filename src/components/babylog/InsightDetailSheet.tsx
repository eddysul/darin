import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Insight } from "../../utils/careInsights";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  insight: Insight | null;
  babyName: string;
  onClose: () => void;
};

export function InsightDetailSheet({ visible, insight, babyName, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!insight) return null;

  const { distribution: dist } = insight;
  const first = dist.buckets[0];
  const last = dist.buckets[dist.buckets.length - 1];
  const firstHigher = first.value >= last.value;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {insight.lead}
              {babyName}가 <Text style={styles.gap}>{insight.gapText}</Text> {insight.tail}
            </Text>
            <Text style={styles.subtitle}>
              {dist.totalDays}일치 기록에서 {dist.bucketLabel}과 {dist.valueLabel}을 비교했어요.
            </Text>

            {/* 양 끝만 크게 대비시킨다. 가운데 구간은 아래 표에 남긴다. */}
            <View style={styles.compare}>
              <View style={styles.compareCol}>
                <Text style={styles.compareRange}>{first.range}</Text>
                <Text style={[styles.compareValue, firstHigher && styles.compareStrong]}>
                  {dist.formatValue(first.value)}
                </Text>
                <Text style={styles.compareDays}>{first.days}일</Text>
              </View>
              <Text style={styles.compareArrow}>→</Text>
              <View style={styles.compareCol}>
                <Text style={styles.compareRange}>{last.range}</Text>
                <Text style={[styles.compareValue, !firstHigher && styles.compareStrong]}>
                  {dist.formatValue(last.value)}
                </Text>
                <Text style={styles.compareDays}>{last.days}일</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>구간별로 보면</Text>
            {dist.buckets.map((bucket) => (
              <View key={bucket.name} style={styles.row}>
                <Text style={styles.rowName}>{bucket.name}</Text>
                <Text style={styles.rowRange}>{bucket.range}</Text>
                <Text style={styles.rowValue}>{dist.formatValue(bucket.value)}</Text>
                <Text style={styles.rowDays}>{bucket.days}일</Text>
              </View>
            ))}

            <View style={styles.caution}>
              <Text style={styles.cautionTitle}>참고해 주세요</Text>
              <Text style={styles.cautionText}>
                함께 나타난 기록일 뿐, 한쪽이 다른 쪽의 원인이라는 뜻은 아니에요.
                성장 급증기처럼 두 가지를 동시에 바꾸는 다른 이유가 있을 수 있어요.
              </Text>
            </View>
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>닫기</Text>
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
