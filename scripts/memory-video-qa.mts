import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeMemoryVideoDurationMs, normalizeMediaDimension, MemoryMediaUploadError } from "../src/utils/memoryMediaMetadata.ts";
import { uploadMediaWithRecovery } from "../src/utils/mediaUploadRecovery.ts";
import { memoryFeedAspectRatio } from "../src/components/memories/memoryPresentation.ts";
import {
  buildTempMediaPath,
  buildTempPosterPath,
  isCanonicalMediaPath,
  isTempMediaPath,
} from "../src/utils/tempMediaPath.ts";
import { memoryFeedPostIdFromViewable } from "../src/utils/memoryFeedPlayback.ts";
import {
  memoryCriticalEn,
  memoryCriticalEs,
  memoryCriticalJa,
  memoryCriticalKo,
  memoryCriticalZhCN,
} from "../src/i18nMemoriesCriticalMessages.ts";

const baby = "10000000-0000-4000-8000-000000000001";
const session = "20000000-0000-4000-8000-000000000001";
const media = "30000000-0000-4000-8000-000000000001";
const limits = readFileSync("src/utils/memoryVideo.ts", "utf8");
assert.equal(normalizeMemoryVideoDurationMs(90_000), 90_000);
assert.equal(normalizeMemoryVideoDurationMs(3566.666666666667), 3567, "iOS fractional duration becomes an int4-compatible value");
assert.equal(normalizeMemoryVideoDurationMs(6095.238095), 6095);
assert.equal(normalizeMemoryVideoDurationMs(120), 120, "short clips remain milliseconds, not seconds");
for (const invalid of [undefined, null, NaN, Infinity, -1, 0]) {
  assert.throws(() => normalizeMemoryVideoDurationMs(invalid), (e: unknown) => e instanceof MemoryMediaUploadError && e.code === "VIDEO_DURATION_UNKNOWN");
}
assert.throws(() => normalizeMemoryVideoDurationMs(90000.01), /VIDEO_TOO_LONG/, "check the upper bound before rounding");
for (const invalid of [NaN, Infinity, -1, 0, 2_147_483_648]) assert.equal(normalizeMediaDimension(invalid), undefined);
assert.equal(normalizeMediaDimension(1079.999999), 1080);
for (const value of [NaN, Infinity, -1, 0]) {
  assert.equal(memoryFeedAspectRatio({ width: value, height: 1920 }), 1);
  assert.equal(memoryFeedAspectRatio({ width: 1080, height: value }), 1);
}
assert.equal(memoryFeedAspectRatio({ width: 1080, height: 1920 }), 0.8);

let attempts = 0;
let verifies = 0;
const network = { originalError: new TypeError("Network request failed") };
await uploadMediaWithRecovery({
  upload: async () => ({ error: ++attempts === 1 ? network : null }),
  assertCurrent: async () => {}, verifyOwned: async () => false, wait: async () => {},
});
assert.equal(attempts, 2, "one transient failure recovers");
attempts = 0;
await uploadMediaWithRecovery({
  upload: async () => ({ error: ++attempts === 1 ? network : { statusCode: "409" } }),
  assertCurrent: async () => {}, verifyOwned: async () => { verifies++; return true; }, wait: async () => {},
});
assert.equal(verifies, 1, "lost upload acknowledgement verifies ownership before accepting conflict");
for (const error of [{ statusCode: 403 }, { statusCode: 413 }, { statusCode: 409 }]) {
  attempts = 0;
  await assert.rejects(uploadMediaWithRecovery({ upload: async () => { attempts++; return { error }; },
    assertCurrent: async () => {}, verifyOwned: async () => false, wait: async () => {} }));
  assert.equal(attempts, 1, "permanent or foreign-object errors are not retried");
}
attempts = 0;
await assert.rejects(uploadMediaWithRecovery({ upload: async () => { attempts++; return { error: network }; },
  assertCurrent: async () => {}, verifyOwned: async () => false, wait: async () => {} }));
assert.equal(attempts, 2, "persistent network failure stops after one retry");
attempts = 0;
let switched = false;
await assert.rejects(uploadMediaWithRecovery({ upload: async () => { attempts++; return { error: network }; },
  assertCurrent: async () => { if (switched) throw new Error("scope changed"); },
  verifyOwned: async () => false, wait: async () => { switched = true; } }), /scope changed/);
assert.equal(attempts, 1, "account switch/cancel prevents retry dispatch");
assert.match(limits, /MEMORY_VIDEO_MAX_BYTES = 100 \* 1024 \* 1024/);
assert.match(limits, /durationMs > MEMORY_VIDEO_MAX_DURATION_MS/);
assert.match(limits, /video\/quicktime/);
assert.match(limits, /memory\.critical\.190/);

function videoDurationExceedsLimit(durationMs: number): boolean {
  return durationMs > 90_000;
}
function formatMemoryVideoDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

assert.equal(videoDurationExceedsLimit(10_000), false, "A 10s video is allowed");
assert.equal(videoDurationExceedsLimit(89_000), false, "B 89s video is allowed");
assert.equal(videoDurationExceedsLimit(90_000), false, "C exactly 90.000s is allowed");
assert.equal(videoDurationExceedsLimit(90_001), true, "D >90s is rejected");
assert.equal(formatMemoryVideoDuration(90_000), "1:30");
assert.equal(formatMemoryVideoDuration(10_000), "0:10");

const mp4 = buildTempMediaPath(baby, session, media, "mp4");
const mov = buildTempMediaPath(baby, session, media, "mov");
const poster = buildTempPosterPath(baby, session, media);
assert.ok(isCanonicalMediaPath(mp4));
assert.ok(isCanonicalMediaPath(mov));
assert.ok(isCanonicalMediaPath(poster));
assert.ok(isTempMediaPath(baby, mp4));
assert.ok(isTempMediaPath(baby, poster));
assert.ok(!isTempMediaPath(session, mp4));

assert.match(limits, /VIDEO_TOO_LONG/);
assert.match(limits, /VIDEO_TOO_LARGE/);

assert.equal(memoryFeedPostIdFromViewable({ kind: "ad" }), null);
assert.equal(memoryFeedPostIdFromViewable({ kind: "memory", card: { post: { id: "post-1" } } }), "post-1");
assert.equal(memoryFeedPostIdFromViewable({ post: { id: "post-2" } }), "post-2");

for (const id of ["190", "191", "192", "193", "194", "195", "196", "197", "198", "199", "200", "201", "202", "203", "204", "205", "206"]) {
  const key = `memory.critical.${id}` as keyof typeof memoryCriticalKo;
  assert.ok(memoryCriticalKo[key], `ko ${key}`);
  assert.ok(memoryCriticalEn[key], `en ${key}`);
  assert.ok(memoryCriticalJa[key], `ja ${key}`);
  assert.ok(memoryCriticalEs[key], `es ${key}`);
  assert.ok(memoryCriticalZhCN[key], `zh ${key}`);
}
assert.match(memoryCriticalKo["memory.critical.190"], /90초/);

const migration = readFileSync("supabase/migrations/202609170001_memory_video_media.sql", "utf8");
const compatibilityMigration = readFileSync("supabase/migrations/202609210001_memory_video_baby_scope_compat.sql", "utf8");
assert.match(migration, /duration_ms/);
assert.match(migration, /thumbnail_storage_path/);
assert.doesNotMatch(migration, /returns table\(bucket_id text,storage_path text,expires_in integer,thumbnail_storage_path text\)/);
assert.match(compatibilityMigration, /returns table\(bucket_id text,storage_path text,expires_in integer,thumbnail_storage_path text\)/);
assert.match(compatibilityMigration, /has_baby_access\(b\.id,'care\.read'\)/);
assert.match(compatibilityMigration, /has_baby_access\(b\.id,'moments\.read'\)/);
assert.match(migration, /mp4\|mov\|m4v/);
assert.match(migration, /file_size_limit=104857600/);
assert.match(migration, /video\/mp4/);
assert.match(migration, /video\/quicktime/);
assert.doesNotMatch(migration, /create table public\.notification_events/);
assert.doesNotMatch(migration, /alter table public\.notification/);
assert.match(migration, /duration_ms <= 90000/);
assert.match(compatibilityMigration, /can_view_memory_post/);
assert.match(migration, /enqueue_deleted_media/);

const signer = readFileSync("supabase/functions/media-signed-url/index.ts", "utf8");
assert.match(signer, /variant/);
assert.match(signer, /thumbnail_storage_path/);
assert.doesNotMatch(signer, /getPublicUrl/);
assert.doesNotMatch(signer, /body\.storagePath/);

const repo = readFileSync("src/repositories/MemoriesRepository.ts", "utf8");
assert.doesNotMatch(repo, /getPublicUrl/);
assert.match(repo, /variant: "thumbnail"/);
assert.match(repo, /requireCompletedEagerPhoto/);
assert.match(repo, /captureSessionScope/);
assert.match(repo, /mediaType === "video"/);
const createPostScoped = repo.match(/async function createMemoryPostScoped[\s\S]*?\n}\n\nasync function addMemoryMediaScoped/)?.[0] ?? "";
assert.ok(createPostScoped, "createMemoryPostScoped must remain covered");
assert.match(
  createPostScoped,
  /status: input\.status \?\? "published",\n  \}\);\n  if \(error\) throw error;/,
  "memory post INSERT must complete without same-statement RETURNING under visibility RLS",
);
assert.match(createPostScoped, /from\("memory_posts"\)\.select\("\*"\)\.eq\("id", postId\)\.single\(\)/);

const upload = readFileSync("src/utils/eagerMediaUpload.ts", "utf8");
assert.match(upload, /prepareVideoUpload/);
assert.match(upload, /MEMORY_VIDEO_MAX_BYTES/);
assert.match(upload, /thumbnailStoragePath/);
assert.doesNotMatch(upload, /console\.(log|info|debug)\(.*storagePath|signedUrl/);

const player = readFileSync("src/components/memories/MemoryVideoPlayer.tsx", "utf8");
assert.match(player, /isMuted/);
assert.match(player, /AppState/);
assert.match(player, /createSignedUrl/);
assert.doesNotMatch(player, /getPublicUrl/);
assert.doesNotMatch(player, /console\.(log|info|warn)\(.*uri/);

const picker = readFileSync("src/components/memories/MemoryUploadModal.tsx", "utf8");
assert.match(picker, /inspectPickedMemoryAsset/);
assert.match(picker, /\["images", "videos"\]/);
assert.match(picker, /failedUploads === 0/);
assert.match(picker, /if \(failedUploads > 0\)/);
assert.match(readFileSync("src/components/memories/memoryPresentation.ts", "utf8"), /mediaType === "video"/);
assert.match(readFileSync("src/screens/tabs/MemoriesScreen.tsx", "utf8"), /playbackActive/);
assert.match(readFileSync("src/screens/tabs/MemoriesScreen.tsx", "utf8"), /onViewableItemsChanged/);

const feed = readFileSync("src/components/memories/MemoryFeedCard.tsx", "utf8");
assert.match(feed, /playbackActive/);
assert.match(feed, /MemoryVideoPlayer/);

const cleanup = readFileSync("supabase/functions/_shared/storageCleanup.ts", "utf8");
assert.match(cleanup, /mp4\|mov\|m4v/);

console.log("Memory video 90s local architecture smoke PASS");
