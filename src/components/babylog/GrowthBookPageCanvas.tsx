import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
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
import { BabyStickerFromModel } from "./BabyStickerView";
import { DiaryStampPair } from "./DiaryStamp";
import { DiaryCoverTemplate, DiaryTemplateDecoration, DiaryTemplatePattern } from "./DiaryCoverTemplate";
import { DiaryRuledText } from "./DiaryPageTemplate";
import { diaryCoverTemplate } from "../../constants/diaryCoverTemplates";
import { diaryPageTemplate, type DiaryPageTemplateConfig } from "../../constants/diaryPageTemplates";
import { useLanguage } from "../../LanguageContext";

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

  const pageTemplate =
    pageType === "diary" || pageType === "final_letter" ? diaryPageTemplate(page.pageTemplateId) : null;
  const coverTemplate = pageType === "cover" ? diaryCoverTemplate(page.coverTemplateId) : null;

  return (
    <View
      style={[
        styles.paper,
        pageTemplate ? { backgroundColor: pageTemplate.backgroundColor, borderColor: pageTemplate.borderColor } : null,
        coverTemplate ? { backgroundColor: coverTemplate.backgroundColor, borderColor: coverTemplate.borderColor } : null,
        style,
      ]}
      onLayout={handleLayout}
    >
      {pageType === "cover" ? <CoverContent page={page} /> : null}
      {pageType === "diary" && pageTemplate ? (
        <>
          <DiaryTemplatePattern pattern={pageTemplate.pattern ?? "none"} color={pageTemplate.borderColor} />
          <MomentContent
            page={page}
            template={pageTemplate}
            mode={mode}
            stickers={stickers}
            onPhotoPress={onPhotoPress}
            onPhotoLongPress={onPhotoLongPress}
            photoSwapSourceIndex={photoSwapSourceIndex}
            onCommentPress={onCommentPress}
            onRollingPress={onRollingPress}
          />
        </>
      ) : null}
      {pageType === "final_letter" && pageTemplate ? (
        <>
          <DiaryTemplatePattern pattern={pageTemplate.pattern ?? "none"} color={pageTemplate.borderColor} />
          <LetterContent page={page} template={pageTemplate} />
        </>
      ) : null}
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
    <DiaryCoverTemplate
      fill
      styleId={page.coverTemplateId}
      photoUri={page.photoUri}
      title={page.title}
      subtitle={page.subtitle}
      caption={page.dateLabel}
      style={styles.fill}
    />
  );
}

function MomentContent({
  page,
  template,
  mode,
  stickers,
  onPhotoPress,
  onPhotoLongPress,
  photoSwapSourceIndex,
  onCommentPress,
  onRollingPress,
}: {
  page: GrowthBookPage;
  template: DiaryPageTemplateConfig;
  mode: GrowthBookCanvasMode;
  stickers: BabySticker[];
  onPhotoPress?: (index: number) => void;
  onPhotoLongPress?: (index: number) => void;
  photoSwapSourceIndex?: number | null;
  onCommentPress?: () => void;
  onRollingPress?: () => void;
}) {
  const { t } = useLanguage();
  const [innerSize, setInnerSize] = useState({ width: 0, height: 0 });
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
  const rolling = (page.rollingComments ?? []).slice(0, 3);
  const editOutline = editable
    ? { borderColor: `${template.accentColor}88`, borderWidth: 1, borderStyle: "dashed" as const }
    : null;

  return (
    <View style={styles.momentPad}>
      <View
        style={[styles.momentSurface, { backgroundColor: template.surfaceColor, borderColor: template.borderColor }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setInnerSize({ width, height });
        }}
      >
        <TemplateDecorations
          decorations={template.decorations}
          color={template.accentColor}
          width={innerSize.width}
          height={innerSize.height}
        />
        <View style={styles.momentForeground} pointerEvents="box-none">
          <View
            style={[
              styles.pageHeader,
              template.headerStyle !== "line" && styles.roundedHeader,
              {
                borderColor: template.accentColor,
                backgroundColor: template.headerStyle === "line" ? "transparent" : `${template.accentColor}12`,
              },
            ]}
          >
            <Text style={[styles.pageDate, { color: template.textColor }]} numberOfLines={1}>
              {page.dateLabel || t("diary.template.datePlaceholder")}
            </Text>
            <DiaryStampPair skyId={page.weatherStamp} moodId={page.moodStamp} size="sm" />
          </View>

          {(editable || uris.length > 0) ? (
            <View style={[styles.photoGrid, commentStickers.length > 0 && styles.photoGridWithCommentSticker]}>
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
                        borderColor: template.borderColor,
                        backgroundColor: `${template.accentColor}14`,
                      },
                      editable && { borderStyle: "dashed", borderColor: template.accentColor },
                      photoSwapSourceIndex === index && styles.photoSwapSource,
                    ]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.fill} contentFit="cover" />
                    ) : editable ? (
                      <View style={styles.emptyPhoto}>
                        <Text style={[styles.addPhotoPlus, { color: template.accentColor }]}>＋</Text>
                        <Text style={[styles.addPhotoLabel, { color: template.accentColor }]}>{t("growth.critical.128")}</Text>
                      </View>
                    ) : null}
                    {editable && uri ? (
                      <View style={[styles.photoEditBadge, photoSwapSourceIndex === index && styles.photoMoveBadge]}>
                        <Text style={styles.photoEditBadgeText}>
                          {photoSwapSourceIndex === index ? t("growth.critical.129") : t("growth.critical.004")}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable
            disabled={!editable}
            onPress={onCommentPress}
            style={[styles.commentRegion, editOutline]}
          >
            <DiaryRuledText
              text={page.body}
              emptyText={editable ? t("diary.template.bodyPlaceholder") : undefined}
              color={template.textColor}
              lineColor={`${template.accentColor}55`}
              lineStyle={template.writingLineStyle}
              lineHeight={24}
              minLines={commentStickers.length > 0 ? 2 : 4}
              maxLines={commentStickers.length > 0 ? 4 : 8}
              fontSize={14}
            />
            {commentStickers.length > 0 ? (
              <View style={styles.commentStickerRow}>
                {commentStickers.map((sticker, index) => (
                  <BabyStickerFromModel key={`${sticker.id}-${index}`} sticker={sticker} size={20} />
                ))}
              </View>
            ) : null}
          </Pressable>

          <View
            style={[
              styles.titleSection,
              template.titleSectionStyle === "box" && {
                borderWidth: 1,
                borderColor: `${template.accentColor}66`,
                borderRadius: 8,
                backgroundColor: `${template.accentColor}0A`,
              },
            ]}
          >
            <Text style={[styles.titleLabel, { color: template.accentColor }]}>{t("diary.template.title")}</Text>
            <Text
              style={[styles.pageTitle, { color: template.textColor, borderBottomColor: `${template.accentColor}66` }]}
              numberOfLines={2}
            >
              {page.title?.trim() || t("diary.template.titlePlaceholder")}
            </Text>
          </View>

          <Pressable disabled={!editable} onPress={onRollingPress} style={[styles.rollingWrap, editOutline]}>
            {rolling.length > 0 ? (
              rolling.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Text style={[styles.commentAuthor, { color: template.accentColor }]} numberOfLines={1}>
                    {formatGrowthAuthorLabel(comment.authorRelationshipLabel, comment.authorName)}
                  </Text>
                  <View style={styles.rollingRuled}>
                    <DiaryRuledText
                      text={comment.text}
                      color={template.textColor}
                      lineColor={`${template.accentColor}44`}
                      lineStyle={template.writingLineStyle}
                      lineHeight={20}
                      minLines={1}
                      maxLines={2}
                      fontSize={10}
                    />
                    {(comment.stickerIds ?? []).length > 0 ? (
                      <View style={styles.rollingStickerStack}>
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
                    ) : null}
                  </View>
                </View>
              ))
            ) : editable ? (
              <Text style={[styles.emptyRolling, { color: template.accentColor }]}>{t("growth.critical.131")}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TemplateDecorations({
  decorations,
  color,
  width,
  height,
}: {
  decorations: DiaryPageTemplateConfig["decorations"];
  color: string;
  width: number;
  height: number;
}) {
  if (!width || !height) return null;
  return (
    <View pointerEvents="none" style={styles.watermarkLayer}>
      {decorations.map((decoration, index) => (
        <DiaryTemplateDecoration
          key={`${decoration.type}-${index}`}
          {...decoration}
          color={color}
          width={width}
          height={height}
          opacity={0.38}
        />
      ))}
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
  const { t } = useLanguage();
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
          <StickerControl label={t("growth.critical.036")} onPress={() => onDelete?.(selected.id)} danger />
          <StickerControl label={t("growth.critical.132")} onPress={() => onDuplicate?.(selected.id)} />
          <StickerControl label={t("growth.critical.133")} onPress={() => onBringForward?.(selected.id)} />
          <StickerControl label={t("growth.critical.134")} onPress={() => onSendBackward?.(selected.id)} />
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

function LetterContent({ page, template }: { page: GrowthBookPage; template: DiaryPageTemplateConfig }) {
  const { t } = useLanguage();
  const [innerSize, setInnerSize] = useState({ width: 0, height: 0 });
  const letters = page.letters ?? [];

  return (
    <View style={styles.momentPad}>
      <View
        style={[styles.momentSurface, { backgroundColor: template.surfaceColor, borderColor: template.borderColor }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setInnerSize({ width, height });
        }}
      >
        <TemplateDecorations
          decorations={template.decorations}
          color={template.accentColor}
          width={innerSize.width}
          height={innerSize.height}
        />
        <View style={styles.momentForeground} pointerEvents="box-none">
          <View
            style={[
              styles.pageHeader,
              template.headerStyle !== "line" && styles.roundedHeader,
              {
                borderColor: template.accentColor,
                backgroundColor: template.headerStyle === "line" ? "transparent" : `${template.accentColor}12`,
              },
            ]}
          >
            <Text style={[styles.pageDate, { color: template.textColor }]} numberOfLines={1}>
              {page.subtitle || t("growth.critical.010")}
            </Text>
            <View style={[styles.letterStamp, { borderColor: `${template.accentColor}77` }]}>
              <Text style={[styles.letterStampText, { color: template.accentColor }]}>♥</Text>
            </View>
          </View>

          <View
            style={[
              styles.titleSection,
              template.titleSectionStyle === "box" && {
                borderWidth: 1,
                borderColor: `${template.accentColor}66`,
                borderRadius: 8,
                backgroundColor: `${template.accentColor}0A`,
              },
            ]}
          >
            <Text style={[styles.titleLabel, { color: template.accentColor }]}>{t("diary.template.title")}</Text>
            <Text
              style={[styles.pageTitle, { color: template.textColor, borderBottomColor: `${template.accentColor}66` }]}
              numberOfLines={2}
            >
              {page.title?.trim() || t("growth.critical.085")}
            </Text>
          </View>

          {letters.length > 0 ? (
            <View style={styles.letterList}>
              {letters.slice(0, 3).map((letter) => (
                <View key={letter.id} style={styles.commentRow}>
                  <Text style={[styles.commentAuthor, { color: template.accentColor }]} numberOfLines={2}>
                    {formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName)}
                  </Text>
                  <View style={styles.rollingRuled}>
                    <DiaryRuledText
                      text={letter.text}
                      color={template.textColor}
                      lineColor={`${template.accentColor}44`}
                      lineStyle={template.writingLineStyle}
                      lineHeight={20}
                      minLines={letters.length > 1 ? 3 : 8}
                      maxLines={letters.length > 1 ? 5 : 12}
                      fontSize={13}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.letterBodyWrap}>
              <DiaryRuledText
                text={page.body}
                emptyText={t("growth.critical.058")}
                color={template.textColor}
                lineColor={`${template.accentColor}55`}
                lineStyle={template.writingLineStyle}
                lineHeight={24}
                minLines={8}
                maxLines={12}
                fontSize={14}
              />
            </View>
          )}

          <View style={[styles.letterSeal, { backgroundColor: `${template.accentColor}28`, borderColor: template.accentColor }]}>
            <Text style={[styles.letterSealText, { color: template.accentColor }]}>♥</Text>
          </View>
        </View>
      </View>
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
  momentPad: { flex: 1, padding: 10 },
  momentSurface: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, overflow: "hidden" },
  watermarkLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  momentForeground: { flex: 1, zIndex: 1 },
  pageHeader: {
    minHeight: 42,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    paddingBottom: 5,
    gap: 8,
  },
  roundedHeader: { borderWidth: 1, borderRadius: 10, padding: 5, marginBottom: 5 },
  pageDate: { flex: 1, fontSize: 12, fontWeight: "700" },
  titleSection: { minHeight: 52, padding: 7, marginTop: 6 },
  titleLabel: { fontSize: 11, fontWeight: "800", marginBottom: 3 },
  pageTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700", paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  photoGrid: { position: "relative", marginTop: 8, height: "32%" },
  photoGridWithCommentSticker: { height: "26%" },
  photoCell: { position: "absolute", borderRadius: 8, overflow: "hidden", borderWidth: 1.5, backgroundColor: "rgba(255,255,255,0.5)" },
  photoSwapSource: { borderWidth: 2, borderStyle: "solid", borderColor: colors.amber, opacity: 0.82 },
  emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center" },
  addPhotoPlus: { fontSize: 24, fontWeight: "500" },
  addPhotoLabel: { fontSize: 10, fontWeight: "700" },
  photoEditBadge: { position: "absolute", right: 5, top: 5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: "rgba(61,52,44,0.7)" },
  photoEditBadgeText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  photoMoveBadge: { backgroundColor: "rgba(176,58,52,0.92)" },
  commentRegion: { marginTop: 8, minHeight: 48, paddingHorizontal: 2, paddingVertical: 2 },
  commentStickerRow: { height: 40, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 2, paddingHorizontal: 2, paddingBottom: 2 },
  rollingWrap: { marginTop: 6, minHeight: 32, paddingVertical: 2, gap: 4 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  commentAuthor: { width: 62, fontSize: 10, lineHeight: 20, fontWeight: "800" },
  rollingRuled: { flex: 1 },
  rollingStickerStack: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  rollingStickerImage: { width: 28, height: 28 },
  emptyRolling: { fontSize: 10, fontWeight: "700", textAlign: "center", paddingVertical: 5 },
  freeSticker: { position: "absolute", alignItems: "center", justifyContent: "center", borderRadius: 8 },
  freeStickerSelected: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: "rgba(255,255,255,0.12)" },
  freeStickerVisual: { alignSelf: "center" },
  stickerControls: { position: "absolute", top: 4, left: 28, right: 6, zIndex: 1000, flexDirection: "row", justifyContent: "flex-end", gap: 2 },
  stickerControlButton: { minWidth: 23, height: 20, paddingHorizontal: 3, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(61,52,44,0.86)", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  stickerControlDanger: { backgroundColor: "rgba(200,75,71,0.94)" },
  stickerControlText: { color: "#FFF", fontSize: 6.8, fontWeight: "800" },
  stickerControlDangerText: { color: "#FFF" },
  letterList: { flex: 1, marginTop: 8, gap: 10 },
  letterBodyWrap: { flex: 1, marginTop: 8 },
  letterStamp: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  letterStampText: { fontSize: 12, fontWeight: "800" },
  letterSeal: { marginTop: 10, alignSelf: "flex-end", width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  letterSealText: { fontSize: 18, fontWeight: "800" },
});
