import { Mic, Sparkles } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVoiceRecording } from "../context/VoiceRecordingContext";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";
import { VoiceWaveform } from "./VoiceWaveform";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceRecordingOverlay() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { isRecording, levels, durationMs, stopAndSave } = useVoiceRecording();

  if (!isRecording) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => void stopAndSave()}>
      <Pressable style={styles.backdrop} onPress={() => void stopAndSave()}>
        <Pressable style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 12) + 88 }]} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.liveDot} />
            <Text style={styles.title}>{t("log.recordingLive")}</Text>
            <Text style={styles.duration}>{formatDuration(durationMs)}</Text>
          </View>

          <VoiceWaveform levels={levels} barCount={36} height={72} />

          <View style={styles.footer}>
            <Sparkles size={12} color={colors.yellow} />
            <Text style={styles.hint}>{t("log.tapMicToSave")}</Text>
          </View>

          <Pressable style={styles.saveBtn} onPress={() => void stopAndSave()}>
            <Mic size={18} color={colors.primaryForeground} />
            <Text style={styles.saveBtnText}>{t("log.saveRecording")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.yellow,
    padding: 18,
    gap: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  duration: { fontSize: 14, fontWeight: "600", color: colors.muted, fontVariant: ["tabular-nums"] },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hint: { fontSize: 12, color: colors.muted, textAlign: "center" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
});
