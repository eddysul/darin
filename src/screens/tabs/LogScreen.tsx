import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle,
  Mic,
  Moon,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Thermometer,
  Utensils,
} from "lucide-react-native";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { PressSlide } from "../../components/PressSlide";
import { VoiceWaveform } from "../../components/VoiceWaveform";
import { useApp } from "../../context/AppContext";
import { generateDailyReportFromApi } from "../../api/generateReport";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { generateDailyReport } from "../../demo/dailyReport";
import { normalizeDailyReport } from "../../utils/reportPresentation";
import { appendEventsForToday } from "../../utils/eventStore";
import { buildLogSourceNote, categorizeLog, extractSummary, normalizeLogCategory } from "../../utils/categorize";
import { getLogEntries } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import type { DailyReport } from "../../types/dailyReport";
import { ORDERED_PRIMARY_CATEGORIES, PRIMARY_CATEGORY_META, type LogPrimaryCategory } from "../../types/log";
import { colors, radius } from "../../theme";

export function LogScreen() {
  const { profile, setDailyReport, logEntries, addLogEntry } = useApp();
  const { locale, t } = useLanguage();
  const demoLogEntries = getLogEntries(locale);
  const {
    isRecording,
    isTranscribing,
    levels,
    savedNote,
    recordingError,
    startRecording,
    stopAndSave,
    clearSavedNote,
    clearRecordingError,
  } = useVoiceRecording();
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState<DailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [caregiverCategory, setCaregiverCategory] = useState<LogPrimaryCategory>("meal");
  const [caregiverEntryText, setCaregiverEntryText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const reportSectionY = useRef(0);

  const isCaregiver = profile.role === "caregiver";

  useEffect(() => {
    if (savedNote?.transcript) {
      setVoiceTranscript(savedNote.transcript);
      if (isCaregiver && savedNote.events?.[0]?.category) {
        setCaregiverCategory(normalizeLogCategory(savedNote.events[0].category));
        if (!caregiverEntryText) setCaregiverEntryText(savedNote.transcript);
      }
      return;
    }

    if (!savedNote && !isTranscribing) {
      setVoiceTranscript("");
    }
  }, [savedNote, isCaregiver, isTranscribing, caregiverEntryText]);

  const errorMessage = (() => {
    switch (recordingError) {
      case "micPermissionDenied":
        return t("log.micPermissionDenied");
      case "recordingFailed":
        return t("log.recordingFailed");
      case "recordingTooShort":
        return t("log.recordingTooShort");
      case "noSpeechDetected":
        return t("log.noSpeechDetected");
      case "transcribeFailed":
        return t("log.transcribeFailed");
      default:
        return null;
    }
  })();

  const hasTranscript = Boolean(voiceTranscript.trim());

  const resetToDefault = () => {
    clearSavedNote();
    clearRecordingError();
    setVoiceTranscript("");
    setInputText("");
    setGenerated(null);
    setIsGenerating(false);
  };

  const handleRetake = () => {
    resetToDefault();
  };

  const buildSourceParts = () => {
    const parts: string[] = [];
    if (logEntries.length > 0) {
      parts.push(buildLogSourceNote(logEntries, locale));
    }
    if (voiceTranscript.trim()) parts.push(voiceTranscript.trim());
    if (inputText.trim()) parts.push(inputText.trim());
    return parts.filter(Boolean).join("\n\n");
  };

  const handleGenerate = async (sourceOverride?: string) => {
    const source = sourceOverride ?? buildSourceParts();
    if (!source.trim()) return;
    Keyboard.dismiss();
    setIsGenerating(true);
    setGenerated(null);
    try {
      const report = await generateDailyReportFromApi({
        rawText: voiceTranscript || source,
        events: savedNote?.events,
        quickNotes: inputText,
        sourceNote: source,
      });
      setGenerated(report);
    } catch {
      setGenerated(generateDailyReport(source));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromLogs = () => {
    const source = buildSourceParts();
    if (!source.trim()) return;
    void handleGenerate(source);
  };

  useEffect(() => {
    if (!generated || isGenerating) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(reportSectionY.current - 16, 0),
        animated: true,
      });
    });
  }, [generated, isGenerating]);

  const handleSave = () => {
    if (!generated) return;
    setDailyReport(
      normalizeDailyReport(generated, {
        events: savedNote?.events,
        rawText: voiceTranscript,
      }),
    );
    if (savedNote?.events && savedNote.events.length > 0) {
      appendEventsForToday(savedNote.events);
    }
    resetToDefault();
  };

  const handleSaveCareLog = () => {
    const text = caregiverEntryText.trim();
    if (!text) return;
    const category = categorizeLog(text);
    addLogEntry({
      category: caregiverCategory || category,
      timestamp: new Date().toISOString(),
      rawText: text,
      summary: extractSummary(text),
    });
    setCaregiverEntryText("");
  };

  const displayLogEntries =
    logEntries.length > 0
      ? logEntries.map((entry) => {
          const meta = PRIMARY_CATEGORY_META[entry.category];
          return {
            text: entry.summary ?? entry.rawText,
            time: new Date(entry.timestamp).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
            type: entry.category === "sleep" ? "sleep" : entry.category === "meal" ? "meal" : entry.category === "clinic" ? "health" : "activity",
          };
        })
      : demoLogEntries;

  return (
    <ScreenScrollView innerRef={scrollRef} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("log.title")}</Text>
      <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

      {isCaregiver && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("log.caregiverSection")}</Text>

          <Text style={styles.fieldLabel}>{t("log.selectCategory")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {ORDERED_PRIMARY_CATEGORIES.map((cat) => {
              const meta = PRIMARY_CATEGORY_META[cat];
              const active = caregiverCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCaregiverCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {meta.emoji} {locale === "ko" ? meta.labelKo : meta.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>{t("log.entryText")}</Text>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={3}
            placeholder={t("log.entryPlaceholder")}
            placeholderTextColor={colors.muted}
            value={caregiverEntryText}
            onChangeText={setCaregiverEntryText}
          />

          <PressSlide
            style={[styles.saveLogBtn, !caregiverEntryText.trim() && styles.btnDisabled]}
            onPress={handleSaveCareLog}
            disabled={!caregiverEntryText.trim()}
          >
            <Text style={styles.saveLogBtnText}>{t("log.saveCareLog")}</Text>
          </PressSlide>

          <Text style={styles.savedTitle}>{t("log.savedEntries")}</Text>
          {logEntries.length === 0 ? (
            <Text style={styles.emptyEntries}>{t("log.noEntries")}</Text>
          ) : (
            logEntries.map((entry) => {
              const meta = PRIMARY_CATEGORY_META[entry.category];
              return (
                <View key={entry.id} style={styles.savedEntry}>
                  <Text style={styles.savedEntryCat}>
                    {meta.emoji} {locale === "ko" ? meta.labelKo : meta.labelEn}
                  </Text>
                  <Text style={styles.savedEntryText}>{entry.rawText}</Text>
                  <Text style={styles.savedEntryTime}>
                    {new Date(entry.timestamp).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            })
          )}

          {logEntries.length > 0 && (
            <PressSlide style={styles.generateFromLogsBtn} onPress={handleGenerateFromLogs}>
              <Sparkles size={14} color={colors.yellow} />
              <Text style={styles.generateFromLogsText}>{t("log.generateFromLogs")}</Text>
            </PressSlide>
          )}
        </View>
      )}

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
            <Text style={styles.recording}>{t("log.recordingLive")}</Text>
            <View style={styles.waveWrap}>
              <VoiceWaveform levels={levels} barCount={32} height={48} />
            </View>
            <Pressable style={styles.stopRecordBtn} onPress={() => void stopAndSave()}>
              <Square size={14} color={colors.primaryForeground} fill={colors.primaryForeground} />
              <Text style={styles.stopRecordBtnText}>{t("log.stopRecording")}</Text>
            </Pressable>
          </>
        ) : isTranscribing ? (
          <>
            <Text style={styles.recording}>{t("log.transcribing")}</Text>
            <View style={styles.waveWrap}>
              <VoiceWaveform levels={levels} barCount={32} height={48} active={false} />
            </View>
          </>
        ) : hasTranscript ? (
          <>
            <Text style={styles.transcript}>{voiceTranscript}</Text>
            {savedNote?.events && savedNote.events.length > 0 && (
              <View style={styles.eventList}>
                {savedNote.events.map((event, index) => (
                  <View key={`${event.category}-${index}`} style={styles.eventChip}>
                    <Text style={styles.eventChipText}>{event.category}</Text>
                  </View>
                ))}
              </View>
            )}
            {savedNote?.usedFallbackTranscript && (
              <Text style={styles.fallbackHint}>
                {recordingError === "transcribeFailed" ? t("log.transcribeFailed") : t("log.transcribeFallback")}
              </Text>
            )}
            <View style={styles.voiceActions}>
              <Pressable style={styles.retakeBtn} onPress={handleRetake}>
                <RotateCcw size={14} color={colors.text} />
                <Text style={styles.retakeBtnText}>{t("log.retake")}</Text>
              </Pressable>
              <Pressable
                style={[styles.generateVoiceBtn, isGenerating && styles.btnDisabled]}
                onPress={() => void handleGenerate()}
                disabled={isGenerating}
              >
                <Sparkles size={14} color={colors.yellow} />
                <Text style={styles.generateVoiceBtnText}>
                  {isGenerating ? t("log.generating") : t("log.generateReport")}
                </Text>
              </Pressable>
            </View>
            {savedNote && (
              <View style={styles.savedVoiceRow}>
                <CheckCircle size={11} color={colors.muted} />
                <Text style={styles.savedVoiceHint}>
                  {t("log.voiceSaved")} · {savedNote.savedAt}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.holdHint}>{t("log.holdCenterHint")}</Text>
            {errorMessage && <Text style={styles.errorHint}>{errorMessage}</Text>}
            <Pressable
              style={styles.recordBtn}
              onPress={() => {
                clearRecordingError();
                void startRecording();
              }}
            >
              <Mic size={16} color={colors.text} />
              <Text style={styles.recordBtnText}>{t("log.recordVoiceNote")}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("log.quickNotes")}</Text>
        <TextInput
          style={styles.textarea}
          multiline
          numberOfLines={4}
          placeholder={t("log.placeholder")}
          placeholderTextColor={colors.muted}
          value={inputText}
          onChangeText={setInputText}
        />
        {!hasTranscript && (
          <Pressable
            style={[styles.generateBtn, !buildSourceParts().trim() && styles.btnDisabled]}
            onPress={() => void handleGenerate()}
            disabled={isGenerating || !buildSourceParts().trim()}
          >
            <Sparkles size={15} color={colors.yellow} />
            <Text style={styles.generateBtnText}>{isGenerating ? t("log.generating") : t("log.generateReport")}</Text>
          </Pressable>
        )}
      </View>

      {(isGenerating || generated) && (
        <View
          onLayout={(event) => {
            reportSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          {isGenerating && (
            <View style={[styles.card, styles.aiCard, styles.centerCard]}>
              <Sparkles size={24} color={colors.yellow} />
              <Text style={styles.generatingText}>{t("log.generating")}</Text>
            </View>
          )}

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
                  <Text style={[styles.sectionBody, section.italic && styles.italic]}>{section.body}</Text>
                </View>
              ))}
              <View style={[styles.card, styles.saveCard]}>
                <View style={styles.saveHeader}>
                  <Sparkles size={14} color={colors.yellow} />
                  <Text style={styles.saveTitle}>{t("log.aiDraft")}</Text>
                  <Text style={styles.saveHint}>{t("log.readyToSend")}</Text>
                </View>
                <View style={styles.saveActions}>
                  <Pressable style={styles.sendBtn} onPress={handleSave}>
                    <Send size={14} color={colors.primaryForeground} />
                    <Text style={styles.sendBtnText}>{t("log.sendToParent")}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      <Text style={styles.logTitle}>{t("log.todaysLog")}</Text>
      {displayLogEntries.map((entry, i) => {
        const iconMap = { meal: Utensils, sleep: Moon, activity: Activity, health: Thermometer };
        const Icon = iconMap[entry.type as keyof typeof iconMap] ?? Activity;
        return (
          <View key={i} style={styles.logItem}>
            <View style={styles.logIcon}>
              <Icon size={14} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logText}>{entry.text}</Text>
              <Text style={styles.logTime}>{entry.time}</Text>
            </View>
          </View>
        );
      })}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, marginTop: 4 },
  categoryRow: { marginBottom: 12 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    marginRight: 8,
  },
  categoryChipActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  categoryChipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  categoryChipTextActive: { color: colors.text },
  saveLogBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveLogBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  savedTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 16, marginBottom: 8 },
  emptyEntries: { fontSize: 13, color: colors.muted },
  savedEntry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  savedEntryCat: { fontSize: 11, fontWeight: "700", color: colors.text, marginBottom: 4 },
  savedEntryText: { fontSize: 13, lineHeight: 20, color: colors.text },
  savedEntryTime: { fontSize: 11, color: colors.muted, marginTop: 4 },
  generateFromLogsBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  generateFromLogsText: { fontSize: 13, fontWeight: "600", color: colors.text },
  voiceCard: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.yellow,
    padding: 18,
    marginBottom: 14,
  },
  voiceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
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
  recording: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  holdHint: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 4,
  },
  errorHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#B45309",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  recordBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  recordBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
  stopRecordBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  stopRecordBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  waveWrap: { marginTop: 2 },
  transcript: { fontSize: 14, lineHeight: 22, color: colors.text },
  eventList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  eventChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eventChipText: { fontSize: 11, fontWeight: "600", color: colors.text },
  fallbackHint: { fontSize: 11, color: colors.muted, marginTop: 10 },
  voiceActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  retakeBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  generateVoiceBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  generateVoiceBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  savedVoiceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  savedVoiceHint: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  aiCard: { backgroundColor: colors.yellowSoft, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 12 },
  textarea: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 88,
    textAlignVertical: "top",
  },
  generateBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  btnDisabled: { opacity: 0.4 },
  generateBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  centerCard: { alignItems: "center", paddingVertical: 24 },
  generatingText: { marginTop: 8, fontSize: 14, fontWeight: "600", color: colors.text },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 8 },
  sectionBody: { fontSize: 14, lineHeight: 22, color: colors.muted },
  italic: { fontStyle: "italic", color: colors.text },
  saveCard: { borderTopWidth: 3, borderTopColor: colors.yellow },
  saveHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  saveTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  saveHint: { fontSize: 12, color: colors.muted },
  saveActions: { flexDirection: "row" },
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
  logTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 12 },
  logItem: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  logIcon: { backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 6 },
  logText: { fontSize: 14, lineHeight: 20, color: colors.text },
  logTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
