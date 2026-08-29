import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const memories = readFileSync("src/repositories/MemoriesRepository.ts", "utf8");
const diary = readFileSync("src/repositories/DiaryRepository.ts", "utf8");
const careLogs = readFileSync("src/repositories/CareLogRepository.ts", "utf8");
const notifications = readFileSync("src/repositories/NotificationRepository.ts", "utf8");
const contactRequests = readFileSync("src/repositories/ContactRequestRepository.ts", "utf8");
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
assert.match(diary, /DIARY_HYDRATION_PAGE_SIZE = 100/);
assert.match(diary, /\.order\("entry_date", \{ ascending: false \}\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)/);
assert.match(diary, /\.range\(offset, offset \+ DIARY_HYDRATION_PAGE_SIZE - 1\)/);
assert.match(diary, /\.in\("diary_entry_id", ids\)/);
assert.match(diary, /page\.length < DIARY_HYDRATION_PAGE_SIZE/);
assert.match(careLogs, /\.range\(safeOffset, safeOffset \+ safeLimit - 1\)/);
assert.match(careLogs, /page\.length < CARE_LOG_HYDRATION_PAGE_SIZE/);
assert.match(careLogs, /offset \+= page\.length/);
assert.match(careLogs, /mergeCareLogEntries\(\[\], logs\)/);
assert.match(careLogs, /CARE_LOG_ENTRY_SELECT = "id,category,date_key,time_local,payload,source,created_by"/);
assert.doesNotMatch(careLogs, /\.select\("\*"\)/);
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
assert.doesNotMatch(notifications, /\.select\("\*"\)/);
assert.match(notifications, /NOTIFICATION_SETTINGS_SELECT/);
assert.doesNotMatch(contactRequests, /\.select\(/);

console.log("Repository query shape smoke passed");
