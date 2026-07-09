import { Audio } from "expo-av";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEMO_VOICE_TRANSCRIPT } from "../demo/dailyReport";
import { transcribeRecording } from "../api/transcribe";
import type { VoiceNote } from "../types/voiceNote";
import { createId } from "../utils/id";

const HOLD_MS = 600;
const METER_INTERVAL_MS = 80;
const MAX_LEVELS = 48;
const MIN_RECORDING_MS = 400;

type VoiceRecordingContextValue = {
  isRecording: boolean;
  isHolding: boolean;
  holdProgress: number;
  levels: number[];
  durationMs: number;
  savedNote: VoiceNote | null;
  isTranscribing: boolean;
  recordingError: string | null;
  beginHold: () => void;
  endHold: () => void;
  startRecording: () => Promise<void>;
  stopAndSave: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  clearSavedNote: () => void;
  clearRecordingError: () => void;
  consumeSkipPress: () => boolean;
};

const VoiceRecordingContext = createContext<VoiceRecordingContextValue | null>(null);

function normalizeMetering(metering?: number) {
  if (metering == null || Number.isNaN(metering)) return 0.15;
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}

function formatSavedAt() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

async function resetAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  } catch {
    // ignore
  }
}

export function VoiceRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(MAX_LEVELS).fill(0.1));
  const [durationMs, setDurationMs] = useState(0);
  const [savedNote, setSavedNote] = useState<VoiceNote | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdFrameRef = useRef<number | null>(null);
  const holdStartedRecordingRef = useRef(false);
  const skipNextPressRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const isStartingRef = useRef(false);

  const pushLevel = useCallback((value: number) => {
    setLevels((prev) => [...prev.slice(-(MAX_LEVELS - 1)), value]);
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdFrameRef.current != null) {
      cancelAnimationFrame(holdFrameRef.current);
      holdFrameRef.current = null;
    }
    holdStartRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isStartingRef.current) return;

    isStartingRef.current = true;
    setRecordingError(null);
    setSavedNote(null);
    setIsTranscribing(false);

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setRecordingError("micPermissionDenied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        pushLevel(normalizeMetering(status.metering));
        if (status.durationMillis != null) setDurationMs(status.durationMillis);
      });
      recording.setProgressUpdateInterval(METER_INTERVAL_MS);
      await recording.startAsync();

      recordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationMs(0);
      setLevels(Array(MAX_LEVELS).fill(0.12));
    } catch {
      setRecordingError("recordingFailed");
      await resetAudioMode();
    } finally {
      isStartingRef.current = false;
    }
  }, [isRecording, pushLevel]);

  const stopAndSave = useCallback(async () => {
    if (!isRecording || isSavingRef.current) return;

    isSavingRef.current = true;
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);

    let uri: string | null = null;
    let finalDuration = durationMs;

    const recording = recordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        uri = recording.getURI();
        const status = await recording.getStatusAsync();
        if (status.durationMillis != null) finalDuration = status.durationMillis;
      } catch {
        uri = null;
      }
      recordingRef.current = null;
    }

    if (recordingStartedAtRef.current != null && finalDuration === 0) {
      finalDuration = Date.now() - recordingStartedAtRef.current;
    }
    recordingStartedAtRef.current = null;

    setIsRecording(false);
    await resetAudioMode();

    if (finalDuration < MIN_RECORDING_MS) {
      setRecordingError("recordingTooShort");
      isSavingRef.current = false;
      return;
    }

    const baseNote: VoiceNote = {
      id: createId(),
      uri,
      durationMs: finalDuration,
      transcript: "",
      savedAt: formatSavedAt(),
    };

    if (!uri) {
      setSavedNote({
        ...baseNote,
        transcript: DEMO_VOICE_TRANSCRIPT,
        usedFallbackTranscript: true,
      });
      setRecordingError("recordingFailed");
      isSavingRef.current = false;
      return;
    }

    setSavedNote(baseNote);
    setIsTranscribing(true);

    try {
      const result = await transcribeRecording(uri);
      const transcript = result.raw_text?.trim() ?? "";

      if (!transcript) {
        setSavedNote({
          ...baseNote,
          transcript: "",
          events: result.events,
          transcribeDate: result.date,
          usedFallbackTranscript: false,
        });
        setRecordingError("noSpeechDetected");
        return;
      }

      setSavedNote({
        ...baseNote,
        transcript,
        events: result.events,
        transcribeDate: result.date,
        usedFallbackTranscript: false,
      });
    } catch {
      setSavedNote({
        ...baseNote,
        transcript: DEMO_VOICE_TRANSCRIPT,
        usedFallbackTranscript: true,
      });
      setRecordingError("transcribeFailed");
    } finally {
      setIsTranscribing(false);
      isSavingRef.current = false;
    }
  }, [clearHoldTimer, durationMs, isRecording]);

  const cancelRecording = useCallback(async () => {
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);
    isSavingRef.current = false;
    isStartingRef.current = false;

    const recording = recordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }

    recordingStartedAtRef.current = null;
    setIsRecording(false);
    setDurationMs(0);
    setIsTranscribing(false);
    await resetAudioMode();
  }, [clearHoldTimer]);

  const beginHold = useCallback(() => {
    if (isRecording) return;

    clearHoldTimer();
    holdStartedRecordingRef.current = false;
    setIsHolding(true);
    setHoldProgress(0);
    holdStartRef.current = Date.now();

    const tick = () => {
      if (holdStartRef.current == null) return;
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(elapsed / HOLD_MS, 1);
      setHoldProgress(progress);

      if (elapsed >= HOLD_MS) {
        holdStartedRecordingRef.current = true;
        skipNextPressRef.current = true;
        setIsHolding(false);
        setHoldProgress(1);
        clearHoldTimer();
        void startRecording();
        return;
      }

      holdFrameRef.current = requestAnimationFrame(tick);
    };

    holdFrameRef.current = requestAnimationFrame(tick);
  }, [clearHoldTimer, isRecording, startRecording]);

  const endHold = useCallback(() => {
    if (isRecording) return;
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);
  }, [clearHoldTimer, isRecording]);

  const clearSavedNote = useCallback(() => {
    setSavedNote(null);
    setRecordingError(null);
  }, []);

  const clearRecordingError = useCallback(() => setRecordingError(null), []);

  const consumeSkipPress = useCallback(() => {
    if (!skipNextPressRef.current) return false;
    skipNextPressRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, [clearHoldTimer]);

  const value = useMemo(
    () => ({
      isRecording,
      isHolding,
      holdProgress,
      levels,
      durationMs,
      savedNote,
      isTranscribing,
      recordingError,
      beginHold,
      endHold,
      startRecording,
      stopAndSave,
      cancelRecording,
      clearSavedNote,
      clearRecordingError,
      consumeSkipPress,
    }),
    [
      beginHold,
      clearRecordingError,
      clearSavedNote,
      consumeSkipPress,
      durationMs,
      endHold,
      holdProgress,
      isHolding,
      isRecording,
      isTranscribing,
      levels,
      recordingError,
      savedNote,
      startRecording,
      stopAndSave,
      cancelRecording,
    ],
  );

  return <VoiceRecordingContext.Provider value={value}>{children}</VoiceRecordingContext.Provider>;
}

export function useVoiceRecording() {
  const ctx = useContext(VoiceRecordingContext);
  if (!ctx) throw new Error("useVoiceRecording must be used within VoiceRecordingProvider");
  return ctx;
}
