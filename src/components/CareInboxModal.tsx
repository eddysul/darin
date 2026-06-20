import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  MessageCircle,
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

type CareInboxModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Open directly to a thread (e.g. from Find proposals). Back closes the modal. */
  startThreadId?: number | null;
  directThread?: boolean;
};

type Step = "list" | "thread";

export function CareInboxModal({
  visible,
  onClose,
  startThreadId = null,
  directThread = false,
}: CareInboxModalProps) {
  const { locale, t } = useLanguage();
  const {
    matchConfirmed,
    activeRelationship,
    acceptedProposalId,
    getNegotiation,
    initNegotiation,
    sendCarePlanUpdate,
    acceptCarePlanUpdate,
    askDarinOnUpdate,
    proposeTrialSession,
  } = useCareFlow();
  const { threads, getPreview, getThread, sendMessage } = useChat();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>("list");
  const [threadId, setThreadId] = useState(1);
  const [input, setInput] = useState("");
  const [translatePreview, setTranslatePreview] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);

  const caregiver = CAREGIVER_MATCHES.find((c) => c.id === threadId) ?? CAREGIVER_MATCHES[0];
  const negotiation = getNegotiation(threadId);
  const { draft, terms, items } = negotiation;
  const thread = getThread(threadId);
  const messages = thread?.messages ?? [];
  const savedChat = thread?.savedChat ?? false;
  const isActiveCare =
    matchConfirmed && activeRelationship?.caregiverId === threadId && savedChat;
  const showNegotiation =
    isActiveCare || acceptedProposalId === threadId || items.length > 0;
  const suggestedMessage = locale === "ko" ? AI_SUGGESTED_MESSAGE.ko : AI_SUGGESTED_MESSAGE.en;

  useEffect(() => {
    if (!visible) return;
    if (startThreadId != null) {
      setThreadId(startThreadId);
      setStep("thread");
    } else {
      setStep("list");
    }
    setInput("");
    setTranslatePreview(null);
  }, [visible, startThreadId]);

  useEffect(() => {
    if (!visible || step !== "thread") return;
    initNegotiation(threadId);
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, items, visible, step, threadId, initNegotiation]);

  const handleClose = () => {
    setStep("list");
    onClose();
  };

  const handleBack = () => {
    if (step === "thread" && (directThread || startThreadId != null)) {
      handleClose();
      return;
    }
    if (step === "thread") {
      setStep("list");
      return;
    }
    handleClose();
  };

  const openThread = (id: number) => {
    setThreadId(id);
    setInput("");
    setTranslatePreview(null);
    setStep("thread");
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(threadId, input.trim(), input.trim());
    setInput("");
    setTranslatePreview(null);
  };

  const handleSendUpdate = (form: CarePlanAdjustForm) => {
    sendCarePlanUpdate(threadId, form);
    setAdjustOpen(false);
  };

  const handleProposeTrial = () => {
    proposeTrialSession(threadId, draft.trialSession ?? "Friday 4 PM");
    setTrialOpen(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <View style={[styles.root, { paddingTop: topInset }]}>
        {step === "list" ? (
          <>
            <View style={styles.header}>
              <Pressable onPress={handleClose} style={styles.backBtn} hitSlop={12}>
                <ChevronLeft size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.headerTitle}>{t("chat.inboxTitle")}</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
              {threads.map((item) => {
                const c = CAREGIVER_MATCHES.find((x) => x.id === item.caregiverId);
                if (!c) return null;
                const preview = getPreview(item.caregiverId, locale);
                const time = locale === "ko" ? item.updatedAtKo : item.updatedAtEn;

                return (
                  <Pressable
                    key={item.caregiverId}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => openThread(item.caregiverId)}
                  >
                    <Avatar src={c.img} size={52} />
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName}>{c.name}</Text>
                        <Text style={styles.rowTime}>{time}</Text>
                      </View>
                      <Text style={styles.rowPreview} numberOfLines={2}>
                        {preview}
                      </Text>
                      {item.savedChat && (
                        <Text style={styles.rowBadge}>{t("chat.savedChat")}</Text>
                      )}
                    </View>
                    <ChevronRight size={16} color={colors.muted} />
                  </Pressable>
                );
              })}

              {threads.length === 0 && (
                <View style={styles.empty}>
                  <MessageCircle size={32} color={colors.muted} />
                  <Text style={styles.emptyText}>{t("chat.emptyInbox")}</Text>
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={styles.header}>
              <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
                <ChevronLeft size={22} color={colors.text} />
              </Pressable>
              <View style={styles.headerCenter}>
                <Avatar src={caregiver.img} size={32} />
                <View style={styles.headerText}>
                  <Text style={styles.headerName}>{caregiver.name}</Text>
                  <Text style={styles.headerSub}>
                    {isActiveCare
                      ? t("chat.savedChat")
                      : savedChat
                        ? t("chat.savedChat")
                        : t("chat.proposalDiscussion")}
                  </Text>
                </View>
              </View>
              {isActiveCare && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{t("chat.activeRelationship")}</Text>
                </View>
              )}
              {!isActiveCare && <View style={styles.headerSpacer} />}
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {showNegotiation && (
                <>
                  <CarePlanDraftCard draft={draft} terms={terms} />
                  <AgreementTracker terms={terms} />
                </>
              )}

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

              {showNegotiation &&
                items.map((item) => (
                  <NegotiationItem
                    key={item.id}
                    item={item}
                    caregiverImg={caregiver.img}
                    onAccept={() => acceptCarePlanUpdate(threadId, item.id)}
                    onCounter={() => setAdjustOpen(true)}
                    onAskDarin={() => askDarinOnUpdate(threadId)}
                  />
                ))}

              {!isActiveCare && (
              <View style={styles.suggestCard}>
                <Text style={styles.suggestLabel}>{t("chat.suggestedMessage")}</Text>
                <Text style={styles.suggestBody}>&ldquo;{suggestedMessage}&rdquo;</Text>
                <Pressable onPress={() => setInput(suggestedMessage)}>
                  <Text style={styles.suggestLink}>{t("chat.useSuggestion")}</Text>
                </Pressable>
              </View>
              )}
            </ScrollView>

            <View style={styles.composer}>
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsRow}>
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
                {showNegotiation && (
                  <Pressable style={styles.toolBtn} onPress={() => setAdjustOpen(true)}>
                    <SlidersHorizontal size={13} color={colors.text} />
                    <Text style={styles.toolText}>{t("negotiation.adjustCarePlan")}</Text>
                  </Pressable>
                )}
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
            </View>
          </KeyboardAvoidingView>
        )}
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.text },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  headerText: { alignItems: "center" },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
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
  list: { flex: 1 },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowPressed: { backgroundColor: colors.backgroundSecondary },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  rowTime: { fontSize: 12, color: colors.muted, flexShrink: 0 },
  rowPreview: { fontSize: 14, color: colors.muted, marginTop: 4, lineHeight: 20 },
  rowBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: colors.muted },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 14 },
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
  suggestCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 4,
  },
  suggestLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  suggestBody: { fontSize: 14, lineHeight: 21, color: colors.text, fontStyle: "italic" },
  suggestLink: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 8, textDecorationLine: "underline" },
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
  toolsRow: { flexDirection: "row", gap: 8, marginBottom: 10, paddingRight: 8 },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
});
