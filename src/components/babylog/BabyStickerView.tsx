import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type {
  BabySticker,
  StickerBorderStyle,
  StickerFrameType,
  StickerShadowStyle,
  StickerSpeechBubbleType,
  StickerTemplateId,
} from "../../types/babySticker";
import { colors } from "../../theme";

type VisualProps = {
  imageUri: string;
  borderStyle?: StickerBorderStyle;
  shadowStyle?: StickerShadowStyle;
  speechBubbleType?: StickerSpeechBubbleType;
  frameType?: StickerFrameType;
  templateId?: StickerTemplateId;
  text?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function BabyStickerView({
  imageUri,
  borderStyle = "whiteThick",
  shadowStyle = "soft",
  speechBubbleType = "none",
  frameType = "none",
  templateId = "portrait",
  text,
  size = 132,
  style,
}: VisualProps) {
  const border = borderStyleMap[borderStyle];
  const shadow = shadowStyleMap[shadowStyle];
  const frame = frameStyleMap[frameType];
  const template = templateStyleMap[templateId];
  const label = typeof text === "string" ? text.trim() : "";

  return (
    <View style={[styles.wrap, { width: size + 24 }, style]}>
      {speechBubbleType !== "none" && label ? (
        <View style={[styles.bubble, bubbleStyleMap[speechBubbleType]]}>
          <Text style={styles.bubbleText} numberOfLines={2}>
            {label}
          </Text>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}

      <View style={[styles.frameOuter, frame.outer, { width: size + 8, height: size + 8 }]}>
        {templateId !== "portrait" ? (
          <View
            style={[
              styles.templateBody,
              {
                width: size * 0.74,
                height: size * 0.42,
                borderRadius: size * 0.2,
                backgroundColor: template.bodyColor,
                borderColor: template.accent,
              },
            ]}
          >
            <Text style={[styles.templateBadge, { color: template.accent }]}>{template.badge}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.photoShell,
            border,
            shadow,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
          />
        </View>
      </View>

      {speechBubbleType === "none" && label ? (
        <Text style={styles.caption} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
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
      imageUri={sticker.finalStickerImageUri || sticker.cutoutImageUri || sticker.originalImageUri}
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

const borderStyleMap: Record<StickerBorderStyle, object> = {
  none: { borderWidth: 0, backgroundColor: "transparent" },
  whiteThick: { borderWidth: 5, borderColor: "#FFFFFF", backgroundColor: "#FFFFFF" },
  cream: { borderWidth: 5, borderColor: "#F7EFE4", backgroundColor: "#F7EFE4" },
  coral: { borderWidth: 5, borderColor: colors.amber, backgroundColor: "#FFF5F3" },
};

const shadowStyleMap: Record<StickerShadowStyle, object> = {
  none: {},
  soft: {
    shadowColor: "#4A3428",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  paper: {
    shadowColor: "#2E2A26",
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 3 },
    elevation: 3,
  },
};

const bubbleStyleMap: Record<Exclude<StickerSpeechBubbleType, "none">, object> = {
  round: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  small: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, maxWidth: 110 },
  ribbon: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFF1EC",
    borderColor: colors.amber,
  },
};

const frameStyleMap: Record<StickerFrameType, { outer: object }> = {
  none: { outer: {} },
  star: { outer: { borderColor: "#F0C95A", borderWidth: 2, borderRadius: 18 } },
  heart: { outer: { borderColor: "#E8918A", borderWidth: 2, borderRadius: 18 } },
  ribbon: { outer: { borderColor: "#C9A0C4", borderWidth: 2, borderRadius: 18 } },
  growthBook: { outer: { borderColor: "#8A735A", borderWidth: 2, borderRadius: 14 } },
};

const templateStyleMap: Record<StickerTemplateId, { bodyColor: string; accent: string; badge: string }> = {
  portrait: { bodyColor: "transparent", accent: colors.amber, badge: "" },
  sleepy: { bodyColor: "#EEE9FF", accent: "#7669A8", badge: "쿨쿨" },
  hungry: { bodyColor: "#FFF0DF", accent: "#C77845", badge: "꼬르륵" },
  yummy: { bodyColor: "#FFF4D8", accent: "#B77B28", badge: "냠냠" },
  milestone: { bodyColor: "#E8F4E8", accent: "#648C64", badge: "성공" },
  love: { bodyColor: "#FFE8E5", accent: "#C85F65", badge: "사랑" },
  proud: { bodyColor: "#E5F1F4", accent: "#4E8290", badge: "뿌듯" },
  excited: { bodyColor: "#FFF0E8", accent: "#D96F5F", badge: "신남" },
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  bubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    maxWidth: 150,
    zIndex: 2,
  },
  bubbleText: { fontSize: 11.5, fontWeight: "700", color: colors.text, textAlign: "center" },
  bubbleTail: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: "45deg" }],
  },
  frameOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  templateBody: { position: "absolute", bottom: -12, alignItems: "center", justifyContent: "flex-end", borderWidth: 2, paddingBottom: 3 },
  templateBadge: { fontSize: 9, fontWeight: "900", letterSpacing: -0.2 },
  photoShell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  caption: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
  },
});
