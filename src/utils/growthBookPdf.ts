import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { DiaryEntry } from "../types/babyLog";
import type { GrowthBookEdit } from "../types/growthBook";
import type { BabySticker, StickerTemplateId } from "../types/babySticker";
import { formatGrowthAuthorLabel } from "../types/growthBook";
import { buildGrowthBookPages, type GrowthBookPage } from "./growthBookPages";
import type { Translate } from "./recordDisplay";
import type { Locale } from "../i18n";
import { growthBookStickerHeightFactor, growthBookStickerPdfPosition } from "./growthBookStickerLayout";
import { getPhotoLayoutSlots, normalizePhotoLayout, photoSlotPercentStyle } from "./growthBookPhotoLayouts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function photoGridHtml(page: GrowthBookPage): string {
  const allUris = page.photoUris ?? (page.photoUri ? [page.photoUri] : []);
  const layout = normalizePhotoLayout(page.photoLayout ?? page.layout, allUris.length);
  const slots = getPhotoLayoutSlots(layout, page.photoLayoutTuning);
  const uris = allUris.slice(0, slots.length);
  if (uris.length === 0) return "";
  const cells = slots
    .map((slot, index) => {
      const uri = uris[index];
      if (!uri) return "";
      const position = photoSlotPercentStyle(slot);
      return `<div class="cell" style="left:${position.leftPercent}%;top:${position.topPercent}%;width:${position.widthPercent}%;height:${position.heightPercent}%"><img src="${escapeHtml(uri)}" alt="" /></div>`;
    })
    .join("");
  return `<div class="grid">${cells}</div>`;
}

function stickerImageUri(sticker: BabySticker): string {
  return sticker.cutoutImageUri || sticker.finalStickerImageUri || sticker.originalImageUri;
}

const PDF_TEMPLATE_DECORATIONS: Partial<Record<StickerTemplateId, readonly string[]>> = {
  hello: ["✦", "♥"],
  huh: ["?", "?"],
  wow: ["!", "✦", "★"],
  yummy: ["♥", "♪"],
  sleepy: ["☾", "Z", "·"],
  cry: ["💧", "💧", "ㅠ"],
  daze: ["…", "✧"],
  heart: ["♥", "♥", "♥"],
  giggle: ["✦", "♪"],
  like: ["★", "✓"],
  pout: ["×", "~"],
  squeal: ["!", "♥"],
  why: ["?", "~"],
  oops: ["!", "✦"],
  bite: ["♪", "♥"],
  cute: ["♥", "★", "✦"],
};

function pdfBubblePlacement(templateId: StickerTemplateId): "top-left" | "top-right" | "bottom-right" {
  if (templateId === "hello" || templateId === "giggle") return "top-left";
  if (["yummy", "daze", "heart", "pout", "squeal", "oops", "bite", "cute"].includes(templateId)) {
    return "bottom-right";
  }
  return "top-right";
}

function stickerVisualHtml(sticker: BabySticker, sizeClass: string): string {
  const uri = stickerImageUri(sticker);
  if (!uri) return "";
  const text = sticker.text.trim();
  const frameClass =
    sticker.frameType === "star"
      ? " frame-star"
      : sticker.frameType === "heart"
        ? " frame-heart"
        : sticker.frameType === "growthBook"
          ? " frame-book"
          : "";
  const bubble = text
    ? `<span class="sticker-text${sticker.speechBubbleType === "round" ? " is-bubble" : ""}">${escapeHtml(text)}</span>`
    : "";
  const decorations = (PDF_TEMPLATE_DECORATIONS[sticker.templateId] ?? [])
    .map((symbol) => `<i>${escapeHtml(symbol)}</i>`)
    .join("");
  const decorationLayer = decorations ? `<span class="sticker-decorations">${decorations}</span>` : "";
  const borderClass = sticker.borderStyle === "whiteThick" ? " has-white-border" : "";
  const shadowClass = sticker.shadowStyle === "soft" ? " has-soft-shadow" : "";
  const shapeClass = sticker.cutoutMode === "circular" ? " is-circle" : " is-rounded";
  const placementClass = ` bubble-${pdfBubblePlacement(sticker.templateId)}`;
  return `<span class="sticker-visual ${sizeClass}${frameClass}${borderClass}${shadowClass}${shapeClass}${placementClass}"><img src="${escapeHtml(uri)}" alt="" />${decorationLayer}${bubble}</span>`;
}

function pageHtml(page: GrowthBookPage, stickersById: Record<string, BabySticker>, t?: Translate): string {
  if (page.kind === "cover") {
    return `
      <section class="page cover">
        <p class="eyebrow">${escapeHtml(page.subtitle ?? (t ? t("growth.critical.013") : "성장책"))}</p>
        <h1>${escapeHtml(page.title)}</h1>
        ${
          page.photoUri
            ? `<div class="cover-photo"><img src="${escapeHtml(page.photoUri)}" alt="" /></div>`
            : ""
        }
        ${page.dateLabel ? `<p class="range">${escapeHtml(page.dateLabel)}</p>` : ""}
      </section>`;
  }

  if (page.kind === "letter") {
    const letters = page.letters ?? [];
    const letterBlocks =
      letters.length > 0
        ? letters
            .map((letter) => {
              const author = formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName, t);
              const from = t ? t("growth.critical.171", { author }) : `${author}가`;
              return `
          <div class="letter-block">
            <p class="letter-from">${escapeHtml(from)}</p>
            <p class="letter-body">${escapeHtml(letter.text).replace(/\n/g, "<br/>")}</p>
          </div>`;
            })
            .join("")
        : `<p class="body">${escapeHtml(page.body ?? "").replace(/\n/g, "<br/>")}</p>`;

    return `
      <section class="page letter">
        <p class="eyebrow">${escapeHtml(page.subtitle ?? (t ? t("growth.critical.010") : "마지막 편지"))}</p>
        <h2>${escapeHtml(page.title)}</h2>
        ${letterBlocks}
      </section>`;
  }

  const comments = (page.rollingComments ?? []).slice(0, 3)
    .map((c) => {
      const familyStickers = (c.stickerIds ?? []).slice(0, 3)
        .map((id) => stickersById[id])
        .filter(Boolean)
        .map((sticker) => stickerVisualHtml(sticker!, "sticker-sm"))
        .join("");
      return `
      <div class="comment">
        <p class="comment-author">${escapeHtml(
          formatGrowthAuthorLabel(c.authorRelationshipLabel, c.authorName, t),
        )}</p>
        <div class="comment-line"><p class="comment-text">“${escapeHtml(c.text)}”</p>${familyStickers ? `<span class="family-stickers">${familyStickers}</span>` : ""}</div>
      </div>`;
    })
    .join("");

  const commentStickerBlocks = (page.commentStickers ?? []).slice().sort((a, b) => a.order - b.order)
    .map((item) => stickersById[item.stickerId])
    .filter(Boolean)
    .slice(0, 6)
    .map((sticker) => stickerVisualHtml(sticker!, "sticker-md"))
    .join("");

  const pageStickerBlocks = (page.pageStickers ?? []).slice().sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => {
      const sticker = stickersById[item.stickerId];
      if (!sticker) return "";
      const position = growthBookStickerPdfPosition(item, growthBookStickerHeightFactor(sticker));
      return `<div class="page-sticker" style="left:${position.leftPercent}%;top:${position.topPercent}%;width:${position.widthPercent}%;z-index:${position.zIndex};transform:rotate(${position.rotation}deg)">${stickerVisualHtml(sticker, "sticker-lg")}</div>`;
    })
    .join("");

  return `
    <section class="page moment${commentStickerBlocks ? " has-comment-stickers" : ""}">
      <p class="eyebrow">${escapeHtml(page.subtitle ?? "")}</p>
      <h2>${escapeHtml(page.title)}</h2>
      ${page.dateLabel ? `<p class="date">${escapeHtml(page.dateLabel)}</p>` : ""}
      ${photoGridHtml(page)}
      ${page.body ? `<p class="body">${escapeHtml(page.body).replace(/\n/g, "<br/>")}</p>` : ""}
      ${commentStickerBlocks ? `<div class="comment-stickers">${commentStickerBlocks}</div>` : ""}
      ${comments ? `<div class="comments">${comments}</div>` : ""}
      ${pageStickerBlocks ? `<div class="page-sticker-layer">${pageStickerBlocks}</div>` : ""}
    </section>`;
}

export function buildGrowthBookPdfHtml(input: {
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
  stickers?: BabySticker[];
  t?: Translate;
  locale?: Locale;
}): string {
  const pages = buildGrowthBookPages(input);
  const stickersById = Object.fromEntries((input.stickers ?? []).map((s) => [s.id, s]));
  const sections = pages.map((page) => pageHtml(page, stickersById, input.t)).join("\n");
  const title = input.t
    ? input.t("growth.critical.139", { babyName: input.babyName })
    : `${input.babyName}의 성장책`;
  return `<!DOCTYPE html>
<html lang="${input.locale ?? "ko"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; color: #3D342C; background: #fff; }
    .page {
      page-break-after: always;
      width: 210mm;
      height: 297mm;
      box-sizing: border-box;
      padding: 18mm 16mm 14mm 20mm;
      position: relative;
      overflow: hidden;
      background: linear-gradient(145deg, #FFF9F2 0%, #F7EFE4 58%, #F3E8DA 100%);
    }
    .page::before { content: ""; position: absolute; left: 12mm; top: 10mm; bottom: 10mm; width: 0.3mm; background: rgba(232,145,138,0.28); }
    .page::after { content: ""; position: absolute; right: 0; top: 0; width: 0; height: 0; border-top: 12mm solid rgba(196,170,140,0.55); border-left: 12mm solid transparent; }
    .page > * { position: relative; z-index: 1; }
    .page:last-child { page-break-after: auto; }
    .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #E8918A; text-transform: uppercase; margin: 0 0 6px; }
    h1 { font-size: 28px; line-height: 1.25; margin: 0 0 16px; }
    h2 { font-size: 22px; line-height: 1.3; margin: 0 0 6px; }
    .range, .date { color: #8A735A; font-size: 12px; font-weight: 600; margin: 0 0 12px; }
    .cover-photo { width: 74%; max-width: 130mm; margin: 8mm auto 7mm; border-radius: 12px; overflow: hidden; border: 2mm solid #fff; box-sizing: border-box; }
    .cover-photo img, .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cover { text-align: center; padding-top: 28mm; }
    .cover-photo { aspect-ratio: 1; }
    .moment { padding-top: 16mm; }
    .grid { position: relative; height: 102mm; margin: 4mm 0 4mm; }
    .moment.has-comment-stickers .grid { height: 82mm; }
    .moment.has-comment-stickers .body { max-height: 14mm; }
    .cell { position: absolute; border-radius: 3mm; overflow: hidden; border: 1mm solid #fff; box-sizing: border-box; }
    .body { font-size: 13px; line-height: 1.55; white-space: pre-wrap; margin: 3mm 0 0; max-height: 27mm; overflow: hidden; }
    .comments { margin-top: 3mm; padding: 2mm; }
    .comment { margin-bottom: 1.5mm; padding: 1.5mm 2mm; background: rgba(255,255,255,0.62); border-radius: 2mm; }
    .comment-author { font-size: 9px; font-weight: 800; margin: 0 0 1mm; color: #E8918A; }
    .comment-text { font-size: 10px; margin: 0; color: #4A4038; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .comment-line { display: flex; align-items: center; gap: 1mm; }
    .comment-line .comment-text { flex: 1; }
    .family-stickers { display: flex; align-items: center; gap: 0.8mm; }
    .comment-stickers { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5mm; min-height: 11mm; margin-top: 1mm; }
    .sticker-visual { position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
    .sticker-visual img { display: block; width: 100%; height: 100%; object-fit: cover; box-sizing: border-box; }
    .sticker-visual.is-rounded img { border-radius: 18%; }
    .sticker-visual.is-circle img { border-radius: 50%; }
    .sticker-visual.has-white-border img { border: 0.8mm solid #fff; }
    .sticker-visual.has-soft-shadow img { filter: drop-shadow(0 1mm 1.5mm rgba(74,52,40,0.18)); }
    .sticker-sm { width: 5mm; height: 5mm; }
    .sticker-md { width: 10mm; height: 10mm; }
    .sticker-lg { width: 100%; }
    .sticker-visual.frame-star img { clip-path: polygon(50% 4%, 62% 36%, 96% 36%, 69% 58%, 80% 92%, 50% 72%, 20% 92%, 31% 58%, 4% 36%, 38% 36%); }
    .sticker-visual.frame-heart img { clip-path: polygon(50% 90%, 16% 66%, 4% 40%, 8% 18%, 28% 8%, 50% 24%, 72% 8%, 92% 18%, 96% 40%, 84% 66%); }
    .sticker-visual.frame-book { padding: 4%; background: #F7EFE4; border: 0.4mm solid #8A735A; border-radius: 1.5mm; box-sizing: border-box; }
    .sticker-decorations { display: none; position: absolute; inset: 0; z-index: 2; pointer-events: none; }
    .sticker-lg .sticker-decorations { display: block; }
    .sticker-decorations i { position: absolute; display: inline-flex; align-items: center; justify-content: center; width: 22%; aspect-ratio: 1; color: #E46F82; font-size: 18px; font-style: normal; font-weight: 900; filter: drop-shadow(0 0.8mm 1mm rgba(74,52,40,0.14)); text-shadow: -1.2px -1.2px 0 #fff, 1.2px -1.2px 0 #fff, -1.2px 1.2px 0 #fff, 1.2px 1.2px 0 #fff, 0 0 3px #fff; }
    .sticker-decorations i:nth-child(1) { left: -7%; top: 5%; transform: rotate(-10deg); }
    .sticker-decorations i:nth-child(2) { left: -7%; bottom: 7%; transform: rotate(10deg); color: #E2A62D; }
    .sticker-decorations i:nth-child(3) { right: -5%; bottom: 7%; transform: rotate(6deg); color: #7199CF; }
    .sticker-visual.bubble-top-left .sticker-decorations i:nth-child(1) { left: auto; right: -7%; }
    .sticker-visual.bubble-top-left .sticker-decorations i:nth-child(2) { left: auto; right: -7%; }
    .sticker-visual.bubble-top-left .sticker-decorations i:nth-child(3) { left: -5%; right: auto; }
    .sticker-visual.bubble-bottom-right .sticker-decorations i:nth-child(2) { left: auto; right: -7%; top: 7%; bottom: auto; }
    .sticker-visual.bubble-bottom-right .sticker-decorations i:nth-child(3) { left: -5%; right: auto; }
    .sticker-text { position: absolute; right: -1mm; top: 1mm; z-index: 3; max-width: 70%; padding: 0.6mm 1.2mm; border-radius: 1.4mm; background: #fff; color: #B03A34; font-size: 6px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sticker-text.is-bubble { background: #fff; color: #B03A34; border: 0.3mm solid #fff; }
    .sticker-visual.bubble-top-left .sticker-text { left: -1mm; right: auto; }
    .sticker-visual.bubble-bottom-right .sticker-text { top: auto; bottom: 1mm; }
    .page-sticker-layer { position: absolute !important; inset: 0; z-index: 20 !important; pointer-events: none; }
    .page-sticker { position: absolute; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
    .letter-block { margin: 16px 0; padding: 12px; background: #FAF4EE; border-radius: 10px; }
    .letter-from { font-weight: 700; color: #E8918A; margin: 0 0 8px; }
    .letter-body { margin: 0; line-height: 1.65; white-space: pre-wrap; }
  </style>
</head>
<body>
  ${sections}
</body>
</html>`;
}

export async function createGrowthBookPdf(input: {
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
  stickers?: BabySticker[];
  t?: Translate;
  locale?: Locale;
}): Promise<{ uri: string } | null> {
  try {
    const html = buildGrowthBookPdfHtml(input);
    const file = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: input.t
          ? input.t("chrome.critical.046", { babyName: input.babyName })
          : `${input.babyName}의 성장책 PDF`,
        UTI: "com.adobe.pdf",
      });
    } else if (Platform.OS === "ios") {
      await Print.printAsync({ html });
    } else {
      Alert.alert(
        input.t ? input.t("chrome.critical.042") : "PDF 준비됨",
        input.t ? input.t("chrome.critical.043", { uri: file.uri }) : `파일이 생성되었어요.\n${file.uri}`,
      );
    }
    return file;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : input.t
        ? input.t("chrome.critical.045")
        : "알 수 없는 오류";
    Alert.alert(input.t ? input.t("chrome.critical.044") : "PDF 만들기 실패", message);
    return null;
  }
}
