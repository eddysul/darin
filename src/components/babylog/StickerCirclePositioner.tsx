import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Image as RNImage,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors } from "../../theme";
import {
  DEFAULT_CIRCLE_CROP,
  type CircularCutoutCrop,
} from "../../utils/babyStickerCutout";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const NUDGE = 16;
const HIT = Platform.OS === "android" ? 48 : 44;

type Props = {
  uri: string;
  initialCrop?: CircularCutoutCrop;
  bottomPad: number;
  onConfirm: (crop: CircularCutoutCrop) => void;
};

function coverScale(nw: number, nh: number, viewport: number) {
  return Math.max(viewport / nw, viewport / nh);
}

function clampTranslate(tx: number, ty: number, imgW: number, imgH: number, viewport: number) {
  return {
    tx: Math.min(0, Math.max(viewport - imgW, tx)),
    ty: Math.min(0, Math.max(viewport - imgH, ty)),
  };
}

function translateFromCrop(
  crop: CircularCutoutCrop,
  nw: number,
  nh: number,
  viewport: number,
) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom));
  const scale = coverScale(nw, nh, viewport) * zoom;
  const imgW = nw * scale;
  const imgH = nh * scale;
  return clampTranslate(
    viewport / 2 - crop.offsetX * imgW,
    viewport / 2 - crop.offsetY * imgH,
    imgW,
    imgH,
    viewport,
  );
}

function cropFromTranslate(
  tx: number,
  ty: number,
  zoom: number,
  nw: number,
  nh: number,
  viewport: number,
): CircularCutoutCrop {
  const scale = coverScale(nw, nh, viewport) * zoom;
  const imgW = nw * scale;
  const imgH = nh * scale;
  return {
    offsetX: imgW <= 0 ? 0.5 : Math.min(1, Math.max(0, (viewport / 2 - tx) / imgW)),
    offsetY: imgH <= 0 ? 0.5 : Math.min(1, Math.max(0, (viewport / 2 - ty) / imgH)),
    zoom,
  };
}

export function StickerCirclePositioner({ uri, initialCrop = DEFAULT_CIRCLE_CROP, bottomPad, onConfirm }: Props) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const viewport = Math.round(Math.min(width - 48, height * (compact ? 0.34 : 0.42), compact ? 240 : 300));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(() => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCrop.zoom)));
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const initialCropRef = useRef(initialCrop);
  initialCropRef.current = initialCrop;

  const txRef = useRef(tx);
  const tyRef = useRef(ty);
  const startRef = useRef({ x: 0, y: 0 });
  txRef.current = tx;
  tyRef.current = ty;

  const framedUriRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setReady(false);
    setNatural(null);
    framedUriRef.current = null;
    RNImage.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNatural({ w, h });
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    if (!natural) return;
    if (framedUriRef.current === uri) return;
    framedUriRef.current = uri;
    const next = translateFromCrop(initialCropRef.current, natural.w, natural.h, viewport);
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCropRef.current.zoom)));
    setTx(next.tx);
    setTy(next.ty);
    setReady(true);
  }, [natural, viewport, uri]);

  const imgW = natural ? natural.w * coverScale(natural.w, natural.h, viewport) * zoom : 0;
  const imgH = natural ? natural.h * coverScale(natural.w, natural.h, viewport) * zoom : 0;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startRef.current = { x: txRef.current, y: tyRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          if (imgW <= 0 || imgH <= 0) return;
          const next = clampTranslate(
            startRef.current.x + gesture.dx,
            startRef.current.y + gesture.dy,
            imgW,
            imgH,
            viewport,
          );
          txRef.current = next.tx;
          tyRef.current = next.ty;
          setTx(next.tx);
          setTy(next.ty);
        },
      }),
    [imgW, imgH, viewport],
  );

  const applyZoom = (nextZoom: number) => {
    if (!natural) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(nextZoom / ZOOM_STEP) * ZOOM_STEP));
    const crop = cropFromTranslate(tx, ty, zoom, natural.w, natural.h, viewport);
    const next = translateFromCrop({ ...crop, zoom: clamped }, natural.w, natural.h, viewport);
    setZoom(clamped);
    setTx(next.tx);
    setTy(next.ty);
  };

  const nudge = (dx: number, dy: number) => {
    if (imgW <= 0 || imgH <= 0) return;
    const next = clampTranslate(tx + dx, ty + dy, imgW, imgH, viewport);
    setTx(next.tx);
    setTy(next.ty);
  };

  const resetCenter = () => {
    if (!natural) return;
    const next = translateFromCrop({ offsetX: 0.5, offsetY: 0.5, zoom }, natural.w, natural.h, viewport);
    setTx(next.tx);
    setTy(next.ty);
  };

  const confirm = () => {
    if (!natural) return;
    onConfirm(cropFromTranslate(tx, ty, zoom, natural.w, natural.h, viewport));
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomPad + 16 }]}>
      <Text style={styles.hint}>동그라미 안에 넣고 싶은 부분이 보이게 사진을 밀어 맞춰 주세요.</Text>

      <View style={styles.stage}>
        {ready && natural && imgW > 0 ? (
          <View style={styles.circleWrap}>
            <View
              style={[styles.circle, { width: viewport, height: viewport, borderRadius: viewport / 2 }]}
              accessibilityRole="image"
              accessibilityLabel="둥근 스티커 미리보기"
              accessibilityHint="손가락으로 밀거나 아래 버튼으로 위치를 맞춰 주세요"
              {...panResponder.panHandlers}
            >
            <Image
              source={{ uri }}
              pointerEvents="none"
              style={{
                position: "absolute",
                width: imgW,
                height: imgH,
                left: tx,
                top: ty,
              }}
              contentFit="fill"
            />
            </View>
          </View>
        ) : (
          <View style={[styles.circle, styles.loading, { width: viewport, height: viewport, borderRadius: viewport / 2 }]}>
            {loadError ? (
              <Text style={styles.loadError}>사진을 불러오지 못했어요</Text>
            ) : (
              <ActivityIndicator color={colors.amberText} />
            )}
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, (!ready || zoom <= MIN_ZOOM) && styles.disabled]}
            onPress={() => applyZoom(zoom - ZOOM_STEP)}
            disabled={!ready || zoom <= MIN_ZOOM}
            accessibilityRole="button"
            accessibilityLabel="축소"
          >
            <Text style={styles.chipText}>축소</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, !ready && styles.disabled]}
            onPress={resetCenter}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="가운데로"
          >
            <Text style={styles.chipText}>가운데</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, (!ready || zoom >= MAX_ZOOM) && styles.disabled]}
            onPress={() => applyZoom(zoom + ZOOM_STEP)}
            disabled={!ready || zoom >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel="확대"
          >
            <Text style={styles.chipText}>확대</Text>
          </Pressable>
        </View>

        <View style={styles.pad}>
          <Pressable
            style={[styles.padBtn, !ready && styles.disabled]}
            onPress={() => nudge(0, -NUDGE)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="위로 이동"
          >
            <Text style={styles.padText}>위</Text>
          </Pressable>
          <View style={styles.padMid}>
            <Pressable
              style={[styles.padBtn, !ready && styles.disabled]}
              onPress={() => nudge(-NUDGE, 0)}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel="왼쪽으로 이동"
            >
              <Text style={styles.padText}>왼쪽</Text>
            </Pressable>
            <Pressable
              style={[styles.padBtn, !ready && styles.disabled]}
              onPress={() => nudge(NUDGE, 0)}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel="오른쪽으로 이동"
            >
              <Text style={styles.padText}>오른쪽</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.padBtn, !ready && styles.disabled]}
            onPress={() => nudge(0, NUDGE)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="아래로 이동"
          >
            <Text style={styles.padText}>아래</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryBtn, !ready && styles.disabled]}
          disabled={!ready}
          onPress={confirm}
          accessibilityRole="button"
          accessibilityLabel="이 위치로 자르기"
        >
          <Text style={styles.primaryBtnText}>이 위치로 자르기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hint: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 8,
  },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  circleWrap: {
    shadowColor: "#4A3428",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  circle: {
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: colors.cardHi,
  },
  loading: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  loadError: { fontSize: 13, fontWeight: "700", color: colors.muted, textAlign: "center" },
  controls: { paddingHorizontal: 18, paddingTop: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: {
    flex: 1,
    minHeight: HIT,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  pad: { alignItems: "center", gap: 8, marginBottom: 12 },
  padMid: { flexDirection: "row", gap: 8 },
  padBtn: {
    minWidth: HIT,
    minHeight: HIT,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  padText: { fontSize: 13, fontWeight: "700", color: colors.text },
  primaryBtn: {
    minHeight: HIT,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  disabled: { opacity: 0.55 },
});
