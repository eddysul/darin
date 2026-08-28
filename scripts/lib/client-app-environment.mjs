import { readFileSync } from "node:fs";
import { QA_PROJECT_REF } from "./qa-project-config.mjs";

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

export function qaClientEnvironment(source, inherited = process.env) {
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
  if (projectRef !== QA_PROJECT_REF) {
    throw new Error(`LOCAL APP SAFETY BLOCK: .env.qa must target ${QA_PROJECT_REF}`);
  }
  if (!publicValues.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("LOCAL APP SAFETY BLOCK: QA publishable key is missing");
  }

  const environment = { ...inherited };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("EXPO_PUBLIC_") || SERVER_ONLY_KEYS.includes(key)) delete environment[key];
  }
  return {
    ...environment,
    ...publicValues,
    EXPO_PUBLIC_FEATURE_ENV: "qa",
    EXPO_PUBLIC_FEATURE_PROFILE: "internal",
    EXPO_NO_DOTENV: "1",
  };
}

export function loadQaClientEnvironment(path = ".env.qa", inherited = process.env) {
  return qaClientEnvironment(readFileSync(path, "utf8"), inherited);
}

