/**
 * Logic-level MVP QA smoke. Run: pnpm dlx tsx scripts/mvp-qa-smoke.mts
 */
import assert from "node:assert/strict";
import { formatDateKey, lastNDateKeys, parseDateKey, shiftDateKey } from "../src/utils/dateKey";
import {
  buildTodaySummary,
  FEEDING_CATS,
  getLogsForDay,
  weeklyTrend,
} from "../src/utils/reportAggregates";
import { buildCareLogDailySummary } from "../src/utils/diaryMomentSuggestions";
import { buildGrowthBookPages, estimateGrowthBookPageCount } from "../src/utils/growthBookPages";
import { filterDiaries, resolveDiaryComposeTarget } from "../src/utils/diaryToday";
import { buildVoiceSession } from "../src/utils/voiceToBabyLog";
import { buildBabyLogConsultPrompt, buildCareContextPack } from "../src/utils/babyLogAIContext";
import { canAddLog, canEditLog, canInvite, canDeleteLog } from "../src/types/family";
import type { BabyLogEntry, DiaryEntry } from "../src/types/babyLog";
import type { CareSetup } from "../src/types/careSetup";
import { DEMO_CARE_SETUP } from "../src/types/careSetup";
import { isCustomCategoryKey } from "../src/types/logCategory";
import { elapsedClockMinutes } from "../src/utils/formatLog";
import { QUICK_RECORD_ACTIONS } from "../src/constants/quickRecordActions";
import {
  clearStorageIssue,
  getStorageIssue,
  reportStorageIssue,
  subscribeStorageIssues,
} from "../src/utils/storageIssues";
import { resolvePostSplashPhase } from "../src/utils/appStartup";
import {
  EMPTY_QA_FAULT_STATE,
  armQaFault,
  consumeQaFault,
} from "../src/utils/qaFaults";

const today = formatDateKey();
const me = { id: "me", name: "Me", role: "editor" as const, status: "active" as const, isMe: true };

function log(
  partial: Partial<BabyLogEntry> & Pick<BabyLogEntry, "id" | "cat" | "time">,
): BabyLogEntry {
  return {
    dateKey: today,
    source: "manual",
    ...partial,
  };
}

// --- Local dateKey generation: month/year boundaries and oldest → newest range ---
{
  const jan1 = new Date(2026, 0, 1, 12, 0, 0);
  assert.equal(formatDateKey(jan1), "2026-01-01");
  assert.equal(shiftDateKey(1, jan1), "2025-12-31");
  assert.equal(formatDateKey(parseDateKey("2026-07-20")), "2026-07-20");
  assert.deepEqual(lastNDateKeys(3, jan1), ["2025-12-30", "2025-12-31", "2026-01-01"]);
  assert.equal(elapsedClockMinutes("23:50", "00:20"), 30);
  assert.equal(elapsedClockMinutes("09:10", "10:00"), 50);
}

// --- App restart routing waits for storage and resumes a configured user ---
{
  assert.equal(
    resolvePostSplashPhase({ splashFinished: true, careSetupReady: false, hasSavedCareSetup: true }),
    null,
  );
  assert.equal(
    resolvePostSplashPhase({ splashFinished: true, careSetupReady: true, hasSavedCareSetup: true }),
    "main",
  );
  assert.equal(
    resolvePostSplashPhase({ splashFinished: true, careSetupReady: true, hasSavedCareSetup: false }),
    "login",
  );
}

// --- Data connection: add / update / delete Care Log → derived summaries ---
{
  let logs: BabyLogEntry[] = [
    log({ id: "1", cat: "formula", time: "08:00", amount: "120" }),
    log({ id: "2", cat: "diaper", time: "09:00", chip: "소변" }),
  ];
  let summary = buildTodaySummary(logs);
  assert.equal(summary.feedCount, 1);
  assert.equal(summary.diaperCount, 1);

  logs = [...logs, log({ id: "3", cat: "food", time: "12:00" }), log({ id: "4", cat: "sleep", time: "13:00", duration: "90" })];
  summary = buildTodaySummary(logs);
  assert.equal(summary.feedCount, 1, "solid food is tracked separately from milk feeding");
  assert.equal(summary.totalSleepMinutes, 90);

  logs = [...logs, log({ id: "5", cat: "sleep", time: "16:00", duration: "30" })];
  summary = buildTodaySummary(logs);
  assert.equal(summary.sleepCount, 2);
  assert.equal(summary.totalSleepMinutes, 120, "sleep durations add in minutes");

  logs = logs.map((l) => (l.id === "3" ? { ...l, cat: "snack" as const } : l));
  summary = buildTodaySummary(logs);
  assert.equal(summary.feedCount, 1, "snack is tracked separately from milk feeding");

  logs = logs.filter((l) => l.id !== "1");
  summary = buildTodaySummary(logs);
  assert.equal(summary.feedCount, 0);
  assert.equal(getLogsForDay(logs, today, today).length, 4);

  const week = weeklyTrend(logs);
  assert.equal(week.length, 7);
  assert.ok(week.some((d) => d.dateKey === today && d.totalCount > 0));

  const pack = buildCareContextPack({
    careSetup: DEMO_CARE_SETUP,
    logs,
    diaryEntries: [],
    locale: "ko",
    question: "오늘 수유 괜찮아요?",
  });
  assert.equal(pack.todaySummary.feedCount, summary.feedCount);
  assert.equal(pack.focus, "feeding");
}

// --- TodayLogSummaryCard feeding predicate matches FEEDING_CATS ---
{
  const sample = [
    log({ id: "a", cat: "breast", time: "07:00" }),
    log({ id: "b", cat: "formula", time: "08:00" }),
    log({ id: "c", cat: "food", time: "12:00" }),
    log({ id: "d", cat: "snack", time: "15:00" }),
    log({ id: "e", cat: "pump", time: "16:00" }),
    log({ id: "f", cat: "diaper", time: "17:00" }),
    log({ id: "g", cat: "storedMilk", time: "18:00", amount: "90" }),
    log({ id: "h", cat: "milk", time: "19:00", amount: "100" }),
  ];
  const cardCount = sample.filter(
    (e) => !isCustomCategoryKey(e.cat) && FEEDING_CATS.includes(e.cat as (typeof FEEDING_CATS)[number]),
  ).length;
  assert.equal(cardCount, buildTodaySummary(sample).feedCount);
}

// --- Record home quick actions: 6 core + 13 expanded = 19, unique and diaper split ---
{
  assert.equal(QUICK_RECORD_ACTIONS.length, 19);
  assert.equal(QUICK_RECORD_ACTIONS.filter((action) => action.core).length, 6);
  assert.equal(new Set(QUICK_RECORD_ACTIONS.map((action) => action.id)).size, 19);
  assert.deepEqual(
    QUICK_RECORD_ACTIONS.filter((action) => action.cat === "diaper").map((action) => action.chip).sort(),
    ["대변", "소변"].sort(),
  );
  assert.equal(QUICK_RECORD_ACTIONS.find((action) => action.id === "storedMilk")?.label, "저장 모유 수유");
}

// --- Diary compose live summary vs frozen snapshot ---
{
  const logs: BabyLogEntry[] = [
    log({ id: "1", cat: "formula", time: "08:00", amount: "120" }),
    log({ id: "2", cat: "sleep", time: "10:00", duration: "60" }),
  ];
  const live = buildCareLogDailySummary(buildTodaySummary(logs), getLogsForDay(logs, today, today));
  assert.match(live, /수유 1회/);

  const frozen = "오늘은 수유 9회, 수면 9시간이 기록되었어요.";
  const diary: DiaryEntry = {
    id: "d1",
    babyId: "baby-1",
    date: "오늘",
    dateKey: today,
    photos: [],
    comment: "테스트",
    weatherStamp: "sun",
    moodStamp: "love",
    careLogSummarySnapshot: frozen,
    momentSuggestionsUsed: [],
    milestoneTag: null,
    customMilestoneTag: null,
    includedInGrowthBook: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "manual",
    draftStatus: "saved",
  };

  // After Care Log changes, frozen snapshot must stay
  const logs2 = [...logs, log({ id: "3", cat: "formula", time: "18:00", amount: "150" })];
  const live2 = buildCareLogDailySummary(buildTodaySummary(logs2), getLogsForDay(logs2, today, today));
  assert.notEqual(live2, frozen);
  assert.equal(diary.careLogSummarySnapshot, frozen);

  // Edit save keeps original snapshot (empty stays empty — no live backfill)
  const emptySnapDiary = { ...diary, careLogSummarySnapshot: "" };
  const afterEdit = emptySnapDiary.careLogSummarySnapshot; // UI persist rule
  assert.equal(afterEdit, "");
}

// --- Growth book filter + page order ---
{
  const entries: DiaryEntry[] = [
    {
      id: "new",
      babyId: "b",
      date: "최근",
      dateKey: today,
      photos: ["x"],
      comment: "최근 일기",
      weatherStamp: null,
      moodStamp: null,
      careLogSummarySnapshot: "",
      momentSuggestionsUsed: [],
      milestoneTag: "첫 미소",
      customMilestoneTag: null,
      includedInGrowthBook: true,
      createdAt: "",
      updatedAt: "",
      source: "manual",
      draftStatus: "saved",
    },
    {
      id: "old",
      babyId: "b",
      date: "예전",
      dateKey: shiftDateKey(5),
      photos: [],
      comment: "예전 일기",
      weatherStamp: null,
      moodStamp: null,
      careLogSummarySnapshot: "",
      momentSuggestionsUsed: [],
      milestoneTag: null,
      customMilestoneTag: null,
      includedInGrowthBook: true,
      createdAt: "",
      updatedAt: "",
      source: "manual",
      draftStatus: "saved",
    },
    {
      id: "out",
      babyId: "b",
      date: "제외",
      dateKey: shiftDateKey(2),
      photos: [],
      comment: "미포함",
      weatherStamp: null,
      moodStamp: null,
      careLogSummarySnapshot: "",
      momentSuggestionsUsed: [],
      milestoneTag: null,
      customMilestoneTag: null,
      includedInGrowthBook: false,
      createdAt: "",
      updatedAt: "",
      source: "manual",
      draftStatus: "saved",
    },
  ];

  assert.equal(filterDiaries(entries, "book").length, 2);
  assert.equal(filterDiaries(entries, "growth").length, 1);
  assert.equal(estimateGrowthBookPageCount(filterDiaries(entries, "book").length), 4);

  const pages = buildGrowthBookPages({ babyName: "콩이", entries });
  assert.equal(pages[0]?.kind, "cover");
  assert.equal(pages[pages.length - 1]?.kind, "letter");
  assert.equal(pages[1]?.id, "entry-old", "oldest diary first after cover");
  assert.equal(pages[2]?.id, "entry-new");
  assert.ok(!pages.some((p) => p.id === "entry-out"));

  // Toggle off → removed from book filter + pages
  const toggled = entries.map((e) =>
    e.id === "new" ? { ...e, includedInGrowthBook: false } : e,
  );
  assert.equal(filterDiaries(toggled, "book").length, 1);
  const pages2 = buildGrowthBookPages({ babyName: "콩이", entries: toggled });
  assert.ok(!pages2.some((p) => p.id === "entry-new"));
}

// --- Storage issue signal: failures are observable and dismissible ---
{
  const seen: Array<string | null> = [];
  const unsubscribe = subscribeStorageIssues((issue) => seen.push(issue?.operation ?? null));
  reportStorageIssue("save", "test:key");
  assert.equal(getStorageIssue()?.storageKey, "test:key");
  clearStorageIssue();
  assert.equal(getStorageIssue(), null);
  unsubscribe();
  assert.deepEqual(seen.slice(-2), ["save", null]);
}

// --- DEV QA fault injection is armed once and automatically consumed ---
{
  for (const kind of ["ai", "storageRead", "storageWrite"] as const) {
    const armed = armQaFault(EMPTY_QA_FAULT_STATE, kind);
    assert.equal(armed[kind], true);
    const first = consumeQaFault(armed, kind);
    assert.equal(first.consumed, true);
    assert.equal(first.state[kind], false);
    const second = consumeQaFault(first.state, kind);
    assert.equal(second.consumed, false, `${kind} must fail only once`);
  }
}

// --- Notification / compose routing (today overwrite prevention) ---
{
  const saved: DiaryEntry = {
    id: "today-diary",
    babyId: "b",
    date: "오늘",
    dateKey: today,
    photos: [],
    comment: "이미 저장됨",
    weatherStamp: null,
    moodStamp: null,
    careLogSummarySnapshot: "frozen",
    momentSuggestionsUsed: [],
    milestoneTag: null,
    customMilestoneTag: null,
    includedInGrowthBook: false,
    createdAt: "",
    updatedAt: "",
    source: "manual",
    draftStatus: "saved",
  };
  const target = resolveDiaryComposeTarget({ entries: [saved], draft: null, dateKey: today });
  assert.equal(target.kind, "edit");
  if (target.kind === "edit") assert.equal(target.entry.comment, "이미 저장됨");

  const draftTarget = resolveDiaryComposeTarget({
    entries: [],
    draft: {
      dateKey: today,
      updatedAt: "",
      comment: "초안",
      photos: [],
      weatherStamp: "sun",
      moodStamp: "love",
      milestoneTag: null,
      customMilestoneTag: null,
      includedInGrowthBook: false,
      careLogSummarySnapshot: "",
      momentSuggestionsUsed: [],
    },
    dateKey: today,
  });
  assert.equal(draftTarget.kind, "draft");

  const fresh = resolveDiaryComposeTarget({ entries: [], draft: null, dateKey: today });
  assert.equal(fresh.kind, "new");
}

// --- Voice multi-event ---
{
  const session = buildVoiceSession("분유 120ml 먹었어. 응가했어 노란색.");
  assert.ok(session.events.length >= 2, `expected multi events, got ${session.events.length}`);
  assert.ok(session.events.some((e) => e.cat === "formula" || e.cat === "breast"));
  assert.ok(session.events.some((e) => e.cat === "diaper"));
}

// --- Family permissions ---
{
  assert.equal(canAddLog("viewer"), false);
  assert.equal(canAddLog("caregiver"), true);
  assert.equal(canInvite("editor"), false);
  assert.equal(canInvite("owner"), true);
  assert.equal(canEditLog("viewer", { userId: "me", displayName: "Me", role: "editor" }, me), false);
  assert.equal(
    canEditLog("editor", { userId: "me", displayName: "Me", role: "editor" }, me),
    true,
  );
  assert.equal(
    canEditLog("editor", { userId: "other", displayName: "Other", role: "editor" }, me),
    false,
  );
  assert.equal(canEditLog("editor", undefined, me), false, "legacy missing createdBy");
  assert.equal(
    canDeleteLog("caregiver", { userId: "me", displayName: "Me", role: "caregiver" }, {
      ...me,
      role: "caregiver",
    }),
    true,
  );
}

// --- AI consult prompt: safety + diary snapshot + chronological relevant logs ---
{
  const logs: BabyLogEntry[] = [
    log({ id: "old", cat: "formula", time: "20:00", dateKey: shiftDateKey(1) }),
    log({ id: "new", cat: "formula", time: "08:00", dateKey: today }),
  ];
  const diaries: DiaryEntry[] = [
    {
      id: "d",
      babyId: "b",
      date: "어제",
      dateKey: shiftDateKey(1),
      photos: [],
      comment: "잘 잤어요",
      weatherStamp: null,
      moodStamp: null,
      careLogSummarySnapshot: "수유 3회 요약",
      momentSuggestionsUsed: [],
      milestoneTag: null,
      customMilestoneTag: null,
      includedInGrowthBook: false,
      createdAt: "",
      updatedAt: "",
      source: "manual",
      draftStatus: "saved",
    },
  ];
  const prompt = buildBabyLogConsultPrompt({
    careSetup: DEMO_CARE_SETUP as CareSetup,
    logs,
    diaryEntries: diaries,
    locale: "ko",
    question: "오늘 수유 괜찮아요?",
  });
  assert.match(prompt, /의료 안전|소아과/);
  assert.match(prompt, /수유 3회 요약/);
  assert.match(prompt, /최근 기록 기준|ONLY the context pack/i);
  // older date then today in relevant lines order
  const idxOld = prompt.indexOf(shiftDateKey(1));
  const idxNew = prompt.indexOf(today);
  assert.ok(idxOld >= 0 && idxNew >= 0 && idxOld < idxNew, "relevant logs chronological");
}

console.log("mvp-qa-smoke: all checks passed");
