/** Baby sticker domain — original / cutout / final assets stay separate. */

export type StickerBorderStyle = "none" | "whiteThick";
export type StickerShadowStyle = "none" | "soft";
export type StickerSpeechBubbleType = "none" | "round";
export type StickerFrameType = "none" | "star" | "heart" | "ribbon" | "growthBook";
export type StickerType = "faceCrop" | "faceTemplate";
/** How the base photo was turned into a sticker image. */
export type StickerCutoutMode = "roundedRect" | "circular" | "personCutout";
export type StickerTemplateId =
  | "portrait"
  | "hello"
  | "huh"
  | "wow"
  | "yummy"
  | "sleepy"
  | "cry"
  | "daze"
  | "heart"
  | "giggle"
  | "like"
  | "pout"
  | "squeal"
  | "why"
  | "oops"
  | "bite"
  | "cute";

export const STICKER_TEMPLATE_OPTIONS: Array<{
  value: StickerTemplateId;
  label: string;
  defaultPhrase: string;
  speechBubbleType: StickerSpeechBubbleType;
}> = [
  { value: "portrait", label: "기본 얼굴", defaultPhrase: "", speechBubbleType: "none" },
  { value: "hello", label: "안녕!", defaultPhrase: "안녕!", speechBubbleType: "round" },
  { value: "huh", label: "응?", defaultPhrase: "응?", speechBubbleType: "round" },
  { value: "wow", label: "우와!", defaultPhrase: "우와!", speechBubbleType: "round" },
  { value: "yummy", label: "냠냠", defaultPhrase: "냠냠", speechBubbleType: "round" },
  { value: "sleepy", label: "졸려요~", defaultPhrase: "졸려요~", speechBubbleType: "round" },
  { value: "cry", label: "힝 ㅠㅠ", defaultPhrase: "힝 ㅠㅠ", speechBubbleType: "round" },
  { value: "daze", label: "멍~", defaultPhrase: "멍~", speechBubbleType: "round" },
  { value: "heart", label: "심쿵", defaultPhrase: "심쿵", speechBubbleType: "round" },
  { value: "giggle", label: "헤헷", defaultPhrase: "헤헷", speechBubbleType: "round" },
  { value: "like", label: "좋아요!", defaultPhrase: "좋아요!", speechBubbleType: "round" },
  { value: "pout", label: "삐짐", defaultPhrase: "삐짐", speechBubbleType: "round" },
  { value: "squeal", label: "꺄!", defaultPhrase: "꺄!", speechBubbleType: "round" },
  { value: "why", label: "왜애", defaultPhrase: "왜애", speechBubbleType: "round" },
  { value: "oops", label: "앗!", defaultPhrase: "앗!", speechBubbleType: "round" },
  { value: "bite", label: "냠!", defaultPhrase: "냠!", speechBubbleType: "round" },
  { value: "cute", label: "헤헤", defaultPhrase: "헤헤", speechBubbleType: "round" },
];

export type BabySticker = {
  id: string;
  babyId: string;
  originalImageUri: string;
  /** Face/cutout source kept separate for future face detection and AI cutout. */
  faceImageUri: string;
  cutoutImageUri: string;
  finalStickerImageUri: string;
  /** Private Supabase object path when this sticker is server-backed. */
  storagePath?: string;
  /** True when the current display URI came from a short-lived signed URL. */
  serverBacked?: boolean;
  /** roundedRect = current default; circular is retained for existing stickers. */
  cutoutMode: StickerCutoutMode;
  stickerType: StickerType;
  templateId: StickerTemplateId;
  label: string;
  borderStyle: StickerBorderStyle;
  shadowStyle: StickerShadowStyle;
  speechBubbleType: StickerSpeechBubbleType;
  frameType: StickerFrameType;
  text: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type BabyStickerDraft = {
  originalImageUri: string;
  faceImageUri: string;
  cutoutImageUri: string;
  cutoutMode: StickerCutoutMode;
  stickerType: StickerType;
  templateId: StickerTemplateId;
  borderStyle: StickerBorderStyle;
  shadowStyle: StickerShadowStyle;
  speechBubbleType: StickerSpeechBubbleType;
  frameType: StickerFrameType;
  text: string;
  label: string;
};

export const STICKER_BORDER_OPTIONS: Array<{ value: StickerBorderStyle; label: string }> = [
  { value: "none", label: "없음" },
  { value: "whiteThick", label: "흰색 두꺼운 테두리" },
];

export const STICKER_SHADOW_OPTIONS: Array<{ value: StickerShadowStyle; label: string }> = [
  { value: "none", label: "없음" },
  { value: "soft", label: "부드러운 그림자" },
];

export const STICKER_BUBBLE_OPTIONS: Array<{ value: StickerSpeechBubbleType; label: string }> = [
  { value: "none", label: "말풍선 없음" },
  { value: "round", label: "둥근 말풍선" },
];

export const STICKER_FRAME_OPTIONS: Array<{ value: StickerFrameType; label: string }> = [
  { value: "none", label: "모양 없음" },
  { value: "star", label: "별" },
  { value: "heart", label: "하트" },
  { value: "ribbon", label: "리본" },
  { value: "growthBook", label: "성장책" },
];

export const STICKER_SUGGESTED_PHRASES = [
  "안녕!",
  "응?",
  "우와!",
  "냠냠",
  "졸려요~",
  "힝 ㅠㅠ",
  "멍~",
  "심쿵",
  "헤헷",
  "좋아요!",
  "삐짐",
  "꺄!",
  "왜애",
  "앗!",
  "냠!",
  "헤헤",
] as const;

const TEMPLATE_IDS = new Set<StickerTemplateId>(STICKER_TEMPLATE_OPTIONS.map((item) => item.value));
const BORDER_STYLES = new Set<StickerBorderStyle>(["none", "whiteThick"]);
const SHADOW_STYLES = new Set<StickerShadowStyle>(["none", "soft"]);
const BUBBLE_TYPES = new Set<StickerSpeechBubbleType>(["none", "round"]);
const FRAME_TYPES = new Set<StickerFrameType>(["none", "star", "heart", "ribbon", "growthBook"]);

export function normalizeTemplateId(value: string | undefined | null): StickerTemplateId {
  if (value === "love") return "heart";
  if (value === "excited") return "giggle";
  return value && TEMPLATE_IDS.has(value as StickerTemplateId) ? (value as StickerTemplateId) : "portrait";
}

export function normalizeBorderStyle(value: string | undefined | null): StickerBorderStyle {
  return value && BORDER_STYLES.has(value as StickerBorderStyle) ? (value as StickerBorderStyle) : "whiteThick";
}

export function normalizeShadowStyle(value: string | undefined | null): StickerShadowStyle {
  return value && SHADOW_STYLES.has(value as StickerShadowStyle) ? (value as StickerShadowStyle) : "soft";
}

export function normalizeSpeechBubbleType(value: string | undefined | null): StickerSpeechBubbleType {
  return value && BUBBLE_TYPES.has(value as StickerSpeechBubbleType) ? (value as StickerSpeechBubbleType) : "none";
}

export function normalizeFrameType(value: string | undefined | null): StickerFrameType {
  return value && FRAME_TYPES.has(value as StickerFrameType) ? (value as StickerFrameType) : "none";
}

export function defaultStickerDraft(
  originalUri: string,
  cutoutUri: string,
  cutoutMode: StickerCutoutMode = "roundedRect",
): BabyStickerDraft {
  return {
    originalImageUri: originalUri,
    faceImageUri: cutoutUri,
    cutoutImageUri: cutoutUri,
    cutoutMode,
    stickerType: "faceTemplate",
    templateId: "portrait",
    borderStyle: cutoutMode === "personCutout" ? "none" : "whiteThick",
    shadowStyle: "soft",
    speechBubbleType: "none",
    frameType: "none",
    text: "",
    label: "",
  };
}
