import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./qa-project-config.mjs";

const PUBLIC_SECRET_PATTERN = /(SECRET|SERVICE_ROLE|DB_PASSWORD|ACCESS_TOKEN|PRIVATE_KEY)/i;
const SERVER_ONLY_KEYS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "CARE_REMINDER_CRON_SECRET",
];

function projectRefFromUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.hostname.endsWith(".supabase.co") ? url.hostname.split(".")[0] ?? "" : "";
  } catch {
    return "";
  }
}

export function validateReleaseEnvironment(environment = process.env, requestedProfile) {
  const profile = requestedProfile ?? environment.EAS_BUILD_PROFILE ?? "";
  if (profile !== "production" && profile !== "qa") {
    throw new Error(`BUILD ENV SAFETY BLOCK: unsupported or missing EAS_BUILD_PROFILE (${profile || "missing"})`);
  }

  const errors = [];
  const publicSecretKeys = Object.keys(environment).filter(
    (key) => key.startsWith("EXPO_PUBLIC_") && PUBLIC_SECRET_PATTERN.test(key),
  );
  if (publicSecretKeys.length) {
    errors.push(`server secret-like EXPO_PUBLIC variables found: ${publicSecretKeys.sort().join(", ")}`);
  }
  const injectedServerKeys = SERVER_ONLY_KEYS.filter((key) => Boolean(environment[key]?.trim()));
  if (injectedServerKeys.length) {
    errors.push(`server-only variables must not enter an app build: ${injectedServerKeys.join(", ")}`);
  }

  const projectRef = projectRefFromUrl(environment.EXPO_PUBLIC_SUPABASE_URL);
  const expected = profile === "production"
    ? {
      projectRef: PRODUCTION_PROJECT_REF,
      featureEnvironment: "production",
      featureProfile: "production",
    }
    : {
      projectRef: QA_PROJECT_REF,
      featureEnvironment: "qa",
      featureProfile: "internal",
    };

  if (projectRef !== expected.projectRef) {
    errors.push(`expected Supabase project ${expected.projectRef}, received ${projectRef || "missing/invalid"}`);
  }
  if (!environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    errors.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
  }
  if (environment.EXPO_PUBLIC_FEATURE_ENV !== expected.featureEnvironment) {
    errors.push(`EXPO_PUBLIC_FEATURE_ENV must be ${expected.featureEnvironment}`);
  }
  if (environment.EXPO_PUBLIC_FEATURE_PROFILE !== expected.featureProfile) {
    errors.push(`EXPO_PUBLIC_FEATURE_PROFILE must be ${expected.featureProfile}`);
  }
  if (profile === "production" && environment.EXPO_PUBLIC_INTERNAL_FEATURES?.trim()) {
    errors.push("EXPO_PUBLIC_INTERNAL_FEATURES must be empty in production");
  }

  if (errors.length) {
    throw new Error(`BUILD ENV SAFETY BLOCK (${profile}):\n- ${errors.join("\n- ")}`);
  }
  return { profile, projectRef };
}

