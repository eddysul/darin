# B0.4b Storage security rollout

Baseline: `fc9c3609fccb21d96abbea8ecc0b9912ff3e7c18`.
Scope: reviewed source, local runtime validation, QA deployment/attacks and
Production deployment. B0.4a authorization functions remain authoritative.
QA and Production use the same reviewed migration and Function manifests.

## Findings and disposition

| ID | Severity | Baseline evidence | Local disposition |
|---|---|---|---|
| S1 | P1 | Storage API reproduced another editor downloading and claiming an exact temp path | Require server-assigned `owner_id`, current membership, completed upload and baby binding |
| S2 | P1 | `can_write_temp_media_path` permissive branch bypasses parent visibility even after linking | Restrictive resource-bound policy; immutable temp claim survives DB deletion; only ready parent-authorized rows are readable |
| S3 | P1 | Memory signed URL cache returns by path/width before RLS, across account/scope changes; sticker TTL was 24h | Remove cache bypass, reauthorize each mint, sticker TTL 180s; clamp client TTLs |
| S4 | P1 | Any authenticated caller could invoke global metadata-only temp DELETE | Revoke old RPC; replace body with no-op; service-only bounded expiry queue, API deletion and lease acknowledgement |
| S5 | P1 | Account deletion removed bytes using pre-transaction membership snapshots | Only actual DB deletions enqueue intents; shared resource retained by B0.4a produces no deletion intent; synthetic membership-arrival scenario tested |
| S6 | P1 | An uncompleted upload could be attached/marked ready, and byte-first deletion could leave false-ready references after DB failure | DB trigger requires existing Storage metadata; await upload; DB-first deletion with durable cleanup intent |
| S7 | P1 hardening | Eager upload/cleanup used mutable shared client authentication | Capture account in job; validate before/after upload; pin JWT to short-lived non-persisting client, including cleanup/status writes. SDK-level stub test verifies A does not adopt B's token |

No unauthenticated public-child-media P0 was reproduced. All five deployed buckets
are private. The reviewed boundary is deployed to QA and Production.

## Bucket inventory (read-only 2026-09-15)

| Bucket | Public | Limit | Existing MIME constraint | QA objects | Production objects |
|---|---|---|---|---:|---:|
| memories | false | 25 MiB | none → local image allow-list | 13 | 77 |
| diary-media | false | 25 MiB | JPEG, PNG, HEIC, HEIF, WebP | 0 | 6 |
| growth-book-media | false | 25 MiB | same image list | 0 | 41 |
| baby-stickers | false | 10 MiB | PNG | 0 | 0 |
| profile-media | false | 5 MiB | none → local image allow-list | 4 | 27 |

No additional/unused buckets were returned. A zero count is not evidence that the
feature is unused. Limits are Storage-server bucket limits, not only picker limits.
MIME is declared metadata: this work does **not** prove image decoder/magic-byte
validation, malware scanning or metadata stripping. These remain P2 hardening.

## Caller and path inventory

| Resource | Source | Path | Writes / reads / deletes |
|---|---|---|---|
| Memory | `src/repositories/MemoriesRepository.ts` | `{baby}/{post}/{media}.jpg` | upload; DB attachment; signed single/transform URLs; DB-first delete |
| Diary | `src/repositories/DiaryRepository.ts` | `{baby}/{entry}/{media}.jpg` | upload; attachment; signed batch/single; DB-first delete |
| Eager Memory/Diary | `src/utils/eagerMediaUpload.ts` | `{baby}/temp/{session}/{media}.jpg` | upload, retry/info, cancel/remove, status writes |
| Growthbook | `src/repositories/GrowthBookRepository.ts` | `{baby}/{book}/{page}/{media}.{image-ext}` | upload, DB attachment, signed batch/single, failure remove |
| User avatar | `src/repositories/ProfileRepository.ts` | `users/{user}/avatar.{image-ext}` | upload/upsert, profile update, signed URL, failure remove |
| Baby avatar | `src/repositories/BabyProfileRepository.ts` | `babies/{baby}/avatar.{image-ext}` | upload/upsert, baby update, signed URL, failure remove |
| Stickers | `src/repositories/BabyStickerRepository.ts` | `{baby}/{sticker}.png` | upload/upsert, row upsert, signed batch/single, failure remove |
| Account deletion | `supabase/functions/delete-account/index.ts` | resolved only from DB deletion intents | verified user JWT; prepare DB deletion; delete Auth user; bounded queue drain |
| Maintenance | `supabase/functions/storage-cleanup/index.ts` | service-only queue entries | queue expired temps; lease; Storage API remove; acknowledge |

The repositories' callers include Memory detail/edit/feed, Diary hydration and
Growthbook hydration. No application `getPublicUrl`, direct Storage REST download,
move or copy caller was found. Tests exercise move/copy directly as attacker APIs.
UUIDs and filenames are client-selected; authorization is **not** inferred from
those strings. Canonical syntax + actual parent/current B0.4a relationship +
server-set uploader identity determine authority. No family-ID path namespace exists.

Canonical keys reject dots outside the extension, traversal, percent escapes,
backslashes, empty segments and Unicode filenames. Final parent positions are
validated. This intentionally supports current generated paths, not arbitrary
user filenames. Production preflight found zero noncanonical object keys,
nonstandard avatars or non-image declared metadata among existing objects.

## Policy matrix

All baseline permissive policies remain in place; new `AS RESTRICTIVE` policies
intersect them. Unknown bucket access fails closed. No baseline B0.4a DB policy is
weakened. Service-role bypass is confined to queue-derived privileged deletion.
Permission/retired-key helpers live in the new `storage_security` schema, which
must not be added to exposed PostgREST schemas.

| Object state | SELECT / list / new sign | INSERT | UPDATE / move / upsert | DELETE |
|---|---|---|---|---|
| Unclaimed temp <24h | actual uploader + current editor/admin | authenticated owner + current editor/admin | denied | uploader, subject to SELECT |
| Linked Memory temp/final | ready row + `can_view_memory_post` | no referenced-object recreation | denied | `can_manage_memory_post`, subject to SELECT |
| Linked Diary temp/final | ready row + `can_view_diary_entry` | no referenced-object recreation | denied | `can_manage_diary_entry`, subject to SELECT |
| Detached claimed temp / retired key | no access; never becomes temp-readable again | denied | denied | service cleanup intent |
| Unlinked final Memory/Diary | not readable/listable | exact existing parent + current manager | denied | current manager; SELECT may prevent client removal, so parent deletion queues it |
| Growthbook | current book + page visibility | exact current book/page graph + editor | denied | current book/page authority |
| User avatar | self; otherwise exact profile projection path + current co-member/contributor relationship | self-owned canonical avatar | baseline self upsert maintained | self |
| Baby avatar | exact current baby avatar + member or friend-visible Memory context | baseline current editor/admin | baseline editor/admin upsert maintained | baseline editor/admin |
| Sticker | `can_view_baby_sticker` | current editor/admin + canonical baby path | existing editor/admin contract retained | existing editor/admin contract retained |

Profile/avatar assets are not public Internet assets. They have a deliberately
wider *authorized display* audience than private Diary or only-me Memory. A
co-member in another baby is still an authorized profile-display viewer, not an
unrelated actor. The test fixture was corrected to distinguish these cases.

The existing `family_circle`, `friend_circle`, `only_me`, `tagged_family` and
`selected_people` contracts remain owned by `can_view_memory_post`; Storage does
not create an alternative sharing model. Existing B0.4a SQL regressions cover
tagged/selected/removed-member boundaries; new real HTTP coverage also exercises
all five visibility modes, selected-list reduction and an external family-tag.

## Upload, attachment, readiness and split-brain recovery

There is no filesystem move/copy finalization in this app. A temp path remains the
final media path; the security transition is DB attachment and a permanent claim.

New flow: upload acknowledged → insert media row/claim in one DB transaction →
ready. The trigger locks the Storage metadata row and checks ownership, baby,
parent, canonical path and 24h lifetime. Missing objects cannot be attached or
marked ready. Existing restored uploads are independently checked server-side.

| Failure | Result / recovery |
|---|---|
| A. Upload succeeds, DB insert fails | No sharing/readiness implied. Unclaimed temp is uploader-only until expiry; service sweep handles it. Unlinked final object remains unreadable and is queued on parent deletion. |
| B. DB exists, physical finalization fails | No move step. New rows require an acknowledged object. Direct externally authorized object deletion can still produce a missing-object row; UI/signing fails safely, not false authorization. |
| C. Object exists, row pending | Not signed/readable as final until ready. Ready update checks metadata. A lost upload acknowledgement is checked with RLS-backed `info`, never destructive overwrite. |
| D. DB row deleted, object remains | Atomic durable intent; object is retired from new read/sign/upload/attach immediately; worker removes bytes and acknowledges. |
| E. Object deleted, DB reference remains | New sign/download fails; re-marking ready is rejected; delete/re-upload repairs the reference. Existing UI fallback remains. No bulk repair here. |

Permanent tombstones prevent cleanup retry from deleting a newly reused key.
Failed compose transactions that retired their keys must use a new upload/key;
the old key is not silently reassigned. Existing production pending/failed media
counts were both zero. Upload-first + DB transaction is not a distributed atomic
transaction; the table above explicitly documents residual recovery paths.

## Cleanup contract

Migration 009 introduces `media_cleanup_queue`: pending → leased → done. Service
workers claim at most 100 items with `FOR UPDATE SKIP LOCKED`; leases expire after
5 minutes. Retried removal is idempotent because retired keys cannot be reused.
Old lease IDs cannot acknowledge a newer lease. Failure/ambiguous acknowledgement
leaves a durable retry, not an automatic completed state. Done tombstones remain.

DB hard-delete triggers cover Memory, Diary, Growthbook, sticker media, resource
parents, baby scope (including unlinked temps/avatars), and the user's avatar
scope. A shared baby retained by B0.4a does not enqueue its media. Arbitrary
client object paths/user IDs are not accepted by the maintenance endpoint.

Expired-temp scan is service-only, bounded, locks objects, excludes all attached
Memory/Diary references, and queues instead of deleting metadata. New attachment
is denied after 24h. Already-linked media is not removed merely because its temp
path is old. The `storage-cleanup` Function and a unique 15-minute `pg_cron`
schedule are deployed in QA and Production.

Parent soft-delete atomically queues attached and completed-but-unattached final
objects. `FOR SHARE` locks serialize Storage admission/finalization against
parent deletion; a real two-session regression proves the delete waits and
observes the committed child. Unreferenced final objects whose parents remain
alive are inventoried, not automatically erased.

Account deletion now invokes authoritative DB cleanup before object cleanup;
queue entries survive Auth deletion. The endpoint drains up to 100 entries and
returns `mediaCleanupPending` for partial/bounded work. Deployment must include
the maintenance worker and scheduling/alerts; otherwise durable intents are safe
but bytes accumulate. Production `storage.objects` has no Auth-user FK that
would block this ordering (read-only catalog check).

## Signed URL and local cache boundary

| Callers | Prior default | Local default / cap |
|---|---:|---:|
| Memory / contributor avatar | 180s | 180s |
| Diary | 300s | 300s |
| Growthbook | 600s | 300s |
| User/baby avatar | 180s | 180s |
| Stickers | 86400s | 180s |

These are server-owned minting limits. Native authenticated Storage SELECT and
native signing are denied; `media-signed-url` accepts only a typed resource
kind/id, reauthorizes it, derives the DB path, and applies a fixed TTL. Existing valid signed URLs remain transferable
bearer capabilities until their requested expiry; the test deliberately proves
one still works after visibility reduction. No immediate revocation claim is made.

For normal app-issued URLs the intended residual network window is at most five
minutes. New hostile native clients cannot choose a longer TTL.

`MemoriesRepository` no longer returns a cross-account path-only cached URL before
RLS. Sticker persistence drops signed HTTP URLs and is account/baby-scoped, but
keeps locally created document-directory assets. `expo-image` views (including
explicit sticker `memory-disk` caching) and React Native/OS caches may retain
already-downloaded bytes beyond URL expiry. Revoking access cannot revoke copies
already delivered to a device. Native logout-cache purge/removal behavior was not
device-tested here; this is a residual privacy/retention boundary, not proof of
immediate byte erasure. No new persistent signed-URL cache was introduced.

## Read-only orphan preflight

Counts are **Storage metadata vs DB references**, not a provider-side physical
byte census. No real media was downloaded for this inventory.

| Environment / bucket | Unreferenced objects | DB references without object | Stale unreferenced temp |
|---|---:|---:|---:|
| Production memories | 69 | 2 | 12 |
| Production diary | 6 | 0 | 6 |
| Production growthbook | 0 | 0 | 0 |
| Production stickers | 0 | 0 | 0 |
| Production profiles | 27 | 50 | 0 |
| QA memories | 13 | 0 | 0 |
| QA diary/growthbook/stickers | 0 | 0 | 0 |
| QA profiles | 4 | 4 | 0 |

Duplicate refs and cross-baby refs within each bucket: zero. Linked temps without
server owner metadata: zero. No mass object migration appears necessary from
these aggregate checks. Missing avatar refs/old orphans require classification,
not automatic deletion or invented ownership. Runtime byte existence remains
separate from metadata availability.

Preflight tooling:

```sh
node --env-file=.env.qa scripts/b04b-storage-preflight.mjs qa
node --env-file=.env.production-backend scripts/b04b-storage-preflight.mjs production
```

Both use `BEGIN READ ONLY` and `default_transaction_read_only=on`, a 30s statement
timeout and target project guards. Output contains bucket/policy definitions and
aggregates, never object names, user rows, credentials, URLs or raw media.

## Tests and provenance

Actual Storage runtime: `supabase/storage-api:v1.74.0`, digest
`sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85`.
Postgres test image digest:
`sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
The version/config reference is the [official Supabase compose source](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml).
Tests use a disposable internal-only Docker network, synthetic JWTs/media and
fixture DBs; no QA/Production credentials. SQL resource helpers use repository
B0.4a migrations. This is not evidence of the hosted Storage service's exact version.

`qa:b04b:storage:local-api`: **184 PASS / 0 skipped**. Covers:

- Baseline temp read/claim exploit reproduction and repaired behavior.
- Admin/editor owner/editor non-owner/viewer/friend/unrelated/removed actors.
- Cross-user read/sign/list/overwrite/delete/move/copy and cross-baby claim.
- Memory only-me/family/friend transitions, removed uploader, public-URL denial.
- Selected-recipient removal, tagged active member/external friend separation,
  and an old but linked temp excluded from expiry cleanup.
- Diary, Growthbook, profile, baby avatar and sticker authorized reads/signs;
  unrelated/friend/removed denial and viewer delete non-mutation.
- Actual upload/finalize/read/sign/delete, DB deletion retirement and worker byte
  deletion, expired temp scan, missing-object readiness and unlinked final objects.
- Bucket MIME/size rejection and encoded object-key rejection.
- Cleanup lease dedupe/expiry/stale acknowledgement, plus membership arriving
  before the account deletion transaction: no cleanup intent for retained baby.

`qa:b04b:storage`: path traversal/Unicode/normalization, cleanup API failure and
lost acknowledgement, worker auth/invalid intents, plus SDK request-stub proof
that an account-A scoped upload/remove does not adopt account-B credentials.

Other PASS: typecheck, architecture, repository-queries, secrets, diff check,
Diary-save reliability, B0.4a P0/ID-invite/ownership-visibility source smoke;
B0.4a P0, ownership/visibility and final-authorization PostgreSQL suites.
Deno was not installed for a separate local `deno check`; QA and Production
Edge Function deployment bundled all three deployed entrypoints successfully.
Hosted QA actual Storage/Edge regression: **146 PASS / 0 skipped**. QA B0.4a P0,
invite, ownership, visibility and final-authorization regressions also pass.
Native device cache purge remains an explicit platform boundary.

## Local change batches and rollout/rollback gate

1. `202609150008_b04b_storage_boundary.sql`: restrictive Storage boundaries,
   completed-upload attachment guard, temp claim tombstones, image MIME lists,
   disable legacy global metadata cleanup. Client canonical path/ready checks and
   pinned upload session are the companion changes.
2. `202609150009_b04b_storage_cleanup_queue.sql`: durable deletion/expiry intents,
   retired-key exclusion, service-only lease/ack functions. Account deletion and
   internal maintenance Edge source are companions. Signed-URL cache/TTL changes
   remain in the corresponding repositories.
3. `202609150010_b04b_storage_fk_cleanup_compatibility.sql`: preserves internal
   FK `SET NULL` account-deletion cleanup without allowing direct identity edits.

Changed-file inventory (no unrelated worktree edits existed at baseline):

- Migrations: all three files above in `supabase/migrations/`.
- Client core: `src/lib/supabase.ts`, `src/lib/sessionClientOptions.ts`,
  `src/utils/eagerMediaUpload.ts`, `src/utils/tempMediaPath.ts`.
- Repositories: `MemoriesRepository.ts`, `DiaryRepository.ts`,
  `GrowthBookRepository.ts`, `BabyStickerRepository.ts`, `ProfileRepository.ts`,
  `BabyProfileRepository.ts` under `src/repositories/`.
- Account capture only, no layout/design edits:
  `src/components/memories/MemoryUploadModal.tsx`,
  `src/components/babylog/DiaryComposeModal.tsx`.
- Edge: `supabase/functions/delete-account/index.ts`,
  `supabase/functions/media-signed-url/index.ts`,
  `supabase/functions/storage-cleanup/index.ts`,
  `supabase/functions/_shared/storageCleanup.ts`.
- Tests/preflight: `scripts/b04b-storage-smoke.mts`,
  `scripts/verify-local-b04b-storage.mjs`, `scripts/b04b-storage-preflight.mjs`,
  `scripts/fixtures/b04b-storage-preflight.sql`,
  `scripts/verify-qa-b04b-storage.mjs`,
  `scripts/verify-b04b-storage-deployment.mjs`,
  `scripts/apply-b04b-storage.mjs`,
  `scripts/deploy-b04b-storage-functions.mjs`;
  five `package.json` QA scripts.
- Documentation: this report. No lockfile/dependency version changes retained.

Rollout completed in order: independent review → QA 008/009/010 → Functions and
scheduler → hosted attacks/B0.4a regressions → identical Production migrations,
Functions and scheduler. Unrelated QA pending migrations were not fake-marked or
applied.

Rollback: migration failures roll back their transaction. After successful
deployment, prefer a reviewed forward fix; never restore the broad temp policy
or global metadata DELETE to regain availability. Preserve queue/claim tombstones
and halt the worker before diagnosis. Restore DB data from approved backup only
with object-level reconciliation; already physically removed bytes cannot be
recovered by dropping policies. No destructive rollback script is supplied.

## Final disposition / required-report checklist

Report items 1–5: baseline, inventory, classification, callers and paths above.
6–13: ownership, cross-scope/API attacks, finalization, split-brain, readiness and
parent/direct-path enforcement above. 14–23: public URLs, signed callers/TTL,
visibility/removal, listing, overwrite, normalization and MIME/size above.
24–32: delete authority, DB/Storage consistency, expiration/orphans/race, policy
matrix, service authority and avatar distinctions above. 33–42: actor/resource
matrix, controls, findings, source/migrations/tests and existing B0.4a regressions.
43–48: preflight/rollout, no mass migration, remaining risks and verdict below.

Remaining reproduced Storage authorization P0: **0**. Remaining reproduced
authorization/lifecycle P1 in the new source: **0**. Independent Sol High review:
`B0.4b FINAL SECURITY REVIEW PASS — READY FOR QA GATE`.

Post-deployment compatibility review found one separate operational P1: the
previously submitted Production iOS build (build 19, source
`654fc07ca3147de8559a66c6120c3c68e7f829b9`) still calls native Supabase Storage
`createSignedUrl(s)`. B0.4b deliberately denies native Storage SELECT/signing and
requires the new `media-signed-url` Edge contract. Therefore that submitted old
binary can no longer mint Memory, Diary, Growthbook, avatar or sticker URLs after
this backend rollout. A compatible replacement was prepared without weakening
the Storage boundary: Production iOS build 20 was built from
`9f5461341474dec8b92bdf216380a2c9af142695` and successfully uploaded to App Store
Connect. EAS build `d0a91b3e-108d-44ca-bd33-78af8dae61ff` finished and submission
`b29be1fa-e328-42a9-946e-f696a527d92e` finished on 2026-09-16. Apple processing,
TestFlight/App Store distribution and installed-client uptake remain external
release operations; old installed binaries must update to use the new contract.
Until distribution and an installed-client compatibility smoke are confirmed,
the operational P1 remains open. Successful App Store Connect upload alone is
not evidence that users received build 20.

Remaining P2/operational work: classify existing orphan/missing refs; review
metadata-only vs byte existence; monitor the deployed cleanup schedule and
error/queue metrics; define soft-delete historical retention; native cache/device
validation; optional content sniff/decoder hardening. Existing downloaded copies
are not remotely revocable. Production historical stale temp candidates were
counted, not manually deleted during deployment.

Deployment provenance:

- migration manifest: `55168e7a672b773317c58f9c7886d2c7ddad173d46bee3de567b4eb39843144e`
- Function manifest: `3f74b1164e4526d343ed4360f86469d566f0d52a2cf3bc7c0a49041292c58ec9`
- QA hosted attacks: `146 PASS / 0 skipped`
- Production iOS compatibility build: build 20, source `9f5461341474dec8b92bdf216380a2c9af142695`,
  EAS `FINISHED`, App Store Connect submission `FINISHED`.
- Production safe smoke: unsigned signer `401`, unauthorized worker `401`,
  3 migrations, 7 restrictive policies, 4 DB functions and one active schedule.
- Production scheduled maintenance (not manually invoked): 19 pre-existing,
  unreferenced expired temp objects were retired and removed through the queue;
  `done=19`, `pending=0`, `leased=0`, stale temp=0. The object-count change is
  exactly 13 memories + 6 diary temp objects; growthbook, stickers and profile
  counts were unchanged. Deleted bytes are not recoverable through a policy
  rollback. The pre-deployment read-only inventory classified these as stale,
  unattached temp objects. No linked object was queued by this sweep.

**B0.4b SERVER SECURITY PASS — CLIENT ROLLOUT P1 OPEN**
