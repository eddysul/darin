import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  Globe,
  Send,
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
import { useChat } from "../context/ChatContext";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { colors, radius } from "../theme";

const SUGGESTION_CHIPS = [
  "chat.chipInfant",
  "chat.chipNap",
  "chat.chipBackground",
  "chat.chipTrial",
  "chat.chipReports",
] as const;

type CareChatScreenProps = {
  visible: boolean;
  caregiverId?: number;
  onClose: () => void;
};

export function CareChatScreen({ visible, caregiverId = 1, onClose }: CareChatScreenProps) {
  const { locale, t } = useLanguage();
  const { getThread, sendMessage } = useChat();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [translatePreview, setTranslatePreview] = useState<string | null>(null);

  const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId) ?? CAREGIVER_MATCHES[0];
  const thread = getThread(caregiverId);
  const messages = thread?.messages ?? [];
  const savedChat = thread?.savedChat ?? false;
  const suggestedMessage = locale === "ko" ? AI_SUGGESTED_MESSAGE.ko : AI_SUGGESTED_MESSAGE.en;

  useEffect(() => {
    if (!visible) return;
    setInput("");
    setTranslatePreview(null);
  }, [visible, caregiverId]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, visible]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(caregiverId, input.trim(), input.trim());
    setInput("");
    setTranslatePreview(null);
  };

  const handleDraftAI = () => {
    setInput(locale === "ko" ? AI_DRAFT_MESSAGE.ko : AI_DRAFT_MESSAGE.en);
  };

  const handleTranslate = () => {
    setInput(AI_TRANSLATE_DEMO.inputKo);
    setTranslatePreview(AI_TRANSLATE_DEMO.outputEn);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: topInset }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Avatar src={caregiver.img} size={32} />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{caregiver.name}</Text>
              <Text style={styles.headerSub}>
                {savedChat ? t("chat.savedChat") : t("chat.negotiationSpace")}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              <View key={msg.id} style={[styles.row, isParent ? styles.rowParent : styles.rowCaregiver]}>
                {!isParent && <Avatar src={caregiver.img} size={28} />}
                <View style={[styles.bubble, isParent ? styles.bubbleParent : styles.bubbleCaregiver]}>
                  <Text style={[styles.bubbleText, isParent && styles.bubbleTextParent]}>{text}</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.suggestCard}>
            <Text style={styles.suggestLabel}>{t("chat.suggestedMessage")}</Text>
            <Text style={styles.suggestBody}>&ldquo;{suggestedMessage}&rdquo;</Text>
            <Pressable onPress={() => setInput(suggestedMessage)}>
              <Text style={styles.suggestLink}>{t("chat.useSuggestion")}</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
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

          <View style={styles.toolsRow}>
            <Pressable style={styles.toolBtn} onPress={handleDraftAI}>
              <Wand2 size={13} color={colors.text} />
              <Text style={styles.toolText}>{t("chat.draftAI")}</Text>
            </Pressable>
            <Pressable style={styles.toolBtn} onPress={handleTranslate}>
              <Globe size={13} color={colors.text} />
              <Text style={styles.toolText}>{t("chat.translate")}</Text>
            </Pressable>
            <Pressable style={styles.toolBtn}>
              <Calendar size={13} color={colors.text} />
              <Text style={styles.toolText}>{t("chat.scheduleTrial")}</Text>
            </Pressable>
          </View>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  headerText: { alignItems: "center" },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  headerSpacer: { width: 40 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  row: { flexDirection: "row", gap: 8, maxWidth: "100%" },
  rowParent: { justifyContent: "flex-end" },
  rowCaregiver: { justifyContent: "flex-start", alignItems: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
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
    alignSelf: "stretch",
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
  chipsScroll: { maxHeight: 36, marginBottom: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: { fontSize: 11, fontWeight: "600", color: colors.text },
  translateBox: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
  },
  translateLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginBottom: 4 },
  translateText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  toolsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
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
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    maxHeight: 120,
    paddingVertical: 8,
  },
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
