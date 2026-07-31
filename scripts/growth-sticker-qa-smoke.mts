import assert from "node:assert/strict";
import {
  buildGrowthBookPageMeta,
  buildGrowthBookPages,
  buildGrowthBookPaginationItems,
  resolveGrowthBookSwipeDirection,
} from "../src/utils/growthBookPages";
import {
  PHOTO_LAYOUT_OPTIONS,
  getPhotoLayoutSlots,
  normalizePhotoLayout,
  photoSlotPercentStyle,
  swapPhotoOrder,
} from "../src/utils/growthBookPhotoLayouts";
import {
  growthBookStickerHeightFactor,
  growthBookStickerPdfPosition,
} from "../src/utils/growthBookStickerLayout";
import { createEmptyGrowthBookEdit } from "../src/types/growthBook";
import { defaultStickerDraft, type BabySticker } from "../src/types/babySticker";
import {
  canDeleteGrowthBookNote,
  canEditOwnGrowthBookNote,
  canWriteGrowthBookNote,
  memberRelationshipLabel,
  type FamilyMember,
} from "../src/types/family";
import type { DiaryEntry } from "../src/types/babyLog";

const now = new Date().toISOString();
const diary: DiaryEntry = {
  id: "d1",
  babyId: "baby-1",
  date: "2026.7.21",
  dateKey: "2026-07-21",
  photos: ["original.jpg"],
  comment: "원본 일기",
  weatherStamp: null,
  moodStamp: null,
  careLogSummarySnapshot: "",
  momentSuggestionsUsed: [],
  milestoneTag: "첫 미소",
  customMilestoneTag: null,
  includedInGrowthBook: true,
  stickerIds: [],
  createdAt: now,
  updatedAt: now,
  source: "manual",
  draftStatus: "saved",
};
const originalDiary = JSON.stringify(diary);

const edit = createEmptyGrowthBookEdit({ babyId: "baby-1", babyName: "콩" });
edit.coverTitle = "QA 성장책";
edit.coverSubtitle = "우리 가족의 성장 기록";
edit.coverDateRange = "2026.07 ~ 2026.12";
edit.coverPhotoUri = "cover.jpg";
edit.pages.d1 = {
  diaryId: "d1",
  photos: ["edit-1.jpg", "edit-2.jpg"],
  photoLayout: "three_left_large_right_top_medium_bottom_small",
  photoLayoutTuning: { primaryRatio: 0.65, secondaryTopRatio: 0.6 },
  pageComment: "성장책 전용 코멘트",
  rollingComments: [
    {
      id: "c1",
      pageId: "d1",
      authorId: "me",
      authorName: "민지",
      authorRelationshipLabel: "엄마",
      text: "롤링 QA",
      stickerIds: ["s1"],
      createdAt: now,
      updatedAt: now,
    },
  ],
  pageStickers: [
    {
      id: "ps1",
      pageId: "d1",
      stickerId: "s1",
      xRatio: 0.25,
      yRatio: 0.4,
      widthRatio: 0.2,
      zIndex: 3,
      createdBy: "me",
      createdAt: now,
    },
  ],
  commentStickers: [
    {
      id: "cs1",
      pageId: "d1",
      stickerId: "s1",
      order: 0,
      createdBy: "me",
      createdAt: now,
    },
  ],
};
edit.letters = [
  {
    id: "l1",
    growthBookId: edit.id,
    authorId: "me",
    authorName: "민지",
    authorRelationshipLabel: "엄마",
    text: "마지막 편지 QA",
    createdAt: now,
    updatedAt: now,
  },
];

const restoredEdit = JSON.parse(JSON.stringify(edit)) as typeof edit;
assert.equal(restoredEdit.pages.d1?.pageStickers?.[0]?.xRatio, 0.25);
assert.equal(restoredEdit.pages.d1?.pageStickers?.[0]?.yRatio, 0.4);
assert.equal(restoredEdit.pages.d1?.pageStickers?.[0]?.widthRatio, 0.2);
assert.deepEqual(restoredEdit.pages.d1?.photoLayoutTuning, { primaryRatio: 0.65, secondaryTopRatio: 0.6 });
assert.deepEqual(restoredEdit.pages.d1?.rollingComments?.[0]?.stickerIds, ["s1"]);

const sticker: BabySticker = {
  id: "s1",
  babyId: "baby-1",
  originalImageUri: "original.png",
  faceImageUri: "cutout.png",
  cutoutImageUri: "cutout.png",
  finalStickerImageUri: "final.png",
  cutoutMode: "circular",
  stickerType: "faceTemplate",
  templateId: "milestone",
  label: "QA 스티커",
  borderStyle: "whiteThick",
  shadowStyle: "soft",
  speechBubbleType: "round",
  frameType: "star",
  text: "쑥쑥",
  createdBy: "me",
  createdAt: now,
  updatedAt: now,
};

const pages = buildGrowthBookPages({ babyName: "콩", entries: [diary], edit });
assert.equal(pages[0]?.title, "QA 성장책");
assert.equal(pages[0]?.pageType, "cover");
assert.equal(pages[0]?.subtitle, "우리 가족의 성장 기록");
assert.equal(pages[0]?.dateLabel, "2026.07 ~ 2026.12");
assert.deepEqual(pages[1]?.photoUris, ["edit-1.jpg", "edit-2.jpg"]);
assert.equal(pages[1]?.pageType, "diary");
assert.equal(pages[1]?.photoLayout, "three_left_large_right_top_medium_bottom_small");
assert.deepEqual(pages[1]?.photoLayoutTuning, { primaryRatio: 0.65, secondaryTopRatio: 0.6 });
assert.equal(pages[1]?.body, "성장책 전용 코멘트");
assert.equal(pages[1]?.rollingComments?.[0]?.authorRelationshipLabel, "엄마");
assert.deepEqual(pages[1]?.rollingComments?.[0]?.stickerIds, ["s1"]);
assert.deepEqual(pages[1]?.stickerIds, ["s1"]);
assert.equal(pages[1]?.pageStickers?.[0]?.xRatio, 0.25);
assert.equal(pages[1]?.pageStickers?.[0]?.widthRatio, 0.2);
assert.equal(pages[1]?.commentStickers?.[0]?.stickerId, "s1");
assert.equal(pages.at(-1)?.letters?.[0]?.text, "마지막 편지 QA");
assert.equal(pages.at(-1)?.pageType, "final_letter");
assert.deepEqual(buildGrowthBookPageMeta(pages).map((page) => ({ type: page.pageType, title: page.title, diaryId: page.linkedDiaryEntryId })), [
  { type: "cover", title: "표지", diaryId: undefined },
  { type: "diary", title: "1", diaryId: "d1" },
  { type: "final_letter", title: "편지", diaryId: undefined },
]);
assert.deepEqual(
  buildGrowthBookPaginationItems(12, 7).map((item) => item.type === "page" ? item.index : "…"),
  [0, "…", 6, 7, 8, "…", 11],
);
assert.deepEqual(
  buildGrowthBookPaginationItems(5, 2).map((item) => item.type === "page" ? item.index : "…"),
  [0, 1, 2, 3, 4],
);
assert.equal(resolveGrowthBookSwipeDirection(-84, 12), "next");
assert.equal(resolveGrowthBookSwipeDirection(84, 12), "previous");
assert.equal(resolveGrowthBookSwipeDirection(-30, 4), null);
assert.equal(resolveGrowthBookSwipeDirection(-84, 72), null);
assert.equal(JSON.stringify(diary), originalDiary, "growth edit must not mutate source diary");

assert.equal(normalizePhotoLayout(3), "three_top_large_bottom_two");
assert.equal(PHOTO_LAYOUT_OPTIONS.length, 13);
for (const option of PHOTO_LAYOUT_OPTIONS) {
  const slots = getPhotoLayoutSlots(option.value);
  assert.equal(slots.length, option.photoCount);
  for (const photoSlot of slots) {
    assert.ok(photoSlot.xRatio >= 0 && photoSlot.yRatio >= 0);
    assert.ok(photoSlot.widthRatio > 0 && photoSlot.heightRatio > 0);
    assert.ok(photoSlot.xRatio + photoSlot.widthRatio <= 1.000001);
    assert.ok(photoSlot.yRatio + photoSlot.heightRatio <= 1.000001);
  }
}
const asymmetricSlots = getPhotoLayoutSlots("three_left_large_right_top_medium_bottom_small");
assert.equal(asymmetricSlots[0]?.heightRatio, 1);
assert.ok((asymmetricSlots[1]?.heightRatio ?? 0) > (asymmetricSlots[2]?.heightRatio ?? 1));
assert.deepEqual(asymmetricSlots.map((item) => [item.xRatio, item.yRatio, item.widthRatio, item.heightRatio]), [
  [0, 0, 0.62, 1],
  [0.66, 0, 0.34, 0.58],
  [0.66, 0.62, 0.34, 0.38],
]);
const tunedAsymmetricSlots = getPhotoLayoutSlots(
  "three_left_large_right_top_medium_bottom_small",
  { primaryRatio: 0.7, secondaryTopRatio: 0.65 },
);
assert.deepEqual(tunedAsymmetricSlots.map((item) => [item.xRatio, item.yRatio, item.widthRatio, item.heightRatio]), [
  [0, 0, 0.7, 1],
  [0.74, 0, 0.26, 0.65],
  [0.74, 0.69, 0.26, 0.31],
]);
assert.deepEqual(swapPhotoOrder(["first", "second", "third"], 0, 2), ["third", "second", "first"]);
assert.deepEqual(swapPhotoOrder(["first", "second"], 0, 4), ["first", "second"]);
const asymmetricPdfSlot = photoSlotPercentStyle(asymmetricSlots[1]!);
assert.equal(asymmetricPdfSlot.leftPercent, 66);
assert.equal(asymmetricPdfSlot.topPercent, 0);
assert.equal(asymmetricPdfSlot.widthPercent, 34);
assert.ok(Math.abs(asymmetricPdfSlot.heightPercent - 58) < 0.000001);

assert.equal(sticker.finalStickerImageUri, "final.png");
assert.equal(sticker.faceImageUri, "cutout.png");
assert.equal(sticker.templateId, "milestone");

assert.deepEqual(growthBookStickerPdfPosition(edit.pages.d1!.pageStickers![0]!), {
  leftPercent: 25,
  topPercent: 40,
  widthPercent: 20,
  zIndex: 3,
});
assert.equal(growthBookStickerHeightFactor(sticker), 1.75);
assert.ok(
  growthBookStickerPdfPosition(
    { ...edit.pages.d1!.pageStickers![0]!, yRatio: 0.99 },
    growthBookStickerHeightFactor(sticker),
  ).topPercent < 76,
  "decorated sticker must stay inside the PDF page",
);

const stickerDraft = defaultStickerDraft("original.png", "cutout.png");
assert.equal(stickerDraft.originalImageUri, "original.png");
assert.equal(stickerDraft.cutoutImageUri, "cutout.png");
assert.equal(stickerDraft.faceImageUri, "cutout.png");
assert.equal(stickerDraft.templateId, "portrait");
assert.equal(stickerDraft.cutoutMode, "circular");
assert.equal(stickerDraft.borderStyle, "whiteThick");
const personStickerDraft = defaultStickerDraft("original.png", "person.png", "personCutout");
assert.equal(personStickerDraft.cutoutMode, "personCutout");
assert.equal(personStickerDraft.borderStyle, "none");

const me: FamilyMember = {
  id: "me",
  name: "민지",
  role: "editor",
  relationshipLabel: "엄마",
  status: "active",
  isMe: true,
};
assert.equal(memberRelationshipLabel(me), "엄마");
assert.equal(canWriteGrowthBookNote("viewer"), false);
assert.equal(canEditOwnGrowthBookNote("editor", "me", me), true);
assert.equal(canEditOwnGrowthBookNote("editor", "other", me), false);
assert.equal(canDeleteGrowthBookNote("admin", "other", me), true);

console.log("growth-sticker-qa-smoke: all checks passed");
