import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const context = readFileSync("src/context/BabyLogContext.tsx", "utf8");
const hydration = readFileSync("src/context/babyLogHydrationService.ts", "utf8");
const domainHydration = readFileSync("src/context/babyLogDomainHydrationService.ts", "utf8");
const persistence = readFileSync("src/context/useBabyLogCachePersistence.ts", "utf8");
const i18n = readFileSync("src/i18n.ts", "utf8");
const legacyMessages = readFileSync("src/i18nLegacyMessages.ts", "utf8");
const localeOverrides = readFileSync("src/i18nLegacyLocaleOverrides.ts", "utf8");

assert.match(context, /resolveBabyLogDataScope/);
assert.match(context, /hydrateBabyLogCaches/);
assert.match(context, /resolveHydratedCareLogs/);
assert.doesNotMatch(context, /const SEED_DIARY|function seedLogs|const SEED_FAMILY/);
assert.doesNotMatch(context, /hydrate(CustomCategories|QuickRecords|BabyLogs|DiaryEntries|ChatHistory|FamilyMembers)\(/);
assert.doesNotMatch(context, /FamilyRepository\.listMembersAsFamily|bootstrapDiaryFromServer|bootstrapGrowthBookFromServer|bootstrapGrowthRecordsFromServer/);

assert.match(hydration, /AuthRepository\.getSession\(\)/);
assert.match(hydration, /BabyRepository\.listMyBabies\(\)/);
assert.match(hydration, /Promise\.all\(\[/);
assert.match(hydration, /normalizeCachedCareLogs/);
assert.match(domainHydration, /resolveDiarySnapshot/);
assert.match(domainHydration, /resolveFamilySnapshot/);
assert.match(domainHydration, /resolveGrowthBookSnapshot/);
assert.match(domainHydration, /resolveStickerSnapshot/);
assert.match(domainHydration, /resolveGrowthRecordsSnapshot/);
assert.match(domainHydration, /resolveCautionFoodsSnapshot/);
assert.match(persistence, /scoped cache/);

assert.match(i18n, /import \{ legacyLocaleOverrides \}/);
assert.match(i18n, /import \{ legacyMessages \}/);
assert.doesNotMatch(i18n, /"tabs\.home": "Home"/);
assert.doesNotMatch(i18n, /"voice\.listening": "聞いています"/);
assert.match(legacyMessages, /"tabs\.home": "Home"/);
assert.match(legacyMessages, /"tabs\.home": "홈"/);
assert.match(localeOverrides, /"voice\.listening": "聞いています"/);
assert.match(localeOverrides, /"voice\.listening": "Escuchando"/);
assert.match(localeOverrides, /"voice\.listening": "正在聆听"/);

console.log("Architecture boundary smoke passed");
