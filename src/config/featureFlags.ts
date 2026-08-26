import type { Locale } from "../i18n";

export type FeatureStatus = "hidden" | "dev_only" | "internal_test" | "beta" | "ready";
export type FeatureName =
  | "feedingReminder"
  | "sleepReminder"
  | "multilingualPicker"
  | "englishSupport"
  | "fiveLanguageSupport"
  | "careReminderServer"
  | "experimentalNotifications";
export type FeatureEnvironment = "development" | "qa" | "production";

type FeatureDefinition = {
  status: FeatureStatus;
  qaStatus?: "internal_test";
  dependsOn?: readonly FeatureName[];
};

/**
 * Single release-readiness ledger for incomplete features.
 * Change a status to beta/ready only after its release audit is complete.
 */
export const FEATURE_FLAGS = {
  feedingReminder: { status: "dev_only", qaStatus: "internal_test", dependsOn: ["careReminderServer"] },
  sleepReminder: { status: "hidden" },
  multilingualPicker: { status: "dev_only", qaStatus: "internal_test" },
  englishSupport: { status: "dev_only", qaStatus: "internal_test" },
  fiveLanguageSupport: { status: "hidden" },
  careReminderServer: { status: "dev_only", qaStatus: "internal_test" },
  experimentalNotifications: { status: "dev_only", qaStatus: "internal_test" },
} as const satisfies Record<FeatureName, FeatureDefinition>;

const RELEASE_STATUSES = new Set<FeatureStatus>(["beta", "ready"]);

function isDevelopmentRuntime(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

function internalFeatureAllowlist(): Set<FeatureName> {
  const raw = (process.env.EXPO_PUBLIC_INTERNAL_FEATURES ?? "") as string;
  return new Set(
    raw.split(",").map((value: string) => value.trim()).filter((value: string): value is FeatureName => value in FEATURE_FLAGS),
  );
}

export function currentFeatureEnvironment(): FeatureEnvironment {
  if (isDevelopmentRuntime()) return "development";
  const internalProfile = process.env.EXPO_PUBLIC_FEATURE_PROFILE === "internal";
  const qaEnvironment = process.env.EXPO_PUBLIC_FEATURE_ENV === "qa";
  return internalProfile && qaEnvironment ? "qa" : "production";
}

export function effectiveFeatureStatus(
  feature: FeatureName,
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): FeatureStatus {
  const definition: FeatureDefinition = FEATURE_FLAGS[feature];
  if (environment === "production") return definition.status;
  if (environment === "qa") {
    return definition.qaStatus && qaAllowlist.has(feature) ? definition.qaStatus : "hidden";
  }
  return definition.status;
}

function statusIsExposed(status: FeatureStatus, environment: FeatureEnvironment): boolean {
  if (environment === "production") return RELEASE_STATUSES.has(status);
  if (environment === "qa") return status === "internal_test" || RELEASE_STATUSES.has(status);
  return status === "dev_only" || status === "internal_test" || RELEASE_STATUSES.has(status);
}

export function isFeatureVisible(
  feature: FeatureName,
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
  resolving: ReadonlySet<FeatureName> = new Set(),
): boolean {
  if (resolving.has(feature)) return false;
  if (!statusIsExposed(effectiveFeatureStatus(feature, environment, qaAllowlist), environment)) return false;
  const nextResolving = new Set(resolving).add(feature);
  const dependencies = (FEATURE_FLAGS[feature] as FeatureDefinition).dependsOn ?? [];
  return dependencies.every((dependency) => isFeatureVisible(dependency, environment, qaAllowlist, nextResolving));
}

export function isLocaleAvailable(
  locale: Locale,
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): boolean {
  if (locale === "ko") return true;
  if (locale === "en") return isFeatureVisible("englishSupport", environment, qaAllowlist);
  return isFeatureVisible("fiveLanguageSupport", environment, qaAllowlist);
}

export function canShowLanguagePicker(
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): boolean {
  return isFeatureVisible("multilingualPicker", environment, qaAllowlist)
    && (isFeatureVisible("englishSupport", environment, qaAllowlist)
      || isFeatureVisible("fiveLanguageSupport", environment, qaAllowlist));
}

export function canAccessCareReminderUi(
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): boolean {
  return isFeatureVisible("feedingReminder", environment, qaAllowlist);
}

export function canShowNotificationEvent(
  eventType: string,
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): boolean {
  if (eventType === "feeding_reminder") return isFeatureVisible("feedingReminder", environment, qaAllowlist);
  if (eventType === "sleep_reminder") return isFeatureVisible("sleepReminder", environment, qaAllowlist);
  return true;
}

export function canOpenNotificationData(
  data: Record<string, unknown>,
  environment: FeatureEnvironment = currentFeatureEnvironment(),
  qaAllowlist: ReadonlySet<FeatureName> = internalFeatureAllowlist(),
): boolean {
  if (data.feature === "feedingReminder") return isFeatureVisible("feedingReminder", environment, qaAllowlist);
  if (data.feature === "sleepReminder") return isFeatureVisible("sleepReminder", environment, qaAllowlist);
  if (data.route === "settings" && (data.settingsPage === undefined || data.settingsPage === "careAlerts")) {
    return canAccessCareReminderUi(environment, qaAllowlist);
  }
  return true;
}

export function productionExposure(feature: FeatureName): boolean {
  return isFeatureVisible(feature, "production", new Set());
}
