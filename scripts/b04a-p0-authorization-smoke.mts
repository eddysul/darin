import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/202609140001_b04a_p0_authorization_hotfix.sql",
  "utf8",
);

for (const functionName of [
  "create_invite_code",
  "list_baby_memory_friends",
  "add_darin_friend_to_baby",
]) {
  const start = migration.indexOf(`function public.${functionName}`);
  assert.notEqual(start, -1, `${functionName} replacement is missing`);
  const body = migration.slice(start, migration.indexOf("$$;", start) + 3);
  assert.match(
    body,
    /is distinct from 'admin'::public\.permission_role/,
    `${functionName} must fail closed when baby_permission is NULL`,
  );
}

assert.match(migration, /invite issuer no longer has permission/);
assert.match(migration, /issuer\.user_id = v_invite\.created_by/);
assert.match(migration, /issuer\.status = 'active'/);
assert.match(migration, /issuer\.permission_role = 'admin'::public\.permission_role/);
assert.match(
  migration,
  /from public\.baby_members issuer[\s\S]*?issuer\.permission_role = 'admin'::public\.permission_role[\s\S]*?for update/,
);
assert.doesNotMatch(migration, /for key share/);

assert.match(migration, /foreign key \(memory_post_id, baby_id\)/);
assert.match(migration, /references public\.memory_posts \(id, baby_id\)/);
assert.match(migration, /not valid/);
assert.doesNotMatch(migration, /parent_post\.baby_id\s*=\s*parent_post\.baby_id/);

for (const policyName of [
  "memory_media_select_visible",
  "memory_media_insert_manager",
  "memory_media_update_manager",
  "memory_media_delete_manager",
]) {
  const start = migration.indexOf(`create policy ${policyName}`);
  assert.notEqual(start, -1, `${policyName} replacement is missing`);
  const body = migration.slice(start, migration.indexOf(";", start) + 1);
  assert.match(body, /parent_post\.id = memory_media\.memory_post_id/);
  assert.match(body, /parent_post\.baby_id = memory_media\.baby_id/);
}

console.log("B0.4a P0 authorization source smoke passed");
