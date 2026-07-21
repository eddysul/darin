/** Baby sticker domain — original / cutout / final assets stay separate. */

export type StickerBorderStyle = "none" | "whiteThick" | "cream" | "coral";
export type StickerShadowStyle = "none" | "soft" | "paper";
export type StickerSpeechBubbleType = "none" | "round" | "small" | "ribbon";
export type StickerFrameType = "none" | "star" | "heart" | "ribbon" | "growthBook";

export type BabySticker = {
  id: string;
  babyId: string;
  originalImageUri: string;
  cutoutImageUri: string;
  finalStickerImageUri: string;
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
  cutoutImageUri: string;
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
  "엄마 최고",
  "많이 컸어요",
  "사랑해요",
] as const;

export function defaultStickerDraft(originalUri: string, cutoutUri: string): BabyStickerDraft {
  return {
    originalImageUri: originalUri,
    cutoutImageUri: cutoutUri,
    borderStyle: "whiteThick",
    shadowStyle: "soft",
    speechBubbleType: "none",
    frameType: "none",
    text: "",
    label: "",
  };
}
