/**
 * Prints / copies Phase 2E Memories RLS SQL for manual apply.
 * DDL cannot be applied with the Expo publishable key.
 *
 * Usage: node scripts/apply-memories-2e-migration.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sqlPath = resolve("supabase/migrations/202607310003_memories_manage_author_admin.sql");
const sql = readFileSync(sqlPath, "utf8");
spawnSync("pbcopy", [], { input: sql, encoding: "utf8" });
console.log("SQL copied to clipboard:");
console.log(`  ${sqlPath}`);
console.log("Open Supabase SQL Editor and Run:");
console.log("  https://supabase.com/dashboard/project/efipxojpdirvkeyfdfzl/sql/new");
console.log("Then re-run: pnpm qa:supabase:memories");
