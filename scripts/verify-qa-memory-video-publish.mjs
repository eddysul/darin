// Disposable QA fixtures only. Requires ffmpeg; never accepts Production.
// Run: node --env-file=.env.qa --experimental-strip-types scripts/verify-qa-memory-video-publish.mjs
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { createAdminClient, createQaAccount } from "./lib/qa-auth.mjs";
import { normalizeMemoryVideoDurationMs } from "../src/utils/memoryMediaMetadata.ts";

assertQaProjectEnvironment();
const service = createAdminClient();
const dir = await mkdtemp(join(tmpdir(), "darin-video-qa-"));
let actor;
let baby;
const paths = [];
function checked(result, step) {
  if (result.error) throw new Error(`${step}: ${result.error.code ?? result.error.status ?? "API_ERROR"}`);
  return result.data;
}
const pass = step => console.log(`PASS ${step}`);
try {
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x64:r=30", "-t", "3.566666667", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(dir, "synthetic.mp4")]);
  execFileSync("ffmpeg", ["-v", "error", "-i", join(dir, "synthetic.mp4"), "-frames:v", "1", join(dir, "poster.jpg")]);
  actor = await createQaAccount("memory-video-duration");
  baby = checked(await actor.sb.rpc("create_baby_with_owner", {
    p_name: "Synthetic video QA", p_child_status: "newborn", p_relationship_label: "보호자",
  }), "create synthetic baby").id;
  const post = crypto.randomUUID(), media = crypto.randomUUID(), session = crypto.randomUUID();
  const videoPath = `${baby}/temp/${session}/${media}.mp4`;
  const posterPath = `${baby}/temp/${session}/${media}-poster.jpg`;
  for (const [path, file, mime] of [[videoPath, "synthetic.mp4", "video/mp4"], [posterPath, "poster.jpg", "image/jpeg"]]) {
    paths.push(path); // Include ambiguous network successes in cleanup.
    checked(await actor.sb.storage.from("memories").upload(path, await readFile(join(dir, file)), { contentType: mime, upsert: false }), "authenticated storage upload");
  }
  pass("authenticated synthetic video + poster upload");
  checked(await actor.sb.from("memory_posts").insert({ id: post, baby_id: baby, author_id: actor.user.id,
    privacy_type: "only_me", status: "published", caption: "Synthetic video regression" }), "create post");
  checked(await actor.sb.from("memory_posts").select("id").eq("id", post).single(), "post readback");
  const row = { id: media, memory_post_id: post, baby_id: baby, storage_path: videoPath,
    thumbnail_storage_path: posterPath, media_type: "video", upload_status: "ready", width: 64, height: 64 };
  const observedDuration = 3566.666666666667;
  const rejected = await actor.sb.from("memory_media").insert({ ...row, duration_ms: observedDuration });
  assert.equal(rejected.error?.code, "22P02", "reproduce original fractional-ms integer rejection");
  pass("original fractional iOS duration reproduces 22P02");
  const saved = checked(await actor.sb.from("memory_media").insert({ ...row, duration_ms: normalizeMemoryVideoDurationMs(observedDuration) }).select("*").single(), "normalized media insert/readback");
  assert.equal(saved.duration_ms, 3567);
  assert.equal(saved.upload_status, "ready");
  pass("normalized duration publishes ready video with INSERT/SELECT");
  for (const [variant, file] of [["source", "synthetic.mp4"], ["thumbnail", "poster.jpg"]]) {
    const signed = checked(await actor.sb.functions.invoke("media-signed-url", {
      body: { kind: "memory_media", resourceId: media, variant },
    }), "authorized signing");
    assert.ok(signed.signedUrl, "signed URL missing");
    const response = await fetch(signed.signedUrl);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(join(dir, file)));
    pass(`${variant} signed read returns exact synthetic bytes`);
  }
} finally {
  const errors = [];
  if (paths.length) {
    const removed = await service.storage.from("memories").remove(paths);
    if (removed.error) errors.push("synthetic storage cleanup");
  }
  if (baby) {
    const removed = await service.from("babies").delete().eq("id", baby).select("id");
    if (removed.error || removed.data?.length !== 1) errors.push("synthetic baby cleanup");
  }
  if (actor) {
    const removed = await service.auth.admin.deleteUser(actor.qaUserId);
    if (removed.error) errors.push("synthetic account cleanup");
  }
  await rm(dir, { recursive: true, force: true });
  assert.equal(errors.length, 0, errors.join(", "));
  pass("exact synthetic fixtures removed; existing records untouched");
}
