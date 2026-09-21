import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveInviteRowStatus, inviteSearchQueryReady } from "../src/utils/inviteSearchStatus.ts";

const emptySets = {
  familyIds: new Set<string>(),
  friendIds: new Set<string>(),
  outgoingUserIds: new Set<string>(),
  outgoingDarinIds: new Set<string>(),
  incomingUserIds: new Set<string>(),
};

const hit = { userId: "u-2", darinId: "jungmoon#0027" };

assert.equal(inviteSearchQueryReady(""), false);
assert.equal(inviteSearchQueryReady("정"), false);
assert.equal(inviteSearchQueryReady("정문"), true);
assert.equal(inviteSearchQueryReady("ab"), true);

assert.equal(resolveInviteRowStatus({
  hit: { userId: "me", darinId: "me#0001" },
  meId: "me",
  myDarinId: "me#0001",
  ...emptySets,
  canInvite: true,
}), "self");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  canInvite: true,
}), "invite");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  familyIds: new Set(["u-2"]),
  canInvite: true,
}), "family");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  friendIds: new Set(["u-2"]),
  canInvite: true,
}), "friend");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  outgoingUserIds: new Set(["u-2"]),
  canInvite: true,
}), "outgoing");

assert.equal(resolveInviteRowStatus({
  hit: { userId: "", darinId: "jungmoon#0027" },
  meId: "me",
  ...emptySets,
  outgoingDarinIds: new Set(["jungmoon#0027"]),
  canInvite: true,
}), "outgoing");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  incomingUserIds: new Set(["u-2"]),
  canInvite: true,
}), "incoming");

assert.equal(resolveInviteRowStatus({
  hit,
  meId: "me",
  ...emptySets,
  canInvite: false,
}), "hidden");

const share = readFileSync("src/screens/FamilyShareScreen.tsx", "utf8");
assert.doesNotMatch(share, /요청 보내기|요청 받기|연결된 사람/);
assert.doesNotMatch(share, /ShareTab|"enter"/);
assert.match(share, /InviteComposerSheet/);
assert.match(share, /searchInviteProfiles/);
assert.match(share, /sendDarinIdInviteRequest/);
assert.match(share, /SEARCH_DEBOUNCE_MS = 300/);
assert.match(share, /canInvite\(myFamilyRole\)/);
assert.match(share, /NotificationCenter/);

const composer = readFileSync("src/components/family/InviteComposerSheet.tsx", "utf8");
assert.match(composer, /invite-choice-family/);
assert.match(composer, /invite-choice-friend/);
assert.doesNotMatch(composer, /invite-role-/);
assert.doesNotMatch(composer, /FAMILY_ROLES/);
assert.match(composer, /role: "editor"/);
assert.match(composer, /family\.critical\.177/);
assert.match(composer, /family\.critical\.112/);

const people = readFileSync("src/components/family/FamilyPeopleManage.tsx", "utf8");
assert.match(people, /setBabyAccessPermissions/);
assert.match(people, /promoteBabyFullAdmin/);
assert.match(people, /removeFriend/);
assert.doesNotMatch(people, /updateMemberRole/);
assert.doesNotMatch(people, /ROLE_OPTIONS/);

const notice = readFileSync("src/screens/NotificationCenterScreen.tsx", "utf8");
assert.doesNotMatch(notice, /tab: "enter"/);
assert.match(notice, /respondToDarinIdInviteRequest/);

const rpc = readFileSync("src/repositories/FamilyRepository.ts", "utf8");
assert.match(rpc, /rpc\("send_darin_id_invite_request"/);
assert.match(rpc, /rpc\("respond_darin_id_invite_request"/);
assert.doesNotMatch(rpc, /status = 'cancelled'/);

const searchRpc = readFileSync("supabase/migrations/202609170004_search_invite_profiles.sql", "utf8");
assert.match(searchRpc, /search_invite_profiles/);
assert.match(searchRpc, /only baby admin can search invite profiles/);
assert.match(searchRpc, /limit 20/);
assert.match(searchRpc, /char_length\(v_query\) < 2/);
assert.match(searchRpc, /returns table \([\s\S]*user_id uuid,[\s\S]*display_name text,[\s\S]*darin_id text,[\s\S]*avatar_storage_path text/);
assert.match(searchRpc, /security definer/);
const searchSelect = searchRpc.slice(searchRpc.indexOf("return query"), searchRpc.indexOf("limit 20"));
assert.doesNotMatch(searchSelect, /email|phone|guardian_birth_date|residence_country|nickname/);

const sendRpc = readFileSync("supabase/migrations/202608170003_darin_invite_admin_guard.sql", "utf8");
assert.match(sendRpc, /if p_role not in \('admin', 'editor'\)/);
assert.match(sendRpc, /only baby admin can send requests/);

const familyAuth = readFileSync("src/types/family.ts", "utf8");
assert.match(familyAuth, /role === "owner" \|\| role === "admin"/);

console.log("Invite search QA smoke passed");
