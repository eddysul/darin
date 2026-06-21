import { useEffect, useRef, useState } from "react";
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
import { colors, radius } from "../theme";
import type { DailyReport } from "../types/dailyReport";
import type { Locale } from "../i18n";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

function buildSystemPrompt(report: DailyReport | null, locale: Locale): string {
  const isKo = locale === "ko";
  const langInstruction = isKo
    ? "Always respond in Korean (한국어로만 답변하세요)."
    : "Always respond in English.";

  const base = `You are Darin AI, a friendly childcare advisor built into the Darin app.
You help parents understand their child's daily care reports and give practical childcare advice.
Keep responses concise (2-4 sentences). ${langInstruction}`;

  if (!report) {
    const noDataNote = isKo
      ? "현재 아이에 대한 리포트가 부족합니다. 정확한 상담을 원하시면 Log 탭에서 리포트를 작성해 주세요."
      : "There is currently not enough report data for your child. For accurate advice, please create a report in the Log tab.";

    return `${base}

IMPORTANT: You do NOT have any report data for this child yet.
Always start every response with exactly this sentence: "${noDataNote}"
Then provide a helpful general answer after that.`;
  }

  return `${base}

You have access to today's care report for ${report.child}:
- Date: ${report.date}
- Caregiver: ${report.caregiver}
- Report (EN): ${report.reportEn}
- Report (KO): ${report.reportKo}
${report.details ? `- Care details: ${report.details.map((d) => `${d.type}: ${d.value}`).join(", ")}` : ""}

Use this report data to give personalized, specific advice.`;
}

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callOpenAI(history: OpenAIMessage[], systemPrompt: string): Promise<string> {
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
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

type Props = {
  onClose: () => void;
};

export function AIChatScreen({ onClose }: Props) {
  const { dailyReport } = useApp();
  const { locale } = useLanguage();
  const topInset = useScreenTopInset(8);
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const greeting = locale === "ko"
    ? "안녕하세요! Darin AI 상담사입니다. 아이의 돌봄 리포트를 바탕으로 궁금한 점이 있으시면 무엇이든 물어보세요."
    : "Hi! I'm Darin AI, your childcare advisor. Feel free to ask me anything about your child's care reports.";
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "ai", text: greeting },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const nextId = useRef(1);
  const historyRef = useRef<OpenAIMessage[]>([]);
  const systemPrompt = buildSystemPrompt(dailyReport, locale);

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
      const reply = await callOpenAI(historyRef.current, systemPrompt);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "ai", text: "죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.aiAvatar}>
            <Sparkles size={16} color={colors.yellow} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI 상담</Text>
            <Text style={styles.headerSub}>Darin AI · 항상 온라인</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
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

      {/* Input */}
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
