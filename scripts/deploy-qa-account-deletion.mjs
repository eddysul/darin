import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { QA_PROJECT_REF } from "./lib/qa-project-config.mjs";

assertQaProjectEnvironment();
if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error("QA Supabase deploy token missing");
if (!process.argv.includes("--execute")) {
  console.log(`QA-only delete-account deploy preflight passed: ${QA_PROJECT_REF}`);
  process.exit(0);
}
if (process.env.QA_ACCOUNT_DELETION_CONFIRM !== `DEPLOY_ACCOUNT_DELETION_${QA_PROJECT_REF}`) {
  throw new Error("QA account deletion deploy confirmation missing");
}
const result = spawnSync("pnpm", [
  "dlx", "supabase@latest", "functions", "deploy", "delete-account",
  "--project-ref", QA_PROJECT_REF, "--use-api",
], { cwd: process.cwd(), env: process.env, encoding: "utf8" });
if (result.status !== 0) throw new Error((result.stderr || result.stdout).slice(-3000));
console.log(`QA delete-account Edge Function deployed: ${QA_PROJECT_REF}`);
