import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";

if (process.env.SUPABASE_PROJECT_REF !== PRODUCTION_PROJECT_REF
  || process.env.SUPABASE_PROJECT_REF === QA_PROJECT_REF
  || !process.env.SUPABASE_ACCESS_TOKEN) {
  throw new Error("Production delete-account Edge deployment guard failed");
}
const sha256 = createHash("sha256")
  .update(readFileSync("supabase/functions/delete-account/index.ts"))
  .digest("hex");
const execute = process.argv.includes("--execute");
console.log(JSON.stringify({ target: "production", function: "delete-account", sha256, execute }));
if (!execute) process.exit(0);
if (process.env.ACCOUNT_DELETION_QA_APPROVED_FUNCTION_SHA256 !== sha256
  || process.env.PRODUCTION_ACCOUNT_DELETION_CONFIRM !== `DEPLOY_ACCOUNT_DELETION_PRODUCTION_${PRODUCTION_PROJECT_REF}`) {
  throw new Error("QA-approved Edge source or Production deployment confirmation missing");
}
const result = spawnSync("pnpm", [
  "dlx", "supabase@latest", "functions", "deploy", "delete-account",
  "--project-ref", PRODUCTION_PROJECT_REF, "--use-api",
], { cwd: process.cwd(), env: process.env, encoding: "utf8" });
if (result.status !== 0) throw new Error(`Production delete-account deployment failed: ${(result.stderr || result.stdout).slice(-2200)}`);
console.log(JSON.stringify({ target: "production", deployed: "delete-account", sha256 }));
