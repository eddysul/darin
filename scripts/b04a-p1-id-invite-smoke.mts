import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/202609140002_b04a_p1_id_invite_current_authority.sql",
  "utf8",
);

assert.match(
  migration,
  /respond_darin_id_invite_request\(\s*p_request_id uuid,\s*p_accept boolean\s*\)/,
  "RPC signature must remain compatible",
);
assert.match(migration, /security definer[\s\S]*set search_path = public/);
assert.match(migration, /request_row\.receiver_id = auth\.uid\(\)/);
assert.match(migration, /request_row\.status = 'pending'/);
assert.match(migration, /for update/);
assert.match(migration, /v_request\.sender_id is null or v_request\.baby_id is null/);
assert.match(migration, /v_request\.expires_at is null/);
assert.match(migration, /v_request\.request_type not in \('family', 'friend'\)/);
assert.match(migration, /v_request\.permission_role is null/);
assert.match(migration, /issuer\.baby_id = v_request\.baby_id/);
assert.match(migration, /issuer\.user_id = v_request\.sender_id/);
assert.match(migration, /issuer\.status::text is not distinct from 'active'/);
assert.match(migration, /issuer\.permission_role::text is not distinct from 'admin'/);
assert.match(
  migration,
  /from public\.baby_members as issuer[\s\S]*?issuer\.permission_role::text is not distinct from 'admin'[\s\S]*?for update/,
);
assert.match(migration, /invite issuer no longer has permission/);
assert.match(migration, /revoke all on function public\.respond_darin_id_invite_request\(uuid, boolean\)/);
assert.match(migration, /grant execute on function public\.respond_darin_id_invite_request\(uuid, boolean\) to authenticated/);

console.log("B0.4a P1 ID-invite current-authority source smoke passed");
