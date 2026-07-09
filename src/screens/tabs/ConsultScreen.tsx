import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { callOpenAI, OpenAIChatError, type OpenAIMessage } from "../../api/openaiChat";
import { AppHeader } from "../../components/babylog/AppHeader";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { buildBabyLogConsultPrompt } from "../../utils/babyLogAIContext";
import { colors } from "../../theme";

const QUICK_CHIPS = [
  "오늘 수면 패턴 어때?",
  "수유 간격이 짧은데 괜찮아?",
  "이번 주 성장 요약해줘",
  "배변 이상 있어?",
];

type Props = {
  onOpenProfile: () => void;
};

export function ConsultScreen({ onOpenProfile }: Props) {
  const { careSetup, logs, diaryEntries, feedCount, diaperCount, sleepMinutes, chatHistory, pushChat } =
    useBabyLog();
  const { locale, t } = useLanguage();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const historyRef = useRef<OpenAIMessage[]>([]);

  const systemPrompt = useMemo(
    () =>
      buildBabyLogConsultPrompt({
        careSetup,
        logs,
        diaryEntries,
        feedCount,
        diaperCount,
        sleepMinutes,
        locale,
      }),
    [careSetup, logs, diaryEntries, feedCount, diaperCount, sleepMinutes, locale],
  );
  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    pushChat("user", trimmed);
    historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    setInput("");
    setIsTyping(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      const reply = await callOpenAI(historyRef.current, systemPromptRef.current);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      pushChat("ai", reply);
    } catch (error) {
      const message =
        error instanceof OpenAIChatError && error.code === "missing_api_key"
          ? t("aiChat.noApiKey")
          : t("aiChat.error");
      pushChat("ai", message);
    } finally {
      setIsTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {chatHistory.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, m.role === "user" && styles.userText]}>{m.text}</Text>
          </View>
        ))}
        {isTyping && (
          <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
            <ActivityIndicator size="small" color={colors.amber} />
            <Text style={styles.typingText}>답변 작성 중...</Text>
          </View>
        )}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {QUICK_CHIPS.map((chip) => (
          <Pressable key={chip} style={styles.chip} onPress={() => void send(chip)} disabled={isTyping}>
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="콩이에 대해 물어보세요..."
          placeholderTextColor={colors.faint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
          editable={!isTyping}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
          onPress={() => void send(input)}
          disabled={!input.trim() || isTyping}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.amber,
  },
  bubbleText: { fontSize: 13.5, lineHeight: 21, color: colors.text },
  userText: { color: colors.amberDark },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { fontSize: 13, color: colors.muted },
  chipsScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 18, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, lineHeight: 17, color: colors.muted, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendIcon: { color: colors.amberDark, fontSize: 16, fontWeight: "700" },
});
