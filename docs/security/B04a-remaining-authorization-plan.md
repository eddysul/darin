# B0.4a remaining P1/P2 inventory and implementation plan

Date: 2026-09-14. This is a post-P0 audit and plan, not a P1 deployment approval.

The Production-deployed P0-A and P0-B remain CLOSED. This task commits their source/tooling, rechecks current Production definitions read-only, and reproduces selected remaining findings in isolated local PostgreSQL. No QA/Production migration, resource mutation, Storage operation, notification delivery, or P1 policy fix was performed.

Evidence terminology:

- **LIVE**: current Production catalog, compared with the original B0.4 audit. Outside the four P0 RPCs/four media policies, the inspected existing authorization definitions are unchanged.
- **LOCAL**: direct SQL under `SET ROLE authenticated` plus synthetic `auth.uid()`, using captured actual policy/function definitions and relevant identity triggers. This exercises the database boundary used by REST, but is not an HTTP/PostgREST/JWT/Edge integration test.
- **DERIVED**: evaluated from policies, helpers, constraints and triggers; not an executed attack.
- **DECISION**: product semantics must be fixed before changing legitimate access.

Original evidence reviewed: `/tmp/darin-b04-audit-report.md` (§§4, 7–19, 34–43) and `/tmp/darin-b04-policy-inventory.md`. Retained current evidence is [authorization catalog](evidence/b04a-authorization-catalog-20260914.json). Reproducer: [local audit script](../../scripts/verify-local-b04a-remaining-audit.mjs). Its successful exit means **the listed existing vulnerabilities reproduced**, not that authorization is secure.

## 1. Provenance baseline commit

Commit A: `3aac4e8cbca38d891c82796043cd00c6e9f8773f` (`fix(auth): preserve deployed B0.4a P0 hotfix and verification`).

Exactly nine files: the deployed migration, P0 source smoke, local PostgreSQL runner/bootstrap/assertions, QA attack regression, QA and Production apply scripts, and the three `qa:b04a:p0*` package script additions. No P1 implementation is included. The worktree was clean immediately after this commit.

Migration SHA-256, equal in working tree and committed blob, and equal to the recorded Production deployment source:

`fcb21f49d626101d532df3a00c1f730ef8cbf4c1ff29e3c42f5be39f2fd929e2`

Read-only Production check: target applied; four RPC/four policy hashes still match the successful deployment/QA evidence; FK remains NOT VALID. Database migration history records a version/name, not the original file bytes, so deployment source provenance uses the recorded source digest plus deployed-definition equality, not a claim that the database stores the file SHA.

## 2. Remaining B0.4a P1 findings

Original audit IDs are retained; closed P0s and Storage/Notification findings are excluded.

| Priority | Original ID | Remaining authorization flaw | Evidence and limits |
|---|---|---|---|
| 1 | P1-8 | `respond_darin_id_invite_request` accepts a live request after the sender loses admin authority; may grant admin or memory-friend access | LIVE + LOCAL: real current sender RPC creates family/admin request, a second admin demotes sender to viewer, intended receiver accepts and becomes active admin. Requires a previously legitimate request; not the closed non-member code-invite exploit. Removed-sender/friend/race branches still need regression tests. |
| 2 | P1-3 | Author-only helpers preserve Memory read/manage/soft-delete and Diary soft-delete after membership removal; viewer demotion also leaves own-author privileges | LIVE + LOCAL: removed author cannot SELECT Diary but soft-deletes it; removed author reads and soft-deletes own only_me Memory. Explicit grant retention and viewer transitions additionally DERIVED. |
| 3 | P1-1 | Editors modify/delete other authors' Care/Growth records; existing row can move between babies where actor has editor permission | LIVE + LOCAL Care UPDATE, DELETE and baby reassignment succeed. Growth equivalent is DERIVED. Unauthorized target baby still fails role checks; this is not unrestricted global reassignment. |
| 4 | P1-6 | Friend-visible contributor exposes the whole allowed `profiles` row, including guardian birth date/residence country | LIVE original column/policy inventory and current identical predicate. No real profile data read. RLS filters rows, not private columns. |
| 5 | P1-4 (DB portion) | Shared posting/failed Memory content can be read through direct IDs before publish | LIVE + LOCAL viewer reads posting family_circle row. Failed state follows same missing predicate, not separately exercised. Media/provider readiness is deferred to B0.4b. |
| 6 | P1-5 | `family_member` approved tag can name a non-member; tagged_family visibility trusts that tag without active family check | LIVE + LOCAL admin inserts outsider family tag; outsider then SELECTs the tagged_family post. A post manager is required to create this grant; outsider cannot tag arbitrary victim posts. |
| 7 | P1-7 | Growthbook page/media/comment parent comparisons resolve to inner-column tautologies; comment identity/scope updates lack full graph validation | LIVE current policy/constraint/trigger analysis. Not runtime-reproduced here and no claim of confirmed cross-account media download. |
| 8 | P1-7 (role portion) | Viewer can create/update caution-food rows and create Growthbook/Memory comments; caution-food ownership UPDATE not bound; baby profile permits editor management | LIVE. Strict viewer read-only/admin baby-management baseline differs from current behavior. Own-comment behavior after demotion needs actual RLS tests. |
| Follow-up | P1-11 (data portion) | Account deletion clears relational creator but leaves embedded Care payload creator metadata | Original LIVE/SOURCE evidence. Privacy erasure concern adjacent to B0.4a, not a demonstrated cross-account ACL bypass; do not mix account deletion/Storage redesign into batch 1. |

These are remaining original findings, not new P0s. Targeted invite P1-8 has high impact but requires pre-existing authorized issuance, hence retains its original priority classification. No evidence of real exploitation was collected.

## 3. Remaining B0.4a P2 findings

- Original audit input-validation/error-hygiene item: invalid UUID casts and RPC error messages need a bounded API contract. Do not label normal 22P02 rejection alone as a leak; record only demonstrated sensitive error exposure. No new such exposure was reproduced here.
- Diary shared-family versus private-first, selected_people allowed recipient set, friend comments, and retention of independently granted friend access after family removal need explicit contracts. These are implementation prerequisites, not invented confirmed escalation findings.
- Existing admin/author-only visibility asymmetry and targeted-invite reactivation can conflict with identity/role triggers. Preserve rejection behavior until positive controls define the intended workflow; do not disable `baby_member_role_guard` to make acceptance succeed.
- Historical role-at-issuance evidence is not generally reconstructible from current rows; do not infer past abuse from current role alone.
- P0 uncommitted-source provenance gap is resolved by Commit A. QA's intentionally pending notification migrations remain a separate, known operational disposition, not an authorization repair in this plan.

## 4. Affected tables and current actor matrix

No family/household table exists. Authority comes from active `baby_members`; `babies.created_by` is not an independent owner role. UI owner maps to DB admin; caregiver maps to editor. Relationships such as parent/sitter are not permission roles. Reports read underlying Care/Growth data; there is no standalone report table.

A=admin, B=editor, C=viewer, D=active memory friend without family membership, E=unrelated authenticated, F=removed former member. `V` means exact visibility predicate; `own` means resource author; `sd` means soft-delete RPC. Independent explicit grants are stated separately.

| Current resource/action | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Care/Growth | R/C/U/D | R/C/U/D, including others | R | deny | deny | deny |
| Diary | R/C/U/sd | R/C, own U/sd | R; prior own-author U/sd exception | deny | deny | SELECT denied; own sd succeeds |
| Memory | V read/C; manage includes admin | V read/C; own U/D/sd | V read; prior-author U/D exceptions | friend_circle read; separately granted visibility | deny without explicit grant | own or surviving explicit grant read; own U/D/sd |
| Memory comments | V read/create; own U, moderator D | V read/create; own U/D | V read/create; own U/D | shared-post read/create; own U/D | deny without relation/grant | surviving grant may permit R; C requires active member/friend; U/D depend on SELECT and author predicates |
| Growthbook comments | R/C; own/admin U/sd | R/C; own U/sd | R/C; prior-author U exception | deny | deny | general R denied; RPC author exceptions need runtime test |
| Family membership | R/C/U/D | R, own row U (role/identity trigger limits) | same self-row exception | deny | deny | generally R denied; self-reactivation is not proven |
| Baby management | R/C/U/D in authorized scope | R/U, can create own separate baby | R | deny for managed baby | can create own separate baby, not manage victim | denied for removed baby |
| Code invitations | admin create/list/add; accept checks current issuer | no baby invite management | no | no | no | no; P0 stays closed |
| ID request acceptance | authorized send; receiver-only accept | cannot send as baby admin | cannot send as baby admin | intended receiver can accept | intended receiver can accept | old authorized sender's pending request still usable (P1-8) |
| Sharing/tags/grants | manages authorized post | own-post manager | no general management; prior-author exception | no general management | no general management | former-author manager exception |

Affected tables: `care_logs`, `growth_records`, `diary_entries`, `memory_posts`, `memory_comments`, `memory_tags`, `memory_selected_people`, `profiles`, `baby_members`, `babies`, `darin_invite_requests`, `memory_friends`, `growth_books`, `growth_book_pages`, `growth_book_media`, `growth_book_comments`, `baby_caution_foods`. `diary_media` and closed-P0 `memory_media` are regression dependents, not reasons to change Storage ACL here.

## 5. Affected policies

Exact USING/WITH CHECK expressions are in the retained catalog.

| Area | Policies to review/change in its batch |
|---|---|
| Care/Growth | `care_logs_update_editor`, `care_logs_delete_editor`, `growth_records_update_editor`, `growth_records_delete_editor`; INSERT/read policies remain positive/negative controls |
| Diary | `diary_entries_update_author_admin`; visibility and create policies for scope compatibility |
| Memory | `memory_posts_select_visible`, `memory_posts_update_author_or_admin`, `memory_posts_delete_author_or_admin`; author OR in policy must be fixed alongside helper, not helper alone |
| Comments | `memory_comments_insert_member`, `memory_comments_update_author`, `memory_comments_delete_author_or_post_owner`; Growthbook `growth_book_comments_*` |
| Tags/grants | `memory_tags_insert_manager`, `memory_tags_delete_manager`, `memory_selected_people_insert_manager`, `memory_selected_people_delete_manager` |
| Profile | `profiles_select_own_or_shared` plus table/column grants and narrow public-profile projection |
| Growthbook graph | `growth_book_pages_insert_editor`, `growth_book_media_insert_editor`, `growth_book_comments_insert_member`, `growth_book_comments_update_author_admin` |
| Other roles | `baby_caution_foods_insert_member`, `baby_caution_foods_update_member`, `babies_update_admin_or_editor`; member self-update requires a column/role contract, not blanket deletion of self-service |

## 6. Affected RPC/functions

First batch: `respond_darin_id_invite_request`; current sender and role guard are test dependents.

Later: `can_edit_care_logs`, `can_edit_growth_records`, creator/identity helpers; `can_manage_diary_entry`, `soft_delete_diary_entry`; `can_view_memory_post`, `can_manage_memory_post`, `can_delete_memory_post`, `can_interact_with_memory_post`, `soft_delete_memory_post`; Growthbook read/edit/soft-delete and graph/identity helpers; `is_friend_visible_memory_contributor` and a narrow profile projection. `prepare_account_deletion` data minimization is separately scoped.

RPC inventory: baby permission/member helpers derive current active membership; create-baby verifies auth then creates own scope; code invite RPCs have closed P0 guards; ID sender is null-safe, receiver checks user/status/expiry/request lock but not current sender role; list-my request RPCs scope to caller; author-based soft-delete helpers can bypass RLS; identity triggers protect selected immutable columns but not current membership. Business SECURITY DEFINER functions use fixed public search_path. Trigger/event-trigger functions are not ordinary callable RPCs merely because EXECUTE appears in catalog. No blanket SECURITY DEFINER bypass exception is proposed.

## 7. Care Log permission gaps

`can_edit_care_logs(baby_id)` admits any active admin/editor. UPDATE/DELETE do not bind editor to row `created_by`. UPDATE has WITH CHECK, but it only rechecks destination baby role and unchanged creator. Therefore dual-baby editor can relocate an existing row. `src/types/family.ts` own-only UI cannot protect REST.

Keep active member reads; admin broader writes; editor own non-null creator writes. NULL creators stay admin-managed. New-row creator stays `auth.uid()`; add an immutable baby/ID/creator invariant. Apply same contract to Growth and Voice-created Care rows. Denial tests must show unchanged row contents, not just HTTP error.

## 8. Diary permission gaps

Current server Diary is family-readable, not author-private. It has no server visibility field that can simply be switched to only_me. Do not silently hide seven existing diaries from valid family members. Preserve family read for this hardening plan; changing Diary privacy requires a separate explicit schema/product contract.

Active member SELECT blocks removed author, but author-only SECURITY DEFINER management and soft-delete still succeed. Active viewer who was an author can retain writes. Keep immutable baby/author/ID triggers and add active role predicates to both direct UPDATE and RPC.

## 9. Memory permission gaps

Current visibility: family_circle=member; friend_circle=member or active memory friend; only_me=author; tagged_family=approved family tag; selected_people=explicit user grant. Author bypass precedes these checks. Deleted_at is enforced, publication state is not. Both helper and outer policy author paths must be considered.

Target: shared reads require published status and current authorized relation; own draft/failed reads only for an active permitted author. Active admin management does not automatically imply reading others' only_me posts; preserve this distinction and test it. Closed P0 parent-scope/FK stays unchanged.

## 10. Friend-boundary gaps

Ordinary friend IDs do not independently unlock family-only/only_me/excluded selected_people/Care/Diary/Growth/Reports. Family tag and explicit-grant paths can override normal relation requirements. Profile contributor predicate grants whole rows rather than a minimal display/avatar projection.

Plan a safe-profile DTO/RPC/view and restrict the base table so sensitive columns cannot still be fetched directly. A broad permissive base SELECT policy left in place would defeat a new projection. Verify actual clients' field needs before revoking base grants.

## 11. Removed-member gaps

Care/Growth/Diary normal reads consult current active membership and deny after removal. Memory author/explicit grants and author-based RPCs do not uniformly do so. Removal does not automatically revoke independent `memory_friends`, tags, or selected_people rows. Default hardening should revoke family-derived access immediately; a separately valid friend grant can only survive under an explicit product contract. Storage URL revocation is deferred.

## 12. Role-transition gaps

JWT role cache is not the identified issue: `baby_permission` reads the live row. Problems are author branches that skip role checks and saved invitation authority. Test admin→editor/viewer, editor→viewer, and removal with the same authenticated session. Preserve own-profile/self-label updates separately from membership administration. Do not claim self-reactivation succeeds without testing SELECT RLS and trigger interaction.

## 13. INSERT ownership gaps

Care/Growth creator, Diary/Memory author and Memory comment author are generally bound to auth.uid. Tags bind creator but not family-tag recipient relation. Selected_people validates post manager but not recipient relation. Growthbook has independent parent FKs plus tautological joins; caution-food viewer can insert despite strict read-only baseline. `babies_insert_authenticated` creates a user's own baby; that alone is not a victim-baby escalation.

## 14. UPDATE/WITH CHECK gaps

WITH CHECK exists on Care/Growth but does not make baby immutable. Diary/Memory identity triggers already prevent baby/author moves. Growthbook comments and caution foods need explicit immutable identity/graph checks. A catalog NULL WITH CHECK does not automatically imply no check: PostgreSQL may reuse USING. Assess each complete policy/trigger path.

## 15. DELETE gaps

Care/Growth editors can delete others' records. Author RPCs allow removed/demoted authors. Enforce active admin OR active editor+own at both SQL mutation and RPC boundary. Comments need an explicit own-delete/moderation rule; the requested viewer read-only baseline wins over historical comment write behavior until separately changed. Friend comment deletion is a product-contract item, not permission to manage family resources.

## 16. Comments gaps

Memory read follows parent visibility and create checks active member/friend; viewer create conflicts with baseline. Own U/D lacks an explicit current-role predicate; removed access requires full RLS execution before broad claims. Parent/author/comment type identity guards already exist. Growthbook comments admit viewer create, have incomplete parent graph checks and no equivalent identity guard. Test parent access loss, deletion, scope reassignment and moderator permissions together.

## 17. Tag gaps

Approved family-member tag must refer to an active member of the parent post's baby, not merely any profile UUID. Test both new tag insertion and a recipient later removed/demoted. Existing selected_people rows=0; choose active members plus explicitly approved baby friends as the proposed eligible set, preserving explicit per-post opt-in and only_me isolation. Arbitrary outsider invitation is not silently implemented.

## 18. Invitation/sharing residual gaps

P1-8 is the targeted ID request path, not `accept_invite_code`. Receiver equality, pending state, expiry, request row lock and replay prevention are present. Sender current authority and its transaction lock are absent. A permitted client-supplied role under valid admin issuance is not itself escalation.

Code invitation remains bearer-by-design, with existing expiry/max-use/issuer checks. Receiver binding for code invitations is a future product decision, not an invented remaining P0. Return/result signatures, decline handling and notification side effects must remain compatible.

## 19. Direct-ID attack results

Local PostgreSQL 16.11 captured-definition probes, 15 assertions/observations, completed successfully:

| Probe | Current result |
|---|---|
| Editor UPDATE another author's Care ID | 1 row changed (P1-1) |
| Editor reassign Care to another baby where also editor | 1 row changed (P1-1) |
| Viewer Care SELECT / UPDATE | read 1 / change 0, expected controls |
| Unrelated Care SELECT | 0, expected control |
| Editor DELETE another author's Care ID | 1 row deleted (P1-1) |
| Viewer SELECT posting family Memory | 1 row (P1-4) |
| Unrelated SELECT family-only Memory | 0, expected control |
| Admin INSERT outsider approved family tag | succeeds (P1-5) |
| Tagged outsider SELECT tagged_family post | 1 row (P1-5) |
| Removed author SELECT Diary / call soft-delete | read 0 / RPC changes deleted_at (P1-3) |
| Removed author SELECT only_me Memory / call soft-delete | read 1 / RPC changes deleted_at (P1-3) |
| Valid admin sends ID admin invite, second admin demotes sender, receiver accepts | receiver gains active admin (P1-8) |

Limits: reduced synthetic supporting schema, actual relevant policies/helpers/identity triggers; notification side effect is a local table sink, no production notification triggers/Edge. Real JWT/REST, Growthbook graph, private-profile SELECT, viewer comment/caution writes, removed-ID issuer/friend branch, comprehensive concurrency and all role combinations were not re-executed. These are required batch tests, not asserted PASS. First probe attempt hit a fixture error (superuser-without-auth demotion rejected by role trigger); rerun used an authenticated second admin and completed. This was not an application fix.

## 20. P0 regression status

Commit source hash and current Production RPC/policy hashes match deployed evidence. `qa:b04a:p0`, `qa:b04a:p0:local-postgres` (two applications plus lock regression), `qa:secrets`, and diff checks pass. Previous QA authenticated attack matrix remains applicable because the P0 source is unchanged. QA attack script was not rerun remotely in this task. Never replace P0 regression tests with this vulnerability reproducer.

## 21. Recommended P1 priority order

1. Targeted ID request stale authority and grant race (P1-8).
2. Active-scope author management plus Care/Growth destructive mutation ownership (P1-3/P1-1).
3. Profile column privacy and unpublished Memory read (P1-6/P1-4).
4. Tag relation, Growthbook graph integrity and strict read-only roles (P1-5/P1-7).

This prioritizes current grants and destructive operations before product-dependent sharing/UI refinements. A confirmed new unrestricted cross-account P0 would supersede the order; none was established here.

## 22. Proposed implementation batches

| Batch | Small boundary | Production candidate rows (read-only snapshot) | Migration safety |
|---|---|---|---|
| B0.4a-1 | Targeted ID acceptance current-admin + lock | `darin_invite_requests` 0, live pending 0 | One existing RPC replacement; no schema/data/notification policy change; no FK needed |
| B0.4a-2 | Care/Growth own+active invariants; Diary/Memory author mutation after removal/demotion | Care 142, Growth 2, Diary 7, Memory 6; NULL Care/Growth creator 0; live nonmember authors 0 | Atomic helper/policy/identity changes; preserve read semantics and RPC signatures; no destructive backfill |
| B0.4a-3 | Memory published/read boundary + safe profile projection | Memory 6, shared unpublished 0; profiles 749 | Coordinate client field compatibility and safe projection/base grants; no blanket public profile policy; no FK needed |
| B0.4a-4 | Tags/selected grants, comments, Growthbook graph, remaining viewer/baby-management role restrictions | Tags 6, selected 0, Memory comments 0; books 3/pages 9/media 41/comments 2; caution-foods 0 | Fully qualified parent checks; graph constraints where needed NOT VALID first; preflight/forward-fix; keep unrelated Storage operations out |

Counts are totals exposed to changed policies, not counts of confirmed victims. Current outsider-family tags and Growthbook graph mismatches are 0. Re-run preflight immediately before each rollout; later data can differ.

## 23. Batch 1 exact scope

Modify only the acceptance authorization of `respond_darin_id_invite_request(uuid, boolean)` plus focused tests.

Sequence: authenticate → lock matching intended receiver's pending request → validate expiration/type → if accepting, lock sender's matching baby_members row with `FOR UPDATE`, requiring active/current admin → grant → retain existing request/result/notification behavior → commit. NULL/missing/inactive/demoted sender fails closed before any grant or side effect. Declining must remain possible even if sender lost authority. Request lock then membership lock order is documented and exercised against real demotion/removal transactions.

Do not alter the four closed-P0 RPCs or four media policies, grant global trigger bypasses, rewrite notification copy/recipients, widen receiver roles, or mass-revoke historical requests. Keep parameter names/defaults/return shape/EXECUTE ACL/search_path compatible. Existing membership reactivation must obey role guard; test its current rejection/success before choosing a narrow secure behavior.

## 24. Batch 1 migration risk

At snapshot time there are no targeted request rows; active sender population and future pending requests still require a preflight at deploy time. New rejection of stale requests is intended. FK/NOT VALID not needed. A single CREATE OR REPLACE FUNCTION with unchanged signature, ACL preservation and exact definition checks fits one transaction. Bounded lock/statement timeouts and queue contention tests are required. Failed migration rolls back; post-commit regression uses secure forward-fix or isolates acceptance, never restores stale-authority grant behavior.

Re-run read-only counts by pending/expired/type/role, issuer active/admin and receiver membership conflict before QA/Production rollout. No data repair is approved by this plan.

## 25. Batch 1 tests

- Positive current-admin family/editor, family/admin and friend requests; intended receiver receives exact approved scope/role.
- Non-member sender, removed sender, inactive sender, admin→editor/viewer; zero new grants, request mutations or notification side effects on rejection.
- Wrong authenticated receiver, wrong baby, non-existent request, NULL parameters, expired/cancelled/declined/accepted request and replay.
- Acceptance racing demotion/removal in both orders; deterministic barriers, not sleep-only scheduling. Sender loses authority first → reject; acceptance locks valid authority first → authorized grant commits before demotion. Recheck max/duplicate acceptance outcomes.
- Decline after sender removal succeeds without granting access. Existing membership/reactivation/role-trigger conflicts never create escalation.
- Receiver cannot spoof request role/baby/sender via direct INSERT/PATCH/DELETE; direct request SELECT remains related-only.
- Existing P0 source/runtime suite, exact code-invite `FOR UPDATE`, current-admin revalidation and media cross-baby matrix remain required.
- Local PostgreSQL actual RLS/RPC suite first; then separately authorized QA REST/JWT attack test and migration/aggregate gate. Production-safe definition/integrity proof only after QA pass.

## 26. Later batches

Every later fix needs authorized own/admin positive controls, unrelated direct-ID reads/writes, wrong role/baby, same-token removal/demotion, forged creator/author, old/new scope updates, destructive DELETE denial and unchanged-row assertions. Include P0 regression in every batch.

Batch 2: test NULL creators/admin repair access without fabricating users, same-family versus other-baby writes, private/shared Diary contract, report/Voice persistence and legacy clients. Batch 3: all five visibilities × published/posting/failed × A–F, private-profile column denial and needed profile display fields. Batch 4: parent book/page/baby mismatch matrices, comment/role transitions, grant recipient eligibility and revocation; preflight all graph orphan/NULL/mismatch counts before constraints. NOT VALID is not a permission bypass for new rows and is not auto-validated in the same task.

`prepare_account_deletion` payload anonymization remains a separate small data-minimization contract after these authorization changes; do not claim whole-account erasure or asset deletion is fixed by RLS hardening.

## 27. Deferred B0.4b items

Original P1-2 temp uploader/claim and finalized temp ACL, P1-4 media-ready portion, P1-9 signed URL/cache lifetime, P1-10 global temp cleanup/storage.objects SQL deletion, P1-11 asset coverage; public/bucket policies, signed URL revocation, media lifecycle and partial cleanup. No fixes in this task.

## 28. Deferred B0.4c items

Original P1-12 resource/recipient/event validation and stale dispatch, P1-13 device token ownership/account switch; push payload, delivery observability/dedupe and QA notification constraint drift. Existing notification statements within ID acceptance remain a compatibility dependent, not permission to redesign notification policy.

## 29. New P0

None established. P0-A and P0-B remain CLOSED. Remaining original P1s are not described as universally secure, and this report does not close B0.4a as a whole. No real-user exploitation, full HTTP matrix, or Storage/Notification security completion is claimed.

## 30. Recommendation

Start B0.4a-1 with targeted ID invitation acceptance and its exact tests. Submit this inventory/contract before changing policies; no P1 fix or new migration has been authored here. Keep Commit A immutable; follow-up tests/docs and future fixes belong in later commits. Production/QA, B0.3, EAS and mobile configuration were not modified.

## 31. Verdict

`B0.4a P1/P2 AUDIT COMPLETE — READY FOR FIRST HARDENING BATCH`
