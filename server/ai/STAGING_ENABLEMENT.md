# Combined staging enablement — local implementation, not deployment approval

Based on P1.2 `6970c6d60d72d4608c1e5e7263bf9931720be947` and P1.3
`2be4a387e08521c80de99b78570a16c6ebb2626d`. This layer requires review and a verified
source commit before deployment. No GCP resources, IAM, secrets, environment or traffic changed.

## Runtime composition

`main -> create_app() -> compose_quota -> CentralConfig -> verified workload metadata credential`
`-> FirestoreStore -> BoundRepository -> QuotaService -> existing routes`.

The default runtime requires explicit `DARIN_QUOTA_MODE`:

* `central`: validate all deployment metadata and bounded keyring locally, even
  when AI is OFF. Client construction failure aborts startup. No network document
  read is made at startup. Every admission/dispatch transaction validates the
  authoritative `control/current` policy and pinned metadata. Outage, denied IAM,
  missing/malformed policy, expired approval, key mismatch, environment mismatch
  and unsupported profiles fail closed before any paid dispatch. There is no
  local rate limiter/cost fallback.
* `bootstrap-off`: explicitly incomplete bootstrap. Only accepted with AI OFF
  and **no other DARIN_QUOTA_* settings**. Can serve health/version, cannot turn
  execution on. Missing mode fails startup rather than guessing a local mode.
* Local tests use explicit Python Settings/repository injection. This is not an
  environment or HTTP-selectable fake provider. `main` never passes test Settings.

AI OFF route smoke performs no quota reads, reservation or provider invocation.
`/health` stays `{status: ok}`; `/version` retains its existing schema. No readiness
or metrics HTTP endpoint is added. Internal `app.state.quota_readiness()` performs
a read-only policy transaction, returning only central_ready/ai_enabled. It is an
explicit diagnostic, not a startup dependency; it does not claim IAM/write-path
readiness. It must not be called during the zero-ledger-mutation smoke unless that
separate read-only diagnostic is intended.

## Deployment metadata contract

All values are server-owned. None comes from the request. No budget/pricing env
fallback exists. Validation errors expose only a constant message.

| Variable | Contract |
| --- | --- |
| DARIN_QUOTA_MODE | central or explicit bootstrap-off |
| DARIN_EXECUTION_ENVIRONMENT | Must equal quota environment |
| DARIN_QUOTA_PROJECT_ID | Explicit quota project, independent of Cloud Run project |
| DARIN_QUOTA_DATABASE_ID | Explicit named database; implicit/default DB forbidden |
| DARIN_QUOTA_ENVIRONMENT | Stable quota environment label |
| DARIN_QUOTA_NAMESPACE | Stable issuer/user namespace; not a revision/config version |
| DARIN_QUOTA_CONFIG_DOCUMENT | Exactly control/current |
| DARIN_QUOTA_SCHEMA_VERSION | Exactly p1.2.v1 |
| DARIN_QUOTA_CONFIG_VERSION | Expected authoritative approval version |
| DARIN_QUOTA_ACTIVE_KEY_VERSION | Must match policy fingerprint_version |
| DARIN_QUOTA_HISTORICAL_KEY_VERSIONS | Explicit JSON array, including [] when none; max 32 |
| DARIN_QUOTA_KEYRING_FILE | Absolute path to mounted, version-pinned Secret Manager keyring |
| DARIN_RUNTIME_SERVICE_ACCOUNT | Exact expected Cloud Run workload service-account email |

Keyring format is JSON `{version: base64_key}` with exact active + historical
members, each decoded key 32–64 bytes. Duplicate members, unknown members, missing
historical keys, invalid encoding, oversized (>16 KiB) payload fail startup.
Never use DARIN_LOG_HASH_SALT as a fingerprint key. No key payload/reference is
returned in health/version or error text. Raw key material remains only in memory.
Do not pass it on CLI arguments or commit an actual keyring fixture. A deployment
operator must retain every historical key referenced by unexpired idempotency
records; the configured list cannot itself prove that an operator omitted no key.
Missing keys on old-record verification remain fail closed, never new admission.

The runtime uses a dedicated `FixedMetadataWorkloadCredentials` object backed by
direct link-local HTTP transport to `169.254.169.254`. The transport does not use
urllib/requests, environment proxies, redirects, generic ADC, Cloud SDK user files,
credential files, service-role keys or project discovery. `GCE_METADATA_HOST`,
`GCE_METADATA_ROOT` and `GCE_METADATA_IP` are configuration hazards and central
startup rejects their presence. `GOOGLE_APPLICATION_CREDENTIALS` and the Firestore
emulator override remain forbidden even when their values are empty.

Every identity and token request carries `Metadata-Flavor: Google` and requires the
same response flavor, status 200, a bounded response and strict parsing. Identity
wire format is exact ASCII with only an optional single terminal LF or CRLF; generic
whitespace normalization is forbidden. Every token refresh first revalidates the
actual metadata identity against the configured expected service account, then
requests a token from that exact email's metadata path. Token JSON is bounded,
duplicate-free and limited to a printable token, exact Bearer type and a positive
expiry no greater than one hour. Refresh failure clears the cached token and fails
closed. Unit tests inject only transport/client boundaries using anonymous
credentials plus a fake GAPIC transport; this DI is not a runtime configuration
surface.

Central `control/current` still owns profiles, micro-USD budgets, UTC approval
validity, minute quota and configuration version. Impossible user_budget greater
than global_budget is rejected on policy read. Zero budget remains a valid stop.
Central metadata cannot be checked locally without a read: missing/malformed
remote policy is request/readiness fail-closed, not claimed startup validation.
Config/pricing/HMAC changes do **not** change existing ledger paths/counter IDs.
Pinned version changes require coordinated revision rollout; mismatched revisions
deny new admission/dispatch, rather than create a fresh quota. Existing accounting
cleanup remains governed by P1.2 conservative semantics.

## No-provider administrative harness

Separate CLI: `python -m app.quota.harness --execute-synthetic-ledger` (from runtime
package root); optional `--fault-injection` explicitly enables destructive fixture
writes. **Do not run against GCP in this local task.** No automatic invocation on
import/startup and no hidden HTTP debug route. No provider adapter is constructed.

All three of database/environment/namespace must start `synthetic-`; otherwise
reject before ADC creation. A separately authorized operator first provisions the
base control/current in a **dedicated synthetic test database** and keyring.
Every run uses a random `syntheticRuns/<opaque run>/` root and opaque synthetic
user, with no baby/audio/transcript/prompt data. The root gets a validated copy of
the central approval, then normal transaction-only ledger code exercises fresh
bootstrap, minute/user/global counters, reservation, one dispatch claim, known
usage settlement, UNKNOWN hold and idempotency conflict.

Fault mode ages only its own synthetic record to exercise conservative settlement,
sets an isolated profile block and corrupts an isolated counter marker to verify
denial. It never removes or resets normal counters and never changes base config.
No list/query/delete permission is used. Fault mode must run under a separate
controlled test/admin principal; production runtime must not run this CLI. Prefix
checks are accident prevention, not an IAM boundary. It is not a replacement for
the previously validated 100-process/concurrency/budget stress suite.

Runtime IAM remains narrow get/create/update plus transaction permissions; CLI
does not justify adding delete/list/broad Datastore roles. Synthetic fixture
retention/cleanup is a separate operator responsibility, never runtime deletion.
Fresh test roots are **not** suitable for cost accounting of real provider calls.

## Observability (no sensitive labels)

`app.telemetry.METRICS.snapshot()` keeps bounded fixed-name counters/gauges with
an ephemeral process ID and sanitized revision. No user/content/document key
labels and no high-frequency log writes/background tasks. Categories include:

* admission/rejection, cost-bound/idempotency/limit/config-integrity failures;
* Firestore success/failure, retry/contention, permission/timeout/unavailability,
  cumulative latency milliseconds (derive mean with transaction count, not p95);
* audio acquire/release/current/capacity denied;
* upload timer start, first nonempty ASGI body received, absolute timeout;
* verified/rejected duration and format/metadata/length/unverified categories;
* actual media child start/reap/current; provider dispatch attempt;
* successful claim/reconcile/unknown/cancel/recover operation counts.

Operation counts are NOT durable billing/state truth; retries, idempotent calls
and process restarts must not be interpreted as charged money. Consult the ledger
for exact accounting state. Error counters use finite class/code mappings, never
exception text. Auth errors continue through existing privacy logging.

`memory_snapshot()` is an on-demand Linux diagnostic: current /proc RSS, cgroup
v2 memory.current, /tmp filesystem used space and operational snapshot. Missing
values are null, not zero. /tmp usage is filesystem-wide, not app attribution.
No arbitrary paths, process arguments, file enumeration or payloads are exposed.
Use Cloud Monitoring for container/RSS/OOM monitoring; exporter/collector wiring
and proxy-correlated Cloud Run load tests remain deployment-time gates. This
implementation intentionally does not invent a metrics HTTP ingress or start an
unapproved external exporter. Observe baseline/deltas per revision + process.

The Dockerfile's worker=1 is unchanged. Two audio slots and the independent media
worker gate are per process: increasing worker count multiplies instance resource
capacity and requires renewed memory admission design/testing. Worker=1 in the
snapshot documents the runtime contract, not an independent process census.
The upload timer still starts after authentication/AI/rate/admission and ends
before verification/provider work; first app body receipt does not prove when
Cloud Run's proxy buffered network bytes. No chunk contents/sequences are logged.

## Deployment/operational gates NOT performed here

* Separate quota project isolation: the existing production compute SA has Editor
  in darin-childcare-auth. A named DB in that same project alone is not isolation.
  Do not remove production Editor/change its SA under this task.
* Firestore API/database/IAM/config/key mounting and effective cross-project access
  still require authorization, negative production-access tests and real staging
  read/write correctness/100+ concurrency checks. Local fake GAPIC is not GCP proof.
* Quota DB isolation is **not provider account isolation**. Staging/production
  currently share an OpenAI secret; unchanged. Provider retention/account policy
  and Cloud Logging retention are independent operational gates. Real calls need
  separate approval with minimum exact counts.
* Suggested future Cloud Run configuration (not changed/hardcoded here): 2GiB,
  CPU2, worker1, concurrency4, max instances1, timeout300s. Measure RSS/cgroup/tmp,
  cancellations, proxy buffering and upload deadlines on actual staging.
* New source needs review then a **new** commit/build/digest/revision. Supply that
  commit via DARIN_BUILD_COMMIT; never label this layer as the earlier P1.3 SHA.
  Until committed, local /version smoke uses unknown or a synthetic test SHA.
* Rollback AI OFF first. Never blindly restore old AI-ON revision or delete
  counters/UNKNOWN reservations. Resource provisioning/build/deploy are not done.

FFmpeg package apt pinning remains a known P2; distributed telemetry export and
production-retention evidence remain operational work, not silently marked PASS.

## Local verification record — 2026-09-11

* Host suite: 282 PASS, 0 skipped (38.164s).
* Final Linux amd64 Python 3.12.14 container: 282 PASS, 0 skipped (75.633s).
  Existing 257 tests plus 25 composition/harness/observability tests.
* Local image `darin-ai:credential-enforcement-local`, manifest-list digest
  `sha256:9e5716d95efc60bb5f3e821989edfee3767ad0875e9bc127a359295f55f59d40`.
  Packaged app's 34 Python files match the working source byte-for-byte. Tests
  mounted read-only; app imports resolve to packaged image, not mounted source.
  Container external networking disabled; localhost tests still run.
* Docker CMD bootstrap-off /health and /version succeeded; commit remains
  `unknown` for uncommitted smoke. Temporary smoke container stopped/removed.
* Typecheck, AI policy, architecture, secrets, voice-scope, Python compile and
  diff whitespace checks PASS. Initial sandbox-only host run blocked existing
  socket/multiprocessing tests; authorized host rerun passed, not a code regression.
* Memory regression: 2 admitted maximum-size requests; 20 denied requests consume
  zero body/materialized bytes; 2 maximum live canonical objects. Container heap
  wait 44.17MiB, peak 88.11MiB, denied incremental peak 1.46MiB. These are test heap
  observations, not a Cloud Run RSS/cgroup capacity certification.
* Actual provider calls: 0. Real Firestore/ADC/GCP operations: 0. No stage/commit,
  push, Cloud Build/deploy, external environment/secret/IAM/resource change.

Changed files (all beneath server/ai):

* app/quota/composition.py — new validated runtime composition and binding.
* app/quota/harness.py — new isolated no-provider administrative CLI.
* app/telemetry.py — new bounded internal metrics and memory sample.
* app/factory.py — default composition and internal readiness/snapshot hooks.
* app/quota/firestore.py — bounded transaction outcome/retry/latency counters.
* app/quota/repository.py — admission and operation outcome counters.
* app/quota/service.py — dispatch attempt counter.
* app/audio_admission.py — lifecycle counters/gauge.
* app/audio_duration.py — verification/child lifecycle counters/gauge.
* app/upload.py — timer/first-body/timeout counters.
* tests/test_quota_composition.py — 16 new tests, real SDK with fake GAPIC.
* README.md — runtime contract link.
* STAGING_ENABLEMENT.md — architecture, operational gates and this record.

Verdict: **COMBINED STAGING ENABLEMENT IMPLEMENTED LOCALLY — READY FOR SECURITY REVIEW**.
This is not approval to modify GCP, commit, deploy, or enable paid execution.

## Focused runtime credential fix — 2026-09-12

The central runtime now requires `DARIN_RUNTIME_SERVICE_ACCOUNT` and obtains a
dedicated fixed-transport credential only after matching that value against the
Cloud metadata identity. Every refresh repeats the identity check and obtains a
token from the explicit service-account path. Direct link-local HTTP ignores all
proxy variables and never follows redirects; ambient GCE metadata endpoint
overrides are rejected. User `authorized_user` ADC, default compute identity,
arbitrary credential files, static tokens and metadata mismatch/unavailability are
rejected. The explicit quota project/database remains independent of the workload
identity. `bootstrap-off` remains credential-free only when AI is OFF; central mode
always requires the identity contract. No provider, Firestore, IAM, Secret Manager
or GCP request was made.

Focused tests cover the user-ADC attack, metadata precedence, wrong/default SA,
missing expected identity, unavailable metadata without fallback, credential-file
rejection, fixed link-local metadata headers and bounded responses, strict identity
wire format, proxy isolation, redirect rejection, GCE override rejection,
refresh-time identity revalidation, explicit token endpoint binding, token response
validation, concurrency, cross-project target, bootstrap semantics and
credential-error redaction. The next required step is an independent focused
security re-review; this local fix remains uncommitted.

Focused hardening verification on 2026-09-12: host suite 290 PASS / 0 skipped;
Linux amd64 Python 3.12.14 container 290 PASS / 0 skipped. Local image
`darin-ai:fixed-metadata-credential-local` has digest
`sha256:ca4c8adaf5d36e1e9bef245a8274571b83e41e69d5335bc858bfee2d0949490f`.
Container networking was disabled and tests were mounted read-only; actual
metadata, Firestore and provider calls were zero. No stage, commit, push, deploy,
GCP, IAM, Secret Manager, Supabase, EAS or mobile change was made.

Focused verdict: **FIXED METADATA WORKLOAD CREDENTIAL HARDENING COMPLETE — READY FOR FOCUSED SECURITY RE-REVIEW**.

## Metadata absolute-deadline follow-up

The focused review reproduced unbounded 100-Continue and chunked-trailer reads:
the former two-second socket idle timeout did not bound the whole operation.
The transport now uses a per-connection monotonic deadline covering connect,
request and response reads. A small RawIOBase wrapper applies the remaining time
to every socket read beneath the standard HTTP parser. This includes interim
responses, trailer lines and slow drips; no watchdog/background I/O worker or
process-global networking change is used. Normal HTTP file-reference ownership
ensures response/connection cleanup releases the actual socket on failure.

Every identity/token lookup has a two-second absolute deadline. Refresh lock
acquisition has a four-second limit; a waiter that times out fails without
mutating the active owner's token. The owner clears token/expiry if its metadata
operation fails, releases the lock, and permits later recovery. Normal Google
Auth cached-token semantics remain unchanged.

Real loopback tests exercise continuous interim responses, endless trailers,
slow header/body drips, connect/header/body stalls, token failure after success,
concurrent waiters, recovery and 300 success/rejection socket lifecycles. These
tests contact no real metadata, Firestore or provider service.

Final commit gate: host 296 PASS / 0 skipped (60.982s); Linux amd64 Python
3.12.14 container 296 PASS / 0 skipped (103.326s). Typecheck, AI policy,
architecture, secrets, voice scope, Python compile and diff checks passed.
Bootstrap-off startup and /health + /version smoke passed with networking disabled.
The local image `darin-ai:metadata-deadline-verified-local` manifest-list digest is
`sha256:34a663b8d13d34a6e5f2c50d130d71ccca092fe62227df7d39fd8b935d3905d1`.
All 35 packaged Python app files match the local source (path/content aggregate
SHA-256 `bac10b37dc9ca3331d93cb9ea2653448c0afb2a9704c964bf7d8b44ff710c5aa`).
The user authorized committing this reviewed combined enablement layer and its
credential fixes after these gates. Actual metadata/Firestore/IAM/Cloud Run
behavior remains UNVERIFIED — STAGING GATE; no provider calls or deployment occurred.
