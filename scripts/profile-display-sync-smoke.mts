import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyProfileDisplayToDiaries,
  applyProfileDisplayToFamily,
  applyProfileDisplayToGrowthBook,
  applyProfileDisplayToLogs,
} from "../src/utils/profileDisplayUpdate.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const update = {
  userId,
  babyId: "baby-a",
  displayName: "다솜이 맘",
  realName: "황정문",
  avatarUrl: "signed://new-avatar",
  relationshipLabel: "엄마" as const,
  applyRelationship: true,
  legacyUserIds: ["local-me"],
};

const family = applyProfileDisplayToFamily([
  { id: userId, name: "이전 이름", role: "editor", relationshipLabel: "보호자", status: "active", isMe: true },
  { id: otherId, name: "다른 가족", role: "admin", relationshipLabel: "아빠", status: "active" },
], update);
assert.equal(family[0]?.name, "다솜이 맘");
assert.equal(family[0]?.relationshipLabel, "엄마");
assert.equal(family[0]?.role, "editor", "profile refresh must never promote the current member's permission");
assert.equal(family[1]?.name, "다른 가족");

const differentBabyFamily = applyProfileDisplayToFamily(family, {
  ...update,
  babyId: "baby-b",
  displayName: "새 닉네임",
  relationshipLabel: "시터",
  applyRelationship: false,
});
assert.equal(differentBabyFamily[0]?.name, "새 닉네임", "global profile identity updates across baby scopes");
assert.equal(differentBabyFamily[0]?.relationshipLabel, "엄마", "relationship remains baby-scoped");

const logs = applyProfileDisplayToLogs([
  { id: "log-1", cat: "memo", time: "10:00", createdBy: { userId: "local-me", name: "이전 이름", role: "editor" } },
  { id: "log-2", cat: "memo", time: "11:00", createdBy: { userId: otherId, name: "다른 가족", role: "admin" } },
], update);
assert.equal(logs[0]?.createdBy?.name, "다솜이 맘");
assert.equal(logs[1]?.createdBy?.name, "다른 가족");

const diaries = applyProfileDisplayToDiaries([{
  id: "diary-1",
  date: "9월 21일",
  dateKey: "2026-09-21",
  photos: [],
  comment: "기록",
  careLogSummarySnapshot: "",
  momentSuggestionsUsed: [],
  includedInGrowthBook: true,
  createdBy: { userId, name: "이전 이름", role: "editor" },
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
  source: "manual",
  draftStatus: "saved",
}], update);
assert.equal(diaries[0]?.createdBy?.name, "다솜이 맘");

const growth = applyProfileDisplayToGrowthBook({
  id: "book-1",
  babyId: "baby-a",
  coverTitle: "성장책",
  coverPhotoUri: null,
  pages: {
    "diary-1": {
      diaryId: "diary-1",
      photoLayout: "single_large",
      rollingComments: [{
        id: "comment-1",
        pageId: "diary-1",
        authorId: userId,
        authorName: "이전 이름",
        authorRelationshipLabel: "보호자",
        text: "댓글",
        createdAt: "2026-09-21T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
      }],
    },
  },
  letters: [{
    id: "letter-1",
    growthBookId: "book-1",
    authorId: userId,
    authorName: "이전 이름",
    authorRelationshipLabel: "보호자",
    text: "편지",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  }],
  updatedAt: "2026-09-21T00:00:00.000Z",
}, update, "2026-09-21T01:00:00.000Z");
assert.equal(growth.pages["diary-1"]?.rollingComments[0]?.authorName, "다솜이 맘");
assert.equal(growth.pages["diary-1"]?.rollingComments[0]?.authorRelationshipLabel, "엄마");
assert.equal(growth.letters[0]?.authorName, "다솜이 맘");
assert.equal(growth.letters[0]?.authorRelationshipLabel, "엄마");

const editFormSource = readFileSync(new URL("../src/components/profile/MyProfileEditForm.tsx", import.meta.url), "utf8");
assert.match(editFormSource, /updateMemberRelation\(\{[\s\S]*?displayNameOverride: null,[\s\S]*?\}\);/, "profile save must update the current baby membership without preserving a stale invite-time name override");
assert.doesNotMatch(editFormSource, /updateMemberRelation\([\s\S]*?\)\.catch\(\(\) => undefined\)/, "relationship save failures must not be reported as success");
assert.match(editFormSource, /applyMyProfileUpdate\(\{[\s\S]*?relationshipLabel: relation/, "successful save must publish the local display update");

const contextSource = readFileSync(new URL("../src/context/BabyLogContext.tsx", import.meta.url), "utf8");
assert.match(contextSource, /profileDisplayUpdateFromFamilyMember/, "server hydration must reapply current family identity to historical display snapshots");

console.log("profile display sync QA: PASS");
