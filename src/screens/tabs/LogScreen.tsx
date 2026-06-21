import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  Moon,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Thermometer,
  Utensils,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { VoiceWaveform } from "../../components/VoiceWaveform";
import { generateReport } from "../../api/transcribe";
import { useApp } from "../../context/AppContext";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { getLogEntries } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import { createId } from "../../utils/id";
import type { DailyReport } from "../../types/dailyReport";
import { colors, radius } from "../../theme";

export function LogScreen() {
  const { dailyReport, setDailyReport } = useApp();
  const { locale, t } = useLanguage();
  const logEntries = getLogEntries(locale);
  const { isRecording, isTranscribing, levels, savedNote, clearSavedNote } = useVoiceRecording();
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState<DailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localEntries, setLocalEntries] = useState<{ type: "meal" | "sleep" | "activity" | "health"; text: string; time: string }[]>([]);
  const [addedToLog, setAddedToLog] = useState(false);

  useEffect(() => {
    if (savedNote?.transcript) {
      setVoiceTranscript(savedNote.transcript);
    }
  }, [savedNote]);

  const hasTranscript = Boolean(voiceTranscript);

  const handleRetake = () => {
    clearSavedNote();
    setVoiceTranscript("");
    setGenerated(null);
    setSaved(false);
    setAddedToLog(false);
  };

  const handleAddToLog = () => {
    if (!voiceTranscript.trim() || addedToLog) return;
    const categoryIconMap: Record<string, "meal" | "sleep" | "activity" | "health" | undefined> = {
      식사: "meal", 간식: "meal", 영양제: "meal",
      수면: "sleep",
      배변: "activity", 목욕: "activity", 터미타임: "activity",
      진료: "health", "온도/습도": "health", "복용 약": "health",
    };
    const firstCategory = savedNote?.events?.[0]?.category as string | undefined;
    const type: "meal" | "sleep" | "activity" | "health" = (firstCategory ? categoryIconMap[firstCategory] : undefined) ?? "activity";
    const now = new Date();
    const time = now.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
    setLocalEntries((prev) => [{ type, text: voiceTranscript.trim(), time }, ...prev]);
    setAddedToLog(true);
  };

  const handleGenerate = async () => {
    const source = [voiceTranscript, inputText].filter(Boolean).join("\n\n");
    if (!source.trim()) return;
    setIsGenerating(true);
    setSaved(false);
    try {
      const events = (savedNote?.events ?? []) as Record<string, unknown>[];
      const result = await generateReport(source, events);
      const now = new Date();
      setGenerated({
        id: createId(),
        date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        child: "",
        caregiver: "Ji-yeon Park",
        sourceNote: source,
        reportEn: result.reportEn,
        reportKo: result.reportKo,
        parentReplyDraft: result.parentReplyDraft,
        items: result.items,
        savedAt: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      });
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generated) return;
    setDailyReport(generated);
    setSaved(true);
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("log.title")}</Text>
      <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

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
              <Text style={styles.fallbackHint}>{t("log.transcribeFallback")}</Text>
            )}
            <View style={styles.voiceActions}>
              <Pressable style={styles.retakeBtn} onPress={handleRetake}>
                <RotateCcw size={14} color={colors.text} />
                <Text style={styles.retakeBtnText}>{t("log.retake")}</Text>
              </Pressable>
              <Pressable
                style={[styles.generateVoiceBtn, isGenerating && styles.btnDisabled]}
                onPress={handleGenerate}
                disabled={isGenerating}
              >
                <Sparkles size={14} color={colors.yellow} />
                <Text style={styles.generateVoiceBtnText}>
                  {isGenerating ? t("log.generating") : t("log.generateReport")}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.addToLogBtn, addedToLog && styles.addToLogBtnDone]}
              onPress={handleAddToLog}
              disabled={addedToLog}
            >
              <CheckCircle size={14} color={addedToLog ? colors.sage : colors.text} />
              <Text style={[styles.addToLogBtnText, addedToLog && styles.addToLogBtnTextDone]}>
                {addedToLog ? "오늘의 기록에 추가됨" : "오늘의 기록에 추가"}
              </Text>
            </Pressable>
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
          <Text style={styles.holdHint}>{t("log.holdCenterHint")}</Text>
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
            style={[styles.generateBtn, !inputText.trim() && styles.btnDisabled]}
            onPress={handleGenerate}
            disabled={isGenerating || !inputText.trim()}
          >
            <Sparkles size={15} color={colors.yellow} />
            <Text style={styles.generateBtnText}>{isGenerating ? t("log.generating") : t("log.generateReport")}</Text>
          </Pressable>
        )}
      </View>

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
            {saved && (
              <Text style={styles.savedText}>
                <CheckCircle size={12} color={colors.text} /> {t("log.savedToReports")}
              </Text>
            )}
          </View>
        </>
      )}

      <Text style={styles.logTitle}>{t("log.todaysLog")}</Text>
      {[...localEntries, ...logEntries].map((entry, i) => {
        const iconMap = { meal: Utensils, sleep: Moon, activity: Activity, health: Thermometer };
        const Icon = iconMap[entry.type];
        const isNew = i < localEntries.length;
        return (
          <View key={i} style={[styles.logItem, isNew && styles.logItemNew]}>
            <View style={[styles.logIcon, isNew && styles.logIconNew]}>
              <Icon size={14} color={isNew ? colors.yellow : colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logText}>{entry.text}</Text>
              <Text style={styles.logTime}>{entry.time}</Text>
            </View>
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
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
    paddingVertical: 8,
  },
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
  savedText: { marginTop: 10, fontSize: 12, color: colors.muted, fontWeight: "500" },
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
  logIconNew: { backgroundColor: colors.yellowSoft },
  logText: { fontSize: 14, lineHeight: 20, color: colors.text },
  logTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
  logItemNew: { borderColor: colors.yellow },
  newBadge: {
    backgroundColor: colors.yellow,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  newBadgeText: { fontSize: 9, fontWeight: "800", color: colors.text },
  addToLogBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
  },
  addToLogBtnDone: { borderColor: colors.sage, backgroundColor: `${colors.sage}10` },
  addToLogBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
  addToLogBtnTextDone: { color: colors.sage },
});
