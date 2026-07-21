import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { DiaryEntry } from "../types/babyLog";
import type { GrowthBookEdit } from "../types/growthBook";
import type { BabySticker } from "../types/babySticker";
import { formatGrowthAuthorLabel } from "../types/growthBook";
import { buildGrowthBookPages, type GrowthBookPage } from "./growthBookPages";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function photoGridHtml(page: GrowthBookPage): string {
  const uris = (page.photoUris ?? (page.photoUri ? [page.photoUri] : [])).slice(0, page.layout ?? 1);
  if (uris.length === 0) return "";
  const layout = page.layout ?? Math.min(4, Math.max(1, uris.length));
  const cells = uris
    .map(
      (uri) =>
        `<div class="cell"><img src="${escapeHtml(uri)}" alt="" /></div>`,
    )
    .join("");
  return `<div class="grid layout-${layout}">${cells}</div>`;
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

  const comments = (page.rollingComments ?? [])
    .map(
      (c) => `
      <div class="comment">
        <p class="comment-author">${escapeHtml(
          formatGrowthAuthorLabel(c.authorRelationshipLabel, c.authorName),
        )}</p>
        <p class="comment-text">“${escapeHtml(c.text)}”</p>
      </div>`,
    )
    .join("");

  const stickerBlocks = (page.stickerIds ?? [])
    .map((id) => stickersById[id])
    .filter(Boolean)
    .map((sticker) => {
      const uri = sticker!.finalStickerImageUri || sticker!.cutoutImageUri;
      const caption = sticker!.text || sticker!.label;
      return `<div class="sticker"><img src="${escapeHtml(uri)}" alt="" /><p>${escapeHtml(caption)}</p></div>`;
    })
    .join("");

  return `
    <section class="page moment">
      <p class="eyebrow">${escapeHtml(page.subtitle ?? "")}</p>
      <h2>${escapeHtml(page.title)}</h2>
      ${page.dateLabel ? `<p class="date">${escapeHtml(page.dateLabel)}</p>` : ""}
      ${photoGridHtml(page)}
      ${page.body ? `<p class="body">${escapeHtml(page.body).replace(/\n/g, "<br/>")}</p>` : ""}
      ${comments ? `<div class="comments">${comments}</div>` : ""}
      ${stickerBlocks ? `<div class="stickers">${stickerBlocks}</div>` : ""}
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
    @page { size: A4; margin: 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; color: #2E2A26; background: #fff; }
    .page { page-break-after: always; padding: 12px 8px 28px; }
    .page:last-child { page-break-after: auto; }
    .eyebrow { font-size: 11px; letter-spacing: 0.08em; color: #A39E96; text-transform: uppercase; margin: 0 0 6px; }
    h1 { font-size: 28px; margin: 0 0 18px; }
    h2 { font-size: 20px; margin: 0 0 8px; }
    .range, .date { color: #7A746C; font-size: 12px; margin: 0 0 14px; }
    .cover-photo { width: 100%; max-width: 360px; margin: 0 auto 16px; border-radius: 12px; overflow: hidden; }
    .cover-photo img, .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cover { text-align: center; }
    .cover-photo { aspect-ratio: 3/4; }
    .grid { display: grid; gap: 8px; margin: 12px 0 16px; }
    .layout-1 { grid-template-columns: 1fr; }
    .layout-1 .cell { aspect-ratio: 4/3; border-radius: 10px; overflow: hidden; }
    .layout-2 { grid-template-columns: 1fr 1fr; }
    .layout-2 .cell { aspect-ratio: 1; border-radius: 10px; overflow: hidden; }
    .layout-3 { grid-template-columns: 1fr 1fr; }
    .layout-3 .cell:first-child { grid-column: 1 / -1; aspect-ratio: 16/9; }
    .layout-3 .cell { aspect-ratio: 1; border-radius: 10px; overflow: hidden; }
    .layout-4 { grid-template-columns: 1fr 1fr; }
    .layout-4 .cell { aspect-ratio: 1; border-radius: 10px; overflow: hidden; }
    .body { font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
    .comments { margin-top: 18px; border-top: 1px solid #EDE5DC; padding-top: 12px; }
    .comment { margin-bottom: 12px; }
    .comment-author { font-size: 12px; font-weight: 700; margin: 0 0 4px; color: #E8918A; }
    .comment-text { font-size: 13px; margin: 0; color: #2E2A26; }
    .stickers { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; justify-content: center; }
    .sticker { width: 96px; text-align: center; }
    .sticker img { width: 84px; height: 84px; border-radius: 42px; object-fit: cover; border: 4px solid #fff; box-shadow: 0 4px 10px rgba(74,52,40,0.18); }
    .sticker p { font-size: 11px; margin: 6px 0 0; color: #7A746C; }
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
