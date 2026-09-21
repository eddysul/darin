# Account deletion: implementation and deployment verdict

**Verdict: Production backend deployed; mobile app release pending.** The new flow passed synthetic local/QA tests. On 2026-09-17, Production received only the two account-deletion migrations and the `delete-account` Edge Function. A post-deployment read-only check passed. No real Production account deletion or Storage worker invocation was used as a canary, so signed-in end-to-end behavior in Production remains untested. The client error and local-session improvements remain local until a reviewed app build is released.

QA separately contains 28 pre-existing admin-less baby spaces. One retains an active member and three care logs. These rows have no recorded `created_by`, so ownership cannot be inferred safely. They were not created by this test run; the synthetic baby count returned to zero and the admin-less count remained 28. Do not automatically delete or transfer these spaces. The Production preflight found 32 admin-less spaces, but none has any membership or care/diary/memory/growth content; it found zero active admin-less spaces. These legacy rows were not remediated by this deployment.

## Reproduced failure and exact stage

The client validates `삭제`, calls `delete-account`, and the Edge Function authenticates the session, runs `prepare_account_deletion()`, then calls server-side `auth.admin.deleteUser()`. The original RPC committed successfully. Auth deletion failed while cascading `auth.users` → `profiles` because `baby_caution_foods_created_by_fkey` was `ON DELETE RESTRICT` on a non-null `created_by` column: SQLSTATE `23503`, HTTP 500. A QA rollback probe replacing only the FK exposed the second blocker: `baby_caution_food_identity_guard()` rejected FK nulling with SQLSTATE `42501`. The client collapsed the HTTP error into a generic message. The earlier RPC could already have removed the last admin membership, leaving a partial deletion.

## Policy and implementation

When another active admin remains, the baby space and its content remain; the departing user's membership, relationships, notifications, push token, profile and Auth account are removed, and surviving authorship is anonymized by the existing FK/cleanup behavior. When the departing user is the last active admin, the entire baby space is deleted even if viewer, editor or friend accounts remain. Those other accounts remain. A non-admin departure removes only that user's relationships. The RPC locks each baby before rechecking its active admins, then uses the existing baby cascades and Storage delete triggers. All direct QA FKs to `babies` use `ON DELETE CASCADE`; post/media descendants cascade through their parents. `media_temp_claims` has no baby FK, so its deleted-baby rows are removed after the Storage triggers inspect them. Surviving claims anonymize the deleted uploader.

Forward migrations:

- `202609170005_account_deletion_lifecycle.sql`: nullable caution `created_by`, `ON DELETE SET NULL`, trusted FK-nulling identity guard, deletion lifecycle RPC, unattached uploader-owned object retirement, and claim anonymization.
- `202609170006_account_deletion_legacy_retry.sql`: recognizes an orphaned baby created by the still-authenticated user after the former RPC removed that user's last-admin membership, then deletes that space on retry. It does not guess ownership of creator-null legacy spaces.

The identity guard still rejects a direct `created_by` change (`42501`), baby ID change, and other identity changes. No RLS policy, bucket privacy setting, API data model, or client-side service-role access was weakened. All five private media buckets remained non-public in the QA read-only audit.

The Edge Function returns stable `INVALID_CONFIRMATION` (400), `UNAUTHORIZED` (401), and `ACCOUNT_DELETION_TEMPORARY_FAILURE` (503) codes, or `{deleted:true,mediaCleanupPending:true}` (200). A 409 `ACCOUNT_DELETION_IN_PROGRESS` is reserved in the client type but is not emitted because no durable in-progress state exists. Server logs contain only stage, stable code, and PostgreSQL code. The Edge request no longer calls Storage remove; deletion triggers create durable queue intents and the scheduled worker processes them asynchronously. The client attempts local cleanup after server success and still removes the local session/routes to Auth if local cleanup fails, showing a separate local-data warning. Account deletion policy copy was updated in all five locales.

## QA results

| Case | Result | Evidence |
| --- | --- | --- |
| A no baby/family | PASS | Auth/profile removed; invalid confirmation returns 400 code |
| B ordinary member | PASS | Only member removed; baby/admin/content preserved |
| C friend only | PASS | Friend relation removed; original baby/admin preserved |
| D another admin | PASS | Baby, care, diary, memories retained; surviving admin remains |
| E last admin + viewer/editor | PASS | Baby and scoped rows deleted; both other accounts remain; old link unavailable; actual attached media row removed and key queued |
| F last admin + friend | PASS | Baby and share removed; friend account remains; old memory link unavailable |
| G sole admin/member | PASS | Entire baby space removed |
| H caution food author | PASS | Direct identity update denied (`42501`); Auth deletion succeeds; surviving caution food retains content with NULL author |
| I Auth failure after RPC | PASS | Manual RPC commit followed by repeat RPC and Edge deletion; no double cascade; no synthetic admin-less space |
| I legacy partial retry | PASS | Former last-admin membership removal simulated; creator retry deletes orphan baby safely |
| J Storage remove failure | PASS | HTTP deletion succeeds; durable queue remains; synthetic failed/expired lease is eligible for worker retry |
| K repeated request | PASS | Deleted-user token returns 401; no unrelated account/resource mutation |

The updated existing `verify-supabase-account-deletion.mjs` also passed on QA, including contact RLS, push/notification cleanup, and last-admin content cascade. `tsc --noEmit`, `git diff --check`, JavaScript syntax checks, and the B0.4b Storage failure/retry smoke passed. The repository-wide i18n coverage check still fails on the pre-existing unrelated Spanish fallback `es:report.critical.130`; all reachable keys are present, and TypeScript checks the new locale keys.

## Files changed for this fix

- Server: `supabase/functions/delete-account/index.ts`; forward migrations `supabase/migrations/202609170005_account_deletion_lifecycle.sql` and `supabase/migrations/202609170006_account_deletion_legacy_retry.sql`.
- Client/session and policy text: `App.tsx`, `src/context/AppContext.tsx`, `src/context/LogoutContext.tsx`, `src/repositories/AuthRepository.ts`, `src/screens/tabs/MenuScreen.tsx`, `src/utils/accountDeletion.ts`, `src/i18nSettingsCriticalMessages.ts`.
- QA, Production deployment, and documentation: `scripts/apply-qa-account-deletion.mjs`, `scripts/deploy-qa-account-deletion.mjs`, `scripts/verify-qa-account-deletion-lifecycle.mjs`, `scripts/verify-supabase-account-deletion.mjs`, `scripts/b04b-storage-smoke.mts`, `scripts/inspect-production-account-deletion.mjs`, `scripts/deploy-production-account-deletion.mjs`, `scripts/deploy-production-account-deletion-function.mjs`, `scripts/verify-production-account-deletion.mjs`, and this report. The earlier failure report only received a note that its old policy recommendation was superseded.

## Production deployment and verification

The Production preflight checked the existing private Storage buckets, scheduled cleanup job, FK shape, and admin-less baby-space inventory. Migration `202609170005` and `202609170006` were applied together with migration-history entries; the SHA-256 manifest of the QA-reviewed pair was `a9259dc8e1959e7ab7fd796a30ca6373a922e102cfa465ff2b1f7e22ac80d36f`. Only the `delete-account` Edge Function was deployed from source SHA-256 `93ab4f1ac69a7d3ea9315b66fd277ecdc71c2f5c90638d680df4523c29143cc9`.

The read-only post-deployment check found both migrations recorded, nullable caution-food author, `ON DELETE SET NULL` FK, legacy-retry RPC, zero active admin-less spaces, zero public private-media buckets, and one active scheduled Storage cleanup job. The `delete-account` function was `ACTIVE` at version 7. Its gateway JWT verification setting was reported as `false`; the handler itself requires a bearer token and verifies it with `auth.getUser()` before the user-scoped RPC. No gateway setting was changed deliberately, and its earlier value was not established. The Production client uses a publishable key, for which gateway JWT verification is not the sole authentication boundary.

No worker POST or actual Production user deletion was executed in verification. An automated approval review rejected the legacy Storage verification script because it would POST to the Production cleanup worker and could process queued object deletions. The replacement checks read only database metadata and function status; they do not prove a physical delete cycle. The existing scheduled worker remains enabled.

The app uses a store-distributed EAS production build and has no configured Expo Updates URL/runtime. Therefore the local client changes are **not yet installed on users' devices**. The working tree also contains many unrelated unreviewed app changes, so it was not submitted as a Production mobile build with this backend rollout.

## Residual risks and follow-up

The RPC and Auth Admin call remain separate transactions. A temporary Auth failure can leave an authenticated account after DB preparation; retry is idempotent for the new flow and for the identified creator-linked legacy state. Creator-null older orphan spaces cannot be linked to a deleting account safely, and no durable `account_deletion_state` journal was added. Concurrent duplicate HTTP requests may yield one success and one retryable error, although database cascades are safe. A durable journal and explicit recovery procedure remain follow-up work.

QA and Production now have migrations 005 and 006 and the updated `delete-account` Edge Function. Existing unrelated worktree edits were preserved. The 28 pre-existing QA admin-less baby spaces still require a reviewed remediation plan, especially the one with an active member and three care logs. Release the app-side error and logout improvements from an isolated, reviewed mobile build; do not include unrelated dirty-tree changes by accident.
