import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchCautionFoods, normalizeCautionFoodName } from "../src/utils/cautionFoodsStore";
import { scopedStorageKey, type LocalDataScope } from "../src/utils/scopedLocalStorage";
import type { CautionFood } from "../src/types/cautionFood";

const firstScope: LocalDataScope = { userId: "user-1", babyId: "baby-1" };
const secondScope: LocalDataScope = { userId: "user-1", babyId: "baby-2" };
assert.notEqual(
  scopedStorageKey("darin:baby-logs", firstScope),
  scopedStorageKey("darin:baby-logs", secondScope),
  "local data keys must be isolated by baby",
);

assert.equal(normalizeCautionFoodName("  달걀  "), "달걀");
assert.equal(normalizeCautionFoodName("MILK"), "milk");
const cautionFoods: CautionFood[] = [
  {
    id: "food-1",
    babyId: "baby-1",
    foodName: "달걀",
    normalizedFoodName: "달걀",
    source: "preset",
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "food-2",
    babyId: "baby-1",
    foodName: "Milk",
    normalizedFoodName: "milk",
    source: "custom",
    createdAt: "2026-08-13T00:00:00.000Z",
  },
];
assert.deepEqual(matchCautionFoods([" 달걀 ", "MILK", "땅콩"], cautionFoods), [" 달걀 ", "MILK"]);
assert.deepEqual(matchCautionFoods(["달걀죽"], cautionFoods), [], "matching must stay exact, not inferred");

const migration = readFileSync("supabase/migrations/202608130001_multi_baby_caution_foods.sql", "utf8");
assert.match(migration, /baby_id uuid not null references public\.babies/);
assert.match(migration, /enable row level security/);
assert.match(migration, /is_baby_member\(baby_id\)/);
assert.match(migration, /is_family_moment boolean not null default false/);
assert.match(migration, /tag_type <> 'baby'[\s\S]*is_baby_member\(baby_id\)/);

for (const file of [
  "babyLogsStore.ts",
  "growthRecordsStore.ts",
  "familyMembersStore.ts",
  "activeTimersStore.ts",
  "babyStickersStore.ts",
  "diaryReminderStore.ts",
]) {
  const source = readFileSync(`src/utils/${file}`, "utf8");
  assert.match(source, /scopedStorageKey/, `${file} must use account+baby scoped persistence`);
}

const context = readFileSync("src/context/BabyLogContext.tsx", "utf8");
assert.match(context, /accessibleBabies\.find\(\(baby\) => baby\.id === sync\.babyId\)/);
assert.match(context, /if \(isSupabaseConfigured\(\) && !activeBabyId\)/);
assert.match(context, /syncCareLogCreate\(next, scope\?\.babyId\)/);

const memories = readFileSync("src/screens/tabs/MemoriesScreen.tsx", "utf8");
assert.match(memories, /card\.post\.isFamilyMoment/);
assert.match(memories, /babies\.map\(\(baby\)/);

console.log("Build 12 multi-baby QA: PASS");
