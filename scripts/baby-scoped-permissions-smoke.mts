import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const core = readFileSync("supabase/migrations/202609200001_baby_scoped_permissions.sql", "utf8");
const extended = readFileSync("supabase/migrations/202609200002_baby_scoped_extended_enforcement.sql", "utf8");
const lifecycle = readFileSync("supabase/migrations/202609200003_baby_scoped_account_lifecycle.sql", "utf8");
const repository = readFileSync("src/repositories/FamilyRepository.ts", "utf8");
const context = readFileSync("src/context/BabyLogContext.tsx", "utf8");
const shareScreen = readFileSync("src/screens/FamilyShareScreen.tsx", "utf8");
const peopleUi = readFileSync("src/components/family/FamilyPeopleManage.tsx", "utf8");
const inviteUi = readFileSync("src/components/family/InviteComposerSheet.tsx", "utf8");
const codeUi = readFileSync("src/components/family/InviteCodeSheet.tsx", "utf8");

for (const permission of ["care.read", "care.write", "moments.read", "moments.write", "social.comment", "social.react"]) {
  assert.ok(core.includes(`'${permission}'`), `server contract includes ${permission}`);
}
assert.match(core, /constraint baby_access_care_write_requires_read/);
assert.match(core, /constraint baby_access_moments_write_requires_read/);
assert.match(core, /constraint baby_access_comment_requires_moments/);
assert.match(core, /current_baby_access_for_write[\s\S]*for update/);
assert.match(core, /Full Admin requires current admin approval/);
assert.match(core, /promote_baby_full_admin[\s\S]*darin\.admin_grant_approved/);
assert.doesNotMatch(core, /relationship_label\s*(=|in)/i, "relationship label never grants access");
assert.match(core, /memory_posts_select_visible[\s\S]*can_view_memory_post/);
assert.match(core, /memory_comments_insert_member[\s\S]*can_comment_memory_post/);
assert.match(core, /memory_reactions_insert_member[\s\S]*can_react_memory_post/);
assert.match(core, /care_logs_select_member[\s\S]*care\.read/);
assert.match(core, /growth_records_select_member[\s\S]*care\.read/);
assert.match(core, /diary_entries_select_member[\s\S]*care\.read/);

assert.match(extended, /p_bucket='memories'[\s\S]*moments\.write/);
assert.match(extended, /p_bucket='baby-stickers'[\s\S]*moments\.write/);
assert.match(extended, /baby_avatar[\s\S]*care\.read[\s\S]*moments\.read/);
assert.match(extended, /resolve_private_media_for_signing[\s\S]*can_view_memory_post/);
assert.match(extended, /baby_caution_foods_select_member[\s\S]*care\.read/);
assert.match(extended, /can_view_growth_book[\s\S]*care\.read/);

assert.match(lifecycle, /darin\.account_deletion/);
assert.match(lifecycle, /is_baby_full_admin\(old\.id,auth\.uid\(\)\)/);
assert.match(lifecycle, /for update/);
assert.match(lifecycle, /delete from public\.baby_access_permissions where user_id=v_user_id/);
assert.match(lifecycle, /media_cleanup_queue/);

assert.match(repository, /setBabyAccessPermissions/);
assert.match(repository, /promoteBabyFullAdmin/);
assert.match(repository, /subscribeToMyBabyAccess/);
assert.match(context, /subscribeToMyBabyAccess/);
assert.match(context, /hidePreviousBabyDuringSwitch\(\);[\s\S]*hydrateStorageState\(true, subscribedScope, true\)/);
assert.match(shareScreen, /refreshGen/);
assert.match(shareScreen, /listBabyAccessPermissions/);
assert.match(shareScreen, /accessByUser=\{accessByUser\}/);
assert.match(peopleUi, /setBabyAccessPermissions/);
assert.match(peopleUi, /promoteBabyFullAdmin/);
assert.match(peopleUi, /key === "careWrite" && value[\s\S]*careRead = true/);
assert.match(peopleUi, /key === "momentsRead" && !value[\s\S]*socialReact = false/);
assert.doesNotMatch(peopleUi, /updateMemberRole/);
assert.match(inviteUi, /role: "editor"/);
assert.doesNotMatch(inviteUi, /invite-role-admin/);
assert.match(codeUi, /role: "editor"/);
assert.doesNotMatch(codeUi, /setRole\(/);

console.log("baby-scoped permission, enforcement, lifecycle, and cache-invalidation source contracts passed");
