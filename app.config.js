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

function normalizedAppLinkHost(value) {
  const host = String(value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!host) return "";
  if (!/^[a-z0-9.-]+$/.test(host) || host.includes("..") || host.startsWith(".") || host.endsWith(".")) {
    throw new Error("EXPO CONFIG SAFETY BLOCK: EXPO_PUBLIC_APP_LINK_HOST must be a hostname");
  }
  return host;
}

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? "local";
  const projectRef = projectRefFromUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const appLinkHost = normalizedAppLinkHost(process.env.EXPO_PUBLIC_APP_LINK_HOST);
  const serverKeys = SERVER_ONLY_KEYS.filter((key) => Boolean(process.env[key]?.trim()));
  if (serverKeys.length) {
    throw new Error(`EXPO CONFIG SAFETY BLOCK: server-only variables detected (${serverKeys.join(", ")})`);
  }

  if (profile === "production" || profile === "local-production") {
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

  if (!appLinkHost) return config;

  const associatedDomain = `applinks:${appLinkHost}`;
  const associatedDomains = Array.from(new Set([
    ...(config.ios?.associatedDomains ?? []),
    associatedDomain,
  ]));
  const existingIntentFilters = config.android?.intentFilters ?? [];
  const hasInviteFilter = existingIntentFilters.some((filter) =>
    filter?.action === "VIEW" && filter?.data?.some((entry) => entry?.scheme === "https" && entry?.host === appLinkHost),
  );

  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains,
    },
    android: {
      ...config.android,
      intentFilters: hasInviteFilter ? existingIntentFilters : [
        ...existingIntentFilters,
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host: appLinkHost, pathPrefix: "/invite" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
  };
};
