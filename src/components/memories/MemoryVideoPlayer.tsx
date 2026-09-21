import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Pause, Play, Volume2, VolumeX } from "lucide-react-native";
import { useLanguage } from "../../LanguageContext";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import type { MemoryMedia } from "../../types/memory";
import { formatMemoryVideoDuration, isLocalMediaUri } from "../../utils/memoryVideo";

type Props = {
  media?: MemoryMedia;
  sourceUri?: string;
  posterUri?: string;
  active: boolean;
  loop?: boolean;
  resizeMode?: ResizeMode;
  onRequestFullscreen?: () => void;
};

function resolveInitialUri(sourceUri?: string): string | undefined {
  return sourceUri && isLocalMediaUri(sourceUri) ? sourceUri : undefined;
}

export function MemoryVideoPlayer({
  media,
  sourceUri,
  posterUri,
  active,
  loop = true,
  resizeMode = ResizeMode.COVER,
  onRequestFullscreen,
}: Props) {
  const { t } = useLanguage();
  const videoRef = useRef<Video>(null);
  const generationRef = useRef(0);
  const refreshAttemptsRef = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [uri, setUri] = useState<string | undefined>(() => resolveInitialUri(sourceUri));
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [durationMs, setDurationMs] = useState(media?.durationMs);

  const shouldPlay = active && foreground && !paused && !failed;
  const durationLabel = formatMemoryVideoDuration(durationMs ?? 0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => setForeground(next === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (active) return;
    setPaused(false);
    setLoaded(false);
    setFailed(false);
    setMuted(true);
    refreshAttemptsRef.current = 0;
    void videoRef.current?.pauseAsync().catch(() => undefined);
  }, [active]);

  const loadUri = useCallback(async (forceRefresh = false) => {
    const local = resolveInitialUri(sourceUri);
    if (local && !forceRefresh) {
      setUri(local);
      setFailed(false);
      return local;
    }
    if (!media?.storagePath || media.uploadStatus !== "ready") {
      if (local) {
        setUri(local);
        setFailed(false);
        return local;
      }
      setFailed(true);
      return undefined;
    }
    const token = generationRef.current + 1;
    generationRef.current = token;
    setLoading(true);
    try {
      const signed = await MemoriesRepository.createSignedUrl(media.storagePath);
      if (generationRef.current !== token) return undefined;
      setUri(signed);
      setFailed(false);
      return signed;
    } catch {
      if (generationRef.current !== token) return undefined;
      if (local) {
        setUri(local);
        setFailed(false);
        return local;
      }
      setFailed(true);
      return undefined;
    } finally {
      if (generationRef.current === token) setLoading(false);
    }
  }, [media?.storagePath, media?.uploadStatus, sourceUri]);

  useEffect(() => {
    if (!active) return;
    void loadUri();
  }, [active, loadUri]);

  useEffect(() => {
    if (!shouldPlay) void videoRef.current?.pauseAsync().catch(() => undefined);
  }, [shouldPlay]);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ("error" in status && status.error && refreshAttemptsRef.current < 2) {
        refreshAttemptsRef.current += 1;
        setLoaded(false);
        void loadUri(true).then((next) => {
          if (!next) setFailed(true);
        });
      } else if ("error" in status && status.error) {
        setFailed(true);
      }
      return;
    }
    refreshAttemptsRef.current = 0;
    setLoaded(true);
    setFailed(false);
    if (typeof status.durationMillis === "number") setDurationMs(status.durationMillis);
  };

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    setPaused(false);
    refreshAttemptsRef.current = 0;
    void loadUri(true);
  };

  const toggleMute = () => setMuted((current) => !current);
  const togglePause = () => setPaused((current) => !current);

  return (
    <View style={styles.root}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.posterFallback]} />
      )}
      {active && uri && !failed ? (
        <Video
          ref={videoRef}
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
          source={{ uri }}
          resizeMode={resizeMode}
          shouldPlay={shouldPlay}
          isLooping={loop}
          isMuted={muted}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={onStatus}
        />
      ) : null}

      {(loading || (active && uri && !loaded && !failed)) ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      {failed ? (
        <View style={styles.fail}>
          <Text style={styles.failText}>{t("memory.critical.195")}</Text>
          <Pressable style={styles.retry} onPress={retry} accessibilityRole="button" accessibilityLabel={t("memory.critical.017")}>
            <Text style={styles.retryText}>{t("memory.critical.017")}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.duration} pointerEvents="none" accessibilityElementsHidden>
        <Text style={styles.durationText}>{t("memory.critical.200", { duration: durationLabel })}</Text>
      </View>

      {!failed && !paused && active ? (
        <Pressable
          style={styles.pauseHit}
          onPress={onRequestFullscreen ?? togglePause}
          accessibilityRole="button"
          accessibilityLabel={onRequestFullscreen ? t("memory.critical.185") : t("memory.critical.197")}
        />
      ) : null}

      {!failed && !active ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestFullscreen}
          accessibilityRole="imagebutton"
          accessibilityLabel={t("memory.critical.196")}
        >
          <View style={styles.playCenter} pointerEvents="none">
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      ) : null}

      {!failed && paused ? (
        <Pressable
          style={styles.playCenter}
          onPress={togglePause}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.196")}
        >
          <Play size={28} color="#fff" fill="#fff" />
        </Pressable>
      ) : null}

      {!failed ? (
        <Pressable
          style={styles.mute}
          onPress={toggleMute}
          accessibilityRole="button"
          accessibilityLabel={muted ? t("memory.critical.198") : t("memory.critical.199")}
          accessibilityState={{ selected: !muted }}
        >
          {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
        </Pressable>
      ) : null}

      {active && !failed && !paused ? (
        <Pressable
          style={styles.pauseCorner}
          onPress={togglePause}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.197")}
        >
          <Pause size={16} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1C1916" },
  posterFallback: { backgroundColor: "#1C1916" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  fail: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(28,25,22,0.55)",
    paddingHorizontal: 24,
  },
  failText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  retry: { minHeight: 44, minWidth: 72, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  duration: {
    position: "absolute",
    left: 10,
    top: 10,
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  mute: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseCorner: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseHit: { ...StyleSheet.absoluteFillObject },
});
