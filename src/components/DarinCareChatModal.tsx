import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Send, Sparkles, X } from "lucide-react-native";
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
  buildReportConsultationPayload,
  getMockConsultationResponse,
  REPORT_CONSULTATION_CHIPS,
} from "../demo/reportConsultation";
import { EMMA_CHILD_PROFILE } from "../demo/childProfile";
import type { CarePlan } from "../types/careFlow";
import type { DailyReport } from "../types/dailyReport";
import type { ConsultationMessage } from "../types/reportConsultation";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { useLanguage } from "../LanguageContext";
import { createId } from "../utils/id";
import { colors, radius } from "../theme";

type DarinCareChatModalProps = {
  visible: boolean;
  selectedReports: DailyReport[];
  activeCarePlan?: CarePlan | null;
  onClose: () => void;
};

export function DarinCareChatModal({
  visible,
  selectedReports,
  activeCarePlan = null,
  onClose,
}: DarinCareChatModalProps) {
  const { locale, t } = useLanguage();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);

  const childName = selectedReports[0]?.child ?? EMMA_CHILD_PROFILE.preferredName ?? "Emma";

  const contextLabel =
    selectedReports.length === 1
      ? t("darinChat.basedOnOne").replace("{date}", selectedReports[0].date)
      : t("darinChat.basedOnMany").replace("{count}", String(selectedReports.length));

  useEffect(() => {
    if (!visible) return;
    setInput("");
    setMessages([]);
  }, [visible, selectedReports]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, visible]);

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || selectedReports.length === 0) return;

    const userMessage: ConsultationMessage = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    const payload = buildReportConsultationPayload({
      childName,
      selectedReports,
      childProfile: EMMA_CHILD_PROFILE,
      activeCarePlan,
      userQuestion: trimmed,
    });

    const reply: ConsultationMessage = {
      id: createId(),
      role: "darin",
      text: getMockConsultationResponse(payload, locale),
    };

    setMessages((prev) => [...prev, userMessage, reply]);
    setInput("");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: topInset }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8}>
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t("darinChat.title")}</Text>
            <Text style={styles.headerSub}>{contextLabel}</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8}>
            <X size={20} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <View style={styles.introBadgeRow}>
              <Sparkles size={12} color={colors.yellow} />
              <Text style={styles.introBadge}>{t("darinChat.aiBadge")}</Text>
            </View>
            <Text style={styles.introText}>{t("darinChat.intro")}</Text>
          </View>

          {messages.map((msg) =>
            msg.role === "darin" ? (
              <View key={msg.id} style={styles.darinBlock}>
                <View style={styles.darinLabelRow}>
                  <Sparkles size={12} color={colors.yellow} />
                  <Text style={styles.darinLabel}>{t("darinChat.darin")}</Text>
                </View>
                <Text style={styles.darinText}>{msg.text}</Text>
              </View>
            ) : (
              <View key={msg.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.text}</Text>
                </View>
              </View>
            ),
          )}
        </ScrollView>

        <View style={styles.composer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {REPORT_CONSULTATION_CHIPS.map((key) => (
              <Pressable key={key} style={styles.chip} onPress={() => sendQuestion(t(key))}>
                <Text style={styles.chipText}>{t(key)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t("darinChat.placeholder")}
              placeholderTextColor={colors.muted}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={() => sendQuestion(input)}
              disabled={!input.trim()}
            >
              <Send size={16} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 12 },
  introCard: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.yellow,
    padding: 14,
  },
  introBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  introBadge: { fontSize: 11, fontWeight: "700", color: colors.text },
  introText: { fontSize: 14, lineHeight: 22, color: colors.text },
  darinBlock: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  darinLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  darinLabel: { fontSize: 11, fontWeight: "700", color: colors.text },
  darinText: { fontSize: 14, lineHeight: 22, color: colors.text },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "88%",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 14, lineHeight: 20, color: colors.primaryForeground },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingHorizontal: 16,
  },
  chips: { gap: 8, paddingBottom: 10 },
  chip: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
