import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronLeft, Send, Sparkles } from "lucide-react-native";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import {
  buildAIChatSystemPrompt,
  mergeReportsForAI,
} from "../utils/aiReportContext";
import { hydrateEventStore, loadEventStore } from "../utils/eventStore";
import { hydrateReportStore, loadReportHistory } from "../utils/reportStore";
import { colors, radius } from "../theme";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

class AIChatRequestError extends Error {
  constructor(
    message: string,
    readonly code: "missing_api_key" | "api_error",
  ) {
    super(message);
    this.name = "AIChatRequestError";
  }
}

async function callOpenAI(history: OpenAIMessage[], systemPrompt: string): Promise<string> {
  if (!OPENAI_API_KEY.trim()) {
    throw new AIChatRequestError("Missing EXPO_PUBLIC_OPENAI_API_KEY", "missing_api_key");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...history],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new AIChatRequestError(`OpenAI error ${res.status}: ${detail.slice(0, 120)}`, "api_error");
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

type Props = {
  onClose: () => void;
};

export function AIChatScreen({ onClose }: Props) {
  const { dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [contextVersion, setContextVersion] = useState(0);
  const greeting = locale === "ko"
    ? "안녕하세요! Darin AI 상담사입니다. 아이의 돌봄 리포트를 바탕으로 궁금한 점이 있으시면 무엇이든 물어보세요."
    : "Hi! I'm Darin AI, your childcare advisor. Feel free to ask me anything about your child's care reports.";
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "ai", text: greeting },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const nextId = useRef(1);
  const historyRef = useRef<OpenAIMessage[]>([]);

  const systemPrompt = useMemo(() => {
    const reports = mergeReportsForAI(dailyReport, loadReportHistory());
    return buildAIChatSystemPrompt({
      reports,
      eventStore: loadEventStore(),
      locale,
    });
  }, [dailyReport, locale, contextVersion]);

  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;

  useEffect(() => {
    void Promise.all([hydrateEventStore(), hydrateReportStore()]).then(() => {
      setContextVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    if (!dailyReport) return;
    setContextVersion((v) => v + 1);
  }, [dailyReport?.id, dailyReport?.savedAt, dailyReport?.reportEn, dailyReport?.reportKo]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    const userMsg: Message = { id: nextId.current++, role: "user", text };
    historyRef.current = [...historyRef.current, { role: "user", content: text }];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const reply = await callOpenAI(historyRef.current, systemPromptRef.current);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", text: reply }]);
    } catch (error) {
      const text =
        error instanceof AIChatRequestError && error.code === "missing_api_key"
          ? t("aiChat.noApiKey")
          : t("aiChat.error");
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "ai", text },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: topInset }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.aiAvatar}>
            <Sparkles size={16} color={colors.yellow} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{t("aiChat.title")}</Text>
            <Text style={styles.headerSub}>{t("aiChat.subtitle")}</Text>
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
        {messages.map((msg) =>
          msg.role === "ai" ? (
            <View key={msg.id} style={styles.aiRow}>
              <View style={styles.aiAvatarSmall}>
                <Sparkles size={12} color={colors.yellow} />
              </View>
              <View style={styles.aiBubble}>
                <Text style={styles.aiBubbleText}>{msg.text}</Text>
              </View>
            </View>
          ) : (
            <View key={msg.id} style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{msg.text}</Text>
              </View>
            </View>
          ),
        )}

        {isTyping && (
          <View style={styles.aiRow}>
            <View style={styles.aiAvatarSmall}>
              <Sparkles size={12} color={colors.yellow} />
            </View>
            <View style={styles.aiBubble}>
              <Text style={styles.typingDots}>· · ·</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={locale === "ko" ? "궁금한 점을 물어보세요..." : "Ask me anything..."}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => { void handleSend(); }}
            disabled={!input.trim() || isTyping}
          >
            <Send size={18} color={input.trim() && !isTyping ? colors.primaryForeground : colors.muted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  headerSpacer: { width: 40 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  aiRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", maxWidth: "85%" },
  aiAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiBubble: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
  },
  aiBubbleText: { fontSize: 14, lineHeight: 22, color: colors.text },
  typingDots: { fontSize: 18, color: colors.muted, letterSpacing: 2 },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  userBubble: {
    backgroundColor: colors.black,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "80%",
  },
  userBubbleText: { fontSize: 14, lineHeight: 22, color: colors.primaryForeground },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
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
