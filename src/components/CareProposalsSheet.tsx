import { CheckCircle, Heart, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AI_COMPARISON_SUMMARY, CARE_PROPOSALS } from "../demo/careFlow";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import { useLanguage } from "../LanguageContext";
import { getBackgroundCheckLabel, isBackgroundCheckComplete } from "../utils/caregiverLabels";
import { Avatar } from "./Avatar";
import { colors, radius } from "../theme";

type CareProposalsSheetProps = {
  open: boolean;
  onClose: () => void;
  onViewProfile: (caregiverId: number) => void;
  onChat: (caregiverId: number) => void;
  onAccept: (caregiverId: number) => void;
  shortlisted: number[];
  onToggleShortlist: (caregiverId: number) => void;
};

export function CareProposalsSheet({
  open,
  onClose,
  onViewProfile,
  onChat,
  onAccept,
  shortlisted,
  onToggleShortlist,
}: CareProposalsSheetProps) {
  const { locale, t } = useLanguage();
  const summary = locale === "ko" ? AI_COMPARISON_SUMMARY.ko : AI_COMPARISON_SUMMARY.en;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.title}>{t("careRequest.proposalsReceived")}</Text>
          <Text style={styles.subtitle}>{t("proposals.subtitle")}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryBox}>
              <View style={styles.summaryLabelRow}>
                <Sparkles size={12} color={colors.yellow} />
                <Text style={styles.summaryLabel}>{t("proposals.aiSummary")}</Text>
              </View>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>

            {CARE_PROPOSALS.map((proposal) => {
              const caregiver = CAREGIVER_MATCHES.find((c) => c.id === proposal.caregiverId);
              if (!caregiver) return null;
              const message = locale === "ko" ? proposal.proposalMessageKo : proposal.proposalMessageEn;
              const careStyle = locale === "ko" ? proposal.careStyleKo : proposal.careStyleEn;
              const trustSummary = locale === "ko" ? proposal.trustSummaryKo : proposal.trustSummaryEn;
              const isShortlisted = shortlisted.includes(proposal.caregiverId);

              return (
                <View key={proposal.caregiverId} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Avatar src={caregiver.img} size={48} />
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{caregiver.name}</Text>
                        <Text style={styles.score}>{proposal.matchScore}% {t("match.matchScore")}</Text>
                      </View>
                      <Text style={styles.rate}>{proposal.rate}</Text>
                      <Text style={styles.meta}>{proposal.availability} · {proposal.languages}</Text>
                    </View>
                  </View>

                  <View style={styles.highlights}>
                    {proposal.highlights.map((h) => (
                      <View key={h} style={styles.highlightChip}>
                        {h.toLowerCase().includes("background") ? (
                          <ShieldCheck size={10} color={isBackgroundCheckComplete(proposal.backgroundCheckStatus) ? colors.text : colors.muted} />
                        ) : (
                          <CheckCircle size={10} color={colors.text} />
                        )}
                        <Text style={styles.highlightText}>
                          {h.toLowerCase().includes("background")
                            ? getBackgroundCheckLabel(proposal.backgroundCheckStatus, t)
                            : h}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>{t("proposals.trust")}</Text>
                    <Text style={styles.detailValue}>{trustSummary}</Text>
                  </View>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>{t("proposals.careStyle")}</Text>
                    <Text style={styles.detailValue}>{careStyle}</Text>
                  </View>

                  <Text style={styles.message}>&ldquo;{message}&rdquo;</Text>

                  <View style={styles.actions}>
                    <Pressable style={styles.actionBtn} onPress={() => onViewProfile(proposal.caregiverId)}>
                      <Text style={styles.actionBtnText}>{t("match.viewProfile")}</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => onChat(proposal.caregiverId)}>
                      <MessageCircle size={13} color={colors.text} />
                      <Text style={styles.actionBtnText}>{t("proposals.chat")}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, isShortlisted && styles.actionBtnActive]}
                      onPress={() => onToggleShortlist(proposal.caregiverId)}
                    >
                      <Heart size={13} color={isShortlisted ? colors.yellow : colors.text} fill={isShortlisted ? colors.yellow : "transparent"} />
                      <Text style={styles.actionBtnText}>{t("proposals.shortlist")}</Text>
                    </Pressable>
                    <Pressable style={styles.acceptBtn} onPress={() => onAccept(proposal.caregiverId)}>
                      <Text style={styles.acceptBtnText}>{t("proposals.accept")}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
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
    maxHeight: "94%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8, gap: 12 },
  summaryBox: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  summaryLabel: { fontSize: 12, fontWeight: "600", color: colors.text },
  summaryText: { fontSize: 13, lineHeight: 20, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 },
  score: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  rate: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 4 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  highlights: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  highlightChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  highlightText: { fontSize: 10, fontWeight: "500", color: colors.text },
  detailBlock: { marginTop: 8 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  detailValue: { fontSize: 11, color: colors.text, marginTop: 2, lineHeight: 16 },
  message: { fontSize: 12, color: colors.muted, fontStyle: "italic", marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionBtn: {
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
  actionBtnActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  actionBtnText: { fontSize: 11, fontWeight: "600", color: colors.text },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  acceptBtnText: { fontSize: 11, fontWeight: "600", color: colors.primaryForeground },
});
