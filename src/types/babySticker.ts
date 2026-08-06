/** Baby sticker domain — original / cutout / final assets stay separate. */

export type StickerBorderStyle = "none" | "whiteThick" | "cream" | "coral";
export type StickerShadowStyle = "none" | "soft" | "paper";
export type StickerSpeechBubbleType = "none" | "round" | "small" | "ribbon";
export type StickerFrameType = "none" | "star" | "heart" | "ribbon" | "growthBook";
export type StickerType = "faceCrop" | "faceTemplate";
/** How the base photo was turned into a sticker image. */
export type StickerCutoutMode = "circular" | "personCutout";
export type StickerTemplateId =
  | "portrait"
  | "sleepy"
  | "hungry"
  | "yummy"
  | "milestone"
  | "love"
  | "proud"
  | "excited";

export const STICKER_TEMPLATE_OPTIONS: Array<{
  value: StickerTemplateId;
  label: string;
  defaultPhrase: string;
}> = [
  { value: "portrait", label: "기본 얼굴", defaultPhrase: "" },
  { value: "sleepy", label: "졸려요", defaultPhrase: "졸려요" },
  { value: "hungry", label: "배고파요", defaultPhrase: "배고파요" },
  { value: "yummy", label: "잘 먹었어요", defaultPhrase: "오늘도 잘 먹었어요" },
  { value: "milestone", label: "뒤집기 성공", defaultPhrase: "첫 뒤집기 성공!" },
  { value: "love", label: "사랑해", defaultPhrase: "오늘도 사랑해" },
  { value: "proud", label: "뿌듯해요", defaultPhrase: "나 잘했죠?" },
  { value: "excited", label: "신나요", defaultPhrase: "신나는 하루!" },
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
  /** circular = round crop; personCutout = Vision person segmentation (iOS). */
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
  { value: "cream", label: "크림색 테두리" },
  { value: "coral", label: "코랄 테두리" },
];

export const STICKER_SHADOW_OPTIONS: Array<{ value: StickerShadowStyle; label: string }> = [
  { value: "none", label: "없음" },
  { value: "soft", label: "부드러운 그림자" },
  { value: "paper", label: "종이 스티커 그림자" },
];

export const STICKER_BUBBLE_OPTIONS: Array<{ value: StickerSpeechBubbleType; label: string }> = [
  { value: "none", label: "말풍선 없음" },
  { value: "round", label: "둥근 말풍선" },
  { value: "small", label: "작은 말풍선" },
  { value: "ribbon", label: "리본 말풍선" },
];

export const STICKER_FRAME_OPTIONS: Array<{ value: StickerFrameType; label: string }> = [
  { value: "none", label: "프레임 없음" },
  { value: "star", label: "별 프레임" },
  { value: "heart", label: "하트 프레임" },
  { value: "ribbon", label: "리본 프레임" },
  { value: "growthBook", label: "성장책 프레임" },
];

export const STICKER_SUGGESTED_PHRASES = [
  "오늘도 잘 먹었어요",
  "첫 뒤집기 성공!",
  "졸려요",
  "배고파요",
  "나 잘했죠?",
  "신나는 하루!",
  "엄마 최고",
  "아빠 최고",
  "할머니 보고 싶어요",
  "많이 컸어요",
  "오늘도 사랑해",
] as const;

export function defaultStickerDraft(
  originalUri: string,
  cutoutUri: string,
  cutoutMode: StickerCutoutMode = "circular",
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
