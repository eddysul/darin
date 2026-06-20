import { ChevronLeft, Send } from "lucide-react-native";
import { useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import type { CaregiverMatch } from "../demo/caregivers";
import { getCaregiverAutoReply, getCaregiverChatThread, type ChatMessage } from "../demo/caregiverChats";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  caregiver: CaregiverMatch;
  onBack: () => void;
};

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CaregiverChatScreen({ caregiver, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  const { profile } = useApp();
  const ko = locale === "ko";
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => getCaregiverChatThread(caregiver.id));
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || replying) return;

    const parentMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      from: "parent",
      textEn: trimmed,
      textKo: trimmed,
      time: formatTime(),
    };

    setMessages((prev) => [...prev, parentMsg]);
    setDraft("");
    setReplying(true);

    setTimeout(() => {
      const reply = getCaregiverAutoReply(caregiver.id);
      const caregiverMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        from: "caregiver",
        textEn: reply.textEn,
        textKo: reply.textKo,
        time: formatTime(),
      };
      setMessages((prev) => [...prev, caregiverMsg]);
      setReplying(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 900);
  };

  const quickReplies = ko
    ? [
        "면접 일정 잡고 싶어요!",
        "상주 돌봄 가능한가요?",
        "감사합니다. 곧 연락드릴게요.",
      ]
    : [
        "I'd love to schedule an interview!",
        "Is live-in care available?",
        "Thank you! We'll be in touch soon.",
      ];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Avatar src={caregiver.img} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{caregiver.name}</Text>
          <Text style={styles.headerStatus}>{t("chat.online")}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.threadHint}>{t("chat.demoHint")}</Text>
        {messages.map((msg) => {
          const isParent = msg.from === "parent";
          const text = ko ? msg.textKo : msg.textEn;
          return (
            <View
              key={msg.id}
              style={[styles.bubbleRow, isParent ? styles.bubbleRowParent : styles.bubbleRowCaregiver]}
            >
              {!isParent && <Avatar src={caregiver.img} size={28} />}
              <View style={[styles.bubble, isParent ? styles.bubbleParent : styles.bubbleCaregiver]}>
                <Text style={[styles.bubbleText, isParent && styles.bubbleTextParent]}>{text}</Text>
                <Text style={[styles.bubbleTime, isParent && styles.bubbleTimeParent]}>{msg.time}</Text>
              </View>
              {isParent && <Avatar src={profile.avatar} size={28} />}
            </View>
          );
        })}
        {replying && (
          <View style={[styles.bubbleRow, styles.bubbleRowCaregiver]}>
            <Avatar src={caregiver.img} size={28} />
            <View style={[styles.bubble, styles.bubbleCaregiver, styles.typingBubble]}>
              <Text style={styles.typingText}>{t("chat.typing")}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.quickReplies}>
        {quickReplies.map((q) => (
          <Pressable key={q} style={styles.quickChip} onPress={() => sendMessage(q)}>
            <Text style={styles.quickChipText}>{q}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage(draft)}
          disabled={!draft.trim() || replying}
        >
          <Send size={18} color={colors.text} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerStatus: { fontSize: 12, color: colors.sage, marginTop: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  threadHint: {
    textAlign: "center",
    fontSize: 11,
    color: colors.muted,
    marginBottom: 16,
    backgroundColor: colors.champagne,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    alignSelf: "center",
    overflow: "hidden",
  },
  bubbleRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "flex-end" },
  bubbleRowParent: { justifyContent: "flex-end" },
  bubbleRowCaregiver: { justifyContent: "flex-start" },
  bubble: { maxWidth: "72%", borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleParent: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleCaregiver: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: colors.text },
  bubbleTextParent: { color: colors.text },
  bubbleTime: { fontSize: 10, color: colors.muted, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeParent: { color: "rgba(36,48,54,0.55)" },
  typingBubble: { paddingVertical: 12 },
  typingText: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
  quickReplies: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.champagne,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: { fontSize: 12, fontWeight: "500", color: colors.text },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
