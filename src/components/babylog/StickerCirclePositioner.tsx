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
import { useLanguage } from "../../LanguageContext";
import {
  DEFAULT_CIRCLE_CROP,
  type CircularCutoutCrop,
} from "../../utils/babyStickerCutout";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
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
  const { t } = useLanguage();
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
  const zoomRef = useRef(zoom);
  const startRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  txRef.current = tx;
  tyRef.current = ty;
  zoomRef.current = zoom;

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
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCropRef.current.zoom));
    zoomRef.current = nextZoom;
    txRef.current = next.tx;
    tyRef.current = next.ty;
    setZoom(nextZoom);
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
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length >= 2 || Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          pinchRef.current = null;
          startRef.current = { x: txRef.current, y: tyRef.current };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2 && natural) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            if (!pinchRef.current) {
              pinchRef.current = { distance, zoom: zoomRef.current };
              return;
            }
            if (pinchRef.current.distance > 0) {
              const nextZoom = Math.min(
                MAX_ZOOM,
                Math.max(MIN_ZOOM, pinchRef.current.zoom * (distance / pinchRef.current.distance)),
              );
              const crop = cropFromTranslate(txRef.current, tyRef.current, zoomRef.current, natural.w, natural.h, viewport);
              const next = translateFromCrop({ ...crop, zoom: nextZoom }, natural.w, natural.h, viewport);
              zoomRef.current = nextZoom;
              txRef.current = next.tx;
              tyRef.current = next.ty;
              setZoom(nextZoom);
              setTx(next.tx);
              setTy(next.ty);
            }
            return;
          }
          pinchRef.current = null;
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
        onPanResponderRelease: () => {
          pinchRef.current = null;
        },
      }),
    [imgW, imgH, natural, viewport],
  );

  const applyZoom = (nextZoom: number) => {
    if (!natural) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(nextZoom / ZOOM_STEP) * ZOOM_STEP));
    const crop = cropFromTranslate(tx, ty, zoom, natural.w, natural.h, viewport);
    const next = translateFromCrop({ ...crop, zoom: clamped }, natural.w, natural.h, viewport);
    zoomRef.current = clamped;
    txRef.current = next.tx;
    tyRef.current = next.ty;
    setZoom(clamped);
    setTx(next.tx);
    setTy(next.ty);
  };

  const resetCenter = () => {
    if (!natural) return;
    const next = translateFromCrop({ offsetX: 0.5, offsetY: 0.5, zoom }, natural.w, natural.h, viewport);
    txRef.current = next.tx;
    tyRef.current = next.ty;
    setTx(next.tx);
    setTy(next.ty);
  };

  const resetOriginal = () => {
    if (!natural) return;
    const next = translateFromCrop(DEFAULT_CIRCLE_CROP, natural.w, natural.h, viewport);
    zoomRef.current = DEFAULT_CIRCLE_CROP.zoom;
    txRef.current = next.tx;
    tyRef.current = next.ty;
    setZoom(DEFAULT_CIRCLE_CROP.zoom);
    setTx(next.tx);
    setTy(next.ty);
  };

  const confirm = () => {
    if (!natural) return;
    onConfirm(cropFromTranslate(txRef.current, tyRef.current, zoomRef.current, natural.w, natural.h, viewport));
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomPad + 16 }]}>
      <Text style={styles.hint}>{t("sticker.critical.094")}</Text>

      <View style={styles.stage}>
        {ready && natural && imgW > 0 ? (
          <View style={styles.cropWrap}>
            <View
              style={[styles.crop, { width: viewport, height: viewport, borderRadius: 24 }]}
              accessibilityRole="image"
              accessibilityLabel={t("sticker.critical.095")}
              accessibilityHint={t("sticker.critical.096")}
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
          <View style={[styles.crop, styles.loading, { width: viewport, height: viewport, borderRadius: 24 }]}>
            {loadError ? (
              <Text style={styles.loadError}>{t("sticker.critical.015")}</Text>
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
            accessibilityLabel={t("sticker.critical.097")}
          >
            <Text style={styles.chipText}>{t("sticker.critical.097")}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, !ready && styles.disabled]}
            onPress={resetCenter}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel={t("sticker.critical.098")}
          >
            <Text style={styles.chipText}>{t("sticker.critical.098")}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, !ready && styles.disabled]}
            onPress={resetOriginal}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel={t("sticker.critical.099")}
          >
            <Text style={styles.chipText}>{t("sticker.critical.099")}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, (!ready || zoom >= MAX_ZOOM) && styles.disabled]}
            onPress={() => applyZoom(zoom + ZOOM_STEP)}
            disabled={!ready || zoom >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel={t("sticker.critical.100")}
          >
            <Text style={styles.chipText}>{t("sticker.critical.100")}</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryBtn, !ready && styles.disabled]}
          disabled={!ready}
          onPress={confirm}
          accessibilityRole="button"
          accessibilityLabel={t("sticker.critical.101")}
        >
          <Text style={styles.primaryBtnText}>{t("sticker.critical.101")}</Text>
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
  cropWrap: {
    shadowColor: "#4A3428",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  crop: {
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: colors.cardHi,
  },
  loading: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  loadError: { fontSize: 13, fontWeight: "700", color: colors.muted, textAlign: "center" },
  controls: { paddingHorizontal: 18, paddingTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexGrow: 1,
    minWidth: "22%",
    minHeight: HIT,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  primaryBtn: {
    minHeight: HIT,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 14.5 },
  disabled: { opacity: 0.55 },
});
