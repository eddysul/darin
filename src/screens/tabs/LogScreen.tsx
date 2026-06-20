import { useState } from "react";
import {
  Activity,
  CheckCircle,
  Mic,
  Moon,
  Pause,
  Send,
  Sparkles,
  Thermometer,
  Utensils,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { DEMO_VOICE_TRANSCRIPT, generateDailyReport } from "../../demo/dailyReport";
import { getLogEntries } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import type { DailyReport } from "../../types/dailyReport";
import { colors, radius } from "../../theme";

export function LogScreen() {
  const { dailyReport, setDailyReport } = useApp();
  const { locale, t } = useLanguage();
  const logEntries = getLogEntries(locale);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState<DailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleVoiceToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceTranscript(DEMO_VOICE_TRANSCRIPT);
    } else {
      setIsRecording(true);
      setVoiceTranscript("");
    }
  };

  const handleGenerate = () => {
    const source = [voiceTranscript, inputText].filter(Boolean).join("\n\n");
    if (!source.trim()) return;
    setIsGenerating(true);
    setSaved(false);
    setTimeout(() => {
      setGenerated(generateDailyReport(source));
      setIsGenerating(false);
    }, 900);
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
        <View style={styles.voiceRow}>
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleVoiceToggle}
          >
            {isRecording ? (
              <Pause size={24} color={colors.primaryForeground} />
            ) : (
              <Mic size={24} color={colors.text} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            {isRecording ? (
              <Text style={styles.recording}>{t("log.recording")}</Text>
            ) : voiceTranscript ? (
              <>
                <Text style={styles.transcriptLabel}>{t("log.transcriptReady")}</Text>
                <Text style={styles.transcript}>{voiceTranscript}</Text>
              </>
            ) : (
              <>
                <Text style={styles.tapLabel}>{t("log.tapToRecord")}</Text>
                <Text style={styles.tapHint}>{t("log.autoTranscribed")}</Text>
              </>
            )}
          </View>
        </View>
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
        <Pressable
          style={[styles.generateBtn, (!voiceTranscript && !inputText.trim()) && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={isGenerating || (!voiceTranscript && !inputText.trim())}
        >
          <Sparkles size={15} color={colors.yellow} />
          <Text style={styles.generateBtnText}>{isGenerating ? t("log.generating") : t("log.generateReport")}</Text>
        </Pressable>
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
      {logEntries.map((entry, i) => {
        const iconMap = { meal: Utensils, sleep: Moon, activity: Activity, health: Thermometer };
        const Icon = iconMap[entry.type];
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
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: colors.black, transform: [{ scale: 1.05 }] },
  recording: { fontSize: 14, fontWeight: "600", color: colors.text },
  transcriptLabel: { fontSize: 12, fontWeight: "600", color: colors.yellow, marginBottom: 4 },
  transcript: { fontSize: 14, lineHeight: 20, color: colors.text },
  tapLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  tapHint: { fontSize: 12, color: colors.muted, marginTop: 4 },
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
  logText: { fontSize: 14, lineHeight: 20, color: colors.text },
  logTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
