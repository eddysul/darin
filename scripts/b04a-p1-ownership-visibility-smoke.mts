import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ownership = readFileSync(
  "supabase/migrations/202609140003_b04a_p1_ownership_lifecycle.sql",
  "utf8",
);
const visibility = readFileSync(
  "supabase/migrations/202609140004_b04a_p1_memory_visibility_social.sql",
  "utf8",
);
const recipientAssignment = readFileSync(
  "supabase/migrations/202609140005_b04a_p1_memory_recipient_assignment.sql",
  "utf8",
);

assert.match(ownership, /current_baby_write_permission[\s\S]*for update/);
assert.match(ownership, /can_manage_care_log/);
assert.match(ownership, /care_logs_insert_editor[\s\S]*current_baby_write_permission\(baby_id\)/);
assert.match(ownership, /care_log_identity_unchanged\(id, baby_id, created_by\)/);
assert.match(ownership, /can_manage_growth_record/);
assert.match(ownership, /growth_records_insert_editor[\s\S]*current_baby_write_permission\(baby_id\)/);
assert.match(ownership, /growth_record_identity_unchanged\(id, baby_id, created_by\)/);
assert.match(ownership, /can_manage_diary_entry[\s\S]*editor[\s\S]*author_id = auth\.uid\(\)/);
assert.match(ownership, /diary_entries_insert_admin_editor[\s\S]*current_baby_write_permission\(baby_id\)/);
assert.match(ownership, /can_manage_memory_post[\s\S]*editor[\s\S]*author_id = auth\.uid\(\)/);
assert.match(ownership, /memory_posts_insert_editor[\s\S]*current_baby_write_permission\(baby_id\)/);
assert.match(ownership, /drop policy if exists care_logs_delete_editor/);
assert.match(ownership, /drop policy if exists growth_records_delete_editor/);
assert.match(ownership, /drop policy if exists diary_entries_update_author_admin/);
assert.match(ownership, /drop policy if exists memory_posts_update_author_or_admin/);

assert.match(visibility, /post_row\.status = 'published'/);
assert.match(visibility, /post_row\.privacy_type = 'family_circle'/);
assert.match(visibility, /post_row\.privacy_type = 'friend_circle'/);
assert.match(visibility, /post_row\.privacy_type = 'only_me'/);
assert.match(visibility, /post_row\.privacy_type = 'tagged_family'/);
assert.match(visibility, /post_row\.privacy_type = 'selected_people'/);
assert.match(visibility, /is_active_family_tag_recipient/);
assert.match(visibility, /is_active_selected_memory_recipient/);
assert.match(visibility, /is_current_memory_friend_for_write[\s\S]*for update/);
assert.match(
  visibility,
  /v_is_friend := public\.is_current_memory_friend_for_write\(v_initial_baby_id\)/,
);
assert.match(visibility, /where post_row\.id = p_memory_post_id[\s\S]*for update/);
assert.match(visibility, /v_post\.privacy_type = 'friend_circle'[\s\S]*or v_is_friend/);
assert.match(visibility, /v_post\.privacy_type = 'tagged_family'[\s\S]*memory_tags[\s\S]*for update/);
assert.match(visibility, /v_post\.privacy_type = 'selected_people'[\s\S]*memory_selected_people[\s\S]*for update/);
assert.match(visibility, /memory_tags_insert_manager[\s\S]*recipient\.baby_id = parent_post\.baby_id/);
assert.match(visibility, /memory_selected_people_insert_manager[\s\S]*recipient_friend\.status is not distinct from 'active'/);
assert.match(visibility, /memory_comments_update_author[\s\S]*can_interact_with_memory_post/);
assert.match(visibility, /memory_comments_delete_author_or_post_owner[\s\S]*can_delete_memory_post/);
assert.match(visibility, /memory_reactions_delete_author[\s\S]*can_interact_with_memory_post/);

assert.match(recipientAssignment, /can_assign_memory_recipient_for_write/);
assert.match(recipientAssignment, /current_baby_write_permission\(v_initial_baby_id\)/);
assert.match(recipientAssignment, /from public\.memory_posts as post_row[\s\S]*for update/);
assert.match(recipientAssignment, /from public\.baby_members as recipient[\s\S]*for update/);
assert.match(recipientAssignment, /from public\.memory_friends as recipient_friend[\s\S]*for update/);
assert.match(recipientAssignment, /memory_tags_insert_manager[\s\S]*false/);
assert.match(recipientAssignment, /memory_selected_people_insert_manager[\s\S]*true/);

console.log("B0.4a-2/B0.4a-3 ownership and visibility source smoke passed");
