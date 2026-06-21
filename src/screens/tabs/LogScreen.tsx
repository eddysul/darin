import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CheckCircle,
  FileText,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react-native";
import { PressSlide } from "../../components/PressSlide";
import { VoiceWaveform } from "../../components/VoiceWaveform";
import { useApp } from "../../context/AppContext";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { generateDailyReport } from "../../demo/dailyReport";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import type { DailyReport } from "../../types/dailyReport";
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
  const { isRecording, isTranscribing, levels, savedNote, startRecording, clearSavedNote } =
    useVoiceRecording();

  // Voice / text state
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [serverCategory, setServerCategory] = useState<LogCategory | null>(null);
  const [quickNote, setQuickNote] = useState("");

  // AI report state
  const [generated, setGenerated] = useState<DailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);

  // Entry submit state
  const [lastAdded, setLastAdded] = useState<{ category: LogCategory } | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  // Receive transcript from Bizcrush pipeline
  useEffect(() => {
    if (!savedNote?.transcript) return;
    setVoiceTranscript(savedNote.transcript);
    if (savedNote.events && savedNote.events.length > 0) {
      setServerCategory(serverCatToLogCategory(savedNote.events[0].category));
    }
  }, [savedNote]);

  const hasTranscript = Boolean(voiceTranscript);
  const sorted = [...logEntries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const handleRetake = () => {
    clearSavedNote();
    setVoiceTranscript("");
    setServerCategory(null);
    setGenerated(null);
    setReportSaved(false);
  };

  const handleGenerate = () => {
    const source = [voiceTranscript, quickNote].filter(Boolean).join("\n\n");
    if (!source.trim()) return;
    setIsGenerating(true);
    setReportSaved(false);
    setTimeout(() => {
      setGenerated(generateDailyReport(source));
      setIsGenerating(false);
    }, 900);
  };

  const handleSaveReport = () => {
    if (!generated) return;
    generateDailyReportFromLogs(locale);
    setReportSaved(true);
    setReportGenerated(true);
  };

  // Add current transcript / note as a categorized log entry
  const handleAddEntry = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    const category = serverCategory ?? categorizeLog(trimmed);
    const summary = extractSummary(trimmed, category);
    addLogEntry({ category, timestamp: new Date().toISOString(), rawText: trimmed, summary });
    setLastAdded({ category });
    setQuickNote("");
    handleRetake();
    successAnim.setValue(0);
    Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>{t("log.title")}</Text>
        <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

        {/* ── Voice Card ──────────────────────────────────── */}
        <View style={styles.voiceCard}>
          <View style={styles.voiceHeader}>
            <Text style={styles.voiceTitle}>{t("log.voiceNote")}</Text>
            <View style={styles.voiceBadge}>
              <Sparkles size={10} color={colors.yellow} />
              <Text style={styles.voiceBadgeText}>AI</Text>
            </View>
          </View>

          {isRecording ? (
            <>
              <Text style={styles.recordingLabel}>{t("log.recordingLive")}</Text>
              <View style={styles.waveWrap}>
                <VoiceWaveform levels={levels} barCount={32} height={48} />
              </View>
            </>
          ) : isTranscribing ? (
            <>
              <Text style={styles.recordingLabel}>{ko ? "변환 중…" : "Transcribing…"}</Text>
              <View style={styles.waveWrap}>
                <VoiceWaveform levels={levels} barCount={32} height={48} active={false} />
              </View>
            </>
          ) : hasTranscript ? (
            <>
              <Text style={styles.transcript}>{voiceTranscript}</Text>

              {/* Server-detected category chips */}
              {savedNote?.events && savedNote.events.length > 0 && (
                <View style={styles.eventList}>
                  {savedNote.events.map((event, i) => {
                    const cat = serverCatToLogCategory(event.category);
                    const meta = CATEGORY_META[cat];
                    return (
                      <View key={i} style={[styles.eventChip, { backgroundColor: meta.bg }]}>
                        <Text style={styles.eventChipEmoji}>{meta.emoji}</Text>
                        <Text style={[styles.eventChipText, { color: meta.color }]}>
                          {ko ? meta.labelKo : meta.labelEn}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {savedNote?.usedFallbackTranscript && (
                <Text style={styles.fallbackNote}>
                  {ko ? "⚠ 서버 미연결 — 예시 텍스트" : "⚠ Server offline — demo text"}
                </Text>
              )}

              {savedNote && (
                <View style={styles.savedRow}>
                  <CheckCircle size={11} color={colors.muted} />
                  <Text style={styles.savedHint}>{t("log.voiceSaved")} · {savedNote.savedAt}</Text>
                </View>
              )}

              <View style={styles.voiceActions}>
                <Pressable style={styles.retakeBtn} onPress={handleRetake}>
                  <RotateCcw size={14} color={colors.text} />
                  <Text style={styles.retakeBtnText}>{t("log.retake")}</Text>
                </Pressable>
                <PressSlide
                  style={[styles.addEntryBtn, isGenerating && styles.btnDisabled]}
                  onPress={() => handleAddEntry(voiceTranscript)}
                >
                  <Send size={14} color={colors.text} />
                  <Text style={styles.addEntryBtnText}>{t("log.submitEntry")}</Text>
                </PressSlide>
                <PressSlide
                  style={[styles.generateVoiceBtn, isGenerating && styles.btnDisabled]}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles size={14} color={colors.yellow} />
                  <Text style={styles.generateVoiceBtnText}>
                    {isGenerating ? t("log.generating") : t("log.generateReport")}
                  </Text>
                </PressSlide>
              </View>
            </>
          ) : (
            /* Idle — tap mic to start */
            <Pressable style={styles.micIdleRow} onPress={() => void startRecording()}>
              <View style={styles.micIdleBtn}>
                <Mic size={22} color={colors.yellow} />
              </View>
              <Text style={styles.holdHint}>{t("log.holdCenterHint")}</Text>
            </Pressable>
          )}
        </View>

        {/* ── Quick Notes ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("log.quickNotes")}</Text>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={4}
            placeholder={t("log.addPlaceholder")}
            placeholderTextColor={colors.muted}
            value={quickNote}
            onChangeText={setQuickNote}
            textAlignVertical="top"
          />
          {quickNote.trim().length > 3 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t("log.categoryDetected")}:</Text>
              <CategoryChip category={categorizeLog(quickNote)} ko={ko} />
            </View>
          )}
          <View style={styles.quickActions}>
            {!hasTranscript && (
              <PressSlide
                style={[styles.generateBtn, (!quickNote.trim() || isGenerating) && styles.btnDisabled]}
                onPress={handleGenerate}
                disabled={isGenerating || !quickNote.trim()}
              >
                <Sparkles size={14} color={colors.yellow} />
                <Text style={styles.generateBtnText}>
                  {isGenerating ? t("log.generating") : t("log.generateReport")}
                </Text>
              </PressSlide>
            )}
            {quickNote.trim().length > 0 && (
              <PressSlide
                style={styles.addNoteBtn}
                onPress={() => handleAddEntry(quickNote)}
              >
                <Send size={13} color={colors.text} />
                <Text style={styles.addNoteBtnText}>{t("log.submitEntry")}</Text>
              </PressSlide>
            )}
          </View>
        </View>

        {/* ── Success toast ───────────────────────────────── */}
        {lastAdded && (
          <Animated.View style={[styles.successRow, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
            <CheckCircle size={14} color={colors.sage} />
            <Text style={styles.successText}>{t("log.entryAdded")} · </Text>
            <CategoryChip category={lastAdded.category} ko={ko} />
          </Animated.View>
        )}

        {/* ── Generating spinner ──────────────────────────── */}
        {isGenerating && (
          <View style={[styles.card, styles.aiCard, styles.centerCard]}>
            <Sparkles size={24} color={colors.yellow} />
            <Text style={styles.generatingText}>{t("log.generating")}</Text>
          </View>
        )}

        {/* ── AI Report sections ──────────────────────────── */}
        {generated && !isGenerating && (
          <>
            {[
              { title: t("log.originalNote"), body: generated.sourceNote, ai: false },
              { title: t("log.aiReportEn"), body: generated.reportEn, ai: true },
              { title: t("log.aiReportKo"), body: generated.reportKo, ai: true },
              { title: t("log.parentReplyDraft"), body: generated.parentReplyDraft, ai: true, italic: true },
            ].map((section) => (
              <View key={section.title} style={[styles.card, section.ai && styles.aiCard]}>
                <Text style={styles.sectionLabel}>
                  {section.ai && <Sparkles size={11} color={colors.yellow} />} {section.title}
                </Text>
                <Text style={[styles.sectionBody, section.italic && styles.italic]}>
                  {section.body}
                </Text>
              </View>
            ))}
            <View style={[styles.card, styles.saveCard]}>
              <View style={styles.saveHeader}>
                <Sparkles size={14} color={colors.yellow} />
                <Text style={styles.saveTitle}>{t("log.aiDraft")}</Text>
                <Text style={styles.saveHint}>{t("log.readyToSend")}</Text>
              </View>
              <PressSlide style={styles.sendBtn} onPress={handleSaveReport}>
                <Send size={14} color={colors.primaryForeground} />
                <Text style={styles.sendBtnText}>{t("log.sendToParent")}</Text>
              </PressSlide>
              {reportSaved && (
                <Text style={styles.savedText}>
                  <CheckCircle size={12} color={colors.muted} /> {t("log.savedToReports")}
                </Text>
              )}
            </View>
          </>
        )}

        {/* ── Timeline ────────────────────────────────────── */}
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{t("log.timeline")}</Text>
          <Text style={styles.entryCount}>
            {logEntries.length} {ko ? "건" : "entries"}
          </Text>
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
              <PressSlide style={styles.generateFullBtn} onPress={() => { generateDailyReportFromLogs(locale); setReportGenerated(true); }}>
                <Sparkles size={14} color="#fff" />
                <Text style={styles.generateFullBtnText}>{t("log.generateFromEntries")}</Text>
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

  // ── Voice card ──────────────────────────────────────────────────────────────
  voiceCard: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.yellow,
    padding: 18,
    marginBottom: 14,
  },
  voiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  voiceTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceBadgeText: { fontSize: 10, fontWeight: "700", color: colors.text },
  recordingLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  waveWrap: { marginTop: 2 },
  micIdleRow: { alignItems: "center", paddingVertical: 8, gap: 10 },
  micIdleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.yellow}22`,
    borderWidth: 1.5,
    borderColor: `${colors.yellow}60`,
    alignItems: "center",
    justifyContent: "center",
  },
  holdHint: { fontSize: 13, color: colors.muted, textAlign: "center" },
  transcript: { fontSize: 14, lineHeight: 22, color: colors.text },
  eventList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  eventChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eventChipEmoji: { fontSize: 11 },
  eventChipText: { fontSize: 11, fontWeight: "600" },
  fallbackNote: { fontSize: 11, color: colors.muted, marginTop: 10 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  savedHint: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  voiceActions: { flexDirection: "row", gap: 7, marginTop: 16 },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 11,
    backgroundColor: colors.background,
  },
  retakeBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  addEntryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: `${colors.navy}14`,
    borderRadius: radius.md,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: `${colors.navy}25`,
  },
  addEntryBtnText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  generateVoiceBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  generateVoiceBtnText: { fontSize: 12, fontWeight: "600", color: colors.primaryForeground },

  // ── Quick notes card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  aiCard: { backgroundColor: colors.yellowSoft, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 10 },
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
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  previewLabel: { fontSize: 12, color: colors.muted },
  quickActions: { flexDirection: "row", gap: 8 },
  generateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  btnDisabled: { opacity: 0.4 },
  generateBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  addNoteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  addNoteBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },

  // ── Toast / success ─────────────────────────────────────────────────────────
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

  // ── AI Report ───────────────────────────────────────────────────────────────
  centerCard: { alignItems: "center", paddingVertical: 24 },
  generatingText: { marginTop: 8, fontSize: 14, fontWeight: "600", color: colors.text },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 8 },
  sectionBody: { fontSize: 14, lineHeight: 22, color: colors.muted },
  italic: { fontStyle: "italic", color: colors.text },
  saveCard: { borderTopWidth: 3, borderTopColor: colors.yellow },
  saveHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  saveTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  saveHint: { fontSize: 12, color: colors.muted },
  sendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  sendBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  savedText: { marginTop: 10, fontSize: 12, color: colors.muted, fontWeight: "500" },

  // ── Timeline ────────────────────────────────────────────────────────────────
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
  generateFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  generateFullBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
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
