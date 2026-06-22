import { Baby, Calendar, CheckCircle, Globe, MapPin, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CareProposalModal, type CareProposalForm } from "../../components/CareProposalModal";
import { PressSlide } from "../../components/PressSlide";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { IncomingCareRequest } from "../../types/incomingCareRequest";
import { colors, radius } from "../../theme";

export function CaregiverFindView() {
  const { incomingCareRequests, markCareProposalSent } = useApp();
  const { locale, t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<IncomingCareRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openProposal = (request: IncomingCareRequest) => {
    setSelectedRequest(request);
    setProposalOpen(true);
  };

  const handleProposalSubmit = (_form: CareProposalForm) => {
    if (selectedRequest) markCareProposalSent(selectedRequest.id);
    setProposalOpen(false);
    setToast(t("caregiverFind.proposalSent"));
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <>
      <ScreenScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("caregiverFind.title")}</Text>
            <Text style={styles.subtitle}>{t("caregiverFind.subtitle")}</Text>
          </View>
          <View style={styles.aiBadge}>
            <Sparkles size={11} color={colors.yellow} />
            <Text style={styles.aiBadgeText}>{t("match.aiRecommended")}</Text>
          </View>
        </View>

        {incomingCareRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            expanded={expandedId === request.id}
            onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
            onCreateProposal={() => openProposal(request)}
          />
        ))}
      </ScreenScrollView>

      {toast && (
        <View style={styles.toast}>
          <CheckCircle size={16} color={colors.yellow} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <CareProposalModal
        open={proposalOpen}
        request={selectedRequest}
        onClose={() => setProposalOpen(false)}
        onSubmit={handleProposalSubmit}
      />
    </>
  );
}

function RequestCard({
  request,
  expanded,
  onToggle,
  onCreateProposal,
}: {
  request: IncomingCareRequest;
  expanded: boolean;
  onToggle: () => void;
  onCreateProposal: () => void;
}) {
  const { locale, t } = useLanguage();
  const sent = request.status === "proposal_sent";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Baby size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.familyName}>{request.familyName}</Text>
          <Text style={styles.childLine}>
            {request.childName}, {request.childAge}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={11} color={colors.muted} />
            <Text style={styles.meta}>{request.location}</Text>
          </View>
        </View>
        {sent && (
          <View style={styles.sentBadge}>
            <CheckCircle size={12} color={colors.yellow} />
            <Text style={styles.sentText}>{t("caregiverFind.proposalSent")}</Text>
          </View>
        )}
      </View>

      <View style={styles.scheduleRow}>
        <Calendar size={12} color={colors.muted} />
        <Text style={styles.meta}>{request.schedule}</Text>
        <Globe size={12} color={colors.muted} />
        <Text style={styles.meta}>{request.languages}</Text>
      </View>

      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailLabel}>{t("caregiverFind.careNeeds")}</Text>
          <View style={styles.chips}>
            {request.careNeeds.map((need) => (
              <Text key={need} style={styles.chip}>
                {need}
              </Text>
            ))}
          </View>
          <Text style={styles.detailLabel}>{t("caregiverFind.budget")}</Text>
          <Text style={styles.detailValue}>{request.budget}</Text>
          <Text style={styles.detailLabel}>{t("caregiverFind.startDate")}</Text>
          <Text style={styles.detailValue}>{request.startDate}</Text>
          <Text style={styles.detailLabel}>{t("caregiverFind.note")}</Text>
          <Text style={styles.note}>{request.note}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.viewBtn} onPress={onToggle}>
          <Text style={styles.viewBtnText}>
            {expanded ? (locale === "ko" ? "접기" : "Hide") : t("caregiverFind.viewRequest")}
          </Text>
        </Pressable>
        {!sent && (
          <PressSlide style={styles.proposalBtn} onPress={onCreateProposal}>
            <Text style={styles.proposalBtnText}>{t("caregiverFind.createProposal")}</Text>
          </PressSlide>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  headerText: { flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 4 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, flexShrink: 1 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  aiBadgeText: { fontSize: 11, fontWeight: "600", color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yellowSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  familyName: { fontSize: 15, fontWeight: "700", color: colors.text },
  childLine: { fontSize: 13, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  meta: { fontSize: 11, color: colors.muted, marginRight: 6 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  sentText: { fontSize: 10, fontWeight: "600", color: colors.text },
  details: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 6, marginTop: 8 },
  detailValue: { fontSize: 13, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  note: { fontSize: 13, lineHeight: 20, color: colors.text },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  viewBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
  },
  viewBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  proposalBtn: {
    flex: 1.2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  proposalBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  toast: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.lg,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 100,
  },
  toastText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
});
