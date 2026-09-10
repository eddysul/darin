# P1.2 centralized quota / hard cost ceiling — local implementation

This documents P1.2 source through its final local container/commit gate, not a
deployed service. Earlier QA/follow-up sections preserve their then-uncommitted
checkpoints. No Firestore database, IAM binding, Cloud Build, Cloud Run revision,
or real provider call was created by this work. Staging/production remain unchanged.

## Composition and safe default

`create_app()` defaults to an unavailable central ledger. Paid requests cannot
fall back to the instance-local limiter. Health/version, authentication and
deterministic no-provider boundaries work independently of the ledger.

For a later separately authorized deployment, supply a dedicated Firestore
Native database client and a `Fingerprints` keyring. Construct
`QuotaService.for_firestore(client, fingerprints, environment, namespace)` and
inject it into `create_app(quota_service=...)`. Provision/review `control/current`
separately; the runtime never creates it. There is no ambient project discovery,
automatic credential provisioning, embedded HMAC key or production fake-store
switch. Default `app.main` remains fail closed until explicit composition is
supplied. Mobile/EAS idempotency-header integration is a later gate.

## Source boundaries

- `app/quota/types.py`: strict numeric/documents, stage states, safe errors.
- `identity.py`: stable IDs and versioned keyed input fingerprints.
- `pricing.py`: server-owned model/cost profiles and trusted duration proof type.
- `repository.py`: atomic reservation, claim, settlement, cancellation, recovery.
- `firestore.py`: pinned real SDK adapter; bounded RPCs and up to three ABORTED
  transaction attempts under a three-second operation deadline.
- `service.py`: provider execution boundary and accounting integration.
- `tests/quota_fake.py`: test-only transactional central backing store.

## Authoritative configuration

`control/current` must match `QuotaConfig`, without extra fields:

| Field | Contract |
| --- | --- |
| `contract` | `p1.2.v1` |
| `version` | Server-owned execution configuration revision |
| `environment`, `identity_namespace` | Match fixed runtime composition |
| `enabled` | Boolean; false denies new dispatch |
| `fingerprint_version` | Active keyring version |
| `profiles` | Explicit allow-list of built-in reviewed profiles |
| `valid_from` | UTC approval activation; unset/epoch response times cannot admit |
| `valid_until` | UTC approval expiry; covers the admission dispatch window |
| `minute_limit` | Shared fixed UTC-minute admission count limit |
| `user_budget`, `global_budget` | Nonnegative int64 microdollars |

Missing, corrupt, unsupported, expired or incompatible config fails closed.
There are no default paid quotas. The first admission of a UTC day freezes its
global and per-user budget policy in `globalDay`. Config changes cannot reset
existing users or give newly seen users a higher daily budget midway through
that day. New daily amounts apply the next day. Central disable and
`DARIN_AI_ENABLED` deny execution, but do not promise cancellation of calls
already dispatched. Quota/pricing/config versions never enter counter identity.

## Scope and cost proof

USD units are integer microdollars (`1 USD = 1,000,000`). The ceiling covers
provider usage admitted through this ledger across all its instances/revisions,
not other gateways/keys, provider-account-wide spend, taxes/FX or GCP costs.

UTC day/minute use the first server read timestamp of the final successful
transaction attempt. Reconcile always uses original buckets, even after midnight.
This is an admission-day ceiling, not an invoice-day ceiling. Dimensions are
exactly user+operation+minute, user+day, and environment+day.

Normal execution maintains `charged + held <= budget` and `actual <= reserved`.
Multiplication is checked and division rounds up; no floating-point dollars or
truncated fractional per-token prices are used.

The LLM profile reserves the full documented 128,000-token context plus forced
operation output tokens at uncached prices. Materialized request bytes are
additionally bounded, but this byte check is not a token estimator. Calls force
n=1/default service tier with no SDK provider retry/model fallback. Source:
https://developers.openai.com/api/docs/models/gpt-4o-mini

`A > R` preserves actual observed spend, blocks the profile and returns a safe
accounting error. It never clamps A to R. An external violation of the assumed
provider billing cap cannot be undone; this intentional fault test is separate
from normal-ceiling assertions.

## Transcribe dependency

P1.2 has no production duration verifier. Validated audio without trusted duration
returns `COST_BOUND_UNAVAILABLE` before STT or parser calls. Client fields, MIME,
file size and timeout are not duration proof.

Only explicit trusted dependency injection supplies `VerifiedAudioDuration`,
bound to the exact audio digest. Test fixtures reserve STT + parser before STT,
then dispatch/reconcile each stage separately. STT reserves at full-minute
rounding. Its production adapter retains UNKNOWN usage without billable-duration
evidence. P1.3 must establish duration/billing-quantum evidence before activation.

Parser materialized input must fit the initial reservation bound; no top-up is
performed. STT cost remains accounted when parser validation or execution fails.

## State, crash and cleanup

- `RESERVED -> DISPATCHING` is an atomic irreversible single-winner claim, not a
  lease. Only a caller receiving definite success may invoke the provider.
  Lost commit responses never cause provider replay/takeover.
- `SETTLED`: settle known actual usage and return R-A atomically, once.
- `UNKNOWN`: retain full R. Timeout/cancellation/errors do not prove no charge.
- `CANCELLED_UNSENT`: only still-RESERVED stages can release funds.
- Claim window: 120 seconds. `recover(id)` can cancel expired RESERVED stages
  and convert DISPATCHING/UNKNOWN to `SETTLED_CONSERVATIVE` after five minutes.
  Recovery never calls a provider. Missing recovery retains funds. Late results
  cannot automatically refund a conservatively settled stage.
- Usage metadata is extracted before product parsing. Product parsing failure
  does not erase known usage. Accounting persists only safe numeric/status
  metadata, never raw provider content, prompt, audio or transcript.

Only fully terminal reservations receive `expires_at = day_end + 8 days`.
Unresolved records have no TTL. Counters have no automatic TTL or refund. Missing
old counters fail closed, not recreate a budget. Scheduled recovery and counter
compaction are later operational work, not provisioned here.

## Idempotency and HMAC

Nonce format: `YYYYMMDD.<32 lowercase hex characters>`. Only the current server
UTC date can create a new reservation. Existing keys are checked through that
day's end + 7 days; older keys always expire, even after deletion. Same key with
different canonical input conflicts. Same key/input never reserves or dispatches
again. API replay returns safe `IDEMPOTENCY_REPLAY`, not a cached product result.
Clients must not silently generate new keys on retry.

Lookup IDs depend on stable authentication namespace/sub, operation and nonce,
not HMAC/pricing/config versions. Fingerprints are compared using their original
key version. Missing historical verification keys fail closed. Stored digests
are pseudonymous identifiers, not anonymization. No baby identity is required.

## Verification and remaining gates

`npm run qa:ai-server` includes existing security/Voice/JWT tests and P1.2 tests.
Existing positive Voice tests explicitly inject a central fake and duration
proof. Production-style missing-duration tests assert STT=0 and parser=0.

Coverage includes 100 requests across independent processes, 100 route retries
across two apps, crash/commit-loss injection, independent fake-provider billing,
midnight/retry/config/HMAC rotation, overflow, rejected-output accounting, privacy,
and the actual Firestore SDK with a fake GAPIC transport. SDK tests use anonymous
test credentials and never connect to GCP.

Firestore emulator/live datastore were not used. Fake/SDK tests do not establish
deployed IAM, production contention, latency or throughput. Those remain isolated
staging gates after review and separate authorization. No commit/deploy is made.

## Initial local QA result (before independent security review)

- Host `npm run qa:ai-server`: **159 PASS / 0 skipped** (86 existing + 73 new).
- Same-Dockerfile Python **3.12.14** container, network disabled: **159 PASS / 0 skipped**.
- Existing valid Voice integration matrix: **216 combinations PASS**, within the suite.
- Python compile, AI-OFF startup health/version, typecheck, AI policy,
  architecture, secret scan, voice-scope and `git diff --check`: **PASS**.
- Two independent processes, 100 requests: **37 admitted at a 37-request cost
  boundary**; 100 duplicate requests: **one provider dispatch**.
- Missing duration: **STT 0 / parser 0**. All provider tests use fakes/mocks.
- No stage/commit/deploy. HEAD remains the P1.1 baseline
  `e93c15cbe339d17f1f59b4d9b01f738c7a64d9bc`.

Initial host dependency/IPC issues were resolved with an isolated local venv
and permission for local process IPC. Final suites have no failures or skips.
Firestore emulator, real GCP IAM/throughput, and live provider tests were not run.

## Changed files (28, all under server/ai, including security follow-up)

```text
server/ai/.dockerignore
server/ai/P1_2_QUOTA.md
server/ai/requirements.txt
server/ai/app/factory.py
server/ai/app/operations.py
server/ai/app/providers/base.py
server/ai/app/providers/openai_llm.py
server/ai/app/providers/openai_stt.py
server/ai/app/quota/__init__.py
server/ai/app/quota/firestore.py
server/ai/app/quota/identity.py
server/ai/app/quota/pricing.py
server/ai/app/quota/repository.py
server/ai/app/quota/service.py
server/ai/app/quota/types.py
server/ai/tests/quota_fake.py
server/ai/tests/support.py
server/ai/tests/test_api_contract.py
server/ai/tests/test_auth_and_rate_limit.py
server/ai/tests/test_output_safety.py
server/ai/tests/test_p0_claim_boundary.py
server/ai/tests/test_p0_upload_boundary.py
server/ai/tests/test_quota_firestore.py
server/ai/tests/test_quota_ledger.py
server/ai/tests/test_quota_routes.py
server/ai/tests/test_quota_security_followup.py
server/ai/tests/test_transcribe.py
server/ai/tests/test_voice_grounding.py
```

Existing test changes inject the explicit central fake/duration fixture and nonce.
The aggregate-overflow fixture also seeds a valid counter/marker pair atomically,
so it still tests arithmetic overflow rather than the separate integrity rejection.
Closed auth/JWKS/local limiter/upload/policy/grounding source is unchanged.

## Security review follow-up (local only)

The independent review reproduced three defects not covered by the initial 159
tests. This follow-up changes only `quota/types.py`, `quota/repository.py`,
`providers/base.py`, `providers/openai_llm.py`, the aggregate-overflow test fixture,
`tests/test_quota_security_followup.py`, and this document. No commit/deploy occurs.

### Counter integrity / bootstrap

`Counter` requires `schema_version=counter.v1`, `bootstrap_id`, held, charged,
admissions, budget and user_budget; persisted documents never default these fields.
Each counter has a separate `counterMarkers/{digest(counter_path)}` document with
`counter-marker.v1`, a path-bound counter ID, the same bootstrap ID, and a digest
of the entire typed counter state. Both documents are written atomically with
reservation/settlement/recovery. Neither counter nor marker has TTL.

- First use: only when BOTH documents are absent, explicitly construct zeros and
  bootstrap the pair inside the admission transaction.
- Existing counter: validate every required field and compare the complete marker.
- Counter missing but marker present, marker missing but counter present, malformed
  schema/numbers, copied marker, or a well-typed partial reset: fail closed without
  repair, new reservation or provider execution.
- Claim rechecks both user/day and global/day counter witnesses before dispatch.
  Reconcile and recovery cannot rewrite a corrupt pair either.
- Old pre-marker documents are rejected, never automatically adopted or migrated.

This is a partial-loss/corruption detection contract, not a backup system or a
defence against a privileged actor coherently rewriting/deleting all copies.
Markers must not be deleted/TTL-expired independently of the ledger. Coordinated
loss/rollback of BOTH counter and marker cannot be distinguished from first use
by that pair alone: keep AI disabled during datastore restore and re-establish
the authoritative ledger before reopening admission. Live IAM/restore procedures
remain a separately authorized staging gate; none were configured here.

### Late terminal evidence

Reconcile checks owner, stage, pricing/model and usage before the terminal branch.
Late A <= R preserves the original terminal money/accounting. Late A > R preserves
the largest observed numeric cost and separate `violation_accounting`, blocks the
profile, and returns `ACCOUNTING_INVARIANT_VIOLATION`. It never refunds or changes
the terminal charge, counter balances, or stage state, and never re-dispatches a
provider. Repeated evidence is idempotent. Already-reserved but undispatched work
also fails its subsequent profile-block check.

### Accounting outlives product parsing

The adapter extracts usage once, then delegates product parsing to
`ProviderResult.parse_product(accounting, parser)`. This boundary retains the
existing usage on any ordinary parser/schema exception, including RecursionError;
only safe parse status/category changes. Raw content and exception messages are
not stored or logged. Process death/cancellation retains the durable reservation.
Product output validation still occurs after accounting settlement, so rejection
does not discard known usage. Deep JSON may fail in the decoder or the product
validator depending on Python runtime; both paths must preserve the same billing.

### Added regression coverage

27 new test methods cover user/global counter field loss, malformed/negative/overflow
values, entire counter loss, marker corruption/loss, first-use bootstrap, dispatch
and recovery integrity, a 500-request race, terminal A < R / A = R / A = R+1,
100 duplicate late events, blocked provider dispatch, parser failure preservation,
privacy, and real Firestore SDK round trips through a fake transport.
No live provider, Firestore emulator, or GCP service is contacted by these tests.

### Final follow-up verification

- Host full server suite: **186 PASS / 0 skipped** (159 prior + 27 follow-up).
- Existing Dockerfile local image `darin-ai:p1-2-followup-local`, Python
  **3.12.14**, read-only source mount and `--network none`: **186 PASS / 0 skipped**.
- Container in-memory compile of 28 app modules and actual AI-OFF Uvicorn startup:
  **PASS**; `/health` and `/version` both **200**.
- Typecheck, AI policy, architecture, secrets, voice-scope and `git diff --check`:
  **PASS**. Existing JWT/P1.1, crash/idempotency and 216 valid Voice combinations
  remain covered by the full suite.
- 500 competing requests across two clients admit exactly 37 at a 37R boundary;
  the existing independent-process race also passes. Duplicate claims/requests
  retain one winner/dispatch; 100 duplicate late evidence events change no money.
- Missing duration proof: **STT 0 / parser 0**. Actual provider calls: **0**.
- Privacy assertions inspect fake persisted documents, captured logs and route
  responses; no raw provider content, exception payload or credentials are added.

The initial restricted host run could not bind local process IPC; the authorized
local-IPC rerun passed. One initial container assertion expected a deep JSON
decoder error (502), while Python 3.12 parsed it and product validation rejected
it (422). The regression now verifies preserved Known usage and actual settlement
on either safe rejection path; a separate test explicitly raises RecursionError.
Both final suites have no failures or skips. Dependency deprecation warnings are
unchanged and are not test failures.

No staging, commit, Cloud Build, Firestore/IAM, deployment, external provider,
staging AI, production, EAS/mobile or Supabase mutation was performed. The three
reproduced findings are locally addressed; independent security re-review and
separately authorized live Firestore/restore validation remain outstanding.
P1.3 duration verification and broader deferred grounding/retention work are not
implemented by this follow-up.

**P1.2 LOCAL FIXES COMPLETE — READY FOR SECURITY RE-REVIEW**

## Focused re-review and final local gate

The focused security re-review closed the original counter-integrity, terminal
late-overage and parser-accounting findings. Independent fake-provider route and
ledger probes passed, including recoverable MemoryError, cross-user/operation
profile blocking and both 500-request user/global budget races. The review verdict
is **P1.2 SECURITY RE-REVIEW PASS — READY FOR CONTAINER/COMMIT GATE**.

### P2 residual risks — staging/operations gates, not local commit blockers

- Simultaneous counter/marker loss or privileged coherent datastore rollback can
  look like first use. The marker detects partial corruption, not a privileged
  rewrite of both copies. No public HTTP path performs such a rewrite/deletion.
- Verify runtime IAM, dedicated staging/production database isolation, backup/PITR
  and coordinated restore. Keep AI disabled while restoring the ledger, and
  verify destructive administrative-action monitoring before production use.
- Global/day counter and marker are shared transaction hotspots. Real contention,
  server timestamp semantics, throughput and latency require staging validation.
- Scheduled conservative recovery, marker/counter retention and operational
  cleanup remain to be designed and verified. Cleanup must not reset budget or
  remove integrity witnesses for an active accounting period.

All live Firestore/IAM/backup/PITR/monitoring claims remain **UNVERIFIED — STAGING
GATE**. This source gate neither provisions them nor authorizes deployment.

### Final container/commit gate verification

- Local build: `darin-ai:p1-2-final-gate-local-20260910`, unchanged Dockerfile and
  `server/ai` build context, pinned Python base digest. Cached dependency layers
  preserve the previously verified resolution; all 41 installed package versions
  match the earlier reviewed container. No new dependency/lock mechanism is added.
- Python **3.12.14**, non-root **UID 10001**. Image app sources exactly match the
  read-only sources used by tests. All 28 app modules compile successfully.
- Full host suite and final container `python -m unittest discover`: each
  **186 PASS / 0 skipped / 0 failures / 0 errors**. Container tests use
  `--network none`; no real provider is invoked.
- Mandatory independent container smoke passes: 38 user/global corruption cases
  yield 503 with no additional provider/reservation; terminal R+1 retains charge
  and evidence, blocks affected execution, and tolerates 100 duplicate reports;
  Known/Unknown parsing matrices retain their accounting, including MemoryError.
- Both independent 500-request budget races admit exactly 37 at 37R. The targeted
  100-duplicate route test confirms one provider dispatch. Missing duration proof
  produces zero STT and parser calls.
- Prior P0: absent/invalid auth with 2 MiB multipart yields 401 and zero body,
  parser, spool and provider activity. Five-locale attack/valid safe-claim checks
  pass. Existing JWT/P1.1 and 216 valid Voice combinations remain passing.
- The unmodified Dockerfile CMD starts `app.main:app` with synthetic local config,
  AI OFF and no external network. `/health` and `/version` return 200. Before the
  source commit, `/version.commit` intentionally remains `unknown`; this is not a
  deployed provenance claim. The temporary startup container was stopped/removed.
- Typecheck, AI policy, architecture, secrets, voice-scope and diff checks pass.
  The first ad-hoc stdin test runner was incompatible with multiprocessing spawn,
  and a direct smoke method call omitted its fixture setup. Standard unittest
  runners resolved both harness-only errors without changing app/test source.

The source commit contains only the approved 28 P1.2 files listed above. No
Cloud Build, Cloud Run, Firestore/IAM, staging AI, production, EAS/mobile or
Supabase action is part of this gate. P1.3 is unchanged. Commit SHA and final
worktree status are reported after committing, rather than self-embedded here.
