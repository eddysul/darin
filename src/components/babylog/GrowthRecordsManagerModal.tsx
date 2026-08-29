import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HeightUnit, WeightUnit } from "../../types/appSettings";
import type { GrowthRecord } from "../../types/growthRecord";
import { colors, radius } from "../../theme";
import { formatWeight, lengthFromCm } from "../../utils/measurementFormat";
import { BabyLogIcon } from "./BabyLogIcon";
import { useLanguage } from "../../LanguageContext";

type Props = {
  visible?: boolean;
  embedded?: boolean;
  records: GrowthRecord[];
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  onClose: () => void;
  onDismiss?: () => void;
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
  visible = true,
  embedded = false,
  records,
  weightUnit,
  heightUnit,
  onClose,
  onDismiss,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const sorted = [...records].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

  const confirmDelete = (record: GrowthRecord) => {
    Alert.alert(
      t("growth.critical.114"),
      t("growth.critical.115"),
      [
        { text: t("growth.critical.066"), style: "cancel" },
        { text: t("growth.critical.036"), style: "destructive", onPress: () => onDelete(record.id) },
      ],
    );
  };

  const content = (
    <View style={styles.root}>
        {!embedded ? <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.headerSide} onPress={onClose}><Text style={styles.closeText}>{t("growth.critical.008")}</Text></Pressable>
          <Text style={styles.headerTitle}>{t("growth.critical.116")}</Text>
          <View style={styles.headerSide} />
        </View> : null}

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 34, 46) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}><BabyLogIcon kind="tab" tab="report" size={23} color="#69AFA0" /></View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>{t("growth.critical.117")}</Text>
              <Text style={styles.introBody}>{t("growth.critical.118")}</Text>
            </View>
          </View>

          <Pressable style={styles.addButton} onPress={onAdd} accessibilityRole="button" accessibilityLabel={t("growth.critical.095")}>
            <Text style={styles.addButtonText}>{t("growth.critical.119")}</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("growth.critical.120")}</Text>
            <Text style={styles.sectionCount}>{t("growth.critical.121", { count: sorted.length })}</Text>
          </View>

          {sorted.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t("growth.critical.122")}</Text>
              <Text style={styles.emptyBody}>{t("growth.critical.123")}</Text>
            </View>
          ) : sorted.map((record) => (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.date}>{displayDate(record.measuredAt)}</Text>
                  <Text style={styles.source}>{record.source === "hospital" ? t("growth.critical.124") : t("growth.critical.125")}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable style={styles.smallButton} onPress={() => onEdit(record)}><Text style={styles.smallButtonText}>{t("growth.critical.046")}</Text></Pressable>
                  <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(record)}><Text style={styles.deleteText}>{t("growth.critical.036")}</Text></Pressable>
                </View>
              </View>
              <View style={styles.metrics}>
                <Metric label={t("growth.critical.101")} value={record.weightKg === undefined ? "-" : formatWeight(record.weightKg, weightUnit)} />
                <Metric label={t("growth.critical.126")} value={displayLength(record.heightCm, heightUnit)} />
                <Metric label={t("growth.critical.104")} value={displayLength(record.headCircumferenceCm, heightUnit)} last />
              </View>
              {record.note ? <Text style={styles.note} numberOfLines={2}>{record.note}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>
  );

  if (embedded) return content;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      {content}
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
  addButton: { marginTop: 12, alignItems: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary },
  addButtonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "800" },
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
  smallButton: { minWidth: 52, minHeight: 44, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
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
