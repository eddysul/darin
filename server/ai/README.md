# Darin AI Backend v2

This directory is the source of truth for Darin's versioned AI gateway. It is
independent of the historical `dh` worktree and is not wired to the mobile app
or the existing Cloud Run service yet.

## Architecture

```text
Mobile client
  -> Supabase bearer JWT
  -> authentication and per-user rate limit
  -> operation registry and strict input schema
  -> server-owned policy, model and token budget
  -> LLM/STT adapter with explicit timeout
  -> operation-specific output validation
  -> privacy-safe response and metadata-only log
```

Route handlers do not accept a system prompt, provider, model, policy override,
or output-token override. User questions, diary text, care-log text, profile
text, and transcripts are serialized only into the provider's user message and
are labeled `UNTRUSTED_INPUT_JSON`. The fixed system message is selected from
the server operation registry.

## Endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Returns only `{ "status": "ok" }` |
| GET | `/version` | Public | Service, semantic version, build commit and policy version |
| POST | `/v1/ai/execute` | Supabase bearer JWT | Executes one allow-listed AI operation |
| POST | `/v1/transcribe` | Supabase bearer JWT | Validates/transcribes audio and extracts reviewable care events |

The public endpoints never expose environment values or provider readiness.

### AI operation envelope

```json
{
  "operation": "weekly_narrative",
  "input": {},
  "locale": "ko"
}
```

The v1 allow-list is deliberately limited to:

- `consult_record_question`
- `weekly_narrative`
- `insight_phrase`

Unknown operations and extra fields are rejected. Each operation has a distinct
Pydantic input and output model. Supported locales are `ko`, `en`, `ja`, `es`,
and `zh-CN`.

### Error shape

```json
{
  "error": {
    "code": "OUTPUT_REJECTED",
    "message": "The generated result did not pass Darin safety validation."
  },
  "requestId": "opaque-request-id",
  "fallbackRecommended": true
}
```

Stable error codes include `AUTH_REQUIRED`, `AUTH_INVALID`,
`INVALID_OPERATION`, `INVALID_INPUT`, `REQUEST_TOO_LARGE`,
`UNSUPPORTED_AUDIO_TYPE`, `INVALID_AUDIO`, `RATE_LIMITED`, `AI_DISABLED`,
`PROVIDER_TIMEOUT`, `PROVIDER_ERROR`, and `OUTPUT_REJECTED`. Provider messages,
stack traces, request text, and secret values are not returned.

## Authentication and resource trust boundary

Every `/v1/*` route requires a Supabase access token. `SupabaseJwksVerifier`
uses the project's HTTPS JWKS and permits only `ES256` and `RS256`. Decoding
requires a valid signature plus `iss`, `aud`, `exp`, and `sub` claims. The
issuer defaults to `${SUPABASE_URL}/auth/v1`, the audience defaults to
`authenticated`, and the authenticated user is always taken from `sub`.

JWKS snapshots expire after 300 seconds; individual signing keys are not cached
indefinitely. Refreshes are serialized and limited to one attempt per 30 seconds
per instance, including failures and unknown `kid` requests. Unsupported header
algorithms and missing/oversized key IDs are rejected before JWKS fetching.
Expired snapshots are never accepted during an outage. New signing keys may
therefore require up to 30 seconds to become available; a removed key may remain
usable for at most the snapshot lifetime. This is not instant token revocation.

This v1 service does **not** read Care Logs or diaries from Supabase. It can
verify the authenticated user, operation, schema, payload limits, policy, and
output. It cannot prove that every client-supplied snapshot belongs to a
resource that user may read. Inputs therefore remain untrusted snapshots. The
auth verifier and operation layer are separate so a later server-side resource
loader/authorizer can be added without changing provider adapters. A service
role key is intentionally not part of this implementation.

## Server policy and output validation

The policy prohibits medical judgments, treatment advice, peer comparisons,
causal claims, and unsupported states/events. **Keyword filtering is not the
final approval boundary.** Under policy `2026-09-08.v2-p0`, all three execute
operations use closed provider selections and server-owned five-locale copy:

| Operation | Only accepted provider output | Server rendering |
| --- | --- | --- |
| `consult_record_question` | `{"claim_type":"record_references","fact_indexes":[0]}` | Acknowledges the number of referenced supplied items; unique integer indexes must exist |
| `weekly_narrative` | `{"claim_type":"metric_comparison","metric":"sleepMinutes"}` | Uses that metric's original previous/current averages and enum unit |
| `insight_phrase` | `{"claim_type":"associations","observation_ids":["feed-sleep"]}` | Uses the supplied relation enum; every ID must match in order |

Extra fields, including otherwise harmless prose, are rejected. Provider text,
fact text, question text, source sentences and arbitrary display labels are
never inserted into the final sentences. Clinical requests recognized by the
existing gate still return the fixed localized boundary without a provider call.
Unrecognized clinical requests cannot expand the closed output vocabulary.

This is an intentional **staging capability reduction**, not a full semantic
grounding redesign: consult no longer produces a free-text factual answer, and
insight copy no longer repeats source-sentence numbers. Their untyped text is
not sufficient evidence to safely render arbitrary claims. The public result
shapes remain unchanged. The legacy text validators in `validators.py` are not
used to approve execute responses. Voice-event validation is unchanged; its
P1 field/event grounding gaps remain follow-up work.

Voice numeric grounding now rejects signed, ranged, scientific-notation,
thousands-separated and approximate quantity evidence instead of extracting a
positive suffix. The check applies to the enclosing event clause even when the
provider selects a shorter source span. Simple exact decimals remain supported.
This deliberately rejects unsupported precision rather than converting it;
complex multilingual assertions, clock field roles and date/timezone semantics
still require further hardening. The finite notation checks are not a complete
natural-language semantic proof.

Rejected output is never returned as successful AI copy. The error tells the
future client to retain its deterministic fallback.

## Audio handling

`/v1/transcribe` accepts multipart field `file` and optional `locale`. P1.3's
supported subset (all paths require full validation, not just signatures) is:

- `audio/m4a`, `audio/x-m4a`, `audio/mp4`: non-fragmented ISO BMFF, one AAC-LC
  audio stream, mono/stereo, no other tracks/cover art/external data references.
- `audio/wav`: one RIFF/WAVE PCM16LE mono/stereo stream; strict chunk framing.

Supported source sample rates are 8, 16, 22.05, 24, 32, 44.1 and 48 kHz.
The old signature-only `audio/mpeg` (ID3/MPEG) and `audio/webm` (EBML) paths are
now disabled. Unknown codecs, fragmented layouts and ambiguous streams fail
closed. See [P1.3 duration contract](AUDIO_DURATION.md) for the threat model,
exact limits, proof and billing semantics, and runtime/security review caveats.

The route declares no FastAPI `File`/`Form` parameters: JWT authentication runs
before any body consumption. Declared size, kill switch and per-user rate gates
run before parsing. Starlette's existing multipart parser then receives a
bounded stream: **24 MiB per file, 24 MiB + 64 KiB total request bytes**, one file,
and at most one small `locale` field. Actual received bytes are counted even
when Content-Length is missing or false. One ASGI chunk crossing the limit is
received from the transport but is not forwarded to the parser. The server
cannot control buffering performed by an upstream proxy/ASGI server.

Before quota reservation, the server verifies actual PCM sample counts and emits
a canonical PCM WAV. Only this exact hash-bound WAV is sent to Whisper under the
existing timeout. Client durations and container duration tags cannot set the
proof or reservation. No proof still means `COST_BOUND_UNAVAILABLE`, STT/parser 0.
Spools are explicitly owned and synchronously closed
in `finally`, including incomplete/malformed input, disconnect, cancellation
during parsing or provider work, overflow, and provider error. A missing final
multipart boundary is rejected. No persistent audio storage is added.
The transcript and parsed events are returned for the existing confirmation UX;
they are not saved by this service.

No code disables TLS certificate or hostname verification. Provider SDKs and
JWKS retrieval use their standard verified HTTPS transports.

## Limits, rate protection and cost controls

| Limit | Value |
| --- | --- |
| AI JSON request | 128 KiB |
| Audio | 24 MiB |
| Verified audio duration | 120 seconds inclusive, integer sample boundary |
| Multipart total | 24 MiB + 64 KiB |
| Multipart fields | one `file`, optional one `locale` (32-byte field limit) |
| Consult facts | 80 items, 500 characters each |
| Consult question | 2,000 characters |
| Weekly metrics | 20 |
| Insight observations | 5 |
| Consult output | 450 tokens |
| Weekly output | 220 tokens |
| Insight output | 300 tokens |
| Voice event parse output | 900 tokens |
| LLM timeout | 20 seconds |
| STT timeout | 45 seconds |
| AI rate | 30 requests/user/operation/minute |
| Transcribe rate | 10 requests/user/minute |

`DARIN_AI_ENABLED=false` is the safe default and disables both provider-backed
routes while health/version remain available. The model names and token limits
are server-owned constants rather than request fields.

The rate limiter is deliberately in-memory and per Cloud Run instance. One
Uvicorn worker keeps each instance internally consistent, but limits are not
global across multiple instances and reset on restart. Before public traffic or
abuse-sensitive scale, replace this adapter with a shared atomic limiter such as
Redis/Memorystore or an API gateway quota while retaining the same user and
operation keys. Cloud Run max instances should be a second cost ceiling, not a
substitute for the shared limiter.

The local limiter retains at most 10,000 user/operation keys, sweeps expired
entries and denies new keys at capacity without evicting active quota history.
`Retry-After` rounds up to avoid suggesting retries before the window expires.
This bounds local storage; it does not implement shared quotas or a global cost
ceiling. Capacity exhaustion can still deny new users until entries expire.

## Logging and retention

Application logs contain only request ID, operation, a salted opaque user hash,
status, latency, path, provider/validation metadata when supplied, and an error
category. The logging API discards unapproved fields. Do not add authorization
tokens, raw audio, full transcripts, diary bodies, care-log memos, chat history,
or full prompts.

- Raw audio: not persistently stored by this backend.
- Request payload: not stored in an application database.
- Transcript: not stored in an application database.
- AI response: not stored in an application database.
- Deletion lifecycle: request-scoped memory is released after the response;
  upload handles are explicitly closed.

**PROVIDER RETENTION REQUIRES EXTERNAL POLICY VERIFICATION.**

Cloud Logging retention/redaction and the provider account's retention or zero
data retention settings must be verified outside this repository before staging
approval. This README does not claim a provider retention period.

## Environment

Copy `.env.example` for local development and supply values through an ignored
file or the process environment. Required server-only values are:

- `SUPABASE_URL`
- `OPENAI_API_KEY`

Production also needs `DARIN_AI_ENABLED=true`, a build-injected
`DARIN_BUILD_COMMIT`, and a secret `DARIN_LOG_HASH_SALT`. Optional JWT issuer and
JWKS overrides exist for explicit Supabase configuration. Never place these
values in Expo/EAS public variables or commit them.

## Local setup and tests

```bash
python3 -m venv server/ai/.venv
server/ai/.venv/bin/pip install -r server/ai/requirements.txt
server/ai/.venv/bin/python -m unittest discover -s server/ai/tests -p 'test_*.py'
```

After installing backend dependencies, the repository-level repeatable command
is:

```bash
npm run qa:ai-server
```

Local run:

```bash
set -a
source server/ai/.env.local
set +a
uvicorn server.ai.app.main:app --host 127.0.0.1 --port 8080
```

The service remains disabled until `DARIN_AI_ENABLED=true` is set.

## Docker

```bash
docker build -t darin-ai-v2:local server/ai
docker run --rm -p 8080:8080 --env-file server/ai/.env.local darin-ai-v2:local
```

For a provenance-preserving build, inject the reviewed Git SHA as
`DARIN_BUILD_COMMIT`, tag the image with the same SHA, record the immutable
digest, and verify `/version` after deployment.

## Deployment boundary

This build does not modify or deploy the existing `darin-ai` Cloud Run service,
change traffic, create secrets, change Supabase, or point EAS/mobile clients to
these `/v1` routes. Staging must use a separate service and separate endpoint.
# Combined staging runtime

See [STAGING_ENABLEMENT.md](STAGING_ENABLEMENT.md) for the explicit central versus
bootstrap-off startup contract, mounted keyring, no-provider synthetic ledger CLI
and internal observability hooks. This is local implementation only, not approval
to provision GCP or deploy. Default runtime now requires `DARIN_QUOTA_MODE`.
