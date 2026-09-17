import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MISSING_MEMORY_AUTHOR_ID,
  collectMemoryAuthorUserIds,
  isMemoryAuthorIdentityMissing,
  memoryAuthorIdsFromBundle,
  memoryAuthorIdsFromCards,
  mergeDisplayProfiles,
  resolveMemoryAuthorAvatarUrl,
  resolveMemoryAuthorName,
} from "../src/utils/memoryAuthorDisplay.ts";
import { memoryCriticalKo } from "../src/i18nMemoriesCriticalMessages.ts";

const MISSING = memoryCriticalKo["memory.critical.050"];
assert.equal(MISSING, "탈퇴한 사용자");

const jungmunId = "11111111-1111-4111-8111-111111111111";
const ayunId = "22222222-2222-4222-8222-222222222222";
const orphanId = "33333333-3333-4333-8333-333333333333";
const jungmun = { userId: jungmunId, displayName: "정문", avatarUrl: "https://example/jungmun.jpg" };

assert.equal(isMemoryAuthorIdentityMissing(null), true);
assert.equal(isMemoryAuthorIdentityMissing(""), true);
assert.equal(isMemoryAuthorIdentityMissing(MISSING_MEMORY_AUTHOR_ID), true);
assert.equal(isMemoryAuthorIdentityMissing("not-a-uuid"), true);
assert.equal(isMemoryAuthorIdentityMissing(jungmunId), false);

assert.deepEqual(
  collectMemoryAuthorUserIds([jungmunId, MISSING_MEMORY_AUTHOR_ID, "", ayunId, jungmunId]),
  [jungmunId, ayunId],
);

assert.deepEqual(memoryAuthorIdsFromCards([
  { post: { authorId: jungmunId }, latestComment: { authorId: ayunId } },
  { post: { authorId: MISSING_MEMORY_AUTHOR_ID } },
]), [jungmunId, ayunId]);

assert.deepEqual(memoryAuthorIdsFromBundle({
  post: { authorId: jungmunId },
  comments: [{ authorId: ayunId }],
  reactions: [{ authorId: jungmunId }],
  tags: [{ taggedUserId: orphanId }, {}],
}), [jungmunId, ayunId, orphanId]);

assert.deepEqual(
  mergeDisplayProfiles([jungmun], [{ userId: ayunId, displayName: "아윤" }]).map((item) => item.userId),
  [jungmunId, ayunId],
);

// 1-3. Active admin/editor author and shared viewer still see the historical name.
assert.equal(resolveMemoryAuthorName({
  authorId: jungmunId,
  profile: jungmun,
  missingLabel: MISSING,
}), "정문", "1/2/3 shared recipient sees author profile name");

// 4-8. Membership/role/share changes do not replace identity when the profile still exists.
assert.equal(resolveMemoryAuthorName({
  authorId: jungmunId,
  profile: jungmun,
  viewerUserId: ayunId,
  viewerName: "아윤",
  missingLabel: MISSING,
}), "정문", "4-8 historical author preserved without membership input");

// Viewer name is used only for the viewer's own posts.
assert.equal(resolveMemoryAuthorName({
  authorId: ayunId,
  profile: null,
  viewerUserId: ayunId,
  viewerName: "아윤",
  missingLabel: MISSING,
}), "아윤");

// 9. Actual deleted/orphan author identity.
assert.equal(resolveMemoryAuthorName({
  authorId: MISSING_MEMORY_AUTHOR_ID,
  profile: jungmun,
  missingLabel: MISSING,
}), MISSING, "9 null author_id uses deleted fallback even if a profile object is nearby");
assert.equal(resolveMemoryAuthorName({
  authorId: orphanId,
  profile: null,
  missingLabel: MISSING,
}), MISSING, "9 missing profile row uses deleted fallback");
assert.equal(resolveMemoryAuthorAvatarUrl({
  authorId: orphanId,
  profile: null,
}), undefined);

// Membership must not be an input to the resolver.
const resolverSource = readFileSync("src/utils/memoryAuthorDisplay.ts", "utf8");
assert.doesNotMatch(resolverSource, /familyMembers|baby_members|memory_friends|permission_role/);

const familyFeed = readFileSync("src/screens/tabs/MemoriesScreen.tsx", "utf8");
assert.match(familyFeed, /listMemoryAuthorDisplayProfiles/);
assert.match(familyFeed, /resolveMemoryAuthorName/);
assert.doesNotMatch(familyFeed, /familyMembers\.find\(\(member\) => member\.id === authorId\)\?\.name/);

const friendFeed = readFileSync("src/screens/tabs/FriendMemoriesScreen.tsx", "utf8");
assert.match(friendFeed, /listMemoryAuthorDisplayProfiles/);
assert.match(friendFeed, /memory\.critical\.050/);
assert.doesNotMatch(friendFeed, /authorName=\{author\?\.displayName \?\? t\("memory\.critical\.155"\)\}/);
assert.doesNotMatch(friendFeed, /listVisibleDisplayProfiles/);

const detail = readFileSync("src/screens/MemoryDetailScreen.tsx", "utf8");
assert.match(detail, /listMemoryAuthorDisplayProfiles/);
assert.match(detail, /resolveMemoryAuthorName/);
assert.doesNotMatch(detail, /familyMembers\.find\(\(member\) => member\.id === id\)\?\.name/);
assert.match(detail, /canEdit = Boolean\(isAuthor \|\| myFamilyRole === "owner" \|\| myFamilyRole === "admin"\)/);
assert.match(detail, /commentAuthorLabel\(item\.authorId\)/, "comment author uses the loaded safe author projection");

const profiles = readFileSync("src/repositories/ProfileRepository.ts", "utf8");
assert.match(profiles, /rpc\("list_memory_author_display"/);
assert.match(profiles, /nickname: null/);
assert.match(profiles, /default_relation: null/);
assert.match(profiles, /isMissingRpc\(error\)\) return this\.listVisibleDisplayProfiles/);
assert.doesNotMatch(profiles.slice(profiles.indexOf("listMemoryAuthorDisplayProfiles"), profiles.indexOf("getMyProfile")), /birth_date|residence_country|guardian_birth_date|preferred_language/);

const migration = readFileSync("supabase/migrations/202609170003_memory_author_display.sql", "utf8");
assert.match(migration, /create or replace function public\.list_memory_author_display\(p_user_ids uuid\[\]\)/);
assert.match(migration, /can_view_memory_post\(post_row\.id\)/);
assert.match(migration, /display_name text,/);
assert.match(migration, /avatar_storage_path text/);
assert.doesNotMatch(migration, /baby_members/);
assert.doesNotMatch(migration, /memory_friends/);
assert.doesNotMatch(migration, /nickname|default_relation|birth_date|residence_country|guardian|preferred_language/);
assert.match(migration, /grant execute on function public\.list_memory_author_display\(uuid\[\]\) to authenticated/);

const types = readFileSync("src/types/database.ts", "utf8");
assert.match(types, /list_memory_author_display:/);
assert.doesNotMatch(
  types.slice(types.indexOf("list_memory_author_display:"), types.indexOf("can_edit_care_logs")),
  /nickname|default_relation|birth_date/,
);

console.log("Memory author identity display QA passed");
