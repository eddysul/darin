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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("log.title")}</Text>
      <Text style={styles.subtitle}>{t("log.subtitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("log.voiceNote")}</Text>
        <View style={styles.voiceRow}>
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleVoiceToggle}
          >
            {isRecording ? <Pause size={22} color={colors.champagne} /> : <Mic size={22} color={colors.text} />}
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
          <Sparkles size={15} color={colors.text} />
          <Text style={styles.generateBtnText}>{isGenerating ? t("log.generating") : t("log.generateReport")}</Text>
        </Pressable>
      </View>

      {isGenerating && (
        <View style={[styles.card, styles.centerCard]}>
          <Sparkles size={24} color={colors.gold} />
          <Text style={styles.generatingText}>{t("log.generating")}</Text>
        </View>
      )}

      {generated && !isGenerating && (
        <>
          {[
            { title: t("log.originalNote"), body: generated.sourceNote },
            { title: t("log.aiReportEn"), body: generated.reportEn },
            { title: t("log.aiReportKo"), body: generated.reportKo },
            { title: t("log.parentReplyDraft"), body: generated.parentReplyDraft, italic: true },
          ].map((section) => (
            <View key={section.title} style={styles.card}>
              <Text style={styles.sectionLabel}>
                <Sparkles size={11} color={colors.gold} /> {section.title}
              </Text>
              <Text style={[styles.sectionBody, section.italic && styles.italic]}>{section.body}</Text>
            </View>
          ))}
          <View style={[styles.card, styles.saveCard]}>
            <View style={styles.saveHeader}>
              <Sparkles size={14} color={colors.gold} />
              <Text style={styles.saveTitle}>{t("log.aiDraft")}</Text>
              <Text style={styles.saveHint}>{t("log.readyToSend")}</Text>
            </View>
            <View style={styles.saveActions}>
              <Pressable style={styles.generateBtn} onPress={handleSave}>
                <Send size={14} color={colors.text} />
                <Text style={styles.generateBtnText}>{t("log.sendToParent")}</Text>
              </Pressable>
            </View>
            {saved && (
              <Text style={styles.savedText}>
                <CheckCircle size={12} color={colors.sage} /> {t("log.savedToReports")}
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
              <Icon size={14} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logText}>{entry.text}</Text>
              <Text style={styles.logTime}>{entry.time}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 12 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  micBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: colors.navy, transform: [{ scale: 1.05 }] },
  recording: { fontSize: 14, fontWeight: "600", color: colors.text },
  transcriptLabel: { fontSize: 12, fontWeight: "600", color: colors.gold, marginBottom: 4 },
  transcript: { fontSize: 14, lineHeight: 20, color: colors.text, opacity: 0.85 },
  tapLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  tapHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
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
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  btnDisabled: { opacity: 0.4 },
  generateBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  centerCard: { alignItems: "center", paddingVertical: 24 },
  generatingText: { marginTop: 8, fontSize: 14, fontWeight: "600", color: colors.text },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.gold, marginBottom: 8 },
  sectionBody: { fontSize: 14, lineHeight: 22, color: colors.text, opacity: 0.85 },
  italic: { fontStyle: "italic" },
  saveCard: { backgroundColor: "#FFF9EB", borderColor: colors.border },
  saveHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  saveTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  saveHint: { fontSize: 12, color: colors.muted },
  saveActions: { flexDirection: "row" },
  savedText: { marginTop: 10, fontSize: 12, color: colors.sage, fontWeight: "500" },
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
  logIcon: { backgroundColor: colors.champagne, borderRadius: 12, padding: 6 },
  logText: { fontSize: 14, lineHeight: 20, color: colors.text },
  logTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
