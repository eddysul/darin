import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { callOpenAI, OpenAIChatError, type OpenAIMessage } from "../../api/openaiChat";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { ConsultMemoSheet } from "../../components/babylog/ConsultMemoSheet";
import { RecordCreatedToast } from "../../components/babylog/RecordCreatedToast";
import { NavigationHeader } from "../../components/navigation/NavigationHeader";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { buildBabyLogConsultPrompt, buildCareContextPack } from "../../utils/babyLogAIContext";
import { ErrorState, LoadingState } from "../../components/states/FeedbackStates";
import { colors } from "../../theme";
import { consumeQaFaultOnce } from "../../utils/qaDebug";
import { formatDateKey, offsetDateKey } from "../../utils/dateKey";
import { formatHHmm, formatTimeOfDay } from "../../utils/timePicker";
import { openDeviceNotificationSettings, scheduleMemoReminder } from "../../utils/memoReminderNotifications";
import { formatSleepDuration, type TodaySummary } from "../../utils/reportAggregates";
import type { RootStackParamList } from "../../navigation/types";
import type { ConsultCriticalKey } from "../../i18nConsultCriticalMessages";

const QUICK_CHIP_KEYS: ConsultCriticalKey[] = [
  "consult.critical.001",
  "consult.critical.002",
  "consult.critical.003",
  "consult.critical.004",
];

const HAS_AI_SERVER = Boolean((process.env.EXPO_PUBLIC_TRANSCRIBE_URL ?? "").trim());

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function ConsultScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Consult">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Consult">>();
  const {
    careSetup,
    logs,
    diaryEntries,
    chatHistory,
    chatHydrated,
    pushChat,
    babyName,
    activeBabyId,
    storageReady,
    addLogWithPersistence,
    ensureCareLogsForRange,
  } = useBabyLog();
  const { locale, t } = useLanguage();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoSeed, setMemoSeed] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoToast, setMemoToast] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const historyRef = useRef<OpenAIMessage[]>([]);
  const historySeeded = useRef(false);
  const requestInFlightRef = useRef(false);
  const consumedInitialRef = useRef<string | null>(null);
  const babyScopeRunRef = useRef(0);

  const pack = useMemo(
    () => buildCareContextPack({ careSetup, logs, diaryEntries, locale }),
    [careSetup, logs, diaryEntries, locale],
  );

  const sparse = pack.todayLogCount === 0 || pack.weekLogCount < 3;

  // Restore OpenAI turn history after the active baby's chat has hydrated.
  useEffect(() => {
    babyScopeRunRef.current += 1;
    historySeeded.current = false;
    historyRef.current = [];
    requestInFlightRef.current = false;
    setIsTyping(false);
    setAiError(null);
    setFailedQuestion(null);
  }, [activeBabyId]);

  useEffect(() => {
    if (!storageReady || !chatHydrated || historySeeded.current) return;
    historySeeded.current = true;
    historyRef.current = chatHistory
      .filter((m) => m.id !== "greet-1")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));
  }, [storageReady, chatHydrated, chatHistory, activeBabyId]);

  const send = async (text: string, retry = false) => {
    const trimmed = text.trim();
    if (!trimmed || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    const requestScopeRun = babyScopeRunRef.current;
    const todayKey = formatDateKey();
    const recentHistory = await ensureCareLogsForRange(offsetDateKey(todayKey, -6), todayKey);
    if (requestScopeRun !== babyScopeRunRef.current) return;
    const promptLogs = recentHistory.complete ? recentHistory.logs : logs;
    const currentPack = buildCareContextPack({
      careSetup,
      logs: promptLogs,
      diaryEntries,
      locale,
      question: trimmed,
    });

    if (
      (currentPack.todayLogCount === 0 || currentPack.weekLogCount < 3)
      && /\uC9C4\uB2E8|\uC57D|\uBCD1\uC6D0|\uAD1C\uCC2E\uC740\uC9C0|\uC2EC\uAC01\uD55C|\uC751\uAE09/.test(trimmed)
      && currentPack.todayLogCount === 0
    ) {
      pushChat("user", trimmed);
      pushChat(
        "ai",
        t("consult.critical.005"),
      );
      requestInFlightRef.current = false;
      return;
    }

    if (!retry) {
      pushChat("user", trimmed);
      historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    }
    setInput("");
    setIsTyping(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    const prompt = buildBabyLogConsultPrompt({
      careSetup,
      logs: promptLogs,
      diaryEntries,
      locale,
      question: recentHistory.complete
        ? trimmed
        : `${trimmed}\n[Data note: recent care-log history is only partially available. Do not claim that missing events did not occur.]`,
    });

    try {
      if (await consumeQaFaultOnce("ai")) {
        throw new OpenAIChatError("QA injected one-shot AI failure", "api_error");
      }
      const reply = await callOpenAI(historyRef.current, prompt);
      if (requestScopeRun !== babyScopeRunRef.current) return;
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
      if (requestScopeRun === babyScopeRunRef.current) {
        requestInFlightRef.current = false;
        setIsTyping(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    }
  };

  // Prefill from Record FAB prompt sheet — user sends after editing.
  useEffect(() => {
    if (!storageReady) return;
    const question = route.params?.initialQuestion?.trim();
    const shouldFocus = Boolean(question) || route.params?.focusInput;
    if (!question && !route.params?.focusInput) return;
    if (question) {
      if (consumedInitialRef.current === question) return;
      consumedInitialRef.current = question;
      setInput(question);
    }
    navigation.setParams({ initialQuestion: undefined, focusInput: undefined });
    const focus = setTimeout(() => {
      if (shouldFocus) inputRef.current?.focus();
    }, 80);
    const clear = setTimeout(() => {
      consumedInitialRef.current = null;
    }, 500);
    return () => {
      clearTimeout(focus);
      clearTimeout(clear);
    };
  }, [storageReady, route.params?.initialQuestion, route.params?.focusInput, navigation]);

  useEffect(() => {
    const animate = (duration?: number) => {
      LayoutAnimation.configureNext({
        duration: duration && duration > 0 ? duration : 250,
        update: {
          type: Platform.OS === "ios" ? LayoutAnimation.Types.keyboard : LayoutAnimation.Types.easeInEaseOut,
        },
      });
    };
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => {
      animate(event.duration);
      setKeyboardInset(Platform.OS === "ios" ? event.endCoordinates.height : 0);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (event) => {
      animate(event.duration);
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const lastAiText = useMemo(() => {
    const last = [...chatHistory].reverse().find((m) => m.role === "ai" && m.id !== "greet-1" && m.text.trim());
    return last?.text.trim() ?? "";
  }, [chatHistory]);

  const sentChipTexts = useMemo(
    () => new Set(chatHistory.filter((m) => m.role === "user").map((m) => m.text.trim())),
    [chatHistory],
  );
  const hasUserTurn = sentChipTexts.size > 0;
  const showChips = !hasUserTurn || inputFocused;
  const todayLines = useMemo(() => todayEvidenceLines(pack.todaySummary, t, locale), [locale, pack.todaySummary, t]);

  const openMemo = (seed = "") => {
    setMemoSeed(seed);
    setMemoOpen(true);
  };

  const saveMemo = async (input: { notes: string; remindAt?: Date }) => {
    const now = new Date();
    setMemoSaving(true);
    try {
      const saved = await addLogWithPersistence({
        cat: "memo",
        time: formatHHmm(now.getHours(), now.getMinutes()),
        dateKey: formatDateKey(now),
        notes: input.notes,
        title: t("consult.critical.006"),
        chip: t("consult.critical.007"),
        nextAt: input.remindAt
          ? `${formatDateKey(input.remindAt, "midnight")} ${formatHHmm(input.remindAt.getHours(), input.remindAt.getMinutes())}`
          : undefined,
        source: "manual",
      });
      if (!saved) {
        Alert.alert(t("consult.critical.008"), t("consult.critical.009"));
        return;
      }
      if (input.remindAt) {
        const scheduled = await scheduleMemoReminder({
          logId: saved.id,
          fireAt: input.remindAt,
          title: t("consult.critical.010"),
          body: input.notes,
        });
        if (!scheduled) {
          Alert.alert(t("consult.critical.011"), t("consult.critical.012"), [
            { text: t("consult.critical.013"), style: "cancel" },
            { text: t("consult.critical.014"), onPress: () => void openDeviceNotificationSettings() },
          ]);
          setMemoOpen(false);
          setMemoToast(t("consult.critical.015"));
          return;
        }
        setMemoToast(t("consult.critical.075", { time: formatTimeOfDay(formatHHmm(input.remindAt.getHours(), input.remindAt.getMinutes()), "", locale) }));
      } else {
        setMemoToast(t("consult.critical.015"));
      }
      setMemoOpen(false);
    } catch {
      Alert.alert(t("consult.critical.008"), t("consult.critical.009"));
    } finally {
      setMemoSaving(false);
    }
  };

  if (!storageReady || !chatHydrated) {
    return (
      <View style={styles.root}>
        <NavigationHeader title={t("consult.critical.016")} onBack={() => navigation.goBack()} />
        <View style={styles.loadingBox}>
          <LoadingState label={t("consult.critical.017")} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NavigationHeader title={t("consult.critical.016")} onBack={() => navigation.goBack()} />
      <Pressable
        style={styles.banner}
        onPress={() => setBannerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("consult.critical.018")}
        accessibilityHint={sparse ? t("consult.critical.019") : t("consult.critical.020")}
      >
        <Text style={styles.bannerLine} numberOfLines={1}>
          {sparse
            ? t("consult.critical.076", { today: pack.todayLogCount })
            : t("consult.critical.077", { today: pack.todayLogCount, week: pack.weekLogCount })}
        </Text>
        <Text style={styles.bannerChevron}>›</Text>
      </Pressable>
      {!HAS_AI_SERVER ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>{t("consult.critical.021")}</Text>
        </View>
      ) : null}

      <View style={[styles.flex, { paddingBottom: keyboardInset }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {chatHistory.map((m) =>
            m.role === "user" ? (
              m.text ? (
                <View key={m.id} style={[styles.bubble, styles.userBubble]}>
                  <Text style={[styles.bubbleText, styles.userText]}>{m.text}</Text>
                </View>
              ) : null
            ) : (
              <View key={m.id} style={styles.aiBlock}>
                <View style={[styles.bubble, styles.aiBubble]}>
                  <Text style={styles.bubbleText}>{m.id === "greet-1" ? t("consult.critical.080") : m.text}</Text>
                </View>
                {m.id !== "greet-1" ? (
                  <Pressable
                    style={styles.memoLink}
                    onPress={() => openMemo(m.text)}
                    accessibilityRole="button"
                    accessibilityLabel={t("consult.critical.022")}
                  >
                    <Text style={styles.memoLinkText}>{t("consult.critical.023")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ),
          )}
          {isTyping && (
            <View style={styles.aiBlock}>
              <LoadingState label={t("consult.critical.024")} />
            </View>
          )}
          {aiError && !isTyping ? (
            <View style={{ marginTop: 8 }}>
              <ErrorState
                title={t("consult.critical.025")}
                body={aiError}
                onRetry={() => {
                  if (failedQuestion) void send(failedQuestion, true);
                }}
                busy={isTyping}
              />
            </View>
          ) : null}
        </ScrollView>

        {showChips ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK_CHIP_KEYS.map((key) => {
              const chip = t(key);
              const sent = sentChipTexts.has(chip);
              return (
                <Pressable
                  key={chip}
                  style={[styles.chip, sent && styles.chipSent]}
                  onPress={() => {
                    setInput(chip);
                    inputRef.current?.focus();
                  }}
                  disabled={isTyping}
                  accessibilityRole="button"
                  accessibilityLabel={sent ? t("consult.critical.078", { question: chip }) : chip}
                >
                  <Text style={[styles.chipText, sent && styles.chipTextSent]}>{chip}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable
            style={styles.memoBtn}
            onPress={() => openMemo(lastAiText)}
            disabled={isTyping}
            accessibilityRole="button"
            accessibilityLabel={t("consult.critical.026")}
            accessibilityHint={t("consult.critical.027")}
          >
            <Text style={styles.memoBtnText}>{t("consult.critical.028")}</Text>
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t("consult.critical.079", { babyName })}
            placeholderTextColor={colors.faint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => void send(input)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="send"
            editable={!isTyping}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => void send(input)}
            disabled={!input.trim() || isTyping}
            accessibilityRole="button"
            accessibilityLabel={t("consult.critical.029")}
          >
            <BabyLogIcon kind="send" size={18} color={colors.amberDark} />
          </Pressable>
        </View>
      </View>

      <ConsultMemoSheet
        visible={memoOpen}
        initialText={memoSeed}
        saving={memoSaving}
        onClose={() => setMemoOpen(false)}
        onSave={(payload) => void saveMemo(payload)}
      />

      <Modal visible={bannerOpen} transparent animationType="fade" onRequestClose={() => setBannerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setBannerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("consult.critical.030")}</Text>
            <EvidenceRow label={t("consult.critical.031")} detail={pack.babyBirthMeta} />
            <EvidenceRow label={t("consult.critical.032")} detail={todayLines.join("\n")} />
            <EvidenceRow label={t("consult.critical.033")} detail={t("consult.critical.067", { count: pack.weekLogCount })} />
            <EvidenceRow label={t("consult.critical.034")} detail={t("consult.critical.068", { count: pack.diaryCount })} />
            {sparse ? (
              <Text style={styles.modalNote}>
                {t("consult.critical.035")}
              </Text>
            ) : null}
            <Text style={styles.modalNote}>{t("consult.critical.036")}</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => setBannerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t("consult.critical.013")}
            >
              <Text style={styles.modalBtnText}>{t("consult.critical.013")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <RecordCreatedToast
        visible={Boolean(memoToast)}
        title={memoToast ?? ""}
        body={t("consult.critical.037")}
        onDismiss={() => setMemoToast(null)}
        onPress={() => {
          setMemoToast(null);
          navigation.navigate("MainTabs", { screen: "Record" });
        }}
      />
    </View>
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

function todayEvidenceLines(summary: TodaySummary, t: ReturnType<typeof useLanguage>["t"], locale: ReturnType<typeof useLanguage>["locale"]): string[] {
  if (summary.totalCount === 0) return [t("consult.critical.038")];
  const feed = summary.lastFeedAt
    ? t("consult.critical.069", { count: summary.feedCount, time: formatTimeOfDay(summary.lastFeedAt, "", locale) })
    : t("consult.critical.070", { count: summary.feedCount });
  const sleep = t("consult.critical.071", { duration: formatSleepDuration(summary.totalSleepMinutes, t), count: summary.sleepCount });
  const diaper = summary.lastDiaperAt
    ? t("consult.critical.072", { count: summary.diaperCount, time: formatTimeOfDay(summary.lastDiaperAt, "", locale) })
    : t("consult.critical.073", { count: summary.diaperCount });
  return [feed, sleep, diaper];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  banner: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 6,
    minHeight: Platform.OS === "android" ? 48 : 44,
    backgroundColor: colors.amberSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerLine: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.amberText },
  bannerChevron: { fontSize: 18, fontWeight: "700", color: colors.amberText },
  warnBanner: {
    marginHorizontal: 18,
    marginBottom: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: 10,
  },
  warnText: { fontSize: 12, color: colors.dangerText, lineHeight: 18 },
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
  memoLink: {
    minHeight: Platform.OS === "android" ? 48 : 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  memoLinkText: { fontSize: 12, fontWeight: "700", color: colors.amberText },
  chipsScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 18, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    alignSelf: "flex-start",
    minHeight: Platform.OS === "android" ? 48 : 44,
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, lineHeight: 17, color: colors.muted, fontWeight: "600" },
  chipSent: { opacity: 0.45 },
  chipTextSent: { color: colors.faint },
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
  memoBtn: {
    minHeight: Platform.OS === "android" ? 48 : 44,
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 10,
  },
  memoBtnText: { fontSize: 11.5, fontWeight: "800", color: colors.amberText },
  sendBtn: {
    width: Platform.OS === "android" ? 48 : 44,
    height: Platform.OS === "android" ? 48 : 44,
    borderRadius: Platform.OS === "android" ? 24 : 22,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
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
  evidenceDetail: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginLeft: 10, lineHeight: 19 },
  modalNote: { fontSize: 12, color: colors.faint, marginTop: 8, lineHeight: 18 },
  modalBtn: {
    marginTop: 16,
    minHeight: Platform.OS === "android" ? 48 : 44,
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontWeight: "700", color: colors.amberDark },
});
