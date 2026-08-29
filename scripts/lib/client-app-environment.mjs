import { readFileSync } from "node:fs";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./qa-project-config.mjs";

const SERVER_ONLY_KEYS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "CARE_REMINDER_CRON_SECRET",
];

export function parseEnvFile(source) {
  const parsed = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function publicClientEnvironment(source, inherited, options) {
  const fileValues = parseEnvFile(source);
  const publicValues = Object.fromEntries(
    Object.entries(fileValues).filter(([key]) => key.startsWith("EXPO_PUBLIC_")),
  );
  let projectRef = "";
  try {
    projectRef = new URL(publicValues.EXPO_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? "";
  } catch {
    // Report the same safe failure below without echoing credentials.
  }
  if (projectRef !== options.expectedRef) {
    throw new Error(options.wrongRefMessage);
  }
  if (!publicValues.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(options.missingKeyMessage);
  }

  const environment = { ...inherited };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("EXPO_PUBLIC_") || SERVER_ONLY_KEYS.includes(key)) delete environment[key];
  }
  return {
    ...environment,
    ...publicValues,
    EXPO_PUBLIC_FEATURE_ENV: options.featureEnv,
    EXPO_PUBLIC_FEATURE_PROFILE: options.featureProfile,
    EXPO_NO_DOTENV: "1",
    ...(options.clearInternalFeatures ? { EXPO_PUBLIC_INTERNAL_FEATURES: "" } : {}),
    ...(options.easProfile ? { EAS_BUILD_PROFILE: options.easProfile } : {}),
  };
}

export function qaClientEnvironment(source, inherited = process.env) {
  return publicClientEnvironment(source, inherited, {
    expectedRef: QA_PROJECT_REF,
    featureEnv: "qa",
    featureProfile: "internal",
    missingKeyMessage: "LOCAL APP SAFETY BLOCK: QA publishable key is missing",
    wrongRefMessage: `LOCAL APP SAFETY BLOCK: .env.qa must target ${QA_PROJECT_REF}`,
  });
}

export function productionClientEnvironment(source, inherited = process.env) {
  return publicClientEnvironment(source, inherited, {
    expectedRef: PRODUCTION_PROJECT_REF,
    featureEnv: "production",
    featureProfile: "production",
    easProfile: "local-production",
    clearInternalFeatures: true,
    missingKeyMessage: "LOCAL APP SAFETY BLOCK: production publishable key is missing",
    wrongRefMessage: `LOCAL APP SAFETY BLOCK: .env must target ${PRODUCTION_PROJECT_REF}`,
  });
}

export function loadQaClientEnvironment(path = ".env.qa", inherited = process.env) {
  return qaClientEnvironment(readFileSync(path, "utf8"), inherited);
}

export function loadProductionClientEnvironment(path = ".env", inherited = process.env) {
  return productionClientEnvironment(readFileSync(path, "utf8"), inherited);
}

