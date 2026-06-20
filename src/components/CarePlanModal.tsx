import { CheckCircle, ShieldCheck, Sparkles, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CarePlan } from "../types/careFlow";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type CarePlanModalProps = {
  open: boolean;
  plan: CarePlan | null;
  onClose: () => void;
};

export function CarePlanModal({ open, plan, onClose }: CarePlanModalProps) {
  const { t } = useLanguage();

  if (!plan) return null;

  const rows = [
    { label: t("carePlan.child"), value: plan.childName },
    { label: t("carePlan.caregiver"), value: plan.caregiverName },
    { label: t("carePlan.schedule"), value: plan.schedule },
    { label: t("carePlan.rate"), value: plan.rate },
    { label: t("carePlan.startDate"), value: plan.startDate },
    { label: t("carePlan.languages"), value: plan.languages },
    {
      label: t("carePlan.dailyReport"),
      value: plan.dailyReportEnabled ? t("carePlan.enabled") : t("carePlan.disabled"),
    },
  ];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.titleRow}>
            <Sparkles size={18} color={colors.yellow} />
            <Text style={styles.title}>{t("carePlan.title")}</Text>
          </View>
          <Text style={styles.subtitle}>{t("carePlan.subtitle")}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {rows.map(({ label, value }) => (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>{t("carePlan.careNeeds")}</Text>
            <View style={styles.chips}>
              {plan.careNeeds.map((need) => (
                <Text key={need} style={styles.chip}>
                  {need}
                </Text>
              ))}
            </View>

            <View style={styles.sectionTitleRow}>
              <ShieldCheck size={14} color={colors.text} />
              <Text style={styles.sectionTitle}>{t("carePlan.safety")}</Text>
            </View>
            {plan.safetyItems.map((item) => (
              <View key={item} style={styles.safetyRow}>
                <CheckCircle size={14} color={colors.text} />
                <Text style={styles.safetyText}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 2, padding: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 16 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLabel: { fontSize: 14, color: colors.muted, flex: 1 },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1, textAlign: "right" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 20, marginBottom: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  safetyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  safetyText: { fontSize: 14, color: colors.muted, flex: 1 },
});
