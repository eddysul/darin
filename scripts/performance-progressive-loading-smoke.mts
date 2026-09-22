import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  context,
  hydration,
  familyRepository,
  memoriesRepository,
  memoriesScreen,
  recordScreen,
  reportScreen,
  diaryScreen,
  profileScreen,
  weeklyTable,
  traceHook,
] = await Promise.all([
  read("src/context/BabyLogContext.tsx"),
  read("src/context/babyLogHydrationService.ts"),
  read("src/repositories/FamilyRepository.ts"),
  read("src/repositories/MemoriesRepository.ts"),
  read("src/screens/tabs/MemoriesScreen.tsx"),
  read("src/screens/tabs/RecordScreen.tsx"),
  read("src/screens/tabs/BabyReportScreen.tsx"),
  read("src/screens/tabs/DiaryScreen.tsx"),
  read("src/screens/MyProfileScreen.tsx"),
  read("src/utils/weeklyFeatureTable.ts"),
  read("src/hooks/useScreenLoadTrace.ts"),
]);

assert.ok(
  context.includes("await Promise.allSettled([")
    && context.includes("careTask,")
    && context.includes("diaryTask,")
    && context.includes("familyTask,"),
  "independent hydration domains start together instead of a serial waterfall",
);
assert.ok(
  context.includes("normalizeCachedCareLogs(getBabyLogs())")
    && context.indexOf("setLogsHydrated(true)") < context.indexOf("await Promise.allSettled(["),
  "verified scoped care-log cache becomes renderable before secondary hydration finishes",
);
assert.ok(
  hydration.includes("verifiedBabies?: BabyRow[]")
    && hydration.includes("input.verifiedBabies ?? await BabyRepository.listMyBabies()"),
  "baby switch can reuse its verified membership query",
);
assert.ok(
  context.includes("careLogRangeRequestsRef.current.get(requestKey)")
    && context.includes("careLogCategoryRequestsRef.current.get(requestKey)")
    && context.includes("careLogRangeRequestsRef.current.clear()")
    && context.includes("careLogCategoryRequestsRef.current.clear()"),
  "care-log range/category requests dedupe within a scope and clear on scope changes",
);
assert.ok(
  familyRepository.includes("ProfileRepository.listVisibleDisplayProfiles")
    && !familyRepository.includes("ProfileRepository.listDisplayProfilesForBaby(babyId)"),
  "family display hydration reuses the existing membership rows",
);
assert.ok(
  memoriesRepository.includes("resolveMedia?: boolean")
    && memoriesRepository.includes("async resolveCardMedia(card: MemoryCard)"),
  "memory cards can load metadata before private media URLs",
);
assert.ok(
  memoriesScreen.includes("resolveMedia: false")
    && memoriesScreen.includes("onViewableItemsChanged")
    && memoriesScreen.includes("requestCardMediaRef.current")
    && memoriesScreen.includes("Date.now() - lastLoadedAtRef.current < 30_000"),
  "memory feed lazily resolves visible media and avoids warm-focus refetches",
);
for (const [name, source] of [
  ["Record", recordScreen],
  ["OverviewReport", reportScreen],
  ["Diary", diaryScreen],
] as const) {
  assert.ok(source.includes("logsHydrated"), `${name} renders from scoped care-log readiness`);
  assert.ok(!source.includes("storageReady"), `${name} no longer waits for unrelated storage domains`);
}
assert.ok(
  diaryScreen.includes("!diaryHydrated") && diaryScreen.includes("<LoadingState"),
  "diary distinguishes loading from a real empty state",
);
assert.ok(
  profileScreen.includes("statsLoading")
    && profileScreen.includes("babiesLoading")
    && profileScreen.includes("momentsLoading")
    && profileScreen.includes("listMembersForBabyIds")
    && !profileScreen.includes("BabyProfileRepository.getBabyProfile(baby.id)"),
  "profile sections load independently and partial failures do not become false zeroes",
);
assert.ok(
  reportScreen.includes("buildWeeklyFeatureTable(reportLogs, careSetup, undefined, insights)")
    && weeklyTable.includes("precomputedInsights ?? findInsights"),
  "weekly correlations reuse the already computed insight aggregate",
);
assert.ok(
  traceHook.includes("route_enter")
    && traceHook.includes("firstContent")
    && traceHook.includes("coreReady")
    && traceHook.includes("fullReady")
    && !traceHook.includes("devLog(`[performance] ${screen} ${scopeKey}"),
  "development traces measure progressive milestones without logging account/baby identifiers",
);

console.log("performance-progressive-loading-smoke: P1/P2 loading, dedupe, lazy-media, aggregate, and trace invariants passed");
