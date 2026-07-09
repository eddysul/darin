import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { getCategory, nowTime } from "../../constants/babyLogCategories";
import { transcribeToVoiceResult, type VoiceParseResult } from "../../utils/voiceToBabyLog";
import { VoiceWaveform } from "../VoiceWaveform";
import { colors } from "../../theme";

export type VoiceResult = VoiceParseResult;

type Stage = "listening" | "analyzing" | "result" | "error";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: VoiceResult) => void;
  onEdit: (result: VoiceResult) => void;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function errorMessage(code: string | null): string {
  switch (code) {
    case "micPermissionDenied":
      return "마이크 권한이 필요해요. 설정에서 허용해 주세요.";
    case "recordingTooShort":
      return "녹음이 너무 짧아요. 조금 더 길게 말해 주세요.";
    case "noSpeechDetected":
      return "음성이 감지되지 않았어요. 다시 시도해 주세요.";
    case "transcribeFailed":
      return "전사 서버에 연결하지 못했어요. 데모 결과를 표시합니다.";
    case "recordingFailed":
      return "녹음에 실패했어요. 다시 시도해 주세요.";
    default:
      return "문제가 발생했어요. 다시 시도해 주세요.";
  }
}

export function BabyLogVoiceOverlay({ visible, onClose, onConfirm, onEdit }: Props) {
  const {
    isRecording,
    levels,
    durationMs,
    savedNote,
    isTranscribing,
    recordingError,
    startRecording,
    stopAndSave,
    cancelRecording,
    clearSavedNote,
    clearRecordingError,
  } = useVoiceRecording();

  const [stage, setStage] = useState<Stage>("listening");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [transcript, setTranscript] = useState("");
  const openedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      openedRef.current = false;
      setStage("listening");
      setResult(null);
      setTranscript("");
      void cancelRecording();
      clearSavedNote();
      clearRecordingError();
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;
    clearSavedNote();
    clearRecordingError();
    setStage("listening");
    setResult(null);
    setTranscript("");
    void startRecording();
  }, [visible, startRecording, clearSavedNote, clearRecordingError, cancelRecording]);

  useEffect(() => {
    if (!visible) return;

    if (isTranscribing) {
      setStage("analyzing");
      if (savedNote?.transcript) setTranscript(savedNote.transcript);
      return;
    }

    if (savedNote?.transcript) {
      const parsed = transcribeToVoiceResult(savedNote.transcript, savedNote.events ?? []);
      setTranscript(savedNote.transcript);
      setResult(parsed);
      setStage("result");
      return;
    }

    if (recordingError && !isRecording && !isTranscribing) {
      if (savedNote?.usedFallbackTranscript && savedNote.transcript) {
        const parsed = transcribeToVoiceResult(savedNote.transcript, savedNote.events ?? []);
        setTranscript(savedNote.transcript);
        setResult(parsed);
        setStage("result");
        return;
      }
      setStage("error");
    }
  }, [visible, isTranscribing, savedNote, recordingError, isRecording]);

  const handleClose = () => {
    void cancelRecording();
    clearSavedNote();
    clearRecordingError();
    onClose();
  };

  const handleStop = () => {
    void stopAndSave();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.stage} onPress={() => {}}>
          {stage === "listening" && (
            <>
              <Text style={styles.state}>{isRecording ? "듣고 있어요" : "준비 중"}</Text>
              <VoiceWaveform levels={levels} barCount={28} height={64} barColor={colors.amber} />
              <Text style={styles.duration}>{formatDuration(durationMs)}</Text>
              <Text style={styles.hint}>말씀해 주세요. 끝나면 아래 버튼을 눌러 주세요.</Text>
              <Pressable style={[styles.btn, styles.btnPrimary, styles.stopBtn]} onPress={handleStop}>
                <Text style={styles.btnPrimaryText}>녹음 완료</Text>
              </Pressable>
            </>
          )}

          {stage === "analyzing" && (
            <>
              <Text style={styles.state}>자동 분류 중</Text>
              <ActivityIndicator size="large" color={colors.amber} style={{ marginBottom: 16 }} />
              <Text style={styles.analyzingText}>
                {transcript ? `"${transcript}"` : "음성을 텍스트로 변환하고 있어요..."}
              </Text>
            </>
          )}

          {stage === "result" && result && (
            <>
              <Text style={styles.state}>기록으로 변환됐어요</Text>
              {savedNote?.usedFallbackTranscript && (
                <Text style={styles.fallbackNote}>서버 연결 실패 — 데모 전사 결과입니다</Text>
              )}
              <ResultCard result={result} />
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => onEdit(result)}>
                  <Text style={styles.btnGhostText}>수정하기</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onConfirm(result)}>
                  <Text style={styles.btnPrimaryText}>기록에 추가</Text>
                </Pressable>
              </View>
            </>
          )}

          {stage === "error" && (
            <>
              <Text style={styles.state}>다시 시도해 주세요</Text>
              <Text style={styles.errorText}>{errorMessage(recordingError)}</Text>
              <Pressable
                style={[styles.btn, styles.btnPrimary, styles.stopBtn]}
                onPress={() => {
                  clearSavedNote();
                  clearRecordingError();
                  setStage("listening");
                  void startRecording();
                }}
              >
                <Text style={styles.btnPrimaryText}>다시 녹음</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ResultCard({ result }: { result: VoiceResult }) {
  const c = getCategory(result.cat);
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultCat}>
        <View style={[styles.resultCircle, { backgroundColor: c.color }]}>
          <Text>{c.emoji}</Text>
        </View>
        <Text style={styles.resultLabel}>{c.label}</Text>
      </View>
      <Text style={styles.resultFrom}>"{result.text}"</Text>
      <Text style={styles.resultMeta}>{result.extraLabel}</Text>
    </View>
  );
}

export function voiceResultToLog(result: VoiceResult) {
  return {
    cat: result.cat,
    time: nowTime(),
    chip: result.chip,
    chip2: result.chip2,
    amount: result.amount,
    duration: result.duration,
    voice: true,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(46,42,38,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  stage: { width: "100%", alignItems: "center" },
  state: {
    color: "#A39E96",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 22,
  },
  duration: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FEF7F2",
    marginTop: 12,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
  hint: { fontSize: 13, color: "#A39E96", textAlign: "center", marginBottom: 20 },
  analyzingText: { color: "#D8D2CB", fontSize: 14, textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
  fallbackNote: { fontSize: 11.5, color: colors.amber, marginBottom: 10, textAlign: "center" },
  errorText: { fontSize: 14, color: "#D8D2CB", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  resultCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    width: "100%",
  },
  resultCat: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  resultCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  resultLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  resultFrom: { fontSize: 12, color: colors.faint, marginBottom: 14, paddingLeft: 44 },
  resultMeta: { fontSize: 13, color: colors.muted, paddingLeft: 44 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18, width: "100%" },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  stopBtn: { flex: 0, width: "100%", marginTop: 4 },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
});
