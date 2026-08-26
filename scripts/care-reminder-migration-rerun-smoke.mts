import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608220001_care_reminders.sql", "utf8");

const policies = [...migration.matchAll(/create policy\s+(\w+)/g)].map((match) => match[1]);
assert.ok(policies.length >= 8, "expected all care reminder RLS policies");
for (const policy of policies) {
  assert.match(migration, new RegExp(`drop policy if exists ${policy}`), `${policy} is not rerun-safe`);
}

assert.match(migration, /information_schema\.columns/);
assert.match(migration, /required unique constraints are missing/);
assert.match(migration, /add column if not exists delivery_status text/);
assert.match(migration, /drop constraint if exists notification_events_delivery_status_check/);
assert.match(migration, /pg_get_constraintdef\(c\.oid\)/);
assert.match(migration, /select event_type from public\.notification_events/);
assert.match(migration, /validate constraint notification_events_event_type_check/);
assert.match(migration, /'processed'/);

console.log("care reminder migration rerun smoke passed");

