const projectRefs = require("./scripts/lib/project-refs.json");

const SERVER_ONLY_KEYS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "CARE_REMINDER_CRON_SECRET",
];

function projectRefFromUrl(value) {
  try {
    const host = new URL(value ?? "").hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : "";
  } catch {
    return "";
  }
}

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? "local";
  const projectRef = projectRefFromUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const serverKeys = SERVER_ONLY_KEYS.filter((key) => Boolean(process.env[key]?.trim()));
  if (serverKeys.length) {
    throw new Error(`EXPO CONFIG SAFETY BLOCK: server-only variables detected (${serverKeys.join(", ")})`);
  }

  if (profile === "production") {
    if (projectRef !== projectRefs.production
      || process.env.EXPO_PUBLIC_FEATURE_ENV !== "production"
      || process.env.EXPO_PUBLIC_FEATURE_PROFILE !== "production"
      || process.env.EXPO_PUBLIC_INTERNAL_FEATURES?.trim()) {
      throw new Error("EXPO CONFIG SAFETY BLOCK: invalid production project or feature profile");
    }
  } else if (profile === "qa") {
    if (projectRef !== projectRefs.qa
      || process.env.EXPO_PUBLIC_FEATURE_ENV !== "qa"
      || process.env.EXPO_PUBLIC_FEATURE_PROFILE !== "internal") {
      throw new Error("EXPO CONFIG SAFETY BLOCK: invalid QA project or feature profile");
    }
  } else if (projectRef === projectRefs.production) {
    throw new Error("EXPO CONFIG SAFETY BLOCK: local Expo cannot target production; use the QA wrapper");
  }

  return config;
};

