import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
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
import { useLanguage } from "../LanguageContext";
import type { VoiceNote } from "../types/voiceNote";
import { useBabyLog } from "./BabyLogContext";
import {
  createVoiceOperationCoordinator,
  createVoiceRequestGate,
  resolveVoiceScopeSnapshot,
  voiceScopeSnapshotKey,
  type VoiceRequestScope,
  type VoiceScopeSnapshot,
} from "../utils/voiceRequestScope";
import { discardAudioFile } from "../utils/audioFileLifecycle";

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

export async function discardAudio(uri: string | null | undefined) {
  await discardAudioFile(uri, FileSystem.deleteAsync);
}

export function VoiceRecordingProvider({ children }: { children: ReactNode }) {
  const { locale } = useLanguage();
  const { localDataScope } = useBabyLog();
  const currentScope = useMemo(
    () => resolveVoiceScopeSnapshot(localDataScope, locale),
    [localDataScope, locale],
  );
  const currentScopeRef = useRef<VoiceScopeSnapshot | null>(currentScope);
  currentScopeRef.current = currentScope;
  const currentScopeKey = voiceScopeSnapshotKey(currentScope);
  const [isRecording, setIsRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(MAX_LEVELS).fill(0.1));
  const [durationMs, setDurationMs] = useState(0);
  const [savedNote, setSavedNote] = useState<VoiceNote | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const startingRequestIdRef = useRef<string | null>(null);
  const savingRequestIdRef = useRef<string | null>(null);
  const savedNoteRef = useRef<VoiceNote | null>(null);
  const activeRequestRef = useRef<VoiceRequestScope | null>(null);
  const requestGateRef = useRef(createVoiceRequestGate());
  const operationCoordinatorRef = useRef(createVoiceOperationCoordinator());
  const stoppingPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    savedNoteRef.current = savedNote;
  }, [savedNote]);

  const pushLevel = useCallback((value: number) => {
    setLevels((prev) => [...prev.slice(-(MAX_LEVELS - 1)), value]);
  }, []);

  const isRequestActive = useCallback((request: VoiceRequestScope) => (
    requestGateRef.current.isActive(request, currentScopeRef.current)
  ), []);

  const runTranscribe = useCallback(async (baseNote: VoiceNote) => {
    const request = baseNote.requestScope;
    if (!baseNote.uri) {
      if (isRequestActive(request)) setRecordingError("recordingFailed");
      return;
    }

    if (!isRequestActive(request)) {
      await discardAudio(baseNote.uri);
      return;
    }

    savedNoteRef.current = baseNote;
    setSavedNote(baseNote);
    setIsTranscribing(true);
    setRecordingError(null);

    try {
      const result = await transcribeRecording(baseNote.uri);
      if (!isRequestActive(request)) {
        await discardAudio(baseNote.uri);
        return;
      }
      const transcript = result.raw_text?.trim() ?? "";

      if (!transcript) {
        const emptyNote = {
          ...baseNote,
          transcript: "",
          events: result.events,
          transcribeDate: result.date,
        };
        savedNoteRef.current = emptyNote;
        setSavedNote(emptyNote);
        setRecordingError("noSpeechDetected");
        return;
      }

      await discardAudio(baseNote.uri);
      if (!isRequestActive(request)) return;
      const completedNote = {
        ...baseNote,
        uri: null,
        transcript,
        events: result.events,
        transcribeDate: result.date,
      };
      savedNoteRef.current = completedNote;
      setSavedNote(completedNote);
    } catch {
      // Keep uri for retry — do not fake success with demo transcript
      if (isRequestActive(request)) {
        savedNoteRef.current = baseNote;
        setSavedNote(baseNote);
        setRecordingError("transcribeFailed");
      } else {
        await discardAudio(baseNote.uri);
      }
    } finally {
      if (isRequestActive(request)) setIsTranscribing(false);
    }
  }, [isRequestActive]);

  const startRecording = useCallback(() => operationCoordinatorRef.current.runStart(async () => {
    if (recordingRef.current || startingRequestIdRef.current || !currentScopeRef.current) return;

    const request = requestGateRef.current.begin(currentScopeRef.current);
    activeRequestRef.current = request;
    startingRequestIdRef.current = request.requestId;
    setRecordingError(null);
    let preparedRecording: Audio.Recording | null = null;
    try {
      await discardAudio(savedNoteRef.current?.uri);
      if (!isRequestActive(request)) return;
      savedNoteRef.current = null;
      setSavedNote(null);
      setIsTranscribing(false);

      const permission = await Audio.requestPermissionsAsync();
      if (!isRequestActive(request)) return;
      if (!permission.granted) {
        setRecordingError("micPermissionDenied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      if (!isRequestActive(request)) return;

      preparedRecording = new Audio.Recording();
      await preparedRecording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      if (!isRequestActive(request)) return;
      preparedRecording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording || !isRequestActive(request)) return;
        pushLevel(normalizeMetering(status.metering));
        if (status.durationMillis != null) setDurationMs(status.durationMillis);
      });
      preparedRecording.setProgressUpdateInterval(METER_INTERVAL_MS);
      await preparedRecording.startAsync();
      if (!isRequestActive(request)) return;

      recordingRef.current = preparedRecording;
      preparedRecording = null;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationMs(0);
      setLevels(Array(MAX_LEVELS).fill(0.12));
    } catch {
      if (isRequestActive(request)) setRecordingError("recordingFailed");
    } finally {
      if (preparedRecording) {
        await preparedRecording.stopAndUnloadAsync().catch(() => undefined);
        await discardAudio(preparedRecording.getURI());
      }
      if (!recordingRef.current) await resetAudioMode();
      if (startingRequestIdRef.current === request.requestId) startingRequestIdRef.current = null;
    }
  }), [isRequestActive, pushLevel]);

  const stopAndSave = useCallback(async () => {
    const request = activeRequestRef.current;
    if (!isRecording || !request || savingRequestIdRef.current) return;

    savingRequestIdRef.current = request.requestId;

    let uri: string | null = null;
    let finalDuration = durationMs;

    const recording = recordingRef.current;
    if (recording) {
      let stopped = false;
      const stopTask = (async () => {
        try {
          await recording.stopAndUnloadAsync();
          stopped = true;
          uri = recording.getURI();
          const status = await recording.getStatusAsync();
          if (status.durationMillis != null) finalDuration = status.durationMillis;
        } finally {
          if (recordingRef.current === recording) recordingRef.current = null;
        }
      })();
      stoppingPromiseRef.current = stopTask;
      await stopTask.catch(() => undefined);
      if (stoppingPromiseRef.current === stopTask) stoppingPromiseRef.current = null;
      if (!stopped) {
        await discardAudio(recording.getURI());
        uri = null;
      }
    }

    if (!isRequestActive(request)) {
      await discardAudio(uri);
      if (!activeRequestRef.current) {
        recordingStartedAtRef.current = null;
        setIsRecording(false);
        setDurationMs(0);
        setIsTranscribing(false);
        await resetAudioMode();
      }
      if (savingRequestIdRef.current === request.requestId) savingRequestIdRef.current = null;
      return;
    }

    if (recordingStartedAtRef.current != null && finalDuration === 0) {
      finalDuration = Date.now() - recordingStartedAtRef.current;
    }
    recordingStartedAtRef.current = null;

    setIsRecording(false);
    await resetAudioMode();
    if (!isRequestActive(request)) {
      await discardAudio(uri);
      if (savingRequestIdRef.current === request.requestId) savingRequestIdRef.current = null;
      return;
    }

    if (finalDuration < MIN_RECORDING_MS) {
      await discardAudio(uri);
      setRecordingError("recordingTooShort");
      if (savingRequestIdRef.current === request.requestId) savingRequestIdRef.current = null;
      return;
    }

    const baseNote: VoiceNote = {
      id: request.requestId,
      uri,
      durationMs: finalDuration,
      transcript: "",
      savedAt: formatSavedAt(),
      requestScope: request,
    };

    if (!uri) {
      savedNoteRef.current = baseNote;
      setSavedNote(baseNote);
      setRecordingError("recordingFailed");
      if (savingRequestIdRef.current === request.requestId) savingRequestIdRef.current = null;
      return;
    }

    try {
      await runTranscribe(baseNote);
    } finally {
      if (savingRequestIdRef.current === request.requestId) savingRequestIdRef.current = null;
    }
  }, [durationMs, isRecording, isRequestActive, runTranscribe]);

  const retryTranscribe = useCallback(async () => {
    const note = savedNoteRef.current;
    if (!note?.uri || isTranscribing || !isRequestActive(note.requestScope)) return;
    await runTranscribe(note);
  }, [isRequestActive, isTranscribing, runTranscribe]);

  const cancelRecording = useCallback(() => {
    requestGateRef.current.cancel();
    activeRequestRef.current = null;
    savingRequestIdRef.current = null;
    const noteUri = savedNoteRef.current?.uri;
    savedNoteRef.current = null;
    setSavedNote(null);
    setRecordingError(null);

    recordingStartedAtRef.current = null;
    setIsRecording(false);
    setDurationMs(0);
    setIsTranscribing(false);
    return operationCoordinatorRef.current.runCancel(async () => {
      const stopping = stoppingPromiseRef.current;
      if (stopping) await stopping.catch(() => undefined);
      const recording = recordingRef.current;
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => undefined);
        await discardAudio(recording.getURI());
        if (recordingRef.current === recording) recordingRef.current = null;
      }
      await discardAudio(noteUri);
      if (!activeRequestRef.current) await resetAudioMode();
    });
  }, []);

  const clearSavedNote = useCallback(() => {
    requestGateRef.current.cancel();
    activeRequestRef.current = null;
    void discardAudio(savedNoteRef.current?.uri);
    savedNoteRef.current = null;
    setSavedNote(null);
    setRecordingError(null);
  }, []);

  useEffect(() => {
    void cancelRecording();
  }, [cancelRecording, currentScopeKey]);

  const clearRecordingError = useCallback(() => setRecordingError(null), []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        const recording = recordingRef.current;
        void recording.stopAndUnloadAsync().then(() => discardAudio(recording.getURI()));
      }
      requestGateRef.current.cancel();
      void discardAudio(savedNoteRef.current?.uri);
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
