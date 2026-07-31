import { useEffect, useMemo, useRef, useState } from "react";
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
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { callOpenAI, OpenAIChatError, type OpenAIMessage } from "../../api/openaiChat";
import { AppHeader } from "../../components/babylog/AppHeader";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { buildBabyLogConsultPrompt, buildCareContextPack } from "../../utils/babyLogAIContext";
import { EmptyState, ErrorState, LoadingState } from "../../components/states/FeedbackStates";
import { BabyStickerFromModel } from "../../components/babylog/BabyStickerView";
import { BabyStickerVaultModal } from "../../components/babylog/BabyStickerVaultModal";
import { colors } from "../../theme";
import { consumeQaFaultOnce } from "../../utils/qaDebug";

const QUICK_CHIPS = [
  "오늘 수면 괜찮아?",
  "수유량이 부족해?",
  "배변 패턴 어때?",
  "오늘 특이한 점 있어?",
];

const HAS_AI_SERVER = Boolean((process.env.EXPO_PUBLIC_TRANSCRIBE_URL ?? "").trim());

type ConsultRouteParams = {
  initialQuestion?: string;
};

type ConsultNav = BottomTabNavigationProp<
  { Consult: ConsultRouteParams; Record: undefined },
  "Consult"
>;

type Props = {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
};

export function ConsultScreen({ onOpenProfile, onOpenSettings }: Props) {
  const route = useRoute<RouteProp<{ Consult: ConsultRouteParams }, "Consult">>();
  const navigation = useNavigation<ConsultNav>();
  const {
    careSetup,
    logs,
    diaryEntries,
    chatHistory,
    pushChat,
    babyName,
    storageReady,
    babyStickers,
    addBabySticker,
    deleteBabySticker,
    logAuthor,
  } = useBabyLog();
  const { locale, t } = useLanguage();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const historyRef = useRef<OpenAIMessage[]>([]);
  const historySeeded = useRef(false);
  const requestInFlightRef = useRef(false);
  const consumedInitialRef = useRef<string | null>(null);

  const pack = useMemo(
    () => buildCareContextPack({ careSetup, logs, diaryEntries, locale }),
    [careSetup, logs, diaryEntries, locale],
  );

  const sparse = pack.todayLogCount === 0 || pack.weekLogCount < 3;

  // Restore OpenAI turn history from persisted chat after hydrate
  useEffect(() => {
    if (!storageReady || historySeeded.current) return;
    historySeeded.current = true;
    historyRef.current = chatHistory
      .filter((m) => m.id !== "greet-1")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));
  }, [storageReady, chatHistory]);

  const send = async (text: string, retry = false) => {
    const trimmed = text.trim();
    if (!trimmed || requestInFlightRef.current) return;

    if (sparse && /진단|약|병원|괜찮은지|심각한|응급/.test(trimmed) && pack.todayLogCount === 0) {
      pushChat("user", trimmed);
      pushChat(
        "ai",
        "오늘 기록이 거의 없어 판단하기 어려워요. 수유·수면·배변을 남긴 뒤 다시 물어보시면, 최근 기록 기준으로 더 정확히 말씀드릴게요. 고열·호흡곤란·반복 구토·처짐이 있으면 바로 소아과나 응급 진료를 권해요.",
      );
      return;
    }

    if (!retry) {
      pushChat("user", trimmed);
      historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    }
    setInput("");
    requestInFlightRef.current = true;
    setIsTyping(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    const prompt = buildBabyLogConsultPrompt({
      careSetup,
      logs,
      diaryEntries,
      locale,
      question: trimmed,
    });

    try {
      if (await consumeQaFaultOnce("ai")) {
        throw new OpenAIChatError("QA injected one-shot AI failure", "api_error");
      }
      const reply = await callOpenAI(historyRef.current, prompt);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      pushChat("ai", reply);
      setAiError(null);
      setFailedQuestion(null);
    } catch (error) {
      const message =
        error instanceof OpenAIChatError && error.code === "missing_api_key"
          ? t("aiChat.noApiKey")
          : t("aiChat.error");
      setAiError(message);
      setFailedQuestion(trimmed);
    } finally {
      requestInFlightRef.current = false;
      setIsTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Prefill from Record FAB prompt sheet (do not rewrite consult logic).
  useEffect(() => {
    if (!storageReady) return;
    const question = route.params?.initialQuestion?.trim();
    if (!question) return;
    if (consumedInitialRef.current === question) return;
    consumedInitialRef.current = question;
    void send(question);
    navigation.setParams({ initialQuestion: undefined });
    // Allow the same question to be asked again later from the prompt sheet.
    const clear = setTimeout(() => {
      consumedInitialRef.current = null;
    }, 500);
    return () => clearTimeout(clear);
  }, [storageReady, route.params?.initialQuestion]);

  if (!storageReady) {
    return (
      <View style={styles.root}>
        <AppHeader onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />
        <View style={styles.loadingBox}>
          <LoadingState label="상담 기록을 불러오는 중…" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <AppHeader onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />

      <Pressable style={styles.banner} onPress={() => setBannerOpen(true)}>
        <Text style={styles.bannerEyebrow}>AI가 참고 중</Text>
        <Text style={styles.bannerTitle}>
          {pack.babyName} · {pack.babyBirthMeta}
        </Text>
        <Text style={styles.bannerMeta}>
          오늘 기록 {pack.todayLogCount}개 · 최근 7일 기록 {pack.weekLogCount}개 · 일기 {pack.diaryCount}개
        </Text>
        <Text style={styles.bannerTap}>탭하여 참고 정보 보기</Text>
      </Pressable>

      {!HAS_AI_SERVER && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>AI 서버가 없어요. `.env`에 EXPO_PUBLIC_TRANSCRIBE_URL을 넣어 주세요.</Text>
        </View>
      )}

      {sparse && (
        <View style={styles.sparseBanner}>
          <Text style={styles.sparseText}>
            기록이 부족해요. 확정적으로 말하기 어려울 수 있어요 — 판단하기 어려우면 솔직히 알려드릴게요.
          </Text>
        </View>
      )}

      <View style={styles.safetyStrip}>
        <Text style={styles.safetyText}>
          고열·호흡곤란·반복 구토·탈수·처짐이 있으면 소아과/응급 진료를 권해요. 의학적 진단이 아니며 최근 기록
          기준입니다.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {chatHistory.length <= 1 ? (
          <EmptyState
            title="아직 상담 기록이 없어요."
            body="아래 퀵질문으로 첫 상담을 시작해 보세요."
          />
        ) : null}
        {chatHistory.map((m) => {
          const sticker = m.stickerId ? babyStickers.find((item) => item.id === m.stickerId) : null;
          return m.role === "user" ? (
            <View key={m.id} style={[styles.bubble, styles.userBubble]}>
              {sticker ? <BabyStickerFromModel sticker={sticker} size={72} /> : null}
              {m.text ? <Text style={[styles.bubbleText, styles.userText]}>{m.text}</Text> : null}
            </View>
          ) : (
            <View key={m.id} style={styles.aiBlock}>
              <View style={[styles.bubble, styles.aiBubble]}>
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
              <Text style={styles.answerFootnote}>최근 기록 기준입니다.</Text>
            </View>
          );
        })}
        {isTyping && (
          <View style={styles.aiBlock}>
            <LoadingState label="AI 분석 중…" />
          </View>
        )}
        {aiError && !isTyping ? (
          <View style={{ marginTop: 8 }}>
            <ErrorState
              title="잠시 문제가 생겼어요."
              body={aiError}
              onRetry={() => {
                if (failedQuestion) void send(failedQuestion, true);
              }}
              busy={isTyping}
            />
          </View>
        ) : null}
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
        <Pressable
          style={styles.stickerBtn}
          onPress={() => setStickerOpen(true)}
          disabled={isTyping}
          accessibilityLabel="스티커 보내기"
        >
          <Text style={styles.stickerBtnText}>스티커</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={`${babyName}에 대해 물어보세요...`}
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

      <BabyStickerVaultModal
        visible={stickerOpen}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        pickMode
        onClose={() => setStickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
        onPickSticker={(sticker) => {
          pushChat("user", sticker.text || sticker.label, sticker.id);
          setStickerOpen(false);
        }}
      />

      <Modal visible={bannerOpen} transparent animationType="fade" onRequestClose={() => setBannerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setBannerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>참고한 정보</Text>
            <EvidenceRow label="아기 프로필" detail={pack.babyBirthMeta} />
            <EvidenceRow label="오늘 기록" detail={`${pack.todayLogCount}개 · 수유/수면/배변 요약`} />
            <EvidenceRow label="최근 7일 트렌드" detail={`${pack.weekLogCount}개 이벤트`} />
            <EvidenceRow label="최근 일기" detail={`${pack.diaryCount}개`} />
            <Text style={styles.modalNote}>
              답변은 위 범위의 최근 기록 기준입니다. 기록이 부족하면 “판단하기 어려워요”라고 말할 수 있어요.
            </Text>
            <Pressable style={styles.modalBtn} onPress={() => setBannerOpen(false)}>
              <Text style={styles.modalBtnText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EvidenceRow({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={styles.evidenceRow}>
      <Text style={styles.evidenceLabel}>· {label}</Text>
      <Text style={styles.evidenceDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  banner: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 6,
    backgroundColor: colors.amberSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerEyebrow: { fontSize: 10.5, fontWeight: "700", color: colors.amber, marginBottom: 4 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  bannerMeta: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  bannerTap: { fontSize: 11, color: colors.faint, marginTop: 6 },
  warnBanner: {
    marginHorizontal: 18,
    marginBottom: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: 10,
  },
  warnText: { fontSize: 12, color: colors.dangerText, lineHeight: 18 },
  sparseBanner: {
    marginHorizontal: 18,
    marginBottom: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sparseText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  safetyStrip: {
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  safetyText: { fontSize: 11, color: colors.faint, lineHeight: 16 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  bubble: {
    maxWidth: "100%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: colors.amber,
    marginBottom: 8,
  },
  aiBlock: { alignSelf: "flex-start", maxWidth: "85%", marginBottom: 8 },
  bubbleText: { fontSize: 13.5, lineHeight: 21, color: colors.text },
  userText: { color: colors.amberDark },
  answerFootnote: {
    fontSize: 10.5,
    color: colors.faint,
    marginTop: 4,
    marginLeft: 4,
  },
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
  stickerBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  stickerBtnText: { fontSize: 11.5, fontWeight: "800", color: colors.amber },
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
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 28,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  evidenceRow: { marginBottom: 10 },
  evidenceLabel: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  evidenceDetail: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginLeft: 10 },
  modalNote: { fontSize: 12, color: colors.faint, marginTop: 8, lineHeight: 18 },
  modalBtn: {
    marginTop: 16,
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnText: { fontWeight: "700", color: colors.amberDark },
});
