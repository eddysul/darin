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
import { transcribeRecording } from "../api/transcribe";
import type { VoiceNote } from "../types/voiceNote";
import { createId } from "../utils/id";

const METER_INTERVAL_MS = 80;
const MAX_LEVELS = 48;
const MIN_RECORDING_MS = 400;

type VoiceRecordingContextValue = {
  isRecording: boolean;
  levels: number[];
  durationMs: number;
  savedNote: VoiceNote | null;
  isTranscribing: boolean;
  recordingError: string | null;
  startRecording: () => Promise<void>;
  stopAndSave: () => Promise<void>;
  retryTranscribe: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  clearSavedNote: () => void;
  clearRecordingError: () => void;
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

/**
 * MVP option B: drop the in-memory audio URI after success / cancel.
 * File unlink is skipped (expo-file-system is not a direct dependency;
 * Metro would fail on `require("expo-file-system")`).
 */
async function discardAudio(_uri: string | null | undefined) {
  // Intentionally no-op for file deletion — callers clear `uri` from state.
}

export function VoiceRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(MAX_LEVELS).fill(0.1));
  const [durationMs, setDurationMs] = useState(0);
  const [savedNote, setSavedNote] = useState<VoiceNote | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const isStartingRef = useRef(false);
  const savedNoteRef = useRef<VoiceNote | null>(null);

  useEffect(() => {
    savedNoteRef.current = savedNote;
  }, [savedNote]);

  const pushLevel = useCallback((value: number) => {
    setLevels((prev) => [...prev.slice(-(MAX_LEVELS - 1)), value]);
  }, []);

  const runTranscribe = useCallback(async (baseNote: VoiceNote) => {
    if (!baseNote.uri) {
      setRecordingError("recordingFailed");
      return;
    }

    setSavedNote(baseNote);
    setIsTranscribing(true);
    setRecordingError(null);

    try {
      const result = await transcribeRecording(baseNote.uri);
      const transcript = result.raw_text?.trim() ?? "";

      if (!transcript) {
        setSavedNote({
          ...baseNote,
          transcript: "",
          events: result.events,
          transcribeDate: result.date,
        });
        setRecordingError("noSpeechDetected");
        return;
      }

      await discardAudio(baseNote.uri);
      setSavedNote({
        ...baseNote,
        uri: null,
        transcript,
        events: result.events,
        transcribeDate: result.date,
      });
    } catch {
      // Keep uri for retry — do not fake success with demo transcript
      setSavedNote(baseNote);
      setRecordingError("transcribeFailed");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isStartingRef.current) return;

    isStartingRef.current = true;
    setRecordingError(null);
    await discardAudio(savedNoteRef.current?.uri);
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
      await discardAudio(uri);
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
      setSavedNote(baseNote);
      setRecordingError("recordingFailed");
      isSavingRef.current = false;
      return;
    }

    try {
      await runTranscribe(baseNote);
    } finally {
      isSavingRef.current = false;
    }
  }, [durationMs, isRecording, runTranscribe]);

  const retryTranscribe = useCallback(async () => {
    const note = savedNoteRef.current;
    if (!note?.uri || isTranscribing) return;
    await runTranscribe(note);
  }, [isTranscribing, runTranscribe]);

  const cancelRecording = useCallback(async () => {
    isSavingRef.current = false;
    isStartingRef.current = false;

    const recording = recordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        await discardAudio(uri);
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
  }, []);

  const clearSavedNote = useCallback(() => {
    void discardAudio(savedNoteRef.current?.uri);
    setSavedNote(null);
    setRecordingError(null);
  }, []);

  const clearRecordingError = useCallback(() => setRecordingError(null), []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
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
    }),
    [
      cancelRecording,
      clearRecordingError,
      clearSavedNote,
      durationMs,
      isRecording,
      isTranscribing,
      levels,
      recordingError,
      retryTranscribe,
      savedNote,
      startRecording,
      stopAndSave,
    ],
  );

  return <VoiceRecordingContext.Provider value={value}>{children}</VoiceRecordingContext.Provider>;
}

export function useVoiceRecording() {
  const ctx = useContext(VoiceRecordingContext);
  if (!ctx) throw new Error("useVoiceRecording must be used within VoiceRecordingProvider");
  return ctx;
}
