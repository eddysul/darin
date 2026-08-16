import { useId } from "react";
import { Image } from "expo-image";
import type { ImageSource } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, Image as SvgImage, Path } from "react-native-svg";
import { STICKER_TEMPLATE_OPTIONS } from "../../types/babySticker";
import type {
  BabySticker,
  StickerBorderStyle,
  StickerCutoutMode,
  StickerFrameType,
  StickerShadowStyle,
  StickerSpeechBubbleType,
  StickerTemplateId,
} from "../../types/babySticker";
import { colors } from "../../theme";

type VisualProps = {
  imageUri: string;
  cutoutMode?: StickerCutoutMode;
  borderStyle?: StickerBorderStyle;
  shadowStyle?: StickerShadowStyle;
  speechBubbleType?: StickerSpeechBubbleType;
  frameType?: StickerFrameType;
  templateId?: StickerTemplateId;
  text?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type DecorationItem = {
  symbol: string;
  x: number;
  y: number;
  color: string;
  background: string;
  rotate?: string;
};

type BubblePlacement = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

type TemplateLayout = {
  bubblePlacement: BubblePlacement;
  textColor: string;
};

type ExactArtworkDecoration = {
  source: ImageSource;
  x: number;
  y: number;
  size: number;
  rotate?: string;
};

type TemplateArtworkPieces = {
  main: ImageSource;
  mainLayout: { x: number; y: number; size: number };
  decorations: ExactArtworkDecoration[];
};

const DECOR = {
  cloud: require("../../../assets/sticker-templates/decor-cloud-cute.png"),
  exclamation: require("../../../assets/sticker-templates/decor-exclamation-red.png"),
  heart: require("../../../assets/sticker-templates/decor-heart.png"),
  moon: require("../../../assets/sticker-templates/decor-moon.png"),
  puff: require("../../../assets/sticker-templates/decor-puff.png"),
  question: require("../../../assets/sticker-templates/decor-question.png"),
  scribble: require("../../../assets/sticker-templates/decor-scribble.png"),
  sleep: require("../../../assets/sticker-templates/decor-sleep.png"),
  sparkle: require("../../../assets/sticker-templates/decor-sparkle-blue.png"),
  spoon: require("../../../assets/sticker-templates/decor-spoon.png"),
  star: require("../../../assets/sticker-templates/decor-star.png"),
  tear: require("../../../assets/sticker-templates/decor-tear.png"),
  wave: require("../../../assets/sticker-templates/decor-wave.png"),
} satisfies Record<string, ImageSource>;

/** Exact local artwork, arranged around a protected center-photo area. */
const TEMPLATE_ARTWORK: Partial<Record<StickerTemplateId, TemplateArtworkPieces>> = {
  hello: {
    main: require("../../../assets/sticker-templates/phrase-hello.png"),
    mainLayout: { x: 0.65, y: -0.2, size: 0.52 },
    decorations: [
      { source: DECOR.wave, x: 0.65, y: 0.15, size: 0.34, rotate: "-10deg" },
      { source: DECOR.star, x: -0.05, y: 0.68, size: 0.25, rotate: "-8deg" },
      { source: DECOR.sparkle, x: 0.77, y: 0.64, size: 0.2 },
    ],
  },
  huh: {
    main: require("../../../assets/sticker-templates/phrase-huh.png"),
    mainLayout: { x: 0.6, y: 0.06, size: 0.48 },
    decorations: [
      { source: DECOR.question, x: -0.05, y: -0.03, size: 0.32, rotate: "8deg" },
      { source: DECOR.star, x: 0.78, y: -0.05, size: 0.21 },
      { source: DECOR.sparkle, x: 0.81, y: 0.31, size: 0.17 },
    ],
  },
  wow: {
    main: require("../../../assets/sticker-templates/phrase-wow.png"),
    mainLayout: { x: 0.58, y: 0.12, size: 0.5 },
    decorations: [
      { source: DECOR.exclamation, x: -0.06, y: -0.04, size: 0.29, rotate: "-12deg" },
      { source: DECOR.star, x: 0.78, y: -0.06, size: 0.24, rotate: "8deg" },
      { source: DECOR.sparkle, x: -0.03, y: 0.62, size: 0.21 },
    ],
  },
  yummy: {
    main: require("../../../assets/sticker-templates/phrase-yummy.png"),
    mainLayout: { x: 0.58, y: 0.36, size: 0.5 },
    decorations: [
      { source: DECOR.spoon, x: 0.73, y: 0.62, size: 0.31, rotate: "-16deg" },
      { source: DECOR.heart, x: -0.03, y: -0.02, size: 0.27, rotate: "-10deg" },
      { source: DECOR.heart, x: -0.04, y: 0.25, size: 0.23, rotate: "12deg" },
    ],
  },
  sleepy: {
    main: require("../../../assets/sticker-templates/phrase-sleepy.png"),
    mainLayout: { x: 0.58, y: 0.1, size: 0.5 },
    decorations: [
      { source: DECOR.moon, x: -0.05, y: 0.22, size: 0.31, rotate: "-8deg" },
      { source: DECOR.tear, x: -0.04, y: -0.04, size: 0.23, rotate: "12deg" },
      { source: DECOR.cloud, x: -0.04, y: 0.63, size: 0.26 },
      { source: DECOR.sleep, x: 0.76, y: -0.06, size: 0.27 },
    ],
  },
  cry: {
    main: require("../../../assets/sticker-templates/phrase-cry.png"),
    mainLayout: { x: 0.59, y: 0.15, size: 0.49 },
    decorations: [
      { source: DECOR.tear, x: -0.05, y: 0.12, size: 0.29, rotate: "-12deg" },
      { source: DECOR.tear, x: -0.02, y: 0.5, size: 0.25, rotate: "14deg" },
      { source: DECOR.tear, x: 0.78, y: -0.04, size: 0.22, rotate: "10deg" },
    ],
  },
  daze: {
    main: require("../../../assets/sticker-templates/phrase-daze.png"),
    mainLayout: { x: 0.6, y: 0.42, size: 0.46 },
    decorations: [
      { source: DECOR.question, x: -0.04, y: 0.02, size: 0.25, rotate: "-10deg" },
      { source: DECOR.sparkle, x: -0.04, y: 0.64, size: 0.23 },
      { source: DECOR.sparkle, x: 0.79, y: 0.08, size: 0.18, rotate: "12deg" },
    ],
  },
  heart: {
    main: require("../../../assets/sticker-templates/phrase-heart.png"),
    mainLayout: { x: 0.6, y: 0.42, size: 0.47 },
    decorations: [
      { source: DECOR.heart, x: -0.04, y: -0.03, size: 0.29, rotate: "-10deg" },
      { source: DECOR.heart, x: -0.05, y: 0.33, size: 0.27, rotate: "10deg" },
      { source: DECOR.heart, x: 0.79, y: 0.02, size: 0.21, rotate: "12deg" },
    ],
  },
  giggle: {
    main: require("../../../assets/sticker-templates/phrase-giggle.png"),
    mainLayout: { x: -0.08, y: -0.17, size: 0.5 },
    decorations: [
      { source: DECOR.star, x: -0.04, y: 0.65, size: 0.27, rotate: "-8deg" },
      { source: DECOR.sparkle, x: 0.78, y: 0.04, size: 0.21 },
      { source: DECOR.sparkle, x: 0.8, y: 0.65, size: 0.18, rotate: "14deg" },
    ],
  },
  like: {
    main: require("../../../assets/sticker-templates/phrase-like.png"),
    mainLayout: { x: -0.08, y: -0.16, size: 0.52 },
    decorations: [
      { source: DECOR.star, x: -0.05, y: 0.62, size: 0.29, rotate: "-8deg" },
      { source: DECOR.sparkle, x: 0.78, y: 0.04, size: 0.22 },
      { source: DECOR.sparkle, x: 0.8, y: 0.64, size: 0.18, rotate: "12deg" },
    ],
  },
  pout: {
    main: require("../../../assets/sticker-templates/phrase-pout.png"),
    mainLayout: { x: 0.6, y: 0.42, size: 0.47 },
    decorations: [
      { source: DECOR.puff, x: -0.05, y: -0.03, size: 0.29, rotate: "-8deg" },
      { source: DECOR.scribble, x: 0.77, y: 0.01, size: 0.24 },
      { source: DECOR.sparkle, x: -0.02, y: 0.64, size: 0.2 },
    ],
  },
  squeal: {
    main: require("../../../assets/sticker-templates/phrase-squeal.png"),
    mainLayout: { x: 0.6, y: 0.43, size: 0.47 },
    decorations: [
      { source: DECOR.heart, x: -0.05, y: 0.02, size: 0.28, rotate: "-10deg" },
      { source: DECOR.heart, x: -0.04, y: 0.39, size: 0.23, rotate: "8deg" },
      { source: DECOR.exclamation, x: 0.76, y: -0.05, size: 0.25, rotate: "12deg" },
    ],
  },
  why: {
    main: require("../../../assets/sticker-templates/phrase-why.png"),
    mainLayout: { x: 0.58, y: 0.42, size: 0.48 },
    decorations: [
      { source: DECOR.scribble, x: -0.05, y: -0.03, size: 0.3, rotate: "-8deg" },
      { source: DECOR.tear, x: -0.03, y: 0.58, size: 0.22 },
      { source: DECOR.sparkle, x: 0.8, y: 0.66, size: 0.18 },
    ],
  },
  oops: {
    main: require("../../../assets/sticker-templates/phrase-oops.png"),
    mainLayout: { x: 0.59, y: 0.42, size: 0.47 },
    decorations: [
      { source: DECOR.exclamation, x: -0.04, y: -0.04, size: 0.27, rotate: "-10deg" },
      { source: DECOR.sparkle, x: -0.03, y: 0.63, size: 0.22 },
      { source: DECOR.sparkle, x: 0.79, y: 0.03, size: 0.18, rotate: "12deg" },
    ],
  },
  bite: {
    main: require("../../../assets/sticker-templates/phrase-bite.png"),
    mainLayout: { x: -0.08, y: -0.16, size: 0.5 },
    decorations: [
      { source: DECOR.spoon, x: 0.72, y: 0.58, size: 0.32, rotate: "-18deg" },
      { source: DECOR.star, x: 0.78, y: -0.05, size: 0.22 },
      { source: DECOR.tear, x: -0.03, y: 0.63, size: 0.2, rotate: "-10deg" },
    ],
  },
  cute: {
    main: require("../../../assets/sticker-templates/phrase-cute.png"),
    mainLayout: { x: 0.6, y: 0.42, size: 0.47 },
    decorations: [
      { source: DECOR.heart, x: -0.04, y: 0.03, size: 0.27, rotate: "-10deg" },
      { source: DECOR.heart, x: -0.04, y: 0.39, size: 0.22, rotate: "8deg" },
      { source: DECOR.star, x: 0.77, y: -0.05, size: 0.24, rotate: "12deg" },
    ],
  },
};

const TEMPLATE_DEFAULT_PHRASES = Object.fromEntries(
  STICKER_TEMPLATE_OPTIONS.map((option) => [option.value, option.defaultPhrase]),
) as Record<StickerTemplateId, string>;

const TEMPLATE_LAYOUTS: Partial<Record<StickerTemplateId, TemplateLayout>> = {
  hello: { bubblePlacement: "topLeft", textColor: "#E96884" },
  huh: { bubblePlacement: "topRight", textColor: "#63A747" },
  wow: { bubblePlacement: "topRight", textColor: "#8067D5" },
  yummy: { bubblePlacement: "bottomRight", textColor: "#E77D3C" },
  sleepy: { bubblePlacement: "topRight", textColor: "#6687C8" },
  cry: { bubblePlacement: "topRight", textColor: "#5C91CF" },
  daze: { bubblePlacement: "bottomRight", textColor: "#6E70BD" },
  heart: { bubblePlacement: "bottomRight", textColor: "#E26484" },
  giggle: { bubblePlacement: "topLeft", textColor: "#E77E42" },
  like: { bubblePlacement: "topRight", textColor: "#4BAA62" },
  pout: { bubblePlacement: "bottomRight", textColor: "#8A66B4" },
  squeal: { bubblePlacement: "bottomRight", textColor: "#EB6E88" },
  why: { bubblePlacement: "topRight", textColor: "#668EC4" },
  oops: { bubblePlacement: "bottomRight", textColor: "#E66D4F" },
  bite: { bubblePlacement: "bottomRight", textColor: "#5A9B55" },
  cute: { bubblePlacement: "bottomRight", textColor: "#E56F91" },
};

const TEMPLATE_DECORATIONS: Partial<Record<StickerTemplateId, DecorationItem[]>> = {
  hello: [
    { symbol: "✦", x: 0.8, y: 0.08, color: "#F2A933", background: "#FFF4C9", rotate: "-12deg" },
    { symbol: "♥", x: 0.8, y: 0.62, color: "#EA777D", background: "#FFE0E4", rotate: "10deg" },
  ],
  huh: [
    { symbol: "?", x: -0.06, y: 0.08, color: "#74AF58", background: "#E7F6DA", rotate: "8deg" },
    { symbol: "?", x: -0.06, y: 0.62, color: "#83A9DF", background: "#E6F0FF", rotate: "-10deg" },
  ],
  wow: [
    { symbol: "!", x: -0.05, y: 0.04, color: "#F0A72F", background: "#FFF1BF", rotate: "-12deg" },
    { symbol: "✦", x: -0.06, y: 0.68, color: "#8B76DE", background: "#EEE8FF", rotate: "12deg" },
    { symbol: "★", x: 0.78, y: 0.7, color: "#F2B93B", background: "#FFF5C9" },
  ],
  yummy: [
    { symbol: "♥", x: -0.05, y: 0.08, color: "#ED7C92", background: "#FFE0E8", rotate: "-8deg" },
    { symbol: "♪", x: 0.8, y: 0.08, color: "#EE9D3E", background: "#FFF0D2", rotate: "10deg" },
  ],
  sleepy: [
    { symbol: "☾", x: -0.08, y: 0.06, color: "#7188D8", background: "#E5EAFF", rotate: "-10deg" },
    { symbol: "Z", x: 0.8, y: 0.62, color: "#7D79C8", background: "#ECE9FF", rotate: "8deg" },
    { symbol: "·", x: -0.02, y: 0.36, color: "#72A9DC", background: "#E6F5FF" },
  ],
  cry: [
    { symbol: "💧", x: -0.08, y: 0.2, color: "#5AA9DF", background: "#E2F4FF", rotate: "-8deg" },
    { symbol: "💧", x: -0.05, y: 0.58, color: "#5AA9DF", background: "#E2F4FF", rotate: "10deg" },
    { symbol: "ㅠ", x: 0.78, y: 0.68, color: "#7289D2", background: "#E7EBFF" },
  ],
  daze: [
    { symbol: "…", x: -0.08, y: 0.08, color: "#7A72C8", background: "#EDEAFF", rotate: "-6deg" },
    { symbol: "✧", x: 0.8, y: 0.08, color: "#5EAFD1", background: "#E2F7FF", rotate: "12deg" },
  ],
  heart: [
    { symbol: "♥", x: -0.08, y: 0.02, color: "#ED7586", background: "#FFE1E6", rotate: "-10deg" },
    { symbol: "♥", x: 0.8, y: 0.08, color: "#F19AA8", background: "#FFE8EC", rotate: "10deg" },
    { symbol: "♥", x: -0.05, y: 0.66, color: "#E55F78", background: "#FFD8DF", rotate: "-6deg" },
  ],
  giggle: [
    { symbol: "✦", x: 0.8, y: 0.08, color: "#ECAE35", background: "#FFF3C5", rotate: "-10deg" },
    { symbol: "♪", x: 0.8, y: 0.62, color: "#E9798C", background: "#FFE3E8", rotate: "12deg" },
  ],
  like: [
    { symbol: "★", x: -0.08, y: 0.14, color: "#F0AD2E", background: "#FFF1C1", rotate: "-8deg" },
    { symbol: "✓", x: 0.8, y: 0.66, color: "#62AD71", background: "#E0F5E5", rotate: "8deg" },
  ],
  pout: [
    { symbol: "×", x: -0.07, y: 0.08, color: "#D87970", background: "#FFE4DF", rotate: "-10deg" },
    { symbol: "~", x: 0.8, y: 0.1, color: "#9A79BE", background: "#F1E5FF", rotate: "12deg" },
  ],
  squeal: [
    { symbol: "!", x: -0.06, y: 0.06, color: "#F08A87", background: "#FFE4E1", rotate: "-12deg" },
    { symbol: "♥", x: 0.8, y: 0.08, color: "#EC7394", background: "#FFE1EA", rotate: "10deg" },
  ],
  why: [
    { symbol: "?", x: -0.08, y: 0.08, color: "#729BCD", background: "#E5F0FF", rotate: "-12deg" },
    { symbol: "~", x: -0.04, y: 0.66, color: "#E59465", background: "#FFEBD8", rotate: "10deg" },
  ],
  oops: [
    { symbol: "!", x: 0.8, y: 0.04, color: "#EB765F", background: "#FFE3DA", rotate: "10deg" },
    { symbol: "✦", x: -0.06, y: 0.66, color: "#72A5D7", background: "#E5F2FF", rotate: "-8deg" },
  ],
  bite: [
    { symbol: "♪", x: -0.06, y: 0.08, color: "#65A965", background: "#E3F3DA", rotate: "-10deg" },
    { symbol: "♥", x: 0.8, y: 0.08, color: "#E98272", background: "#FFE3DE", rotate: "10deg" },
  ],
  cute: [
    { symbol: "♥", x: -0.08, y: 0.08, color: "#E97F9D", background: "#FFE4EC", rotate: "-10deg" },
    { symbol: "★", x: 0.8, y: 0.08, color: "#EFB23B", background: "#FFF3C7", rotate: "10deg" },
    { symbol: "✦", x: -0.04, y: 0.68, color: "#7EA4D8", background: "#E8F1FF", rotate: "-8deg" },
  ],
};

function StickerDecorations({ templateId, size }: { templateId: StickerTemplateId; size: number }) {
  const decorations = TEMPLATE_DECORATIONS[templateId];
  if (!decorations?.length || size < 42) return null;
  const badgeSize = Math.max(18, Math.min(34, size * 0.24));
  return (
    <View pointerEvents="none" style={[styles.decorationLayer, { width: size, height: size }]}>
      {decorations.map((item, index) => (
        <View
          key={`${templateId}-${item.symbol}-${index}`}
          style={[
            styles.decorationBadge,
            {
              left: item.x * size,
              top: item.y * size,
              width: badgeSize,
              height: badgeSize,
              transform: [{ rotate: item.rotate ?? "0deg" }],
            },
          ]}
        >
          <StickerDecorationIcon symbol={item.symbol} color={item.color} size={badgeSize} />
        </View>
      ))}
    </View>
  );
}

function ExactTemplateArtwork({ artwork, size }: { artwork: TemplateArtworkPieces; size: number }) {
  return (
    <View pointerEvents="none" style={[styles.exactArtworkLayer, { width: size, height: size }]}>
      <Image
        source={artwork.main}
        style={[
          styles.exactArtworkMain,
          {
            left: size * artwork.mainLayout.x,
            top: size * artwork.mainLayout.y,
            width: size * artwork.mainLayout.size,
            height: size * artwork.mainLayout.size,
          },
        ]}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
      {artwork.decorations.map((item, index) => {
        const pieceSize = size * item.size;
        return (
          <Image
            key={`exact-decoration-${item.x}-${item.y}-${index}`}
            source={item.source}
            style={[
              styles.exactArtworkDecoration,
              {
                left: size * item.x,
                top: size * item.y,
                width: pieceSize,
                height: pieceSize,
                transform: [{ rotate: item.rotate ?? "0deg" }],
              },
            ]}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        );
      })}
    </View>
  );
}

function StickerDecorationIcon({ symbol, color, size }: { symbol: string; color: string; size: number }) {
  const solidPath =
    symbol === "♥"
      ? "M16 28C7 22 3 16 4 10C5 5 11 3 16 9C21 3 27 5 28 10C29 16 25 22 16 28Z"
      : symbol === "★"
        ? "M16 2L20 11L30 12L22 19L24 29L16 24L8 29L10 19L2 12L12 11Z"
        : symbol === "✦" || symbol === "✧"
          ? "M16 2C17 10 20 14 30 16C20 18 17 22 16 30C15 22 12 18 2 16C12 14 15 10 16 2Z"
          : symbol === "💧"
            ? "M16 2C13 8 7 14 7 20C7 26 11 30 16 30C21 30 25 26 25 20C25 14 19 8 16 2Z"
            : symbol === "☾"
              ? "M25 24C19 29 10 27 6 20C2 13 6 5 13 3C11 9 13 15 18 19C20 21 22 23 25 24Z"
              : null;

  if (solidPath) {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path d={solidPath} fill={color} stroke="#FFFFFF" strokeWidth={5.5} strokeLinejoin="round" />
        <Path d={solidPath} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      </Svg>
    );
  }

  if (symbol === "·") {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx={16} cy={16} r={7} fill={color} stroke="#FFFFFF" strokeWidth={5} />
      </Svg>
    );
  }

  return (
    <Text
      allowFontScaling={false}
      style={[
        styles.decorationSymbol,
        {
          color,
          fontSize: size * (symbol === "…" ? 0.62 : 0.72),
          lineHeight: size,
          textShadowColor: "#FFFFFF",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 4,
        },
      ]}
    >
      {symbol}
    </Text>
  );
}

function bubblePositionStyle(placement: BubblePlacement): ViewStyle {
  if (placement === "topLeft") return { top: -8, left: -10 };
  if (placement === "bottomLeft") return { bottom: -8, left: -10 };
  if (placement === "bottomRight") return { bottom: -8, right: -10 };
  return { top: -8, right: -10 };
}

function bubbleTailStyle(placement: BubblePlacement): ViewStyle {
  if (placement === "topLeft") return { right: 10, bottom: -5 };
  if (placement === "bottomLeft") return { right: 10, top: -5 };
  if (placement === "bottomRight") return { left: 10, top: -5 };
  return { left: 10, bottom: -5 };
}

function starPath(size: number): string {
  const pts = [
    [0.5, 0.04], [0.62, 0.36], [0.96, 0.36], [0.69, 0.58], [0.8, 0.92],
    [0.5, 0.72], [0.2, 0.92], [0.31, 0.58], [0.04, 0.36], [0.38, 0.36],
  ];
  return `${pts.map((pt, index) => `${index === 0 ? "M" : "L"}${pt[0] * size},${pt[1] * size}`).join(" ")} Z`;
}

function heartPath(size: number): string {
  return [
    `M${0.5 * size},${0.9 * size}`,
    `C${0.16 * size},${0.66 * size} ${0.04 * size},${0.48 * size} ${0.04 * size},${0.3 * size}`,
    `C${0.04 * size},${0.14 * size} ${0.18 * size},${0.06 * size} ${0.32 * size},${0.06 * size}`,
    `C${0.42 * size},${0.06 * size} ${0.48 * size},${0.12 * size} ${0.5 * size},${0.24 * size}`,
    `C${0.52 * size},${0.12 * size} ${0.58 * size},${0.06 * size} ${0.68 * size},${0.06 * size}`,
    `C${0.82 * size},${0.06 * size} ${0.96 * size},${0.14 * size} ${0.96 * size},${0.3 * size}`,
    `C${0.96 * size},${0.48 * size} ${0.84 * size},${0.66 * size} ${0.5 * size},${0.9 * size} Z`,
  ].join(" ");
}

function silhouettePath(frameType: StickerFrameType, size: number): string | null {
  if (frameType === "star") return starPath(size);
  if (frameType === "heart") return heartPath(size);
  return null;
}

export function BabyStickerView({
  imageUri,
  cutoutMode = "roundedRect",
  borderStyle = "whiteThick",
  shadowStyle = "soft",
  speechBubbleType = "none",
  frameType = "none",
  templateId = "portrait",
  text,
  size = 132,
  style,
}: VisualProps) {
  const clipId = `sticker-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const label = typeof text === "string" ? text.trim() : "";
  const templateLayout = TEMPLATE_LAYOUTS[templateId] ?? {
    bubblePlacement: "topRight" as const,
    textColor: colors.amberText,
  };
  const templateArtwork = TEMPLATE_ARTWORK[templateId];
  const usesTemplateArtwork = Boolean(
    templateArtwork
      && speechBubbleType === "round"
      && label === TEMPLATE_DEFAULT_PHRASES[templateId],
  );
  const isPerson = cutoutMode === "personCutout";
  const isCircular = cutoutMode === "circular";
  const bookFrame = frameType === "growthBook";
  const ribbonFrame = frameType === "ribbon";
  // The supplied artwork was drawn around a face-sized opening. Keep the photo
  // inside that opening instead of laying the decorations directly over it.
  const basePhotoSize = bookFrame ? size - 10 : size;
  const photoSize = usesTemplateArtwork ? basePhotoSize * 0.78 : basePhotoSize;
  const silhouette = silhouettePath(frameType, photoSize);
  const shellRadius = isPerson ? 0 : isCircular ? photoSize / 2 : photoSize * 0.18;
  const imageRadius = isPerson ? 0 : isCircular ? (photoSize - 4) / 2 : photoSize * 0.16;
  const stroke = borderStyle === "whiteThick" ? "#FFFFFF" : "transparent";

  return (
    <View style={[styles.wrap, { width: size + 36 }, style]}>
      <View
        style={[
          styles.photoStack,
          shadowStyle === "soft" && styles.softShadow,
          bookFrame && styles.bookFrame,
          { width: size, height: size },
        ]}
      >
        {ribbonFrame ? (
          <View style={styles.ribbon} pointerEvents="none">
            <View style={styles.ribbonTailLeft} />
            <View style={styles.ribbonBand} />
            <View style={styles.ribbonTailRight} />
          </View>
        ) : null}

        {silhouette ? (
          <Svg width={photoSize} height={photoSize}>
            <Defs>
              <ClipPath id={clipId}>
                <Path d={silhouette} />
              </ClipPath>
            </Defs>
            <SvgImage
              href={{ uri: imageUri }}
              x={0}
              y={0}
              width={photoSize}
              height={photoSize}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
            {borderStyle === "whiteThick" ? (
              <Path d={silhouette} fill="none" stroke={stroke} strokeWidth={5} />
            ) : null}
          </Svg>
        ) : (
          <View
            style={[
              styles.photoShell,
              borderStyle === "whiteThick" && styles.whiteBorder,
              {
                width: photoSize,
                height: photoSize,
                borderRadius: bookFrame ? photoSize * 0.12 : shellRadius,
                overflow: isPerson && frameType === "none" ? "visible" : "hidden",
                backgroundColor: isPerson && borderStyle === "none" ? "transparent" : undefined,
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={{
                width: photoSize - (borderStyle === "whiteThick" ? 4 : 0),
                height: photoSize - (borderStyle === "whiteThick" ? 4 : 0),
                borderRadius: bookFrame ? photoSize * 0.1 : imageRadius,
              }}
              contentFit={isPerson ? "contain" : "cover"}
            />
          </View>
        )}

        {usesTemplateArtwork && templateArtwork ? (
          <ExactTemplateArtwork artwork={templateArtwork} size={size} />
        ) : null}

        {label && !usesTemplateArtwork ? (
          <View
            style={[
              styles.attachedText,
              bubblePositionStyle(templateLayout.bubblePlacement),
              speechBubbleType === "round" ? styles.bubble : styles.chip,
            ]}
          >
            <Text
              style={[
                styles.attachedTextLabel,
                speechBubbleType === "round" && styles.bubbleLabel,
                { color: templateLayout.textColor },
              ]}
              numberOfLines={2}
            >
              {label}
            </Text>
            {speechBubbleType === "round" ? (
              <View style={[styles.bubbleTail, bubbleTailStyle(templateLayout.bubblePlacement)]} />
            ) : null}
          </View>
        ) : null}
        {!usesTemplateArtwork ? <StickerDecorations templateId={templateId} size={size} /> : null}
      </View>
    </View>
  );
}

export function BabyStickerFromModel({
  sticker,
  size = 132,
  style,
}: {
  sticker: BabySticker;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BabyStickerView
      imageUri={sticker.cutoutImageUri || sticker.finalStickerImageUri || sticker.originalImageUri}
      cutoutMode={sticker.cutoutMode ?? "circular"}
      borderStyle={sticker.borderStyle}
      shadowStyle={sticker.shadowStyle}
      speechBubbleType={sticker.speechBubbleType}
      frameType={sticker.frameType}
      templateId={sticker.templateId}
      text={sticker.text}
      size={size}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 8, paddingRight: 8 },
  photoStack: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  exactArtworkLayer: { position: "absolute", left: 0, top: 0, zIndex: 7, overflow: "visible" },
  exactArtworkMain: { position: "absolute" },
  exactArtworkDecoration: { position: "absolute" },
  decorationLayer: { position: "absolute", left: 0, top: 0, zIndex: 5, overflow: "visible" },
  decorationBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A3428",
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  decorationSymbol: {
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
  },
  softShadow: {
    shadowColor: "#4A3428",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bookFrame: {
    padding: 5,
    backgroundColor: "#F7EFE4",
    borderWidth: 2,
    borderColor: "#8A735A",
    borderRadius: 12,
  },
  photoShell: { alignItems: "center", justifyContent: "center" },
  whiteBorder: { borderWidth: 5, borderColor: "#FFFFFF", backgroundColor: "#FFFFFF" },
  ribbon: {
    position: "absolute",
    top: -8,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  ribbonBand: {
    minWidth: 54,
    height: 14,
    backgroundColor: colors.amber,
    borderRadius: 4,
  },
  ribbonTailLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#C46B66",
  },
  ribbonTailRight: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#C46B66",
  },
  attachedText: {
    position: "absolute",
    maxWidth: "78%",
    zIndex: 6,
    alignItems: "center",
  },
  bubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: "#4A3428",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  attachedTextLabel: { fontSize: 12, fontWeight: "900", color: colors.amberText, textAlign: "center", letterSpacing: -0.3 },
  bubbleLabel: { color: colors.amberText },
  bubbleTail: {
    position: "absolute",
    width: 8,
    height: 8,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
});
