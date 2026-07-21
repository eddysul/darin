import assert from "node:assert/strict";
import { buildGrowthBookPages } from "../src/utils/growthBookPages";
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
edit.coverPhotoUri = "cover.jpg";
edit.pages.d1 = {
  diaryId: "d1",
  photos: ["edit-1.jpg", "edit-2.jpg"],
  layout: 2,
  pageComment: "성장책 전용 코멘트",
  rollingComments: [
    {
      id: "c1",
      pageId: "d1",
      authorId: "me",
      authorName: "민지",
      authorRelationshipLabel: "엄마",
      text: "롤링 QA",
      createdAt: now,
      updatedAt: now,
    },
  ],
  stickerIds: ["s1"],
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

const sticker: BabySticker = {
  id: "s1",
  babyId: "baby-1",
  originalImageUri: "original.png",
  cutoutImageUri: "cutout.png",
  finalStickerImageUri: "final.png",
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
assert.deepEqual(pages[1]?.photoUris, ["edit-1.jpg", "edit-2.jpg"]);
assert.equal(pages[1]?.body, "성장책 전용 코멘트");
assert.equal(pages[1]?.rollingComments?.[0]?.authorRelationshipLabel, "엄마");
assert.deepEqual(pages[1]?.stickerIds, ["s1"]);
assert.equal(pages.at(-1)?.letters?.[0]?.text, "마지막 편지 QA");
assert.equal(JSON.stringify(diary), originalDiary, "growth edit must not mutate source diary");

assert.equal(sticker.finalStickerImageUri, "final.png");

const stickerDraft = defaultStickerDraft("original.png", "cutout.png");
assert.equal(stickerDraft.originalImageUri, "original.png");
assert.equal(stickerDraft.cutoutImageUri, "cutout.png");

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
