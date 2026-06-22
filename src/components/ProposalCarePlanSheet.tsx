import { Calendar, ClipboardList, SlidersHorizontal, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { AgreementTerms, CarePlanDraft, TermStatus } from "../types/careFlow";
import { CarePlanDetailRow } from "./CarePlanNegotiationBlocks";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
  draft: CarePlanDraft;
  terms: AgreementTerms;
  onEditPlan: () => void;
  onScheduleTrial: () => void;
};

function termLabel(status: TermStatus, t: ReturnType<typeof useLanguage>["t"]) {
  if (status === "agreed") return t("negotiation.statusAgreed");
  if (status === "discussing") return t("negotiation.statusDiscussing");
  return t("negotiation.statusNeedsConfirmation");
}

export function ProposalCarePlanSheet({
  open,
  onClose,
  draft,
  terms,
  onEditPlan,
  onScheduleTrial,
}: Props) {
  const { t } = useLanguage();
  const trialDisplay = draft.trialSession ?? t("negotiation.trialNotScheduled");

  const dailyReportLanguage = draft.dailyReportIncluded
    ? `${t("carePlan.languages")}: Korean / English · ${termLabel(terms.dailyReportLanguage, t)}`
    : t("carePlan.disabled");

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ClipboardList size={18} color={colors.text} />
              <Text style={styles.title}>{t("carePlan.title")}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t("proposalCare.subtitle")}</Text>

          <View style={styles.fields}>
            <CarePlanDetailRow label={t("chat.schedule")} value={draft.schedule} />
            <CarePlanDetailRow label={t("chat.rate")} value={draft.rate} />
            <CarePlanDetailRow label={t("negotiation.trialSession")} value={trialDisplay} />
            <CarePlanDetailRow label={t("chat.startDate")} value={draft.startDate} />
            <CarePlanDetailRow label={t("carePlan.careNeeds")} value={draft.careNeeds.join(", ")} />
            <CarePlanDetailRow label={t("negotiation.termDailyReport")} value={dailyReportLanguage} />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                onClose();
                onEditPlan();
              }}
            >
              <SlidersHorizontal size={15} color={colors.text} />
              <Text style={styles.actionBtnText}>{t("proposalCare.editPlan")}</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                onClose();
                onScheduleTrial();
              }}
            >
              <Calendar size={15} color={colors.text} />
              <Text style={styles.actionBtnText}>{t("chat.scheduleTrial")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 },
  fields: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 12,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
});
