import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";

const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
if (configuredRef !== PRODUCTION_PROJECT_REF || configuredRef === QA_PROJECT_REF
    || !process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("PRODUCTION READ-ONLY SAFETY BLOCK: expected production backend environment");
}

const targetVersions = [
  "202609170004", "202609180002", "202609200001", "202609200002", "202609200003",
];
const sql = `select coalesce(json_agg(version order by version), '[]'::json)
  from supabase_migrations.schema_migrations
  where version = any(array[${targetVersions.map((version) => `'${version}'`).join(",")}]);`;
const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`,
    PGUSER: "postgres",
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
    PGDATABASE: "postgres",
    PGSSLMODE: "require",
    PGCONNECT_TIMEOUT: "15",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000",
  },
});
if (result.status !== 0) {
  throw new Error(`Production read-only check failed: ${result.stderr.slice(0, 500)}`);
}
const applied = JSON.parse(result.stdout.trim());
assert.deepEqual(applied, [], "G5 target migration unexpectedly exists in Production history");
console.log(`PASS Production target migrations remain unapplied (${PRODUCTION_PROJECT_REF})`);
console.log("G5 Production isolation: 1 PASS / 0 skipped");
