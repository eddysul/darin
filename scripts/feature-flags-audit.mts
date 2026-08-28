import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEATURE_FLAGS,
  canOpenNotificationData,
  canShowLanguagePicker,
  canShowNotificationEvent,
  currentFeatureEnvironment,
  effectiveFeatureStatus,
  isFeatureVisible,
  isLocaleAvailable,
  productionExposure,
  type FeatureName,
} from "../src/config/featureFlags.ts";

const featureNames = Object.keys(FEATURE_FLAGS) as FeatureName[];
const releaseStatuses = new Set(["beta", "ready"]);
const allInternal = new Set(featureNames);
const feedingOnly = new Set<FeatureName>(["feedingReminder"]);
const sleepOnly = new Set<FeatureName>(["sleepReminder"]);
const koEnQa = new Set<FeatureName>(["multilingualPicker", "englishSupport"]);
const buildConfig = JSON.parse(readFileSync("eas.json", "utf8")) as {
  build?: { qa?: { env?: { EXPO_PUBLIC_INTERNAL_FEATURES?: string } } };
};

const previousFeatureEnv = process.env.EXPO_PUBLIC_FEATURE_ENV;
const previousFeatureProfile = process.env.EXPO_PUBLIC_FEATURE_PROFILE;
process.env.EXPO_PUBLIC_FEATURE_ENV = "qa";
process.env.EXPO_PUBLIC_FEATURE_PROFILE = "production";
assert.equal(currentFeatureEnvironment(), "production", "FEATURE_ENV=qa alone must not enable internal features");
process.env.EXPO_PUBLIC_FEATURE_PROFILE = "internal";
assert.equal(currentFeatureEnvironment(), "qa", "QA requires both qa environment and internal profile markers");
if (previousFeatureEnv === undefined) delete process.env.EXPO_PUBLIC_FEATURE_ENV;
else process.env.EXPO_PUBLIC_FEATURE_ENV = previousFeatureEnv;
if (previousFeatureProfile === undefined) delete process.env.EXPO_PUBLIC_FEATURE_PROFILE;
else process.env.EXPO_PUBLIC_FEATURE_PROFILE = previousFeatureProfile;
console.log("PASS QA environment cannot be enabled without the internal profile marker");

for (const feature of featureNames) {
  const effective = effectiveFeatureStatus(feature, "production", allInternal);
  assert.equal(
    productionExposure(feature),
    releaseStatuses.has(effective),
    `${feature}: production exposed a non-release status (${effective})`,
  );
}
console.log("PASS production exposes beta/ready only; hidden/dev_only/internal_test remain unavailable");

assert.equal(isFeatureVisible("feedingReminder", "qa", feedingOnly), false);
assert.equal(isFeatureVisible("feedingReminder", "qa", new Set(["feedingReminder", "careReminderServer"])), true);
console.log("PASS feedingReminder cannot be exposed without careReminderServer");
assert.equal(isFeatureVisible("sleepReminder", "qa", sleepOnly), false);
assert.equal(isFeatureVisible("sleepReminder", "qa", new Set(["sleepReminder", "careReminderServer"])), true);
console.log("PASS sleepReminder cannot be exposed without careReminderServer");

assert.equal(canShowLanguagePicker("production", allInternal), true);
for (const locale of ["ko", "en", "ja", "es", "zh-CN"] as const) {
  assert.equal(isLocaleAvailable(locale, "production", allInternal), true);
}
assert.equal(canShowLanguagePicker("qa", new Set(["multilingualPicker"])), false);
assert.equal(canShowLanguagePicker("qa", koEnQa), true);
assert.equal(isLocaleAvailable("ko", "qa", koEnQa), true);
assert.equal(isLocaleAvailable("en", "qa", koEnQa), true);
assert.equal(isLocaleAvailable("ja", "qa", koEnQa), false);
assert.equal(isLocaleAvailable("es", "qa", koEnQa), false);
assert.equal(isLocaleAvailable("zh-CN", "qa", koEnQa), false);
console.log("PASS LanguagePicker requires language support; ko/en and five-language stages remain separated");

assert.equal(canShowNotificationEvent("sleep_reminder", "production", allInternal), true);
assert.equal(canOpenNotificationData({ feature: "sleepReminder", route: "record" }, "production", allInternal), true);
assert.equal(canShowNotificationEvent("feeding_reminder", "production", allInternal), true);
assert.equal(canOpenNotificationData({ feature: "feedingReminder", route: "record" }, "production", allInternal), true);
assert.equal(canOpenNotificationData({ route: "settings", settingsPage: "careAlerts" }, "production", allInternal), true);
console.log("PASS release care-reminder UI, notifications, and deep links are available in production");

const qaProfileAllowlist = new Set(
  (buildConfig.build?.qa?.env?.EXPO_PUBLIC_INTERNAL_FEATURES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is FeatureName => value in FEATURE_FLAGS),
);
for (const feature of [
  "feedingReminder",
  "sleepReminder",
  "careReminderServer",
  "multilingualPicker",
  "englishSupport",
  "fiveLanguageSupport",
] as const) {
  assert.equal(qaProfileAllowlist.has(feature), true, `QA build profile must include ${feature}`);
}
assert.equal(isFeatureVisible("feedingReminder", "qa", qaProfileAllowlist), true);
assert.equal(isFeatureVisible("sleepReminder", "qa", qaProfileAllowlist), true);
assert.equal(canShowLanguagePicker("qa", qaProfileAllowlist), true);
for (const locale of ["ko", "en", "ja", "es", "zh-CN"] as const) {
  assert.equal(isLocaleAvailable(locale, "qa", qaProfileAllowlist), true);
}
console.log("PASS QA build profile covers every Build 17 internal feature and all five locales");

const sources = {
  feedingCard: readFileSync("src/components/babylog/FeedingReminderSettingsCard.tsx", "utf8"),
  languagePicker: readFileSync("src/components/LanguagePicker.tsx", "utf8"),
  profileSetup: readFileSync("src/screens/onboarding/ProfileSetupScreen.tsx", "utf8"),
  myProfile: readFileSync("src/screens/MyProfileScreen.tsx", "utf8"),
  app: readFileSync("App.tsx", "utf8"),
  mainNavigator: readFileSync("src/navigation/MainNavigator.tsx", "utf8"),
  notificationCenter: readFileSync("src/screens/NotificationCenterScreen.tsx", "utf8"),
  notificationSeed: readFileSync("src/data/notificationQaSeed.ts", "utf8"),
  reminderModal: readFileSync("src/components/babylog/DiaryReminderSettingsModal.tsx", "utf8"),
};

assert.match(sources.feedingCard, /isFeatureVisible\(featureName\)/);
assert.match(sources.feedingCard, /if \(!reminderVisible \|\| !active \|\| !babyId\) return/);
assert.match(sources.languagePicker, /canShowLanguagePicker\(\)/);
assert.match(sources.languagePicker, /getVisibleAppLanguageOptions\(\)/);
assert.match(sources.profileSetup, /canShowLanguagePicker\(\)/);
assert.match(sources.myProfile, /canShowLanguagePicker\(\)/);
assert.match(sources.mainNavigator, /canOpenNotificationData\(data\)/);
assert.match(sources.mainNavigator, /config: friendOnly \?/);
assert.match(sources.mainNavigator, /\{!friendOnly \? \(/);
assert.doesNotMatch(sources.app, /ProfileRepository\.getMyProfile\(\)\.catch\(\(\) => null\)/);
assert.match(sources.notificationCenter, /canShowNotificationEvent\(event\.event_type\)/);
assert.match(sources.notificationSeed, /isFeatureVisible\("experimentalNotifications"\)/);
assert.doesNotMatch(sources.notificationSeed, /__DEV__/);
assert.match(sources.reminderModal, /reminderType="sleep"/);
console.log("PASS UI-only toggles, picker, QA seed, deep links, and notification-center paths use central flags");

for (const feature of featureNames) {
  const definition = FEATURE_FLAGS[feature];
  console.log(
    `INFO ${feature}: default=${definition.status} qa=${"qaStatus" in definition ? definition.qaStatus : "hidden"} production=${productionExposure(feature) ? "shown" : "hidden"}`,
  );
}
