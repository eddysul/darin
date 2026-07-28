import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HeightUnit, WeightUnit } from "../../types/appSettings";
import type { GrowthRecord } from "../../types/growthRecord";
import { colors, radius } from "../../theme";
import { formatWeight, lengthFromCm } from "../../utils/measurementFormat";
import { BabyLogIcon } from "./BabyLogIcon";

type Props = {
  visible: boolean;
  records: GrowthRecord[];
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (record: GrowthRecord) => void;
  onDelete: (id: string) => void;
};

function displayLength(value: number | undefined, unit: HeightUnit): string {
  if (value === undefined) return "-";
  return `${lengthFromCm(value, unit)}${unit === "inch" ? "in" : "cm"}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

export function GrowthRecordsManagerModal({
  visible,
  records,
  weightUnit,
  heightUnit,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const sorted = [...records].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

  const confirmDelete = (record: GrowthRecord) => {
    Alert.alert(
      "성장 기록을 삭제할까요?",
      "이 성장 기록만 삭제돼요. 돌봄 기록과 일기 원본에는 영향을 주지 않아요.",
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => onDelete(record.id) },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.headerSide} onPress={onClose}><Text style={styles.closeText}>닫기</Text></Pressable>
          <Text style={styles.headerTitle}>성장 기록 관리</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 34, 46) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}><BabyLogIcon kind="tab" tab="report" size={23} color="#69AFA0" /></View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>검진 때의 성장을 차곡차곡</Text>
              <Text style={styles.introBody}>병원이나 집에서 측정한 값만 기록하며 의료 판단은 제공하지 않아요.</Text>
            </View>
          </View>

          <Pressable style={styles.addButton} onPress={onAdd} accessibilityRole="button" accessibilityLabel="성장 기록 추가">
            <Text style={styles.addButtonText}>+ 성장 기록 추가</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>최근 성장 기록</Text>
            <Text style={styles.sectionCount}>{sorted.length}개</Text>
          </View>

          {sorted.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>아직 성장 기록이 없어요.</Text>
              <Text style={styles.emptyBody}>키·몸무게·머리둘레를 입력하면 최근 흐름을 한눈에 볼 수 있어요.</Text>
            </View>
          ) : sorted.map((record) => (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.date}>{displayDate(record.measuredAt)}</Text>
                  <Text style={styles.source}>{record.source === "hospital" ? "병원 측정" : "집에서 측정"}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable style={styles.smallButton} onPress={() => onEdit(record)}><Text style={styles.smallButtonText}>수정</Text></Pressable>
                  <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(record)}><Text style={styles.deleteText}>삭제</Text></Pressable>
                </View>
              </View>
              <View style={styles.metrics}>
                <Metric label="몸무게" value={record.weightKg === undefined ? "-" : formatWeight(record.weightKg, weightUnit)} />
                <Metric label="키" value={displayLength(record.heightCm, heightUnit)} />
                <Metric label="머리둘레" value={displayLength(record.headCircumferenceCm, heightUnit)} last />
              </View>
              {record.note ? <Text style={styles.note} numberOfLines={2}>{record.note}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Metric({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metric, last && styles.metricLast]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 16 },
  headerSide: { width: 64, minHeight: 44, justifyContent: "center" },
  closeText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 16, fontWeight: "800" },
  content: { padding: 18 },
  intro: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  introIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F5F0" },
  introCopy: { flex: 1 },
  introTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  introBody: { marginTop: 4, color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  addButton: { marginTop: 12, alignItems: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: colors.amber },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 9, paddingHorizontal: 2 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sectionCount: { color: colors.faint, fontSize: 11.5, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 34, paddingHorizontal: 24, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  emptyBody: { marginTop: 7, color: colors.faint, fontSize: 11.5, lineHeight: 17, textAlign: "center" },
  card: { marginBottom: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  date: { color: colors.text, fontSize: 14, fontWeight: "800" },
  source: { color: colors.faint, fontSize: 10.5, marginTop: 3 },
  cardActions: { flexDirection: "row", gap: 6 },
  smallButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  smallButtonText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  deleteButton: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.dangerText, fontSize: 11, fontWeight: "700" },
  metrics: { flexDirection: "row", marginTop: 14 },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: colors.border },
  metricLast: { borderRightWidth: 0 },
  metricLabel: { color: colors.faint, fontSize: 10.5 },
  metricValue: { width: "100%", marginTop: 5, color: colors.text, fontSize: 15, fontWeight: "800" },
  note: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
});
