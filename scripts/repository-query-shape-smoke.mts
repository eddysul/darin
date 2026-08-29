import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const memories = readFileSync("src/repositories/MemoriesRepository.ts", "utf8");
const diary = readFileSync("src/repositories/DiaryRepository.ts", "utf8");
const careLogs = readFileSync("src/repositories/CareLogRepository.ts", "utf8");
const listCards = memories.slice(
  memories.indexOf("async listCardsByBabyId"),
  memories.indexOf("async createMemoryWithImages"),
);
const dateRangeLogs = careLogs.slice(
  careLogs.indexOf("async getCareLogsByBabyAndDateRange"),
  careLogs.indexOf("async getCareLogById"),
);

assert.match(listCards, /\.in\("memory_post_id", postIds\)/);
assert.doesNotMatch(listCards, /this\.list(Media|Tags|Comments|Reactions)\(post\.id\)/);
assert.match(listCards, /\.eq\("baby_id", babyId\)\.eq\("user_id", userId\)\.in\("memory_post_id", postIds\)/);
assert.match(memories, /query\.range\(offset, offset \+ limit - 1\)/);
assert.match(memories, /\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)/);
assert.match(diary, /createSignedUrls\(paths, DIARY_SIGNED_URL_TTL_SECONDS\)/);
assert.match(careLogs, /\.range\(safeOffset, safeOffset \+ safeLimit - 1\)/);
assert.match(careLogs, /page\.length < CARE_LOG_HYDRATION_PAGE_SIZE/);
assert.match(careLogs, /offset \+= page\.length/);
assert.match(careLogs, /mergeCareLogEntries\(\[\], logs\)/);
assert.match(careLogs, /async getCareLogById\(babyId: string, id: string\)/);
assert.match(careLogs, /\.eq\("baby_id", babyId\)\s*\.eq\("id", id\)/);
assert.match(careLogs, /async getCareLogsByBabyAndDateRange/);
assert.match(careLogs, /\.gte\("date_key", fromDateKey\)\s*\.lte\("date_key", toDateKey\)/);
assert.match(dateRangeLogs, /\.order\("recorded_at", \{ ascending: true \}\)\s*\.order\("id", \{ ascending: true \}\)/);
assert.match(dateRangeLogs, /\.range\(offset, offset \+ CARE_LOG_HYDRATION_PAGE_SIZE - 1\)/);
assert.match(dateRangeLogs, /page\.length < CARE_LOG_HYDRATION_PAGE_SIZE/);
assert.match(careLogs, /async getCareLogsByBabyAndCategories/);
assert.match(careLogs, /\.eq\("baby_id", babyId\)\s*\.in\("category", \[\.\.\.categories\]\)/);
assert.match(careLogs, /offset \+ CARE_LOG_HYDRATION_PAGE_SIZE - 1/);

console.log("Repository query shape smoke passed");
