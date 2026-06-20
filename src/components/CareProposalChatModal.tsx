import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  Globe,
  Send,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AI_DRAFT_MESSAGE,
  AI_SUGGESTED_MESSAGE,
  AI_TRANSLATE_DEMO,
} from "../demo/careFlow";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import { useCareFlow } from "../context/CareFlowContext";
import { useChat } from "../context/ChatContext";
import type { CarePlanAdjustForm } from "../types/careFlow";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { CarePlanAdjustModal } from "./CarePlanAdjustModal";
import {
  AgreementTracker,
  CarePlanDetailRow,
  CarePlanDraftCard,
  NegotiationItem,
} from "./CarePlanNegotiationBlocks";
import { ScheduleTrialModal } from "./ScheduleTrialModal";
import { colors, radius } from "../theme";

const SUGGESTION_CHIPS = [
  "chat.chipInfant",
  "chat.chipNap",
  "chat.chipBackground",
  "chat.chipTrial",
  "chat.chipReports",
] as const;

type CareProposalChatModalProps = {
  visible: boolean;
  caregiverId: number;
  onBackToProposals: () => void;
  onViewCarePlan: () => void;
  onGoHome: () => void;
};

export function CareProposalChatModal({
  visible,
  caregiverId,
  onBackToProposals,
  onViewCarePlan,
  onGoHome,
}: CareProposalChatModalProps) {
  const { locale, t } = useLanguage();
  const {
    matchStatus,
    matchConfirmed,
    activeRelationship,
    confirmParentMatch,
    simulateCaregiverConfirm,
    getNegotiation,
    initNegotiation,
    sendCarePlanUpdate,
    acceptCarePlanUpdate,
    askDarinOnUpdate,
    proposeTrialSession,
  } = useCareFlow();
  const { getThread, sendMessage, markThreadSaved, ensureProposalThread } = useChat();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [translatePreview, setTranslatePreview] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);

  const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId) ?? CAREGIVER_MATCHES[0];
  const negotiation = getNegotiation(caregiverId);
  const { draft, terms, items } = negotiation;
  const thread = getThread(caregiverId);
  const messages = thread?.messages ?? [];
  const isConfirmed = matchConfirmed && activeRelationship?.caregiverId === caregiverId;
  const suggestedMessage = locale === "ko" ? AI_SUGGESTED_MESSAGE.ko : AI_SUGGESTED_MESSAGE.en;

  useEffect(() => {
    if (!visible) return;
    initNegotiation(caregiverId);
    ensureProposalThread(caregiverId);
    setInput("");
    setTranslatePreview(null);
  }, [visible, caregiverId, initNegotiation, ensureProposalThread]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, items, visible, matchStatus]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(caregiverId, input.trim(), input.trim());
    setInput("");
    setTranslatePreview(null);
  };

  const handleSimulateCaregiver = () => {
    const id = simulateCaregiverConfirm();
    markThreadSaved(id);
  };

  const handleSendUpdate = (form: CarePlanAdjustForm) => {
    sendCarePlanUpdate(caregiverId, form);
    setAdjustOpen(false);
  };

  const handleProposeTrial = () => {
    proposeTrialSession(caregiverId, draft.trialSession ?? "Friday 4 PM");
    setTrialOpen(false);
  };

  const headerSubtitle = isConfirmed ? t("chat.savedChat") : t("chat.proposalDiscussion");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onBackToProposals}>
      <View style={[styles.root, { paddingTop: topInset }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <Pressable onPress={onBackToProposals} style={styles.backBtn} hitSlop={12}>
              <ChevronLeft size={22} color={colors.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Avatar src={caregiver.img} size={32} />
              <View style={styles.headerText}>
                <Text style={styles.headerName}>{caregiver.name}</Text>
                <Text style={styles.headerSub}>{headerSubtitle}</Text>
                {isConfirmed && (
                  <Text style={styles.headerExtra}>{t("negotiation.dailyReportsEnabled")}</Text>
                )}
              </View>
            </View>
            {isConfirmed ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{t("chat.activeRelationship")}</Text>
              </View>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <CarePlanDraftCard draft={draft} terms={terms} />
            <AgreementTracker terms={terms} />

            {messages.map((msg) => {
              const text = locale === "ko" ? msg.textKo : msg.textEn;
              if (msg.role === "ai") {
                return (
                  <View key={msg.id} style={styles.aiBlock}>
                    <View style={styles.aiLabelRow}>
                      <Sparkles size={12} color={colors.yellow} />
                      <Text style={styles.aiLabel}>Darin AI</Text>
                    </View>
                    <Text style={styles.aiText}>{text}</Text>
                  </View>
                );
              }
              const isParent = msg.role === "parent";
              return (
                <View key={msg.id} style={[styles.msgRow, isParent ? styles.msgRowParent : styles.msgRowCaregiver]}>
                  {!isParent && <Avatar src={caregiver.img} size={28} />}
                  <View style={[styles.bubble, isParent ? styles.bubbleParent : styles.bubbleCaregiver]}>
                    <Text style={[styles.bubbleText, isParent && styles.bubbleTextParent]}>{text}</Text>
                  </View>
                </View>
              );
            })}

            {items.map((item) => (
              <NegotiationItem
                key={item.id}
                item={item}
                caregiverImg={caregiver.img}
                onAccept={() => acceptCarePlanUpdate(caregiverId, item.id)}
                onCounter={() => setAdjustOpen(true)}
                onAskDarin={() => askDarinOnUpdate(caregiverId)}
              />
            ))}

            {!isConfirmed && (
              <View style={styles.suggestCard}>
                <Text style={styles.suggestLabel}>{t("chat.suggestedMessage")}</Text>
                <Text style={styles.suggestBody}>&ldquo;{suggestedMessage}&rdquo;</Text>
                <Pressable onPress={() => setInput(suggestedMessage)}>
                  <Text style={styles.suggestLink}>{t("chat.useSuggestion")}</Text>
                </Pressable>
              </View>
            )}

            {matchStatus === "parent_pending" && !isConfirmed && (
              <View style={styles.pendingCard}>
                <CheckCircle size={22} color={colors.yellow} />
                <Text style={styles.pendingTitle}>{t("chat.parentConfirmed")}</Text>
                <Text style={styles.pendingSub}>{t("chat.waitingCaregiver")}</Text>
                <Pressable style={styles.simulateBtn} onPress={handleSimulateCaregiver}>
                  <Text style={styles.simulateBtnText}>{t("chat.simulateCaregiver")}</Text>
                </Pressable>
              </View>
            )}

            {isConfirmed && activeRelationship && (
              <View style={styles.confirmedCard}>
                <View style={styles.confirmedHeader}>
                  <Sparkles size={16} color={colors.yellow} />
                  <Text style={styles.confirmedTitle}>{t("chat.matchConfirmedTitle")}</Text>
                </View>
                <Text style={styles.confirmedPair}>
                  {caregiver.name} ↔ {t("chat.emmaFamily")}
                </Text>
                <CarePlanDetailRow label={t("chat.schedule")} value={activeRelationship.schedule} />
                <CarePlanDetailRow label={t("chat.rate")} value={activeRelationship.rate} />
                {activeRelationship.trialSession && (
                  <CarePlanDetailRow label={t("chat.trial")} value={activeRelationship.trialSession} />
                )}
                <CarePlanDetailRow label={t("chat.startDate")} value={activeRelationship.startDate} />
                <CarePlanDetailRow label={t("chat.carePlan")} value={activeRelationship.careNeeds.join(", ")} />
                <CarePlanDetailRow label={t("chat.status")} value={t("chat.chatSaved")} />
                <Pressable style={styles.primaryAction} onPress={onBackToProposals}>
                  <Text style={styles.primaryActionText}>{t("chat.goActiveChat")}</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={onViewCarePlan}>
                  <Text style={styles.secondaryActionText}>{t("chat.viewCarePlan")}</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={onGoHome}>
                  <Text style={styles.secondaryActionText}>{t("chat.startDailyReports")}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          <View style={styles.composer}>
              {!isConfirmed && (
              <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {SUGGESTION_CHIPS.map((key) => (
                  <Pressable key={key} style={styles.chip} onPress={() => setInput(t(key))}>
                    <Text style={styles.chipText}>{t(key)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {translatePreview && (
                <View style={styles.translateBox}>
                  <Text style={styles.translateLabel}>{t("chat.translated")}</Text>
                  <Text style={styles.translateText}>{translatePreview}</Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsScroll}>
                <Pressable style={styles.toolBtn} onPress={() => setInput(locale === "ko" ? AI_DRAFT_MESSAGE.ko : AI_DRAFT_MESSAGE.en)}>
                  <Wand2 size={13} color={colors.text} />
                  <Text style={styles.toolText}>{t("chat.draftAI")}</Text>
                </Pressable>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => {
                    setInput(AI_TRANSLATE_DEMO.inputKo);
                    setTranslatePreview(AI_TRANSLATE_DEMO.outputEn);
                  }}
                >
                  <Globe size={13} color={colors.text} />
                  <Text style={styles.toolText}>{t("chat.translate")}</Text>
                </Pressable>
                <Pressable style={styles.toolBtn} onPress={() => setTrialOpen(true)}>
                  <Calendar size={13} color={colors.text} />
                  <Text style={styles.toolText}>{t("chat.scheduleTrial")}</Text>
                </Pressable>
                <Pressable style={styles.toolBtn} onPress={() => setAdjustOpen(true)}>
                  <SlidersHorizontal size={13} color={colors.text} />
                  <Text style={styles.toolText}>{t("negotiation.adjustCarePlan")}</Text>
                </Pressable>
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={t("chat.placeholder")}
                  placeholderTextColor={colors.muted}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!input.trim()}
                >
                  <Send size={18} color={input.trim() ? colors.primaryForeground : colors.muted} />
                </Pressable>
              </View>

              {matchStatus === "none" && (
                <Pressable style={styles.confirmBtn} onPress={confirmParentMatch}>
                  <Text style={styles.confirmBtnText}>{t("chat.confirmMatch")}</Text>
                </Pressable>
              )}
              </>
              )}

              {isConfirmed && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsScroll}>
                  <Pressable style={styles.toolBtn} onPress={() => setTrialOpen(true)}>
                    <Calendar size={13} color={colors.text} />
                    <Text style={styles.toolText}>{t("chat.scheduleTrial")}</Text>
                  </Pressable>
                  <Pressable style={styles.toolBtn} onPress={() => setAdjustOpen(true)}>
                    <SlidersHorizontal size={13} color={colors.text} />
                    <Text style={styles.toolText}>{t("negotiation.adjustCarePlan")}</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
        </KeyboardAvoidingView>
      </View>

      <CarePlanAdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} onSend={handleSendUpdate} />
      <ScheduleTrialModal
        open={trialOpen}
        onClose={() => setTrialOpen(false)}
        onPropose={handleProposeTrial}
        suggestedTime={draft.trialSession ?? "Friday 4 PM"}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  headerText: { alignItems: "flex-start" },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  headerExtra: { fontSize: 10, color: colors.muted, marginTop: 2 },
  headerSpacer: { width: 40 },
  activeBadge: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    maxWidth: 110,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "700", color: colors.text },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
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
  trackerStatusActive: { color: colors.text, backgroundColor: colors.yellowSoft, paddingHorizontal: 8, borderRadius: radius.full, overflow: "hidden" },
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
  suggestCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  suggestLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  suggestBody: { fontSize: 14, lineHeight: 21, color: colors.text, fontStyle: "italic" },
  suggestLink: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 8, textDecorationLine: "underline" },
  pendingCard: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: "center",
  },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8, textAlign: "center" },
  pendingSub: { fontSize: 12, color: colors.muted, marginTop: 4, textAlign: "center" },
  simulateBtn: {
    marginTop: 12,
    width: "100%",
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  simulateBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  confirmedCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: radius.xl,
    padding: 16,
  },
  confirmedHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  confirmedTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  confirmedPair: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 10 },
  primaryAction: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryActionText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  secondaryAction: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
  },
  secondaryActionText: { fontSize: 13, fontWeight: "600", color: colors.text },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  chips: { gap: 8, paddingRight: 8, marginBottom: 10 },
  chip: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: { fontSize: 11, fontWeight: "600", color: colors.text },
  translateBox: { backgroundColor: colors.yellowSoft, borderRadius: radius.md, padding: 10, marginBottom: 10 },
  translateLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginBottom: 4 },
  translateText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  toolsScroll: { gap: 8, paddingRight: 8, marginBottom: 10 },
  toolBtn: {
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
  toolText: { fontSize: 10, fontWeight: "600", color: colors.text },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.text, maxHeight: 120, paddingVertical: 8 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
});
