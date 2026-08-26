import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./qa-project-config.mjs";

export function assertQaProjectEnvironment(options = {}) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!url || !publishableKey) {
    throw new Error("QA SAFETY BLOCK: .env.qa public Supabase variables are required");
  }
  let ref = "";
  try {
    ref = new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    throw new Error("QA SAFETY BLOCK: invalid Supabase URL");
  }
  if (ref === PRODUCTION_PROJECT_REF || url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("QA SAFETY BLOCK: production Supabase ref detected");
  }
  if (ref !== QA_PROJECT_REF) {
    throw new Error(`QA SAFETY BLOCK: expected project ref ${QA_PROJECT_REF}, received ${ref || "unknown"}`);
  }
  if (options.requireSecret !== false && !secretKey) {
    throw new Error("QA SAFETY BLOCK: QA server secret is required before fixture creation");
  }
  return { ref, url };
}

export { QA_PROJECT_REF };
