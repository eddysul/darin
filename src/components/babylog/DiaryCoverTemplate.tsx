import { useState } from "react";
import { Image, type ImageSource } from "expo-image";
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import {
  diaryCoverTemplate,
  type DiaryCoverDecorationType,
  type DiaryCoverTemplateId,
  type DiaryTemplatePattern,
} from "../../constants/diaryCoverTemplates";
import { STICKER_DECOR_ART } from "../../constants/stickerDecorArt";
import type { DiaryCoverPhotoTransform } from "../../types/babyLog";
import { BabyLogIcon } from "./BabyLogIcon";

type Props = {
  styleId?: DiaryCoverTemplateId | null;
  photoUri?: string | null;
  photoTransform?: DiaryCoverPhotoTransform | null;
  title?: string | null;
  /** Small line above the title. Growth book covers use it for 표지 부제. */
  subtitle?: string | null;
  /** Small line under the title box. Growth book covers use it for 표지 기간. */
  caption?: string | null;
  compact?: boolean;
  /** Fills the parent instead of holding the diary cover aspect ratio. */
  fill?: boolean;
  style?: ViewStyle;
};

export function DiaryCoverTemplate({
  styleId,
  photoUri,
  photoTransform,
  title,
  subtitle,
  caption,
  compact = false,
  fill = false,
  style,
}: Props) {
  const template = diaryCoverTemplate(styleId);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };
  const px = (value: number, axis: "x" | "y") => (axis === "x" ? size.width : size.height) * value / 100;
  const frame = template.photoFrame;
  const box = template.titleBox;
  const transform = photoTransform ?? { scale: 1, translateX: 0, translateY: 0 };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.root,
        fill ? styles.fill : compact ? styles.compact : styles.full,
        { backgroundColor: template.backgroundColor, borderColor: template.borderColor },
        style,
      ]}
    >
      <DiaryTemplatePattern pattern={template.pattern ?? "none"} color={template.borderColor} />
      {template.spineColor ? <View style={[styles.spine, { backgroundColor: template.spineColor }]} /> : null}
      {size.width > 0 ? (
        <>
          <View
            style={[
              styles.photoFrame,
              {
                left: px(frame.x, "x"),
                top: px(frame.y, "y"),
                width: px(frame.width, "x"),
                height: px(frame.height, "y"),
                borderRadius: frameRadius(frame.shape, px(frame.radius, "x"), px(frame.width, "x")),
                borderColor: frame.borderColor,
                borderWidth: frame.borderWidth,
              },
            ]}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                contentFit="cover"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    transform: [
                      { scale: transform.scale },
                      { translateX: transform.translateX * px(frame.width, "x") * 0.42 },
                      { translateY: transform.translateY * px(frame.height, "y") * 0.42 },
                    ],
                  },
                ]}
              />
            ) : (
              <View style={styles.placeholder}>
                <BabyLogIcon kind="image" size={compact ? 16 : 28} color={template.borderColor} />
                {!compact ? <Text style={[styles.placeholderText, { color: template.borderColor }]}>사진을 넣어주세요</Text> : null}
              </View>
            )}
          </View>
          <View
            style={[
              styles.titleBox,
              {
                left: px(box.x, "x"),
                top: px(box.y, "y"),
                width: px(box.width, "x"),
                height: px(box.height, "y"),
                borderRadius: px(box.radius, "x"),
                backgroundColor: box.backgroundColor,
                borderColor: box.borderColor,
              },
            ]}
          >
            {!compact && subtitle?.trim() ? (
              <Text style={[styles.subtitle, { color: template.borderColor }]} numberOfLines={1}>
                {subtitle.trim()}
              </Text>
            ) : null}
            <Text style={[styles.title, compact && styles.compactTitle, { color: template.borderColor }]} numberOfLines={2} ellipsizeMode="tail">
              {title?.trim() || "제목을 입력해 주세요"}
            </Text>
          </View>
          {!compact && caption?.trim() ? (
            <Text
              style={[
                styles.caption,
                {
                  top: px(box.y + box.height + 1.5, "y"),
                  left: px(box.x, "x"),
                  width: px(box.width, "x"),
                  color: template.borderColor,
                },
              ]}
              numberOfLines={1}
            >
              {caption.trim()}
            </Text>
          ) : null}
          {template.decorations.map((decoration, index) => (
            <DiaryTemplateDecoration key={`${decoration.type}-${index}`} {...decoration} color={template.borderColor} width={size.width} height={size.height} />
          ))}
        </>
      ) : null}
    </View>
  );
}

export function DiaryTemplatePattern({ pattern, color }: { pattern: DiaryTemplatePattern; color: string }) {
  if (pattern === "none") return null;
  if (pattern === "night") return <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.nightWash]} />;
  const cells = Array.from({ length: pattern === "grid" || pattern === "check" ? 48 : 26 });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.patternWrap]}>
      {cells.map((_, index) => (
        <View
          key={index}
          style={[
            pattern === "stripe" ? styles.stripe : pattern === "grid" || pattern === "check" ? styles.gridCell : styles.dot,
            {
              borderColor: `${color}22`,
              backgroundColor: pattern === "hearts" ? `${color}18` : pattern === "stars" ? `${color}24` : pattern === "dots" ? `${color}28` : "transparent",
              transform: pattern === "hearts" ? [{ rotate: "45deg" }] : pattern === "stars" ? [{ rotate: `${(index % 4) * 15}deg` }] : undefined,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Cute motifs reuse the die-cut sticker artwork; stationery motifs are drawn in the template color. */
const DECORATION_ART: Partial<Record<DiaryCoverDecorationType, ImageSource>> = {
  cloud: STICKER_DECOR_ART.cloud,
  heart: STICKER_DECOR_ART.heart,
  moon: STICKER_DECOR_ART.moon,
  star: STICKER_DECOR_ART.star,
  bear: STICKER_DECOR_ART.bear,
};

/** Width ÷ height of each motif, so `size` always means "% of the page width". */
const DECORATION_RATIO: Record<DiaryCoverDecorationType, number> = {
  cloud: 1.35,
  heart: 1.1,
  moon: 1,
  star: 1,
  bear: 1,
  flower: 1,
  leaf: 0.9,
  bow: 1.6,
  tape: 2.4,
  clip: 0.55,
  pencil: 0.5,
};

export function DiaryTemplateDecoration({
  type,
  x,
  y,
  size,
  rotate,
  color,
  width,
  height,
  opacity = 1,
}: {
  type: DiaryCoverDecorationType;
  x: number;
  y: number;
  size: number;
  rotate?: string;
  color: string;
  width: number;
  height: number;
  opacity?: number;
}) {
  const boxWidth = Math.max(10, width * size / 100);
  const boxHeight = boxWidth / (DECORATION_RATIO[type] ?? 1);
  const common = {
    position: "absolute" as const,
    left: width * x / 100,
    top: height * y / 100,
    width: boxWidth,
    height: boxHeight,
    opacity,
    transform: rotate ? [{ rotate }] : undefined,
  };
  const art = DECORATION_ART[type];
  if (art) {
    return <Image pointerEvents="none" source={art} contentFit="contain" style={common} />;
  }
  return (
    <View pointerEvents="none" style={common}>
      <DecorationGlyph type={type} width={boxWidth} height={boxHeight} color={color} />
    </View>
  );
}

function DecorationGlyph({ type, width, height, color }: { type: DiaryCoverDecorationType; width: number; height: number; color: string }) {
  if (type === "flower") {
    return (
      <Svg width={width} height={height} viewBox="0 0 24 24">
        {[0, 72, 144, 216, 288].map((angle) => (
          <Ellipse key={angle} cx={12} cy={6.6} rx={3.4} ry={4.8} fill={`${color}59`} stroke={color} strokeWidth={0.9} origin="12, 12" rotation={angle} />
        ))}
        <Circle cx={12} cy={12} r={3.1} fill={`${color}E6`} />
      </Svg>
    );
  }
  if (type === "leaf") {
    return (
      <Svg width={width} height={height} viewBox="0 0 24 24">
        <Path d="M13.4 23 C13.4 16.4 12.2 10 9 4" stroke={color} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        <Path d="M12.4 14.6 C16 12 19.8 12.8 21 15.6 C18 18.2 14.2 17.8 12.4 14.6 Z" fill={`${color}66`} stroke={color} strokeWidth={0.9} />
        <Path d="M10.8 9.4 C7.8 6.4 8.2 3 10.4 1.2 C13 3.2 13.6 6.8 10.8 9.4 Z" fill={`${color}66`} stroke={color} strokeWidth={0.9} />
        <Path d="M10.6 18.4 C7.4 16.6 4.2 17.4 3.2 20 C6 22.2 9.4 21.6 10.6 18.4 Z" fill={`${color}4D`} stroke={color} strokeWidth={0.9} />
      </Svg>
    );
  }
  if (type === "bow") {
    return (
      <Svg width={width} height={height} viewBox="0 0 40 24">
        <Path d="M20 12 C13.6 4.6 4 5 3.4 11.4 C2.8 17.8 12.6 18.6 20 12 Z" fill={`${color}59`} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M20 12 C26.4 4.6 36 5 36.6 11.4 C37.2 17.8 27.4 18.6 20 12 Z" fill={`${color}59`} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M18.4 13.6 L14.8 22.6" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <Path d="M21.6 13.6 L25.2 22.6" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <Circle cx={20} cy={12} r={3} fill={`${color}CC`} stroke={color} strokeWidth={1} />
      </Svg>
    );
  }
  if (type === "tape") {
    return (
      <Svg width={width} height={height} viewBox="0 0 48 20">
        <Rect x={0} y={2} width={48} height={16} rx={1.5} fill={`${color}4D`} stroke={`${color}80`} strokeWidth={0.8} />
        {[4, 14, 24, 34].map((offset) => (
          <Path key={offset} d={`M${offset} 18 L${offset + 7} 2`} stroke={`${color}59`} strokeWidth={3.4} strokeLinecap="butt" fill="none" />
        ))}
      </Svg>
    );
  }
  if (type === "clip") {
    return (
      <Svg width={width} height={height} viewBox="0 0 14 26">
        <Path
          d="M9.5 9.5 L9.5 5.6 Q9.5 2.6 6.5 2.6 Q3.5 2.6 3.5 5.6 L3.5 19.8 Q3.5 23.6 7.5 23.6 Q11.5 23.6 11.5 19.8 L11.5 7.4"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }
  if (type === "pencil") {
    return (
      <Svg width={width} height={height} viewBox="0 0 14 28">
        <Path d="M3.4 4 H10.6 V19 H3.4 Z" fill={`${color}4D`} stroke={color} strokeWidth={1} />
        <Path d="M3.4 1.6 H10.6 V4 H3.4 Z" fill={`${color}A6`} stroke={color} strokeWidth={1} />
        <Path d="M3.4 19 H10.6 L7 25.6 Z" fill={`${color}8C`} stroke={color} strokeWidth={1} />
        <Path d="M5.4 22.6 L7 25.6 L8.6 22.6 Z" fill={color} />
      </Svg>
    );
  }
  return <BabyLogIcon kind="sparkles" size={Math.min(width, height)} color={color} strokeWidth={1.8} />;
}

export function frameRadius(shape: "roundedRect" | "circle" | "heart" | "scallop", configured: number, width: number) {
  if (shape === "circle") return width / 2;
  if (shape === "heart" || shape === "scallop") return Math.max(configured, width * 0.2);
  return configured;
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", borderWidth: 1.5 },
  full: { width: "100%", aspectRatio: 0.72, borderRadius: 18 },
  fill: { ...StyleSheet.absoluteFillObject, borderWidth: 0 },
  compact: { width: 104, height: 142, borderRadius: 12 },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: "7%", opacity: 0.85 },
  photoFrame: { position: "absolute", overflow: "hidden", backgroundColor: "#F3F1EE" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FFFFFF8A" },
  placeholderText: { fontSize: 11, fontWeight: "700" },
  titleBox: { position: "absolute", borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, overflow: "hidden" },
  title: { fontSize: 14, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  compactTitle: { fontSize: 7, lineHeight: 9 },
  subtitle: { marginBottom: 3, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  caption: { position: "absolute", fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, textAlign: "center" },
  patternWrap: { flexDirection: "row", flexWrap: "wrap", gap: 11, padding: 9, overflow: "hidden" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  gridCell: { width: "11%", aspectRatio: 1, borderWidth: StyleSheet.hairlineWidth },
  stripe: { width: 2, height: "110%", marginRight: 12, opacity: 0.35 },
  nightWash: { backgroundColor: "#081D3A55" },
});
