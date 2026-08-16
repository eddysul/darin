import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { BabySticker } from "../../types/babySticker";
import type { GrowthBookPage, GrowthBookPageType } from "../../utils/growthBookPages";
import {
  clampGrowthBookPageSticker,
  growthBookStickerHeightFactor,
  scaleGrowthBookPageSticker,
} from "../../utils/growthBookStickerLayout";
import { getPhotoLayoutSlots, normalizePhotoLayout } from "../../utils/growthBookPhotoLayouts";
import {
  formatGrowthAuthorLabel,
  type GrowthBookPageSticker,
} from "../../types/growthBook";
import { colors } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { BabyStickerFromModel } from "./BabyStickerView";
import { DiaryStampPair } from "./DiaryStamp";

export type GrowthBookCanvasMode = "edit" | "preview" | "pdf";

type Props = {
  page: GrowthBookPage;
  pageType?: GrowthBookPageType;
  mode: GrowthBookCanvasMode;
  stickers?: BabySticker[];
  selectedPageStickerId?: string | null;
  style?: StyleProp<ViewStyle>;
  onPhotoPress?: (index: number) => void;
  onPhotoLongPress?: (index: number) => void;
  photoSwapSourceIndex?: number | null;
  onCommentPress?: () => void;
  onRollingPress?: () => void;
  onPageStickerPress?: (pageStickerId: string | null) => void;
  onPageStickerChange?: (next: GrowthBookPageSticker) => void;
  onPageStickerDelete?: (pageStickerId: string) => void;
  onPageStickerDuplicate?: (pageStickerId: string) => void;
  onPageStickerBringForward?: (pageStickerId: string) => void;
  onPageStickerSendBackward?: (pageStickerId: string) => void;
};

export function GrowthBookPageCanvas({
  page,
  pageType = page.pageType,
  mode,
  stickers = [],
  selectedPageStickerId,
  style,
  onPhotoPress,
  onPhotoLongPress,
  photoSwapSourceIndex,
  onCommentPress,
  onRollingPress,
  onPageStickerPress,
  onPageStickerChange,
  onPageStickerDelete,
  onPageStickerDuplicate,
  onPageStickerBringForward,
  onPageStickerSendBackward,
}: Props) {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  return (
    <View style={[styles.paper, style]} onLayout={handleLayout}>
      <LinearGradient
        pointerEvents="none"
        colors={["#FFF9F2", "#F7EFE4", "#F3E8DA"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.marginLine} />
      <View style={styles.dogEar} />

      {pageType === "cover" ? <CoverContent page={page} /> : null}
      {pageType === "diary" ? (
        <MomentContent
          page={page}
          mode={mode}
          stickers={stickers}
          onPhotoPress={onPhotoPress}
          onPhotoLongPress={onPhotoLongPress}
          photoSwapSourceIndex={photoSwapSourceIndex}
          onCommentPress={onCommentPress}
          onRollingPress={onRollingPress}
        />
      ) : null}
      {pageType === "final_letter" ? <LetterContent page={page} /> : null}
      <PageStickerLayer
        mode={mode}
        pageStickers={page.pageStickers ?? []}
        stickers={stickers}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        selectedId={selectedPageStickerId}
        onSelect={onPageStickerPress}
        onChange={onPageStickerChange}
        onDelete={onPageStickerDelete}
        onDuplicate={onPageStickerDuplicate}
        onBringForward={onPageStickerBringForward}
        onSendBackward={onPageStickerSendBackward}
      />
    </View>
  );
}

function CoverContent({ page }: { page: GrowthBookPage }) {
  return (
    <View style={styles.coverInner}>
      <Text style={styles.coverEyebrow}>{page.subtitle}</Text>
      <Text style={styles.coverTitle}>{page.title}</Text>
      {page.photoUri ? (
        <View style={styles.coverPhotoFrame}>
          <Image source={{ uri: page.photoUri }} style={styles.fill} contentFit="cover" />
        </View>
      ) : (
        <View style={styles.coverPhotoPlaceholder}>
          <Text style={styles.coverPhotoEmoji}>🌿</Text>
          <Text style={styles.coverPhotoHint}>소중한 순간들이 여기에 담겨요</Text>
        </View>
      )}
      {page.dateLabel ? <Text style={styles.coverRange}>{page.dateLabel}</Text> : null}
    </View>
  );
}

function MomentContent({
  page,
  mode,
  stickers,
  onPhotoPress,
  onPhotoLongPress,
  photoSwapSourceIndex,
  onCommentPress,
  onRollingPress,
}: {
  page: GrowthBookPage;
  mode: GrowthBookCanvasMode;
  stickers: BabySticker[];
  onPhotoPress?: (index: number) => void;
  onPhotoLongPress?: (index: number) => void;
  photoSwapSourceIndex?: number | null;
  onCommentPress?: () => void;
  onRollingPress?: () => void;
}) {
  const editable = mode === "edit";
  const uris = page.photoUris ?? (page.photoUri ? [page.photoUri] : []);
  const photoLayout = normalizePhotoLayout(page.photoLayout ?? page.layout, uris.length);
  const layoutSlots = getPhotoLayoutSlots(photoLayout, page.photoLayoutTuning);
  const commentStickers = (page.commentStickers ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => stickers.find((sticker) => sticker.id === item.stickerId))
    .filter((item): item is BabySticker => !!item)
    .slice(0, 6);

  return (
    <View style={styles.momentInner}>
      <View style={styles.momentHeader}>
        <Text style={styles.momentEyebrow}>{page.subtitle}</Text>
        <DiaryStampPair skyId={page.weatherStamp} moodId={page.moodStamp} size="sm" />
      </View>
      <Text style={styles.momentTitle} numberOfLines={2}>{page.title}</Text>
      {page.dateLabel ? <Text style={styles.momentDate}>{page.dateLabel}</Text> : null}

      {(editable || uris.length > 0) ? <View style={[styles.photoGrid, commentStickers.length > 0 && styles.photoGridWithCommentSticker]}>
        {layoutSlots.map((slot, index) => {
          const uri = uris[index] ?? null;
          return (
          <Pressable
            key={slot.slotId}
            disabled={!editable}
            onPress={() => onPhotoPress?.(index)}
            onLongPress={uri ? () => onPhotoLongPress?.(index) : undefined}
            delayLongPress={350}
            style={[
              styles.photoCell,
              {
                left: `${slot.xRatio * 100}%`,
                top: `${slot.yRatio * 100}%`,
                width: `${slot.widthRatio * 100}%`,
                height: `${slot.heightRatio * 100}%`,
              },
              editable && styles.editableRegion,
              photoSwapSourceIndex === index && styles.photoSwapSource,
            ]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.fill} contentFit="cover" />
            ) : editable ? (
              <View style={styles.emptyPhoto}>
                <Text style={styles.addPhotoPlus}>＋</Text>
                <Text style={styles.addPhotoLabel}>사진 추가</Text>
              </View>
            ) : null}
            {editable && uri ? (
              <View style={[styles.photoEditBadge, photoSwapSourceIndex === index && styles.photoMoveBadge]}>
                <Text style={styles.photoEditBadgeText}>{photoSwapSourceIndex === index ? "옮길 사진" : "편집"}</Text>
              </View>
            ) : null}
          </Pressable>
          );
        })}
      </View> : null}

      <Pressable
        disabled={!editable}
        onPress={onCommentPress}
        style={[styles.commentRegion, editable && styles.editableRegion]}
      >
        {page.body ? (
          <Text style={styles.momentBody} numberOfLines={commentStickers.length > 0 ? 2 : 4}>{page.body}</Text>
        ) : editable ? (
          <Text style={styles.emptyCopy}>페이지 코멘트를 입력해 주세요</Text>
        ) : null}
        {commentStickers.length > 0 ? (
          <View style={styles.commentStickerRow}>
            {commentStickers.map((sticker, index) => (
              <BabyStickerFromModel key={`${sticker.id}-${index}`} sticker={sticker} size={20} />
            ))}
          </View>
        ) : null}
      </Pressable>

      <Pressable
        disabled={!editable}
        onPress={onRollingPress}
        style={[styles.rollingWrap, editable && styles.editableRegion]}
      >
        {(page.rollingComments ?? []).length > 0 ? (
          (page.rollingComments ?? []).slice(0, 3).map((comment) => (
            <View key={comment.id} style={styles.rollingItem}>
              <Text style={styles.rollingAuthor}>
                {formatGrowthAuthorLabel(comment.authorRelationshipLabel, comment.authorName)}
              </Text>
              <View style={styles.rollingContentRow}>
                <Text style={styles.rollingText} numberOfLines={1}>“{comment.text}”</Text>
                {(comment.stickerIds ?? []).slice(0, 3).map((stickerId, index) => {
                  const sticker = stickers.find((item) => item.id === stickerId);
                  if (!sticker) return null;
                  return (
                    <BabyStickerFromModel
                      key={`${comment.id}-${stickerId}-${index}`}
                      sticker={sticker}
                      size={18}
                      style={styles.rollingStickerImage}
                    />
                  );
                })}
              </View>
            </View>
          ))
        ) : editable ? (
          <Text style={styles.emptyRolling}>＋ 가족 롤링페이퍼</Text>
        ) : null}
      </Pressable>

    </View>
  );
}

function PageStickerLayer({
  mode,
  pageStickers,
  stickers,
  canvasWidth,
  canvasHeight,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
}: {
  mode: GrowthBookCanvasMode;
  pageStickers: GrowthBookPageSticker[];
  stickers: BabySticker[];
  canvasWidth: number;
  canvasHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (next: GrowthBookPageSticker) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
}) {
  if (!canvasWidth || !canvasHeight) return null;
  const editable = mode === "edit";
  const ordered = pageStickers.slice().sort((a, b) => a.zIndex - b.zIndex);
  const selected = ordered.find((item) => item.id === selectedId);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {ordered.map((pageSticker) => {
        const sticker = stickers.find((item) => item.id === pageSticker.stickerId);
        if (!sticker) return null;
        const heightFactor = growthBookStickerHeightFactor(sticker);
        return (
          <FreePageSticker
            key={pageSticker.id}
            pageSticker={clampGrowthBookPageSticker(pageSticker, canvasWidth, canvasHeight, heightFactor)}
            sticker={sticker}
            editable={editable}
            selected={editable && selectedId === pageSticker.id}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            heightFactor={heightFactor}
            onSelect={onSelect}
            onChange={onChange}
          />
        );
      })}

      {editable && selected ? (
        <View style={styles.stickerControls}>
          <StickerControl label="삭제" onPress={() => onDelete?.(selected.id)} danger />
          <StickerControl label="복제" onPress={() => onDuplicate?.(selected.id)} />
          <StickerControl label="앞으로" onPress={() => onBringForward?.(selected.id)} />
          <StickerControl label="뒤로" onPress={() => onSendBackward?.(selected.id)} />
          <StickerControl
            label="−"
            onPress={() => {
              const sticker = stickers.find((item) => item.id === selected.stickerId);
              onChange?.(scaleGrowthBookPageSticker(selected, 0.85, canvasWidth, canvasHeight, sticker ? growthBookStickerHeightFactor(sticker) : 1));
            }}
          />
          <StickerControl
            label="＋"
            onPress={() => {
              const sticker = stickers.find((item) => item.id === selected.stickerId);
              onChange?.(scaleGrowthBookPageSticker(selected, 1.15, canvasWidth, canvasHeight, sticker ? growthBookStickerHeightFactor(sticker) : 1));
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function StickerControl({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={[styles.stickerControlButton, danger && styles.stickerControlDanger]}
    >
      <Text style={[styles.stickerControlText, danger && styles.stickerControlDangerText]}>{label}</Text>
    </Pressable>
  );
}

function FreePageSticker({
  pageSticker,
  sticker,
  editable,
  selected,
  canvasWidth,
  canvasHeight,
  heightFactor,
  onSelect,
  onChange,
}: {
  pageSticker: GrowthBookPageSticker;
  sticker: BabySticker;
  editable: boolean;
  selected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  heightFactor: number;
  onSelect?: (id: string | null) => void;
  onChange?: (next: GrowthBookPageSticker) => void;
}) {
  const [draft, setDraft] = useState(pageSticker);
  const draftRef = useRef(pageSticker);
  const startRef = useRef({ xRatio: pageSticker.xRatio, yRatio: pageSticker.yRatio });
  const pinchRef = useRef<{
    active: boolean;
    distance: number;
    sticker: GrowthBookPageSticker;
  } | null>(null);

  useEffect(() => {
    draftRef.current = pageSticker;
    setDraft(pageSticker);
  }, [pageSticker]);

  const updateDraft = (next: GrowthBookPageSticker) => {
    draftRef.current = next;
    setDraft(next);
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: (event, gesture) =>
        editable && (event.nativeEvent.touches.length >= 2 || Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderGrant: (event) => {
        event.stopPropagation();
        onSelect?.(pageSticker.id);
        startRef.current = { xRatio: draftRef.current.xRatio, yRatio: draftRef.current.yRatio };
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          if (!pinchRef.current?.active) {
            pinchRef.current = { active: true, distance, sticker: draftRef.current };
            return;
          }
          if (pinchRef.current.distance > 0) {
            updateDraft(scaleGrowthBookPageSticker(
              pinchRef.current.sticker,
              distance / pinchRef.current.distance,
              canvasWidth,
              canvasHeight,
              heightFactor,
            ));
          }
          return;
        }
        if (pinchRef.current?.active) return;
        const next = clampGrowthBookPageSticker({
          ...draftRef.current,
          xRatio: startRef.current.xRatio + gesture.dx / canvasWidth,
          yRatio: startRef.current.yRatio + gesture.dy / canvasHeight,
        }, canvasWidth, canvasHeight, heightFactor);
        updateDraft(next);
      },
      onPanResponderRelease: () => {
        pinchRef.current = null;
        onChange?.(draftRef.current);
      },
      onPanResponderTerminate: () => {
        pinchRef.current = null;
        onChange?.(draftRef.current);
      },
    }),
    [canvasHeight, canvasWidth, editable, heightFactor, onChange, onSelect, pageSticker.id],
  );

  const width = draft.widthRatio * canvasWidth;
  return (
    <View
      {...(editable ? panResponder.panHandlers : {})}
      style={[
        styles.freeSticker,
        {
          left: draft.xRatio * canvasWidth,
          top: draft.yRatio * canvasHeight,
          width,
          height: width * heightFactor,
          zIndex: draft.zIndex,
        },
        selected && styles.freeStickerSelected,
      ]}
    >
      <BabyStickerFromModel sticker={sticker} size={Math.max(18, width - 24)} style={styles.freeStickerVisual} />
    </View>
  );
}

function LetterContent({ page }: { page: GrowthBookPage }) {
  return (
    <View style={styles.letterInner}>
      <BabyLogIcon kind="sparkles" size={18} color={colors.amberText} />
      <Text style={styles.letterEyebrow}>{page.subtitle}</Text>
      <Text style={styles.letterTitle}>{page.title}</Text>
      <Text style={styles.letterBody}>{page.body}</Text>
      <View style={styles.letterSeal}><Text style={styles.letterSealText}>♥</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    aspectRatio: 210 / 297,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139,115,90,0.25)",
    backgroundColor: "#FFF9F2",
  },
  fill: { width: "100%", height: "100%" },
  marginLine: { position: "absolute", left: 18, top: 14, bottom: 14, width: 1, backgroundColor: "rgba(232,145,138,0.28)" },
  dogEar: { position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderTopWidth: 20, borderLeftWidth: 20, borderTopColor: "rgba(196,170,140,0.55)", borderLeftColor: "transparent" },
  coverInner: { flex: 1, paddingHorizontal: 28, paddingVertical: 28, alignItems: "center", justifyContent: "center" },
  coverEyebrow: { fontSize: 11, fontWeight: "800", color: colors.amberText, letterSpacing: 2 },
  coverTitle: { marginTop: 8, fontSize: 25, fontWeight: "800", color: "#3D342C", textAlign: "center", lineHeight: 32 },
  coverPhotoFrame: { marginTop: 18, width: "84%", aspectRatio: 1, maxHeight: 230, borderRadius: 12, overflow: "hidden", borderWidth: 5, borderColor: "#FFF" },
  coverPhotoPlaceholder: { marginTop: 18, width: "84%", aspectRatio: 1, maxHeight: 220, borderRadius: 12, backgroundColor: "rgba(232,145,138,0.12)", alignItems: "center", justifyContent: "center", gap: 6, padding: 14 },
  coverPhotoEmoji: { fontSize: 38 },
  coverPhotoHint: { fontSize: 12, color: "#8A735A", textAlign: "center", fontWeight: "600" },
  coverRange: { marginTop: 14, fontSize: 13, fontWeight: "700", color: "#8A735A", letterSpacing: 1 },
  momentInner: { flex: 1, paddingLeft: 28, paddingRight: 22, paddingTop: 20, paddingBottom: 16 },
  momentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  momentEyebrow: { fontSize: 10, fontWeight: "800", color: colors.amberText, letterSpacing: 1 },
  momentTitle: { marginTop: 5, fontSize: 20, fontWeight: "800", color: "#3D342C", lineHeight: 25 },
  momentDate: { marginTop: 2, fontSize: 11, fontWeight: "600", color: "#8A735A" },
  photoGrid: { position: "relative", marginTop: 9, height: "39%" },
  photoGridWithCommentSticker: { height: "31%" },
  photoCell: { position: "absolute", borderRadius: 8, overflow: "hidden", borderWidth: 2.5, borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.5)" },
  photoSwapSource: { borderWidth: 2, borderStyle: "solid", borderColor: colors.amber, opacity: 0.82 },
  editableRegion: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: "rgba(255,255,255,0.38)" },
  emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center" },
  addPhotoPlus: { color: colors.amberText, fontSize: 24, fontWeight: "500" },
  addPhotoLabel: { color: colors.amberDark, fontSize: 10, fontWeight: "700" },
  photoEditBadge: { position: "absolute", right: 5, top: 5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: "rgba(61,52,44,0.7)" },
  photoEditBadgeText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  photoMoveBadge: { backgroundColor: colors.amberDark },
  commentRegion: { marginTop: 8, minHeight: 48, borderRadius: 8 },
  momentBody: { fontSize: 12.5, lineHeight: 18, color: "#4A4038", fontWeight: "500", padding: 7 },
  commentStickerRow: { height: 54, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 2, paddingHorizontal: 6, paddingBottom: 2 },
  emptyCopy: { padding: 10, color: "#A08C7A", fontSize: 11, textAlign: "center" },
  rollingWrap: { marginTop: 7, minHeight: 32, borderRadius: 8, padding: 5, gap: 4 },
  rollingItem: { backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4 },
  rollingAuthor: { fontSize: 9, fontWeight: "800", color: colors.amberText },
  rollingContentRow: { minHeight: 17, flexDirection: "row", alignItems: "center", gap: 3 },
  rollingText: { flex: 1, fontSize: 10, color: "#4A4038", marginTop: 1 },
  rollingStickerImage: { width: 28, height: 28 },
  emptyRolling: { color: colors.amberDark, fontSize: 10, fontWeight: "700", textAlign: "center", paddingVertical: 5 },
  freeSticker: { position: "absolute", alignItems: "center", justifyContent: "center", borderRadius: 8 },
  freeStickerSelected: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: "rgba(255,255,255,0.12)" },
  freeStickerVisual: { alignSelf: "center" },
  stickerControls: { position: "absolute", top: 4, left: 28, right: 6, zIndex: 1000, flexDirection: "row", justifyContent: "flex-end", gap: 2 },
  stickerControlButton: { minWidth: 23, height: 20, paddingHorizontal: 3, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(61,52,44,0.86)", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  stickerControlDanger: { backgroundColor: "rgba(200,75,71,0.94)" },
  stickerControlText: { color: "#FFF", fontSize: 6.8, fontWeight: "800" },
  stickerControlDangerText: { color: "#FFF" },
  letterInner: { flex: 1, paddingHorizontal: 32, paddingVertical: 36, justifyContent: "center" },
  letterEyebrow: { marginTop: 10, fontSize: 11, fontWeight: "800", color: colors.amberText, letterSpacing: 1 },
  letterTitle: { marginTop: 8, fontSize: 24, fontWeight: "800", color: "#3D342C" },
  letterBody: { marginTop: 18, fontSize: 14, lineHeight: 24, color: "#4A4038", fontWeight: "500" },
  letterSeal: { marginTop: 28, alignSelf: "flex-end", width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(232,145,138,0.25)", borderWidth: 1.5, borderColor: colors.amber, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  letterSealText: { color: colors.amberText, fontSize: 18, fontWeight: "800" },
});
