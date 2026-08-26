import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const expectedRef = target === "qa"
  ? QA_PROJECT_REF
  : target === "production"
    ? PRODUCTION_PROJECT_REF
    : null;
if (!expectedRef) throw new Error("Usage: deploy-push-function.mjs <qa|production>");

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim()
  || (projectUrl ? new URL(projectUrl).hostname.split(".")[0] : "");
if (configuredRef !== expectedRef) {
  throw new Error(`Deployment target guard failed: expected ${expectedRef}, received ${configuredRef || "missing"}`);
}
if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
  throw new Error("SUPABASE_ACCESS_TOKEN is required");
}

const result = spawnSync("pnpm", [
  "dlx",
  "supabase@latest",
  "functions",
  "deploy",
  "send-push-notification",
  "--project-ref",
  expectedRef,
  "--use-api",
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
