import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLanguage } from "../../LanguageContext";
import { useVoiceRecording } from "../../context/VoiceRecordingContext";
import { getCategory } from "../../constants/babyLogCategories";
import type { MessageKey } from "../../i18n";
import type { BabyLogActor } from "../../types/babyLog";
import { BabyLogIcon } from "./BabyLogIcon";
import {
  buildVoiceSession,
  voiceEventToLogFields,
  type VoiceEventDraft,
} from "../../utils/voiceToBabyLog";
import { VoiceWaveform } from "../VoiceWaveform";
import { colors } from "../../theme";
import { formatTemperature, formatVolume } from "../../utils/measurementFormat";
import { formatDisplayTime } from "../../utils/logSummary";

export type VoiceResult = VoiceEventDraft;

export type VoiceSessionPayload = {
  rawTranscript: string;
  events: VoiceResult[];
};

type Stage = "listening" | "analyzing" | "result" | "error";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirmAll: (session: VoiceSessionPayload) => void;
  onEditEvent: (event: VoiceResult, rawTranscript: string) => void;
  onManualEntry: () => void;
  /** When set, replaces the matching card in the open review session. */
  eventPatch?: VoiceResult | null;
  onEventPatchConsumed?: () => void;
  /** Nested overlays (e.g. edit sheet) must render inside this Modal on iOS. */
  children?: ReactNode;
};

const ERROR_KEYS: Record<string, MessageKey> = {
  micPermissionDenied: "voice.micPermissionDenied",
  recordingTooShort: "voice.recordingTooShort",
  noSpeechDetected: "voice.noSpeechDetected",
  transcribeFailed: "voice.transcribeFailed",
  recordingFailed: "voice.recordingFailed",
};

const LOW_CONFIDENCE = 0.55;

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatKoClock(hhmm: string): string {
  const configured = formatDisplayTime(hhmm);
  if (!configured.endsWith("AM") && !configured.endsWith("PM")) return configured;
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 || 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

function cardSummary(event: VoiceResult): string {
  const c = getCategory(event.cat);
  const bits = [c.label];
  if (event.amount) {
    if (event.cat === "temp") bits.push(formatTemperature(event.amount));
    else if (event.cat === "food") bits.push(`${event.amount}g`);
    else bits.push(formatVolume(event.amount));
  }
  if (event.duration) bits.push(`${event.duration}분`);
  if (event.chip) bits.push(event.chip);
  if (event.chip2) bits.push(event.chip2);
  bits.push(formatKoClock(event.time));
  return bits.join(" · ");
}

function needsConfirm(event: VoiceResult) {
  return (
    event.confidence < LOW_CONFIDENCE ||
    Boolean(event.flags?.includes("low_confidence")) ||
    Boolean(event.timeAmbiguous) ||
    Boolean(event.flags?.includes("time_ambiguous"))
  );
}

export function BabyLogVoiceOverlay({
  visible,
  onClose,
  onConfirmAll,
  onEditEvent,
  onManualEntry,
  eventPatch = null,
  onEventPatchConsumed,
  children,
}: Props) {
  const { t } = useLanguage();
  const {
    isRecording,
    levels,
    durationMs,
    savedNote,
    isTranscribing,
    recordingError,
    startRecording,
    stopAndSave,
    retryTranscribe,
    cancelRecording,
    clearSavedNote,
    clearRecordingError,
  } = useVoiceRecording();

  const [stage, setStage] = useState<Stage>("listening");
  const [events, setEvents] = useState<VoiceResult[]>([]);
  const [rawTranscript, setRawTranscript] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const openedRef = useRef(false);
  const appliedKeyRef = useRef<string | null>(null);
  const lastAnnounceRef = useRef("");

  const resetLocal = () => {
    setStage("listening");
    setEvents([]);
    setRawTranscript("");
    setTranscriptOpen(false);
    appliedKeyRef.current = null;
  };

  useEffect(() => {
    if (!visible) {
      openedRef.current = false;
      resetLocal();
      void cancelRecording();
      clearSavedNote();
      clearRecordingError();
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;
    clearSavedNote();
    clearRecordingError();
    resetLocal();
    void startRecording();
  }, [visible, startRecording, clearSavedNote, clearRecordingError, cancelRecording]);

  useEffect(() => {
    if (!visible) return;

    if (isTranscribing) {
      setStage("analyzing");
      return;
    }

    if (recordingError && !isRecording && !isTranscribing) {
      setStage("error");
      return;
    }

    if (savedNote?.transcript) {
      const applyKey = `${savedNote.id}:${savedNote.transcript}`;
      if (appliedKeyRef.current === applyKey) return;
      const session = buildVoiceSession(savedNote.transcript, savedNote.events ?? []);
      appliedKeyRef.current = applyKey;
      setRawTranscript(session.rawTranscript);
      setEvents(session.events);
      setTranscriptOpen(false);
      setStage("result");
    }
  }, [visible, isTranscribing, savedNote, recordingError, isRecording]);

  useEffect(() => {
    if (!eventPatch) return;
    setEvents((prev) => prev.map((e) => (e.id === eventPatch.id ? eventPatch : e)));
    onEventPatchConsumed?.();
  }, [eventPatch, onEventPatchConsumed]);

  const handleClose = () => {
    void cancelRecording();
    clearSavedNote();
    clearRecordingError();
    onClose();
  };

  const handleManualEntry = () => {
    void cancelRecording();
    clearSavedNote();
    clearRecordingError();
    onManualEntry();
  };

  const handleRetake = () => {
    clearSavedNote();
    clearRecordingError();
    resetLocal();
    void startRecording();
  };

  const handleRetryAnalyze = () => {
    clearRecordingError();
    void retryTranscribe();
  };

  const handleRemove = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const resolveTime = (id: string, time: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = {
          ...e,
          time,
          timeAmbiguous: false,
          timeOptions: undefined,
          flags: (e.flags ?? []).filter((f) => f !== "time_ambiguous"),
        };
        return next;
      }),
    );
  };

  const errorText = recordingError
    ? t(ERROR_KEYS[recordingError] ?? "voice.errorGeneric")
    : t("voice.errorGeneric");

  const canRetry = Boolean(savedNote?.uri) && recordingError === "transcribeFailed";
  const listeningStatus = isRecording ? t("voice.listening") : t("voice.preparing");
  const listeningA11y = t("voice.statusWithTime")
    .replace("{status}", listeningStatus)
    .replace("{time}", formatDuration(durationMs));
  const showClose = stage === "analyzing" || stage === "result" || stage === "error";

  useEffect(() => {
    if (!visible) {
      lastAnnounceRef.current = "";
      return;
    }
    let message = "";
    if (stage === "listening") message = listeningStatus;
    else if (stage === "analyzing") message = t("voice.analyzing");
    else if (stage === "result") message = events.length === 0 ? t("voice.noEvents") : t("voice.resultTitle");
    else if (stage === "error") message = errorText;
    if (!message || lastAnnounceRef.current === message) return;
    lastAnnounceRef.current = message;
    AccessibilityInfo.announceForAccessibility(message);
  }, [visible, stage, listeningStatus, events.length, errorText, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <View style={styles.stage}>
          {showClose ? (
            <Pressable
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("voice.close")}
            >
              <Text style={styles.closeBtnText}>{t("voice.close")}</Text>
            </Pressable>
          ) : null}

          {stage === "listening" && (
            <>
              <Text
                style={styles.state}
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                accessibilityLabel={listeningStatus}
              >
                {listeningStatus}
              </Text>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <VoiceWaveform levels={levels} barCount={28} height={64} barColor={colors.amber} />
              </View>
              <Text
                style={styles.duration}
                accessibilityRole="text"
                accessibilityLabel={listeningA11y}
              >
                {formatDuration(durationMs)}
              </Text>
              <Text style={styles.hint}>{t("voice.hint")}</Text>
              <View style={styles.listenActions}>
                <Pressable
                  style={[styles.btn, styles.btnGhost, styles.listenBtn]}
                  onPress={handleClose}
                  accessibilityRole="button"
                  accessibilityLabel={t("voice.cancel")}
                >
                  <Text style={styles.btnGhostText}>{t("voice.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, styles.listenBtn, !isRecording && styles.btnDisabled]}
                  disabled={!isRecording}
                  onPress={() => void stopAndSave()}
                  accessibilityRole="button"
                  accessibilityLabel={t("voice.stop")}
                  accessibilityState={{ disabled: !isRecording }}
                >
                  <Text style={styles.btnPrimaryText}>{t("voice.stop")}</Text>
                </Pressable>
              </View>
            </>
          )}

          {stage === "analyzing" && (
            <>
              <Text
                style={styles.state}
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                accessibilityLabel={t("voice.analyzing")}
              >
                {t("voice.analyzing")}
              </Text>
              <ActivityIndicator size="large" color={colors.amberText} style={{ marginBottom: 16 }} />
              <Text style={styles.analyzingText}>{t("voice.analyzingHint")}</Text>
            </>
          )}

          {stage === "result" && (
            <ScrollView
              style={styles.resultScroll}
              contentContainerStyle={styles.resultScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.state} accessibilityLiveRegion="polite">
                {t("voice.resultTitle")}
              </Text>
              {events.length > 1 && (
                <Text style={styles.eventCount}>
                  {t("voice.eventCount").replace("{count}", String(events.length))}
                </Text>
              )}

              {events.length === 0 ? (
                <Text style={styles.emptyEvents}>{t("voice.noEvents")}</Text>
              ) : (
                events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => onEditEvent(event, rawTranscript)}
                    onRemove={() => handleRemove(event.id)}
                    onResolveTime={(time) => resolveTime(event.id, time)}
                    t={t}
                  />
                ))
              )}

              <Pressable style={styles.transcriptToggle} onPress={() => setTranscriptOpen((v) => !v)}>
                <Text style={styles.transcriptToggleText}>
                  {transcriptOpen ? t("voice.heardHide") : t("voice.heardToggle")}
                </Text>
              </Pressable>
              {transcriptOpen && (
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptBody}>
                    {rawTranscript ? `"${rawTranscript}"` : t("voice.noTranscript")}
                  </Text>
                </View>
              )}

              {events.length > 0 ? (
                <Pressable
                  style={[styles.btn, styles.btnPrimary, styles.confirmBtn]}
                  onPress={() => onConfirmAll({ rawTranscript, events })}
                >
                  <Text style={styles.btnPrimaryText}>{t("voice.confirm")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.btn, styles.btnGhost, events.length > 0 ? styles.retakeBtn : styles.confirmBtn]}
                onPress={handleRetake}
              >
                <Text style={styles.btnGhostText}>{t("voice.retake")}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost, styles.retakeBtn]} onPress={handleManualEntry}>
                <Text style={styles.btnGhostText}>{t("voice.manualEntry")}</Text>
              </Pressable>
            </ScrollView>
          )}

          {stage === "error" && (
            <>
              <Text
                style={styles.state}
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
              >
                {recordingError === "transcribeFailed" ? t("voice.transcribeFailed") : t("voice.errorTitle")}
              </Text>
              {recordingError !== "transcribeFailed" ? (
                <Text style={styles.errorText}>{errorText}</Text>
              ) : (
                <Text style={styles.errorHint}>{t("voice.transcribeFailedHint")}</Text>
              )}
              <View style={styles.errorActions}>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, styles.stopBtn]}
                  onPress={recordingError === "transcribeFailed" && canRetry ? handleRetryAnalyze : handleRetake}
                  accessibilityRole="button"
                  accessibilityLabel={recordingError === "transcribeFailed" ? t("voice.retry") : t("voice.retake")}
                >
                  <Text style={styles.btnPrimaryText}>
                    {recordingError === "transcribeFailed" ? t("voice.retry") : t("voice.retake")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnGhost, styles.stopBtn]}
                  onPress={handleManualEntry}
                  accessibilityRole="button"
                  accessibilityLabel={t("voice.manualEntry")}
                >
                  <Text style={styles.btnGhostText}>{t("voice.manualEntry")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
      {children}
    </Modal>
  );
}

function EventCard({
  event,
  onEdit,
  onRemove,
  onResolveTime,
  t,
}: {
  event: VoiceResult;
  onEdit: () => void;
  onRemove: () => void;
  onResolveTime: (time: string) => void;
  t: (key: MessageKey) => string;
}) {
  const c = getCategory(event.cat);
  const summary = cardSummary(event);
  const warn = needsConfirm(event);

  return (
    <View style={[styles.resultCard, warn && styles.resultCardWarn]}>
      {warn && (
        <Text style={styles.warnBanner}>
          {event.timeAmbiguous
            ? t("voice.timeAmbiguous")
            : t("voice.needsConfirm")}
        </Text>
      )}
      <View style={styles.resultCat}>
        <View style={[styles.resultCircle, { backgroundColor: c.color }]}>
          <BabyLogIcon catId={event.cat} size={22} color="#FFFFFF" strokeWidth={2} />
        </View>
        <View style={styles.resultTextWrap}>
          <Text style={styles.resultLabel}>{c.label}</Text>
          <Text style={styles.resultMeta}>{summary}</Text>
          {event.notes ? <Text style={styles.resultNotes}>{event.notes}</Text> : null}
          {warn && !event.timeAmbiguous ? (
            <Text style={styles.understoodAs}>
              {t("voice.understoodAs").replace("{summary}", summary)}
            </Text>
          ) : null}
        </View>
      </View>

      {event.timeAmbiguous && event.timeOptions && event.timeOptions.length >= 2 && (
        <View style={styles.timeChoices}>
          {event.timeOptions.map((opt) => (
            <Pressable key={opt} style={styles.timeChoice} onPress={() => onResolveTime(opt)}>
              <Text style={styles.timeChoiceText}>{formatKoClock(opt)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.cardActions}>
        <Pressable style={styles.cardBtn} onPress={onEdit}>
          <Text style={styles.cardBtnText}>{t("voice.edit")}</Text>
        </Pressable>
        <Pressable style={styles.cardBtn} onPress={onRemove}>
          <Text style={[styles.cardBtnText, styles.cardBtnDanger]}>{t("voice.removeCard")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function voiceResultToLog(
  result: VoiceResult,
  rawTranscript: string,
  createdBy?: BabyLogActor,
) {
  return {
    ...voiceEventToLogFields(result, rawTranscript),
    createdBy,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(46,42,38,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  stage: { width: "100%", maxHeight: "92%", alignItems: "center" },
  closeBtn: {
    alignSelf: "flex-end",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  closeBtnText: { color: "#A39E96", fontSize: 14, fontWeight: "700" },
  listenActions: { flexDirection: "row", gap: 10, width: "100%" },
  listenBtn: { flex: 1 },
  resultScroll: { width: "100%" },
  resultScrollContent: { alignItems: "stretch", paddingBottom: 8 },
  state: {
    color: "#A39E96",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
    textAlign: "center",
  },
  eventCount: { fontSize: 12, color: "#7A746C", textAlign: "center", marginBottom: 12 },
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
  errorText: { fontSize: 14, color: "#D8D2CB", textAlign: "center", lineHeight: 22, marginBottom: 10 },
  errorHint: { fontSize: 12.5, color: "#A39E96", textAlign: "center", lineHeight: 20, marginBottom: 18 },
  errorActions: { width: "100%", gap: 10 },
  emptyEvents: { color: "#D8D2CB", textAlign: "center", marginBottom: 16, lineHeight: 22 },
  resultCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    width: "100%",
    marginBottom: 12,
  },
  resultCardWarn: { borderColor: colors.amber },
  warnBanner: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.amberDark,
    marginBottom: 10,
  },
  resultCat: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  resultTextWrap: { flex: 1 },
  resultLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  resultMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  resultNotes: { fontSize: 11.5, color: colors.faint, marginTop: 4 },
  understoodAs: { fontSize: 11.5, color: colors.amberDark, marginTop: 6 },
  timeChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  timeChoice: {
    backgroundColor: colors.amberSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeChoiceText: { fontSize: 13, fontWeight: "700", color: colors.amberDark },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  cardBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
  },
  cardBtnText: { fontSize: 13.5, fontWeight: "700", color: colors.muted },
  cardBtnDanger: { color: "#B45309" },
  transcriptToggle: { alignSelf: "center", paddingVertical: 10, marginBottom: 4 },
  transcriptToggleText: { fontSize: 13, fontWeight: "600", color: "#A39E96" },
  transcriptBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  transcriptBody: { color: "#D8D2CB", fontSize: 13.5, lineHeight: 20 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  stopBtn: { width: "100%" },
  confirmBtn: { width: "100%", marginTop: 6 },
  retakeBtn: { width: "100%", marginTop: 10 },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
  btnDisabled: { opacity: 0.45 },
});
