import type { DiaryTemplateDecorationSpec, DiaryTemplatePattern } from "./diaryCoverTemplates";

export const DIARY_PAGE_TEMPLATE_IDS = [
  "basic_line",
  "blue_cloud",
  "green_check",
  "pink_heart",
  "purple_star",
  "yellow_flower",
  "beige_paper",
  "mono_note",
  "night",
  "simple_border",
] as const;

export type DiaryPageTemplateId = (typeof DIARY_PAGE_TEMPLATE_IDS)[number];

export type DiaryPageTemplateConfig = {
  id: DiaryPageTemplateId;
  name: string;
  backgroundColor: string;
  surfaceColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  pattern?: DiaryTemplatePattern;
  headerStyle: "line" | "rounded" | "soft";
  writingLineStyle: "solid" | "dashed" | "dotted";
  titleSectionStyle: "box" | "line";
  decorations: DiaryTemplateDecorationSpec[];
};

export const DIARY_PAGE_TEMPLATES: readonly DiaryPageTemplateConfig[] = [
  { id: "basic_line", name: "기본 라인", backgroundColor: "#FFFDF8", surfaceColor: "#FFFDF8", borderColor: "#655E55", accentColor: "#8A8176", textColor: "#35312C", pattern: "none", headerStyle: "line", writingLineStyle: "solid", titleSectionStyle: "line", decorations: [] },
  { id: "blue_cloud", name: "블루 클라우드", backgroundColor: "#EAF6FB", surfaceColor: "#FFFDF8", borderColor: "#8BBBD1", accentColor: "#6DA9C4", textColor: "#345F76", pattern: "none", headerStyle: "soft", writingLineStyle: "dashed", titleSectionStyle: "box", decorations: [{ type: "cloud", x: 54, y: 68, size: 42 }] },
  { id: "green_check", name: "그린 체크", backgroundColor: "#EFF5E6", surfaceColor: "#FFFDF7", borderColor: "#91A970", accentColor: "#7D995B", textColor: "#526D38", pattern: "check", headerStyle: "rounded", writingLineStyle: "dotted", titleSectionStyle: "line", decorations: [{ type: "leaf", x: 68, y: 72, size: 26 }] },
  { id: "pink_heart", name: "핑크 하트", backgroundColor: "#FFF0F3", surfaceColor: "#FFFDFB", borderColor: "#E78A9B", accentColor: "#DF7187", textColor: "#914557", pattern: "hearts", headerStyle: "rounded", writingLineStyle: "dashed", titleSectionStyle: "line", decorations: [{ type: "heart", x: 62, y: 70, size: 30 }] },
  { id: "purple_star", name: "퍼플 별", backgroundColor: "#F0ECFA", surfaceColor: "#FFFDFB", borderColor: "#8E7AC4", accentColor: "#7B68B2", textColor: "#55477D", pattern: "stars", headerStyle: "soft", writingLineStyle: "dotted", titleSectionStyle: "line", decorations: [{ type: "star", x: 64, y: 70, size: 22 }, { type: "star", x: 80, y: 80, size: 14 }] },
  { id: "yellow_flower", name: "옐로우 플라워", backgroundColor: "#FFF8DD", surfaceColor: "#FFFDF5", borderColor: "#DDAE45", accentColor: "#C99429", textColor: "#765B24", pattern: "stripe", headerStyle: "line", writingLineStyle: "dotted", titleSectionStyle: "box", decorations: [{ type: "flower", x: 62, y: 70, size: 26 }, { type: "leaf", x: 80, y: 80, size: 16 }] },
  { id: "beige_paper", name: "베이지 페이퍼", backgroundColor: "#F4E9D7", surfaceColor: "#FFFCF5", borderColor: "#A9855D", accentColor: "#97734D", textColor: "#624B34", pattern: "none", headerStyle: "soft", writingLineStyle: "dashed", titleSectionStyle: "box", decorations: [{ type: "bear", x: 62, y: 70, size: 32 }] },
  { id: "mono_note", name: "모눈 노트", backgroundColor: "#FFF9EE", surfaceColor: "#FFFDF8", borderColor: "#D29C55", accentColor: "#BD853B", textColor: "#76542E", pattern: "grid", headerStyle: "line", writingLineStyle: "dashed", titleSectionStyle: "line", decorations: [{ type: "pencil", x: 78, y: 70, size: 16, rotate: "18deg" }] },
  { id: "night", name: "나이트", backgroundColor: "#102B57", surfaceColor: "#F8FAFD", borderColor: "#F3D36B", accentColor: "#E3C35B", textColor: "#243D66", pattern: "night", headerStyle: "rounded", writingLineStyle: "dotted", titleSectionStyle: "box", decorations: [{ type: "moon", x: 64, y: 68, size: 28 }, { type: "star", x: 58, y: 82, size: 10 }] },
  { id: "simple_border", name: "심플 보더", backgroundColor: "#FAF6EC", surfaceColor: "#FFFDF8", borderColor: "#273F67", accentColor: "#273F67", textColor: "#273F67", pattern: "none", headerStyle: "line", writingLineStyle: "solid", titleSectionStyle: "line", decorations: [{ type: "bow", x: 62, y: 78, size: 28 }] },
] as const;

export const DEFAULT_DIARY_PAGE_TEMPLATE_ID: DiaryPageTemplateId = "basic_line";

export function isDiaryPageTemplateId(value: unknown): value is DiaryPageTemplateId {
  return typeof value === "string" && (DIARY_PAGE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function diaryPageTemplate(value: unknown): DiaryPageTemplateConfig {
  const id = isDiaryPageTemplateId(value) ? value : DEFAULT_DIARY_PAGE_TEMPLATE_ID;
  return DIARY_PAGE_TEMPLATES.find((item) => item.id === id) ?? DIARY_PAGE_TEMPLATES[0];
}
