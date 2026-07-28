import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { DiaryEntry } from "../types/babyLog";
import type { GrowthBookEdit } from "../types/growthBook";
import type { BabySticker } from "../types/babySticker";
import { formatGrowthAuthorLabel } from "../types/growthBook";
import { buildGrowthBookPages, type GrowthBookPage } from "./growthBookPages";
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
  return sticker.finalStickerImageUri || sticker.cutoutImageUri || sticker.originalImageUri;
}

function pageHtml(page: GrowthBookPage, stickersById: Record<string, BabySticker>): string {
  if (page.kind === "cover") {
    return `
      <section class="page cover">
        <p class="eyebrow">${escapeHtml(page.subtitle ?? "성장책")}</p>
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
            .map(
              (letter) => `
          <div class="letter-block">
            <p class="letter-from">${escapeHtml(
              formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName),
            )}가</p>
            <p class="letter-body">${escapeHtml(letter.text).replace(/\n/g, "<br/>")}</p>
          </div>`,
            )
            .join("")
        : `<p class="body">${escapeHtml(page.body ?? "").replace(/\n/g, "<br/>")}</p>`;

    return `
      <section class="page letter">
        <p class="eyebrow">${escapeHtml(page.subtitle ?? "마지막 편지")}</p>
        <h2>${escapeHtml(page.title)}</h2>
        ${letterBlocks}
      </section>`;
  }

  const comments = (page.rollingComments ?? []).slice(0, 3)
    .map((c) => {
      const familyStickers = (c.stickerIds ?? []).slice(0, 3)
        .map((id) => stickersById[id])
        .filter(Boolean)
        .map((sticker) => `<img src="${escapeHtml(stickerImageUri(sticker!))}" alt="" />`)
        .join("");
      return `
      <div class="comment">
        <p class="comment-author">${escapeHtml(
          formatGrowthAuthorLabel(c.authorRelationshipLabel, c.authorName),
        )}</p>
        <div class="comment-line"><p class="comment-text">“${escapeHtml(c.text)}”</p>${familyStickers ? `<span class="family-stickers">${familyStickers}</span>` : ""}</div>
      </div>`;
    })
    .join("");

  const commentStickerBlocks = (page.commentStickers ?? []).slice().sort((a, b) => a.order - b.order)
    .map((item) => stickersById[item.stickerId])
    .filter(Boolean)
    .slice(0, 6)
    .map((sticker) => `<img src="${escapeHtml(stickerImageUri(sticker!))}" alt="" />`)
    .join("");

  const pageStickerBlocks = (page.pageStickers ?? []).slice().sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => {
      const sticker = stickersById[item.stickerId];
      if (!sticker) return "";
      const position = growthBookStickerPdfPosition(item, growthBookStickerHeightFactor(sticker));
      return `<div class="page-sticker" style="left:${position.leftPercent}%;top:${position.topPercent}%;width:${position.widthPercent}%;z-index:${position.zIndex}"><img src="${escapeHtml(stickerImageUri(sticker))}" alt="" /></div>`;
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
}): string {
  const pages = buildGrowthBookPages(input);
  const stickersById = Object.fromEntries((input.stickers ?? []).map((s) => [s.id, s]));
  const sections = pages.map((page) => pageHtml(page, stickersById)).join("\n");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.babyName)}의 성장책</title>
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
    .family-stickers img { width: 5mm; height: 5mm; border-radius: 2.5mm; object-fit: cover; border: 0.3mm solid #fff; }
    .comment-stickers { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5mm; min-height: 11mm; margin-top: 1mm; }
    .comment-stickers img { width: 10mm; height: 10mm; border-radius: 5mm; object-fit: contain; }
    .page-sticker-layer { position: absolute !important; inset: 0; z-index: 20 !important; pointer-events: none; }
    .page-sticker { position: absolute; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
    .page-sticker img { display: block; width: 100%; height: 100%; object-fit: contain; }
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
}): Promise<{ uri: string } | null> {
  try {
    const html = buildGrowthBookPdfHtml(input);
    const file = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: `${input.babyName}의 성장책 PDF`,
        UTI: "com.adobe.pdf",
      });
    } else if (Platform.OS === "ios") {
      await Print.printAsync({ html });
    } else {
      Alert.alert("PDF 준비됨", `파일이 생성되었어요.\n${file.uri}`);
    }
    return file;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    Alert.alert("PDF 만들기 실패", message);
    return null;
  }
}
