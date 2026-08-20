export const DIARY_COVER_TEMPLATE_IDS = [
  "cloud_sky",
  "purple_dot",
  "green_check",
  "pink_heart",
  "purple_star",
  "yellow_flower",
  "beige_paper",
  "mono_note",
  "night",
  "simple_border",
] as const;

export type DiaryCoverTemplateId = (typeof DIARY_COVER_TEMPLATE_IDS)[number];
export type DiaryTemplatePattern = "none" | "dots" | "check" | "hearts" | "stars" | "grid" | "night" | "stripe";
export type DiaryCoverDecorationType = "cloud" | "heart" | "star" | "flower" | "leaf" | "bow" | "moon" | "bear" | "tape" | "pencil" | "clip";

/** `x`/`y` are percentages of the page box; `size` is the motif width as a percentage of the page width. */
export type DiaryTemplateDecorationSpec = {
  type: DiaryCoverDecorationType;
  x: number;
  y: number;
  size: number;
  rotate?: string;
};

export type DiaryCoverTemplateConfig = {
  id: DiaryCoverTemplateId;
  name: string;
  backgroundColor: string;
  borderColor: string;
  spineColor?: string;
  pattern?: DiaryTemplatePattern;
  photoFrame: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    shape: "roundedRect" | "circle" | "heart" | "scallop";
    borderColor: string;
    borderWidth: number;
  };
  titleBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    backgroundColor: string;
    borderColor: string;
  };
  decorations: DiaryTemplateDecorationSpec[];
};

const frame = (borderColor: string, overrides: Partial<DiaryCoverTemplateConfig["photoFrame"]> = {}): DiaryCoverTemplateConfig["photoFrame"] => ({
  x: 14,
  y: 15,
  width: 72,
  height: 58,
  radius: 10,
  shape: "roundedRect",
  borderColor,
  borderWidth: 1.5,
  ...overrides,
});

const titleBox = (borderColor: string, backgroundColor: string): DiaryCoverTemplateConfig["titleBox"] => ({
  x: 12,
  y: 79,
  width: 76,
  height: 14,
  radius: 7,
  backgroundColor,
  borderColor,
});

export const DIARY_COVER_TEMPLATES: readonly DiaryCoverTemplateConfig[] = [
  { id: "cloud_sky", name: "구름 하늘", backgroundColor: "#F6FBFD", borderColor: "#94BED2", spineColor: "#BBDCEC", pattern: "none", photoFrame: frame("#AACBDA"), titleBox: titleBox("#9BC5D8", "#DFEFF6"), decorations: [{ type: "cloud", x: 67, y: 2, size: 24 }, { type: "cloud", x: 1, y: 32, size: 16 }, { type: "cloud", x: 6, y: 43, size: 12 }] },
  { id: "purple_dot", name: "퍼플 도트", backgroundColor: "#F3ECFA", borderColor: "#A98BC7", spineColor: "#C2A9DA", pattern: "dots", photoFrame: frame("#B39BCA"), titleBox: titleBox("#A98BC7", "#FBF8FE"), decorations: [] },
  { id: "green_check", name: "그린 체크", backgroundColor: "#F1F6E8", borderColor: "#90A96F", spineColor: "#B7C997", pattern: "check", photoFrame: frame("#9DB27E", { shape: "scallop", radius: 22 }), titleBox: titleBox("#90A96F", "#FFFDF7"), decorations: [{ type: "leaf", x: 79, y: 40, size: 14 }] },
  { id: "pink_heart", name: "핑크 하트", backgroundColor: "#FFF0F3", borderColor: "#E990A2", spineColor: "#F4B8C3", pattern: "hearts", photoFrame: frame("#EA91A3", { shape: "heart", radius: 28 }), titleBox: titleBox("#E990A2", "#FFF9FA"), decorations: [{ type: "bow", x: 34, y: 2, size: 30 }, { type: "heart", x: 79, y: 57, size: 12 }] },
  { id: "purple_star", name: "퍼플 별", backgroundColor: "#F2EEFA", borderColor: "#8F7CC2", spineColor: "#B7A6D9", pattern: "stars", photoFrame: frame("#A493CA"), titleBox: titleBox("#8F7CC2", "#FCFAFF"), decorations: [{ type: "moon", x: 77, y: 2, size: 17 }, { type: "star", x: 85, y: 52, size: 8 }, { type: "star", x: 79, y: 60, size: 5 }] },
  { id: "yellow_flower", name: "옐로우 플라워", backgroundColor: "#FFF8DC", borderColor: "#DFB04A", spineColor: "#F2CF75", pattern: "stripe", photoFrame: frame("#E2B34C", { shape: "circle", radius: 48, x: 18, width: 64 }), titleBox: titleBox("#DDAE45", "#FFFDF5"), decorations: [{ type: "tape", x: 36, y: 9, size: 22, rotate: "-4deg" }, { type: "flower", x: 4, y: 36, size: 15 }, { type: "leaf", x: 3, y: 47, size: 12 }, { type: "flower", x: 10, y: 52, size: 12 }, { type: "flower", x: 19, y: 60, size: 10 }, { type: "leaf", x: 27, y: 62, size: 9 }] },
  { id: "beige_paper", name: "베이지 페이퍼", backgroundColor: "#F4E9D7", borderColor: "#A9855D", spineColor: "#C5A77E", pattern: "none", photoFrame: frame("#B59670"), titleBox: titleBox("#A9855D", "#FFFCF5"), decorations: [{ type: "clip", x: 11, y: 4, size: 7, rotate: "12deg" }, { type: "bear", x: 74, y: 60, size: 22 }] },
  { id: "mono_note", name: "모눈 노트", backgroundColor: "#FFF9EE", borderColor: "#D29C55", spineColor: "#E4BE82", pattern: "grid", photoFrame: frame("#D2A269"), titleBox: titleBox("#D29C55", "#FFFDF8"), decorations: [{ type: "tape", x: 9, y: 9, size: 20, rotate: "-16deg" }, { type: "star", x: 79, y: 5, size: 8 }, { type: "pencil", x: 83, y: 52, size: 9, rotate: "16deg" }] },
  { id: "night", name: "나이트", backgroundColor: "#102B57", borderColor: "#F3D36B", spineColor: "#0B2145", pattern: "night", photoFrame: frame("#F6E3A1"), titleBox: titleBox("#F3D36B", "#EEF2F8"), decorations: [{ type: "moon", x: 74, y: 1, size: 21 }, { type: "star", x: 11, y: 8, size: 8 }, { type: "star", x: 24, y: 3, size: 5 }, { type: "star", x: 88, y: 22, size: 5 }] },
  { id: "simple_border", name: "심플 보더", backgroundColor: "#FAF6EC", borderColor: "#273F67", spineColor: "#273F67", pattern: "none", photoFrame: frame("#273F67", { x: 18, width: 64, y: 18, height: 54 }), titleBox: titleBox("#273F67", "#FFFDF8"), decorations: [{ type: "bow", x: 42, y: 6, size: 16 }] },
] as const;

export const DEFAULT_DIARY_COVER_TEMPLATE_ID: DiaryCoverTemplateId = "cloud_sky";

export function isDiaryCoverTemplateId(value: unknown): value is DiaryCoverTemplateId {
  return typeof value === "string" && (DIARY_COVER_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function diaryCoverTemplate(value: unknown): DiaryCoverTemplateConfig {
  const id = isDiaryCoverTemplateId(value) ? value : DEFAULT_DIARY_COVER_TEMPLATE_ID;
  return DIARY_COVER_TEMPLATES.find((item) => item.id === id) ?? DIARY_COVER_TEMPLATES[0];
}
