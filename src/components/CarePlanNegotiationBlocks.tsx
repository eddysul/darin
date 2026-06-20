import { CheckCircle, ClipboardList, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AgreementTerms, CarePlanDraft, NegotiationChatItem, TermStatus } from "../types/careFlow";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { colors, radius } from "../theme";

export function CarePlanDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function CarePlanDraftCard({ draft, terms }: { draft: CarePlanDraft; terms: AgreementTerms }) {
  const { t } = useLanguage();
  return (
    <View style={styles.draftCard}>
      <View style={styles.draftTitleRow}>
        <ClipboardList size={14} color={colors.text} />
        <Text style={styles.draftTitle}>{t("negotiation.draftTitle")}</Text>
      </View>
      <CarePlanDetailRow label={t("carePlan.child")} value={draft.childName} />
      <CarePlanDetailRow label={t("carePlan.caregiver")} value={draft.caregiverName} />
      <CarePlanDetailRow label={t("chat.schedule")} value={draft.schedule} />
      <CarePlanDetailRow label={t("chat.rate")} value={draft.rate} />
      <CarePlanDetailRow label={t("chat.startDate")} value={draft.startDate} />
      <CarePlanDetailRow label={t("chat.carePlan")} value={draft.careNeeds.join(", ")} />
      <CarePlanDetailRow
        label={t("negotiation.trialSession")}
        value={draft.trialSession ?? t("negotiation.trialNotScheduled")}
      />
      <View style={styles.statusChips}>
        {terms.schedule === "agreed" && (
          <Text style={styles.statusChip}>{t("negotiation.chipScheduleAgreed")}</Text>
        )}
        {terms.rate === "discussing" && (
          <Text style={[styles.statusChip, styles.statusChipHighlight]}>{t("negotiation.chipRateDiscussing")}</Text>
        )}
        {terms.trialSession !== "agreed" && (
          <Text style={[styles.statusChip, styles.statusChipHighlight]}>{t("negotiation.chipTrialNeeded")}</Text>
        )}
        {draft.dailyReportIncluded && (
          <Text style={styles.statusChip}>{t("negotiation.chipDailyReport")}</Text>
        )}
      </View>
    </View>
  );
}

export function AgreementTracker({ terms }: { terms: AgreementTerms }) {
  const { t } = useLanguage();
  const rows: { label: string; status: TermStatus }[] = [
    { label: t("negotiation.termSchedule"), status: terms.schedule },
    { label: t("negotiation.termCareScope"), status: terms.careScope },
    { label: t("negotiation.termDailyReport"), status: terms.dailyReportLanguage },
    { label: t("negotiation.termRate"), status: terms.rate },
    { label: t("negotiation.termTrial"), status: terms.trialSession },
  ];

  return (
    <View style={styles.trackerCard}>
      <Text style={styles.trackerTitle}>{t("negotiation.trackerTitle")}</Text>
      {rows.map(({ label, status }) => (
        <View key={label} style={styles.trackerRow}>
          <Text style={styles.trackerLabel}>{label}</Text>
          <Text style={[styles.trackerStatus, status !== "agreed" && styles.trackerStatusActive]}>
            {statusLabel(status, t)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function NegotiationItem({
  item,
  caregiverImg,
  onAccept,
  onCounter,
  onAskDarin,
}: {
  item: NegotiationChatItem;
  caregiverImg: string;
  onAccept: () => void;
  onCounter: () => void;
  onAskDarin: () => void;
}) {
  const { locale, t } = useLanguage();
  const text = locale === "ko" ? item.textKo : item.textEn;

  if (item.type === "care_plan_update" && item.update) {
    const u = item.update;
    return (
      <View style={styles.updateCard}>
        <Text style={styles.updateTitle}>{t("negotiation.updateTitle")}</Text>
        <Text style={styles.updateSection}>{t("negotiation.updatedTerms")}</Text>
        <CarePlanDetailRow label={t("chat.trial")} value={u.trialSession} />
        <CarePlanDetailRow label={t("chat.rate")} value={u.rate} />
        <CarePlanDetailRow label={t("chat.schedule")} value={u.schedule} />
        <CarePlanDetailRow
          label={t("negotiation.needReports")}
          value={u.careNeeds.includes("bilingual daily reports") ? "included" : "—"}
        />
        {u.status === "pending" && (
          <View style={styles.updateActions}>
            <Pressable style={styles.updateBtn} onPress={onAccept}>
              <Text style={styles.updateBtnText}>{t("negotiation.accept")}</Text>
            </Pressable>
            <Pressable style={styles.updateBtn} onPress={onCounter}>
              <Text style={styles.updateBtnText}>{t("negotiation.counter")}</Text>
            </Pressable>
            <Pressable style={[styles.updateBtn, styles.updateBtnAccent]} onPress={onAskDarin}>
              <Sparkles size={11} color={colors.text} />
              <Text style={styles.updateBtnText}>{t("negotiation.askDarin")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (item.type === "ai_summary") {
    return (
      <View style={styles.aiBlock}>
        <View style={styles.aiLabelRow}>
          <Sparkles size={12} color={colors.yellow} />
          <Text style={styles.aiLabel}>{t("negotiation.aiSummaryTitle")}</Text>
        </View>
        <Text style={styles.aiText}>{text}</Text>
      </View>
    );
  }

  if (item.type === "system") {
    return (
      <View style={styles.systemCard}>
        <CheckCircle size={14} color={colors.yellow} />
        <Text style={styles.systemText}>{text}</Text>
      </View>
    );
  }

  const isParent = item.role === "parent";
  return (
    <View style={[styles.msgRow, isParent ? styles.msgRowParent : styles.msgRowCaregiver]}>
      {!isParent && item.role === "caregiver" && <Avatar src={caregiverImg} size={28} />}
      <View style={[styles.bubble, isParent ? styles.bubbleParent : styles.bubbleCaregiver]}>
        <Text style={[styles.bubbleText, isParent && styles.bubbleTextParent]}>{text}</Text>
      </View>
    </View>
  );
}

function statusLabel(status: TermStatus, t: ReturnType<typeof useLanguage>["t"]) {
  if (status === "agreed") return t("negotiation.statusAgreed");
  if (status === "discussing") return t("negotiation.statusDiscussing");
  return t("negotiation.statusNeedsConfirmation");
}

const styles = StyleSheet.create({
  draftCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  draftTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  draftTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  detailLabel: { fontSize: 12, color: colors.muted, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: "600", color: colors.text, flex: 1.2, textAlign: "right" },
  statusChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  statusChip: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusChipHighlight: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  trackerCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  trackerTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 10 },
  trackerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  trackerLabel: { fontSize: 12, color: colors.muted },
  trackerStatus: { fontSize: 12, fontWeight: "600", color: colors.text },
  trackerStatusActive: {
    color: colors.text,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  updateCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  updateTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
  updateSection: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8 },
  updateActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  updateBtnAccent: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  updateBtnText: { fontSize: 11, fontWeight: "600", color: colors.text },
  systemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  systemText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  aiBlock: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  aiLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
  aiText: { fontSize: 14, lineHeight: 21, color: colors.text },
  msgRow: { flexDirection: "row", gap: 8, maxWidth: "100%" },
  msgRowParent: { justifyContent: "flex-end" },
  msgRowCaregiver: { justifyContent: "flex-start", alignItems: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleParent: { backgroundColor: colors.black, borderBottomRightRadius: 6 },
  bubbleCaregiver: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, color: colors.text },
  bubbleTextParent: { color: colors.primaryForeground },
});
