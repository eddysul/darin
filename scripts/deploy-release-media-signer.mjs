import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const execute = process.argv.includes("--execute");
if (!['qa', 'production'].includes(target)) {
  throw new Error("usage: deploy-release-media-signer.mjs <qa|production> [--execute]");
}

const projectRef = target === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = target === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "";
const publicUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? `https://${projectRef}.supabase.co`;
const urlRef = new URL(publicUrl).hostname.split(".")[0];
if (
  !accessToken || urlRef !== projectRef
  || publicUrl.includes(otherRef)
  || (target === "production" && configuredRef !== projectRef)
) {
  throw new Error(`${target} media signer project identity guard failed`);
}

const path = "supabase/functions/media-signed-url/index.ts";
const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
if (target === "production" && process.env.MEDIA_SIGNER_QA_APPROVED_SHA256?.trim() !== sha256) {
  throw new Error("production media signer differs from the QA-approved source");
}

console.log(JSON.stringify({ target, projectRef, execute, path, sha256 }));
if (!execute) process.exit(0);

const confirmKey = target === "qa" ? "QA_MEDIA_SIGNER_CONFIRM" : "PRODUCTION_MEDIA_SIGNER_CONFIRM";
const expectedConfirm = target === "qa"
  ? `DEPLOY_MEDIA_SIGNER_${projectRef}`
  : `DEPLOY_MEDIA_SIGNER_PRODUCTION_${projectRef}`;
if (process.env[confirmKey]?.trim() !== expectedConfirm) {
  throw new Error(`${target} media signer deployment confirmation missing`);
}

const deployed = spawnSync("pnpm", [
  "dlx", "supabase@latest", "functions", "deploy", "media-signed-url",
  "--project-ref", projectRef, "--use-api",
], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  stdio: "inherit",
});
if (deployed.status !== 0) throw new Error(`media signer deployment failed with exit ${deployed.status}`);

const response = await fetch(`https://${projectRef}.supabase.co/functions/v1/media-signed-url`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "memory_media", resourceId: "00000000-0000-4000-8000-000000000000" }),
});
if (response.status !== 401) {
  throw new Error(`unsigned media signer expected 401, received ${response.status}`);
}
console.log(JSON.stringify({ target, projectRef, sha256, deployed: "media-signed-url", unsignedStatus: response.status }));
