import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const memories = readFileSync("src/repositories/MemoriesRepository.ts", "utf8");
const diary = readFileSync("src/repositories/DiaryRepository.ts", "utf8");
const listCards = memories.slice(
  memories.indexOf("async listCardsByBabyId"),
  memories.indexOf("async createMemoryWithImages"),
);

assert.match(listCards, /\.in\("memory_post_id", postIds\)/);
assert.doesNotMatch(listCards, /this\.list(Media|Tags|Comments|Reactions)\(post\.id\)/);
assert.match(diary, /createSignedUrls\(paths, DIARY_SIGNED_URL_TTL_SECONDS\)/);

console.log("Repository query shape smoke passed");

