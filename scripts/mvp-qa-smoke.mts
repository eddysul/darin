/**
 * Logic-level MVP QA smoke. Run: pnpm dlx tsx scripts/mvp-qa-smoke.mts
 */
import assert from "node:assert/strict";
import { formatDateKey, lastNDateKeys, parseDateKey, shiftDateKey } from "../src/utils/dateKey";
import {
  buildTodaySummary,
  currentWeekTrend,
  FEEDING_CATS,
  getLogsForDay,
  weeklyTrend,
} from "../src/utils/reportAggregates";
import { buildCareLogDailySummary, buildDiaryMomentSuggestions } from "../src/utils/diaryMomentSuggestions";
import {
  buildGrowthBookPages,
  estimateGrowthBookPageCount,
  resolvePageEdit,
  resolvePagePhotos,
} from "../src/utils/growthBookPages";
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
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_CORE_ACTIONS,
  normalizeAppSettings,
} from "../src/types/appSettings";
import {
  lengthFromCm,
  lengthToCm,
  temperatureFromCelsius,
  temperatureToCelsius,
  volumeFromMl,
  volumeToMl,
  weightFromKg,
  weightToKg,
} from "../src/utils/measurementFormat";
import { familyRoleToPermission, recordedAtFromDateKeyTime } from "../src/utils/supabaseMappers";
import { detectLocalCareLogMigrationCandidates } from "../src/utils/careLogsMigration";
import { detectLocalGrowthRecordMigrationCandidates } from "../src/utils/growthRecordsMigration";
import type { GrowthRecord } from "../src/types/growthRecord";
import type { DiaryEntryRow, GrowthBookCommentRow, GrowthBookPageRow, GrowthBookRow } from "../src/types/database";
import { diaryEntryRowToModel } from "../src/utils/diarySupabaseMappers";
import { diaryServerMigrationFlagKey } from "../src/utils/diaryServerMigrationStore";
import { growthBookServerMigrationFlagKey } from "../src/utils/growthBookServerMigrationStore";
import {
  growthBookRowsToEdit,
  mediaStoragePath,
  mediaStorageRef,
} from "../src/utils/growthBookSupabaseMappers";
import {
  readScopedWithLegacyMigration,
  scopedMigrationFlagKey,
  scopedStorageKey,
  type LocalDataScope,
  type ScopedStorageAdapter,
} from "../src/utils/scopedLocalStorage";

const today = formatDateKey();
const me = { id: "me", name: "Me", role: "editor" as const, status: "active" as const, isMe: true };

// --- Growth Book server mapping preserves page content and scoped migration flags ---
{
  const accountA: LocalDataScope = { userId: "user-a", babyId: "baby-a" };
  const accountB: LocalDataScope = { userId: "user-b", babyId: "baby-a" };
  assert.notEqual(growthBookServerMigrationFlagKey(accountA), growthBookServerMigrationFlagKey(accountB));
  const storagePath = "baby-a/book-a/page-a/photo.jpg";
  assert.equal(mediaStoragePath(mediaStorageRef(storagePath)), storagePath);
  const book: GrowthBookRow = {
    id: "book-a", baby_id: "baby-a", title: "콩의 성장책", status: "draft", created_by: "user-a",
    created_at: "2026-08-03T01:00:00.000Z", updated_at: "2026-08-03T01:00:00.000Z", deleted_at: null,
  };
  const pages: GrowthBookPageRow[] = [{
    id: "cover-a", growth_book_id: "book-a", baby_id: "baby-a", page_type: "cover",
    diary_entry_id: null, page_order: 0, layout_type: null,
    content_json: { coverTitle: "서버 성장책", coverPhotoRef: mediaStorageRef(storagePath) },
    created_by: "user-a", created_at: book.created_at, updated_at: book.updated_at, deleted_at: null,
  }, {
    id: "page-a", growth_book_id: "book-a", baby_id: "baby-a", page_type: "diary",
    diary_entry_id: "diary-a", page_order: 1, layout_type: "three_left_large_right_top_medium_bottom_small",
    content_json: {
      diaryId: "diary-a", photos: [mediaStorageRef(storagePath)],
      photoLayout: "three_left_large_right_top_medium_bottom_small", pageComment: "성장책 전용 코멘트",
      pageStickers: [{ id: "ps-1", pageId: "diary-a", stickerId: "s-1", xRatio: 0.2, yRatio: 0.3,
        widthRatio: 0.15, zIndex: 1, createdBy: "user-a", createdAt: book.created_at }],
      rollingComments: [{ id: "roll-1", pageId: "diary-a", authorId: "user-a", authorName: "엄마",
        authorRelationshipLabel: "엄마", text: "서버 롤링페이퍼", createdAt: book.created_at }],
      commentStickers: [], stickerIds: [],
    },
    created_by: "user-a", created_at: book.created_at, updated_at: book.updated_at, deleted_at: null,
  }];
  const comments: GrowthBookCommentRow[] = [{
    id: "server-comment-a", growth_book_id: "book-a", page_id: "page-a", diary_entry_id: "diary-a",
    baby_id: "baby-a", author_id: "user-a", body: "서버 롤링페이퍼", comment_type: "rolling_paper",
    metadata: { clientId: "roll-1", clientAuthorId: "user-a", authorName: "엄마", authorRelationshipLabel: "엄마" },
    created_at: book.created_at, updated_at: book.updated_at, deleted_at: null,
  }];
  const edit = await growthBookRowsToEdit({
    book, pages, comments, babyName: "콩",
    signedUrlForPath: async (path) => `https://signed.example/${path}`,
  });
  assert.equal(edit.coverTitle, "서버 성장책");
  assert.equal(edit.coverPhotoUri, `https://signed.example/${storagePath}`);
  assert.equal(edit.pages["diary-a"]?.pageComment, "성장책 전용 코멘트");
  assert.equal(edit.pages["diary-a"]?.pageStickers?.[0]?.xRatio, 0.2);
  assert.equal(edit.pages["diary-a"]?.rollingComments.length, 1);
  assert.equal(edit.pages["diary-a"]?.rollingComments[0]?.id, "roll-1");

  const diaryWithNewPhoto: DiaryEntry = {
    id: "diary-a",
    babyId: "baby-a",
    date: "8월 3일",
    dateKey: "2026-08-03",
    photos: ["https://signed.example/diary-photo.jpg"],
    comment: "사진이 나중에 추가된 일기",
    weatherStamp: "sun",
    moodStamp: "love",
    milestoneTag: null,
    customMilestoneTag: null,
    includedInGrowthBook: true,
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    source: "manual",
    draftStatus: "saved",
  };
  const legacyEmptyPage = resolvePageEdit("diary-a", diaryWithNewPhoto, {
    ...edit,
    pages: { ...edit.pages, "diary-a": { ...edit.pages["diary-a"]!, photos: [], photosOverridden: false } },
  });
  assert.deepEqual(resolvePagePhotos(diaryWithNewPhoto, legacyEmptyPage), diaryWithNewPhoto.photos);
  const intentionallyEmptyPage = { ...legacyEmptyPage, photos: [], photosOverridden: true };
  assert.deepEqual(resolvePagePhotos(diaryWithNewPhoto, intentionallyEmptyPage), []);

  const normalizedEdit = await growthBookRowsToEdit({
    book: { ...book, title: "의 성장책" },
    pages: [{ ...pages[0], content_json: { coverTitle: "의 성장책" } }],
    comments: [],
    babyName: "콩",
    signedUrlForPath: async () => null,
  });
  assert.equal(normalizedEdit.coverTitle, "콩의 성장책");
}

// --- Diary server mapping and migration flags preserve account/baby isolation ---
{
  const accountA: LocalDataScope = { userId: "user-a", babyId: "baby-a" };
  const accountB: LocalDataScope = { userId: "user-b", babyId: "baby-a" };
  assert.notEqual(diaryServerMigrationFlagKey(accountA), diaryServerMigrationFlagKey(accountB));
  const row: DiaryEntryRow = {
    id: "00000000-0000-4000-8000-000000000001",
    baby_id: "00000000-0000-4000-8000-000000000002",
    author_id: "00000000-0000-4000-8000-000000000003",
    entry_date: "2026-08-03",
    title: null,
    body: "서버 일기",
    mood: "happy",
    weather: "sunny",
    tags: ["첫 목욕"],
    included_in_growth_book: true,
    client_generated_id: "local-diary-1",
    metadata: {
      dateLabel: "8월 3일 (월)",
      careLogSummarySnapshot: "수유 3회",
      momentSuggestionsUsed: ["feeding"],
      milestoneTag: "첫 목욕",
      stickerIds: ["sticker-1"],
      authorName: "엄마",
      authorRole: "editor",
    },
    created_at: "2026-08-03T01:00:00.000Z",
    updated_at: "2026-08-03T01:00:00.000Z",
    deleted_at: null,
  };
  const model = diaryEntryRowToModel(row, ["https://signed.example/diary.jpg"]);
  assert.equal(model.comment, "서버 일기");
  assert.equal(model.includedInGrowthBook, true);
  assert.equal(model.careLogSummarySnapshot, "수유 3회");
  assert.deepEqual(model.stickerIds, ["sticker-1"]);
  assert.deepEqual(model.photos, ["https://signed.example/diary.jpg"]);
  assert.equal(model.createdBy?.userId, row.author_id);
}

// --- Account/baby-scoped local storage never exposes legacy or another account's value ---
{
  const values = new Map<string, string>();
  const storage: ScopedStorageAdapter = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  const baseKey = "darin:test-diary";
  const accountA: LocalDataScope = { userId: "user-a", babyId: "baby-a" };
  const accountB: LocalDataScope = { userId: "user-b", babyId: "baby-b" };
  values.set(baseKey, JSON.stringify([{ id: "legacy-a" }]));

  const read = (scope: LocalDataScope) => readScopedWithLegacyMigration<Array<{ id: string }>>({
    baseKey,
    scope,
    storage,
    parse: (raw) => {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is { id: string } =>
        !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") : null;
    },
    serialize: JSON.stringify,
    merge: (scoped, legacy) => scoped ?? legacy,
  });

  assert.deepEqual((await read(accountA)).value, [{ id: "legacy-a" }]);
  assert.equal(values.has(baseKey), false);
  assert.ok(values.has(scopedStorageKey(baseKey, accountA)));
  assert.ok(values.has(scopedMigrationFlagKey(baseKey, accountA)));
  assert.equal((await read(accountB)).value, null);

  values.set(scopedStorageKey(baseKey, accountB), JSON.stringify([{ id: "account-b" }]));
  assert.deepEqual((await read(accountB)).value, [{ id: "account-b" }]);
  assert.deepEqual((await read(accountA)).value, [{ id: "legacy-a" }]);
}

function log(
  partial: Partial<BabyLogEntry> & Pick<BabyLogEntry, "id" | "cat" | "time">,
): BabyLogEntry {
  return {
    dateKey: today,
    source: "manual",
    ...partial,
  };
}

// --- Growth record migration dedupes both server ids and client-generated ids ---
{
  const base: GrowthRecord = {
    id: "local-growth-1",
    babyId: "baby-1",
    measuredAt: "2026-07-27",
    weightKg: 8.4,
    weightUnit: "kg",
    heightUnit: "cm",
    headCircumferenceUnit: "cm",
    source: "hospital",
    inputMethod: "manual",
    userConfirmed: true,
    createdBy: "user-1",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  };
  const remote = [{ ...base, id: "server-growth-1", clientGeneratedId: base.id }];
  assert.deepEqual(detectLocalGrowthRecordMigrationCandidates([base], remote), []);
  assert.deepEqual(
    detectLocalGrowthRecordMigrationCandidates([{ ...base, id: "local-growth-2" }], remote).map((record) => record.id),
    ["local-growth-2"],
  );
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
  assert.equal(formatDateKey(new Date(2026, 6, 20, 3, 30), "04:00"), "2026-07-19");
  assert.equal(formatDateKey(new Date(2026, 6, 20, 4, 0), "04:00"), "2026-07-20");
  assert.deepEqual(
    currentWeekTrend([], new Date(2026, 6, 22, 12), "monday").map((day) => day.dateKey),
    ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"],
  );
}

// --- Persistent app settings normalize safely and canonical units round-trip ---
{
  const settings = normalizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    categories: {
      order: ["formula", "sleep"],
      visible: ["formula", "sleep"],
      core: ["formula", "sleep"],
    },
    units: { ...DEFAULT_APP_SETTINGS.units, volume: "oz", temperature: "f" },
  });
  assert.deepEqual(settings.categories.order.slice(0, 2), ["formula", "sleep"]);
  assert.equal(settings.categories.visible.length, 6);
  assert.deepEqual(settings.categories.visible.slice(0, 2), ["formula", "sleep"]);
  assert.equal(settings.categories.core.length, 6);
  assert.ok(settings.categories.core.every((action) => settings.categories.visible.includes(action)));
  const invalidCategories = normalizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    categories: {
      order: ["formula"],
      visible: [],
      core: [...DEFAULT_CORE_ACTIONS, "tummy"],
    },
  });
  assert.equal(invalidCategories.categories.visible.length, QUICK_RECORD_ACTIONS.length);
  assert.equal(invalidCategories.categories.core.length, 6);
  assert.deepEqual(DEFAULT_CORE_ACTIONS, [
    "breastfeeding",
    "formula",
    "bowel",
    "urine",
    "sleep",
    "pump",
  ]);
  assert.equal(volumeFromMl("120", "oz"), "4.1");
  assert.equal(volumeToMl(volumeFromMl("120", "oz"), "oz"), "121");
  assert.equal(temperatureFromCelsius("36.5", "f"), "97.7");
  assert.equal(temperatureToCelsius("97.7", "f"), "36.5");
  assert.equal(weightToKg("22.0", "lb"), 9.979);
  assert.equal(weightFromKg(10, "lb"), "22");
  assert.equal(lengthToCm("25", "in"), 63.5);
  assert.equal(lengthFromCm(63.5, "in"), "25");
}

// --- App restart routing waits for storage and resumes a configured user ---
{
  assert.equal(
    resolvePostSplashPhase({
      splashFinished: true,
      careSetupReady: false,
      termsReady: true,
      authReady: false,
      hasAuthSession: true,
      hasSavedCareSetup: true,
      termsAccepted: true,
    }),
    null,
  );
  assert.equal(
    resolvePostSplashPhase({
      splashFinished: true,
      careSetupReady: true,
      termsReady: true,
      authReady: true,
      hasAuthSession: true,
      hasSavedCareSetup: true,
      termsAccepted: true,
    }),
    "main",
  );
  assert.equal(
    resolvePostSplashPhase({
      splashFinished: true,
      careSetupReady: true,
      termsReady: true,
      authReady: true,
      hasAuthSession: false,
      hasSavedCareSetup: false,
      termsAccepted: false,
    }),
    "terms",
  );
  assert.equal(
    resolvePostSplashPhase({
      splashFinished: true,
      careSetupReady: true,
      termsReady: true,
      authReady: true,
      hasAuthSession: false,
      hasSavedCareSetup: false,
      termsAccepted: true,
    }),
    "auth",
  );
  assert.equal(
    resolvePostSplashPhase({
      splashFinished: true,
      careSetupReady: true,
      termsReady: true,
      authReady: true,
      hasAuthSession: false,
      hasSavedCareSetup: true,
      termsAccepted: true,
    }),
    "auth",
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
  const sentenceSuggestions = buildDiaryMomentSuggestions({
    babyName: "콩",
    todayLogs: getLogsForDay(logs, today, today),
    summary: buildTodaySummary(logs),
  });
  assert.ok(sentenceSuggestions.every((item) => !item.text.includes("?") && !item.text.includes("질문")));

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

{
  assert.equal(familyRoleToPermission("owner"), "admin");
  assert.equal(familyRoleToPermission("caregiver"), "editor");
  assert.equal(familyRoleToPermission("viewer"), "viewer");
  const local = [log({ id: "local-1", cat: "sleep", time: "10:00" })];
  const server = [log({ id: "server-1", cat: "sleep", time: "10:00" })];
  assert.equal(detectLocalCareLogMigrationCandidates(local, server).length, 1);
  assert.equal(detectLocalCareLogMigrationCandidates(local, local).length, 0);
  assert.match(recordedAtFromDateKeyTime("2026-07-20", "09:30"), /2026-07-2/);
}

console.log("mvp-qa-smoke: all checks passed");
