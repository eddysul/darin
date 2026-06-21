import { useRef, useState } from "react";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CheckCircle, FileText, Mic, Send, Sparkles, X } from "lucide-react-native";
import { PressSlide } from "../../components/PressSlide";
import { useApp } from "../../context/AppContext";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { CATEGORY_META, type LogCategory } from "../../types/log";
import { categorizeLog, extractSummary } from "../../utils/categorize";
import { colors, radius } from "../../theme";

function serverCatToLogCategory(serverCat: string): LogCategory {
  if (serverCat.includes("배변")) return "diaper";
  if (serverCat.includes("수면")) return "sleep";
  if (serverCat.includes("식사") || serverCat.includes("수유") || serverCat.includes("간식")) return "meal";
  if (serverCat.includes("키") || serverCat.includes("몸무게") || serverCat.includes("성장")) return "growth";
  if (serverCat.includes("진료") || serverCat.includes("복용") || serverCat.includes("병원")) return "medical";
  return "meal";
}

export function LogScreen() {
  const { profile, logEntries } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  if (profile.role !== "caregiver") {
    return <ParentLogView entries={logEntries} ko={ko} t={t} fadeAnim={fadeAnim} />;
  }

  return <CaregiverLogView locale={locale} ko={ko} t={t} fadeAnim={fadeAnim} />;
}

// ── Caregiver Log View ──────────────────────────────────────────────────────

function CaregiverLogView({
  locale,
  ko,
  t,
  fadeAnim,
}: {
  locale: "en" | "ko";
  ko: boolean;
  t: (key: MessageKey) => string;
  fadeAnim: Animated.Value;
}) {
  const { logEntries, addLogEntry, generateDailyReportFromLogs, dailyReport } = useApp();
  const { isRecording, isTranscribing, savedNote, startRecording, clearSavedNote } = useVoiceRecording();
  const [text, setText] = useState("");
  const [serverCategory, setServerCategory] = useState<LogCategory | null>(null);
  const [lastAdded, setLastAdded] = useState<{ category: LogCategory } | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  // When transcription arrives, pre-fill text and pick server category
  useEffect(() => {
    if (!savedNote || !savedNote.transcript) return;
    setText(savedNote.transcript);
    if (savedNote.events && savedNote.events.length > 0) {
      setServerCategory(serverCatToLogCategory(savedNote.events[0].category));
    }
  }, [savedNote]);

  const sorted = [...logEntries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const detectedCategory = serverCategory ?? (text.trim().length > 3 ? categorizeLog(text) : null);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const category = serverCategory ?? categorizeLog(trimmed);
    const summary = extractSummary(trimmed, category);
    addLogEntry({ category, timestamp: new Date().toISOString(), rawText: trimmed, summary });
    setLastAdded({ category });
    setText("");
    setServerCategory(null);
    clearSavedNote();
    successAnim.setValue(0);
    Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
  };

  const handleGenerateReport = () => {
    generateDailyReportFromLogs(locale);
    setReportGenerated(true);
  };

  const handleClearVoice = () => {
    clearSavedNote();
    setText("");
    setServerCategory(null);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>{t("log.title")}</Text>
        <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

        <View style={styles.card}>
          {/* Card header: title + mic button */}
          <View style={styles.cardTitleRow}>
            <Pressable
              style={[styles.micBtn, isRecording && styles.micBtnActive]}
              onPress={() => void startRecording()}
            >
              <Mic size={15} color={isRecording ? "#fff" : colors.gold} />
            </Pressable>
            <Text style={styles.cardTitle}>{t("log.addEntry")}</Text>
            {isTranscribing && (
              <View style={styles.transcribingBadge}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.transcribingText}>{ko ? "변환 중…" : "Transcribing…"}</Text>
              </View>
            )}
          </View>

          {/* Voice result banner */}
          {savedNote && savedNote.transcript && !isTranscribing && (
            <View style={styles.voiceBanner}>
              <View style={styles.voiceBannerHeader}>
                <Mic size={11} color={colors.gold} />
                <Text style={styles.voiceBannerLabel}>{ko ? "음성 인식 결과 — 확인 후 저장하세요" : "Voice result — review & save"}</Text>
                <Pressable onPress={handleClearVoice}>
                  <X size={13} color={colors.muted} />
                </Pressable>
              </View>
              {savedNote.usedFallbackTranscript && (
                <Text style={styles.fallbackNote}>
                  {ko ? "⚠ 서버 미연결 — 예시 텍스트입니다" : "⚠ Server offline — showing demo text"}
                </Text>
              )}
            </View>
          )}

          <TextInput
            style={[styles.textarea, savedNote?.transcript && !isTranscribing && styles.textareaVoice]}
            multiline
            numberOfLines={3}
            placeholder={isTranscribing
              ? (ko ? "음성을 텍스트로 변환 중…" : "Converting voice to text…")
              : t("log.addPlaceholder")}
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={(v) => { setText(v); setServerCategory(null); }}
            textAlignVertical="top"
            editable={!isTranscribing}
          />

          {detectedCategory && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t("log.categoryDetected")}:</Text>
              <CategoryChip category={detectedCategory} ko={ko} />
              {serverCategory && (
                <Text style={styles.aiLabel}>{ko ? "AI 분류" : "AI classified"}</Text>
              )}
            </View>
          )}

          <PressSlide
            style={[styles.submitBtn, (!text.trim() || isTranscribing) && styles.submitBtnDisabled]}
            onPress={handleAdd}
            disabled={!text.trim() || isTranscribing}
          >
            <Send size={14} color={colors.text} />
            <Text style={styles.submitBtnText}>{t("log.submitEntry")}</Text>
          </PressSlide>
        </View>

        {lastAdded && (
          <Animated.View style={[styles.successRow, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
            <CheckCircle size={14} color={colors.sage} />
            <Text style={styles.successText}>{t("log.entryAdded")} · </Text>
            <CategoryChip category={lastAdded.category} ko={ko} />
          </Animated.View>
        )}

        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{t("log.timeline")}</Text>
          <Text style={styles.entryCount}>{logEntries.length} {ko ? "건" : "entries"}</Text>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("log.noEntries")}</Text>
          </View>
        ) : (
          sorted.map((entry) => {
            const meta = CATEGORY_META[entry.category];
            const time = new Date(entry.timestamp).toLocaleTimeString(ko ? "ko-KR" : "en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <View key={entry.id} style={[styles.entryCard, { borderLeftColor: meta.color }]}>
                <View style={[styles.entryIcon, { backgroundColor: meta.bg }]}>
                  <Text style={styles.entryEmoji}>{meta.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.entryTop}>
                    <Text style={[styles.entryCategory, { color: meta.color }]}>
                      {ko ? meta.labelKo : meta.labelEn}
                    </Text>
                    <Text style={styles.entryTime}>{time}</Text>
                  </View>
                  <Text style={styles.entryText}>{entry.rawText}</Text>
                </View>
              </View>
            );
          })
        )}

        {logEntries.length > 0 && (
          <View style={styles.reportSection}>
            {reportGenerated || dailyReport ? (
              <View style={styles.reportDoneRow}>
                <CheckCircle size={14} color={colors.sage} />
                <Text style={styles.reportDoneText}>{t("log.savedToReports")}</Text>
              </View>
            ) : (
              <PressSlide style={styles.generateBtn} onPress={handleGenerateReport}>
                <Sparkles size={14} color="#fff" />
                <Text style={styles.generateBtnText}>{t("log.generateFromEntries")}</Text>
              </PressSlide>
            )}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

// ── Parent Log View (read-only) ─────────────────────────────────────────────

function ParentLogView({
  entries,
  ko,
  t,
  fadeAnim,
}: {
  entries: ReturnType<typeof useApp>["logEntries"];
  ko: boolean;
  t: (key: MessageKey) => string;
  fadeAnim: Animated.Value;
}) {
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>{t("log.parentViewTitle")}</Text>
        <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileText size={24} color={colors.muted} />
            <Text style={styles.emptyText}>{t("log.parentViewEmpty")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryStrip}>
              {(["diaper", "sleep", "meal", "growth", "medical"] as LogCategory[]).map((cat) => {
                const count = entries.filter((e) => e.category === cat).length;
                if (!count) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <View key={cat} style={[styles.summaryChip, { backgroundColor: meta.bg }]}>
                    <Text style={styles.summaryEmoji}>{meta.emoji}</Text>
                    <Text style={[styles.summaryCount, { color: meta.color }]}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {sorted.map((entry) => {
              const meta = CATEGORY_META[entry.category];
              const time = new Date(entry.timestamp).toLocaleTimeString(ko ? "ko-KR" : "en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <View key={entry.id} style={[styles.entryCard, { borderLeftColor: meta.color }]}>
                  <View style={[styles.entryIcon, { backgroundColor: meta.bg }]}>
                    <Text style={styles.entryEmoji}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.entryTop}>
                      <Text style={[styles.entryCategory, { color: meta.color }]}>
                        {ko ? meta.labelKo : meta.labelEn}
                      </Text>
                      <Text style={styles.entryTime}>{time}</Text>
                    </View>
                    <Text style={styles.entryText}>{entry.rawText}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
}

function CategoryChip({ category, ko }: { category: LogCategory; ko: boolean }) {
  const meta = CATEGORY_META[category];
  return (
    <View style={[styles.catChip, { backgroundColor: meta.bg }]}>
      <Text style={styles.catEmoji}>{meta.emoji}</Text>
      <Text style={[styles.catLabel, { color: meta.color }]}>{ko ? meta.labelKo : meta.labelEn}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 16 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },

  micBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${colors.gold}18`,
    borderWidth: 1,
    borderColor: `${colors.gold}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  transcribingBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  transcribingText: { fontSize: 11, color: colors.gold, fontWeight: "600" },

  voiceBanner: {
    backgroundColor: `${colors.gold}12`,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.gold}30`,
    padding: 8,
    marginBottom: 8,
  },
  voiceBannerHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  voiceBannerLabel: { flex: 1, fontSize: 11, color: colors.gold, fontWeight: "600" },
  fallbackNote: { fontSize: 11, color: colors.muted, marginTop: 4 },

  textarea: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    marginBottom: 10,
  },
  textareaVoice: { borderColor: `${colors.gold}60`, backgroundColor: `${colors.gold}08` },

  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  previewLabel: { fontSize: 12, color: colors.muted },
  aiLabel: { fontSize: 10, color: colors.gold, fontWeight: "600", marginLeft: 2 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },

  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${colors.sage}14`,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 12,
  },
  successText: { fontSize: 13, color: colors.sage, fontWeight: "600" },

  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  timelineTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  entryCount: { fontSize: 12, color: colors.muted },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },

  entryCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  entryEmoji: { fontSize: 16 },
  entryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  entryCategory: { fontSize: 12, fontWeight: "700" },
  entryTime: { fontSize: 11, color: colors.muted },
  entryText: { fontSize: 14, lineHeight: 20, color: colors.text, opacity: 0.85 },

  reportSection: { marginTop: 8 },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  generateBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  reportDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 12,
  },
  reportDoneText: { fontSize: 13, color: colors.sage, fontWeight: "600" },

  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  catEmoji: { fontSize: 12 },
  catLabel: { fontSize: 11, fontWeight: "700" },

  summaryStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  summaryEmoji: { fontSize: 14 },
  summaryCount: { fontSize: 13, fontWeight: "700" },
});
