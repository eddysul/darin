# P1.3 — verified duration (local implementation, not deployed)

Scope: `server/ai/**` only. No ledger redesign, Voice NLP change, cloud resource,
deployment, provider request, staging toggle, stage or commit is authorized here.

## Capability and threat model

The old upload inventory was M4A/MP4 (`ftyp`), WAV (`RIFF/WAVE`), MP3
(`ID3`/MPEG sync), WebM (`EBML`). Signatures were not duration/codec proofs.
The new effective upload/verifier allow-list is intentionally smaller:

| Input MIME | Container/codec | Verification | Corruption/ambiguity behavior |
| --- | --- | --- | --- |
| `audio/wav` | RIFF PCM16LE, 1/2 channels | RIFF envelope audit + stdlib `wave`, exact complete sample bytes | Reject truncated/forged RIFF/data sizes, duplicate/unknown chunks, partial frames, wrong block/byte rate, zero frames |
| `audio/m4a`, `audio/x-m4a`, `audio/mp4` | Non-fragmented BMFF, one AAC-LC stream | Bounded box/dref audit + FFprobe stream check + complete strict FFmpeg PCM decode | Reject missing boxes/references, external references, unsupported codec, decoder errors, extra tracks/cover art/video |
| MP3, WebM, other MIME/codec | Not supported in P1.3 | No proof | Fail closed before provider |

Rates: 8000/16000/22050/24000/32000/44100/48000 Hz; mono/stereo only.
WAV strips only permitted benign `JUNK`, `LIST`, `bext`, `PAD ` chunks.
AAC is decoded/resampled to 16 kHz PCM16LE preserving channel count. Decoder
padding counts as actual output samples, rather than being subtracted by a
metadata estimate. This may conservatively reject an encoded clip labelled
120 seconds when its actual decoded sample count is greater than 120 seconds.

Threats covered: tiny low-bitrate long files, duration metadata spoof, malformed
sample counts, truncation/corruption, unsupported codecs, decoder exhaustion,
multiple/hidden tracks, arbitrary URLs/filenames/options, external drefs,
cancelled requests and leaked process/temp handles. Codec CVEs remain an update
and independent review obligation, not something finite fixtures can disprove.

## Why the proof matches the provider input

```
JWT -> byte/kill/rate gates -> request admission -> bounded multipart -> MIME/signature
 -> strict media validation -> complete PCM samples -> <= 120 seconds
 -> canonical PCM WAV + SHA256-bound VerifiedAudioDuration
 -> unchanged P1.2 reserves STT + parser -> provider receives that exact WAV
```

We do not send the original compressed container after probing it. This avoids
different provider interpretation of edit lists, timestamps, streams, tags or
padding. The actual provider payload is always a plain PCM WAV, a supported
[Whisper transcription input](https://developers.openai.com/api/reference/python/resources/audio/subresources/transcriptions/methods/create).
The original upload's filename and metadata are never forwarded.

## P1-1 follow-up — request-lifetime audio admission (local, uncommitted)

The diagram above's multipart step is now preceded by process-local **request
admission**, separate from the existing media-worker semaphore:

```
JWT -> declared-size / local AI kill switch / cheap rate gate
 -> non-blocking audio request admission
 -> bounded multipart / upload / full decode / canonical proof
 -> P1.2 STT + parser reservation / dispatch / reconciliation
 -> upload, child and large-reference cleanup -> admission release
```

`audio_admission.py` supplies a shared process budget (even across multiple app
compositions in that process), default/hard maximum **2 requests**, no wait queue.
Internal code/test configuration may reduce it to 1; non-integer, boolean, zero,
negative or >2 fails construction. Upload caps outside 1..24 MiB fail application
startup. No client header, declared length, compressed size, MIME average, HTTP
field, environment variable or remote config reduces the reservation or raises
capacity. Saturation immediately returns the existing safe error envelope with
HTTP 503 / `AUDIO_CAPACITY_EXCEEDED`, before body consumption/parser/spool/verifier
or provider work. Authentication, local AI OFF and cheap rate rejection still
precede admission. Central quota remains a separate, post-verification gate.

### Integer worst-case reservation

WAV preserves up to **48 kHz stereo PCM16**, unlike AAC's 16 kHz output. Therefore:

```
maximum canonical WAV = 120 * 48000 * 2 channels * 2 bytes + 44 header
                      = 23,040,044 bytes
request reservation   = 4 * (24 MiB upload + 64 KiB multipart allowance)
                      + 4 * maximum canonical WAV + 4 MiB safety overhead
                      = 197,279,920 bytes
two-request budget    = 394,559,840 bytes (376.282 MiB)
```

Copy allowances conservatively cover input/spool/transport/chunks/join and PCM
audit/read/BytesIO/canonical buffers; the bounded parser, pipe and object overhead
has separate headroom. These are fixed logical reservations used to justify a
small in-flight count, **not a claim that total Python/SDK RSS is capped at this
number**. FFmpeg children, interpreter/libraries, ASGI/proxy buffers, other routes
and allocator behavior are separate. Cloud Run memory/concurrency sizing and
real cgroup measurements remain a staging gate. Multiple processes each have
their own budget; this is neither a global memory quota nor a cost quota.

### Ownership and termination

`transcribe_admitted` contains all large locals. Its entire coroutine, including
upload context and accounting, finishes/unwinds before the admission owner
releases the slot in `finally`. A returned response owns events/transcript only,
never audio. On exceptions/cancellation, unwound frames and cause/context/group
chains are cleared, and only a fresh safe error/category or cancellation escapes.
This also prevents a suppressed provider exception/SDK request from retaining
audio through an error traceback after slot return. Error cleanup preserves
existing output rejection categories and never logs raw error content. Normal
success, failure and cancellation do not rely on cyclic GC to clear audio locals.
Provider adapters must not retain media requests in background tasks/caches after
their coroutine completes; production STT awaits its timed request, without retries.

The independent FFmpeg semaphore remains two slots and releases after media
verification. Request admission does **not** release then: it remains held during
STT/parser waits and reconciliation. If only the worker slots are artificially
occupied, up to the admitted request count may read and fail `AUDIO_VERIFIER_BUSY`;
this is bounded, not a claim of zero read for every worker-busy response. If the
request slots are occupied by those verifications or provider waits, extra requests
perform zero body reads. Client disconnect while uploading closes the spool;
cancellation through verification/provider paths waits for existing cleanup before
release. A disconnect that does not cancel a post-upload ASGI task retains its
slot until that task/provider timeout finishes—never releases while work survives.

### Regression coverage

`tests/test_audio_admission.py` uses the real FastAPI route and verifier with fake
auth/central store/providers. It measures receive bytes, parser creation, spool
writes, materialization, verifier/worker/provider calls; checks 20 denied requests,
blocked STT/verification/accounting, auth/OFF/rate ordering, invalid media/quota/
provider/parser failures, disconnects, cancellation at four stages and real child
kill/temp cleanup. It checks 500 acquire/fail/release cycles, invalid config, and
weak references with cyclic GC disabled **at the release boundary**. A 120-second
48 kHz stereo memory probe measures retained objects and denial allocations without
using platform-specific RSS thresholds. Existing duration/hash/cost/auth suites
remain required, unchanged. No stage/commit/deploy/provider call is authorized by
this local follow-up; focused security re-review precedes the commit gate.

`VerifiedMedia` pairs canonical `ValidatedAudio` with frozen
`VerifiedAudioDuration`: wire SHA256, integer milliseconds rounded **up**, proof
version, integer sample count/rate and extraction method. Methods are
`pcm-frames.v1` and `aac-full-decode-pcm.v1`. Existing explicit internal test DI
is retained; HTTP cannot supply a verifier/proof. Explicit missing proof still
fails P1.2 with `COST_BOUND_UNAVAILABLE` and zero STT/parser calls.

The exact acceptance test is `sample_count <= sample_rate * 120`. No float is
used at this boundary. Zero frames reject. The only use of float is to reject
missing/nonfinite/nonpositive AAC metadata; that number NEVER computes the
proof, sets a decoding stop time or controls the reservation. Spoofed metadata
either rejects or has no effect on the full decoded sample bound.

## Billing upper bound and unchanged P1.2 contract

Integer milliseconds = `ceil(sample_count * 1000 / sample_rate)`.
P1.2 then reserves `ceil(milliseconds / 60000) * 6000` microUSD for Whisper-1,
plus the already-defined parser worst-case bound, before the first dispatch.
The [Whisper-1 price](https://developers.openai.com/api/docs/models/whisper-1)
is $0.006/minute; full-minute rounding deliberately over-reserves instead of
depending on undocumented sub-minute billing precision. At 4.095 seconds STT
reserves 6000 microUSD; at exactly 120 seconds 12000 microUSD. Pricing authority,
currency/date attribution, usage envelope, reconciliation and crash/idempotency
state machines are unchanged. Unknown usage is not inferred from this proof.
This bound assumes the centrally approved duration-only Whisper-1 price/profile
remains applicable (no new request fee or uplift); any provider pricing/contract
change requires approval/revalidation, not silently reusing this profile.

## Bounded parser and process execution

- Upload stays 24 MiB with its existing auth-before-parser gate.
- At most two verifier slots per process, fail-fast when busy; one child per slot
  at a time. Slots cover WAV parsing and both compressed stages.
- BMFF audit is limited to 4096 envelopes/depth 6, exactly one local `dref`, one
  `ftyp`/`moov`/`mdat`; fragmented media is rejected. It does not implement a codec.
- WAV envelope audit is limited to 128 chunks; stdlib `wave` handles PCM parsing.
- Fixed argv, no shell, server-owned temp name in a private directory. MOV demuxer,
  AAC decoder, `file` protocol only; `enable_drefs=0`, `use_absolute_path=0`.
  External `dref` declarations also reject before subprocess execution, not merely
  ignored. No URL/playlist/nested demuxer selection from requests.
- Complete decode with `-xerror` and strict error detection. No `-t` truncation
  that could turn an overlong input into an accepted short clip.
- Each probe/decode gets 10 seconds wall time, CPU 6 seconds (7-second hard kill),
  FD 64, no core dumps, no regular-file writes, single codec/filter/BLAS threads.
- Linux child NPROC is capped at 64 per real UID, in addition to the two-slot
  application gate (saturation fails closed, it cannot cause unbounded forks).
- Linux child `RLIMIT_AS` is 768 MiB total virtual memory; FFmpeg `max_alloc`
  32 MiB is an additional **single-allocation** cap, not a total memory cap.
  512 MiB was rejected during amd64 validation because the distro codec shared
  libraries could not be mapped even at startup; 768 MiB retains a hard bound.
- Probe output <=64 KiB, stderr <=8 KiB; PCM output <=7,680,000 bytes (stereo
  120 seconds at 16 kHz), plus one overflow-detection byte and bounded pipe buffers.
- Child env contains only locale/path/thread bounds, not application secrets.
  No `preexec_fn`: a fresh Python helper sets rlimits and `execv`s the tool.
- Timeout/cancel/overflow/crash kills the process group, reaps children, drains
  or cancels reader tasks, closes private input files, deletes the temp directory
  and releases the slot. The outer upload context closes its spool too.

The production-like **Linux Python 3.12 container gate is mandatory**. macOS
development runs have the same byte/CPU/time/count guards but cannot claim the
Linux hard total-memory limit (Darwin AS/DATA limits are not reliable). Do not
run this service in production on macOS under this contract.

FFmpeg is installed in the runtime image via Debian security-maintained packages.
The Python base is digest-pinned; apt versions remain updateable, so an image
digest + recorded FFmpeg package version, not source SHA alone, identifies the
tested runtime. Future security maintenance must rebuild and rerun this suite.
See [FFmpeg options](https://ffmpeg.org/ffmpeg.html) and
[protocol allow-lists](https://ffmpeg.org/ffmpeg-protocols.html).

## Errors and privacy

Unsupported formats/codecs/references: `AUDIO_FORMAT_UNSUPPORTED` or initial
`UNSUPPORTED_AUDIO_TYPE`. Invalid framing/metadata: `AUDIO_METADATA_INVALID`.
Too long: `AUDIO_TOO_LONG`. Decode failure, timeout, crash: generic
`AUDIO_DURATION_UNVERIFIED`. Missing executable/proof: `COST_BOUND_UNAVAILABLE`.
Busy slot: `AUDIO_VERIFIER_BUSY`. All fail before quota/provider dispatch.

No audio, raw probe output/stderr, uploaded filename, transcript, JWT or provider
content is added to logs/errors/ledger. In-memory PCM and bounded private files
are transient only. This work does not change provider/log retention policy.

## Verification and remaining review

`tests/test_audio_duration.py` generates synthetic WAV/AAC locally and uses fake
auth/store/STT/parser. Tests require ffmpeg and fail (never skip) when absent.
It covers 4.095 seconds, one sample, one second, max +/- one sample, 1800-second
compressed media, VBR, malformed/forged/truncated files, nonfinite metadata,
multi-track/cover art, remote references, command safety, OS/process/output
limits, cancellation/cleanup, canonical proof/price and route success, zero
unauthenticated consumption, provider-zero failures and privacy-safe logging.
Existing P1.1/P1.2/Voice 216-combination/upload-P0 suites remain mandatory.

Independent security review must inspect the format subset and envelope audits,
decoder/provider equivalence, cancellation under ASGI load, and image dependency
maintenance. No actual provider compatibility test or cloud environment test is
performed here. Real device format coverage, broader multilingual/time grounding,
provider retention and Cloud Logging retention verification remain separate work.

## Local verification record — 2026-09-10

Baseline HEAD remains `6970c6d60d72d4608c1e5e7263bf9931720be947`.
These P1.3 changes are **unstaged, uncommitted, not deployed**.

| Gate | Final result |
| --- | --- |
| Host `npm run qa:ai-server` | 221 PASS / 0 skipped, 24.042 seconds |
| Linux amd64 Python 3.12.14 full suite | 221 PASS / 0 skipped, 50.619 seconds |
| Existing baseline cases | All 186 preserved; Voice matrix still checks 216 combinations |
| New duration cases | 35 tests, including real WAV/AAC decode and fake-provider routes |
| `npm run typecheck` | PASS |
| `npm run qa:ai-policy` | PASS |
| `npm run qa:architecture` | PASS |
| `npm run qa:secrets` | PASS, including untracked source |
| `npm run qa:voice-scope` | PASS |
| Python compile | PASS, 48 source/test files; no generated bytecode written |
| `git diff --check` | PASS |
| Packaged runtime vs tested source | All 30 application Python files byte-identical |
| Actual image Uvicorn startup | PASS; `/health` 200, `/version` 200, unauthenticated transcribe 401 |
| Provider/external changes | 0 actual provider calls; no cloud/app/config changes |

Final local image: `darin-ai:p1-3-duration-amd64-local-20260910`.
Image ID: `sha256:ba696b8db4fa318866329ac28ee0193d5ca68a63547363f5b5a04e01e15ce671`.
Application content digest (sorted relative paths + file bytes):
`570e1a48d258469818bf50d4340138f7cb1e9e382a02e07e3585cfb884dc9e93`.
Runtime FFmpeg: `7.1.5-0+deb13u1`; UID 10001, Linux x86_64. Docker ran locally
on the Mac via amd64 emulation, with network disabled, read-only root/source,
no capabilities, no-new-privileges, 2 GiB memory, 2 CPUs, 256 PIDs and bounded
temporary tmpfs. Startup uses test placeholders, never real credentials.

Intermediate failures were in this new implementation, not the baseline:
Darwin cannot enforce the intended AS/DATA limit; native Mac runs are explicitly
development-only. The Linux amd64 library mapping required increasing the hard
AS bound from 512 to 768 MiB. An initial pipe-close warning led to kill/reap plus
explicit bounded-buffer draining and shielded repeated-cancellation cleanup.
All were followed by the successful full reruns above. Existing deprecation and
synthetic rejection-test diagnostics remain; they are not skipped/failing tests.

Changed files (all under this directory):

- `Dockerfile`
- `README.md`
- `AUDIO_DURATION.md`
- `app/audio.py`
- `app/audio_duration.py`
- `app/media_worker.py`
- `app/factory.py`
- `app/quota/pricing.py` (proof metadata/comments only; pricing logic unchanged)
- `tests/audio_fixtures.py`
- `tests/test_audio_duration.py`

No new P0 was identified in this bounded local verification. This is not an
independent security audit or production-readiness approval. Review of the media
boundary and runtime maintenance is still required before a separate commit gate.

Verdict: `P1.3 AUDIO DURATION IMPLEMENTED LOCALLY — READY FOR SECURITY REVIEW`.

## Memory admission follow-up verification — 2026-09-10

The earlier implementation record above is retained as history. This follow-up
changes only `app/factory.py`, new `app/audio_admission.py`, new
`tests/test_audio_admission.py` and this document. Other uncommitted P1.3 work is
preserved; HEAD remains `6970c6d60d72d4608c1e5e7263bf9931720be947`; nothing staged.

- Final host suite: **240 PASS / 0 skipped**, 30.545 seconds (221 existing + 19 new).
- Final fresh-image Linux amd64 Python 3.12.14 suite: **240 PASS / 0 skipped**,
  67.644 seconds. FFmpeg `7.1.5-0+deb13u1`, non-root UID 10001.
- Image: `darin-ai:p1-3-admission-amd64-local-20260910`.
- Local image ID: `sha256:6188abd2d55226da325c2d5a58744cb9d602701c81bfa93ac93d43231f88e8d8`.
- Packaged app vs tested source: all 31 Python files byte-identical; sorted
  path/content SHA256 `7560b34bf0a3608fa97eafb5fc82f2f8860c730781c88102acb2aac667c4f9c3`.
- Uvicorn startup: health/version 200, no-auth transcribe 401. `/version` reports
  `unknown` intentionally: this is an uncommitted local image, not commit provenance.
- Python compile: 50 app/test files; typecheck, AI policy, architecture, secrets,
  voice-scope and diff whitespace checks PASS.
- No actual provider calls; no cloud, deployment, mobile, EAS, Supabase, IAM or
  secret changes. Tests run with network disabled and source/root read-only.

Linux memory probe (same 120s/48kHz/stereo 23,040,044-byte synthetic input):
two admitted STT waits, twenty extra requests denied before body read, zero denied
materialization, maximum two live canonical audio owners. Waiting heap increase
44.18 MiB; admission peak 88.12 MiB; denied-request incremental peak 1.46 MiB
(framework/error overhead, not audio allocation). The independent pre-fix review
observed four waits retaining ~90.1 MiB, and four worker-busy responses which had
already materialized 92,160,176 bytes. These are bounded local Python heap probes,
not total RSS or Cloud Run production load certification. The after-test uses
direct ASGI receives to count rejected input rather than HTTP client allocations.

Intermediate failures were addressed, not skipped: Python 3.10 needs the ASGI
stack's existing ExceptionGroup backport; sandbox IPC blocked two pre-existing
quota multiprocess tests (rerun with local IPC permission); an offline Docker
build cache mode could not resolve Debian packages (normal build reused cached
dependency layers). Under amd64 emulation plus tracemalloc/debug, the new large
upload probe occasionally exceeded its 15-second setup wait; only that test's
setup deadline became 45 seconds, with early request-failure detection. Product
timeouts and all resource/acceptance assertions are unchanged. Final full reruns
above pass without skips.

Remaining: focused independent re-review of admission/exception cleanup before
any commit gate; staging process/cgroup sizing and disconnect/transport behavior;
the existing P2 FFmpeg version/provenance/update obligation. No newly identified
P0/P1 remains in this bounded local verification; this is not production approval.

Verdict: `P1.3 MEMORY ADMISSION FIXED LOCALLY — READY FOR FOCUSED SECURITY RE-REVIEW`.

## Upload-duration starvation follow-up — 2026-09-11 (local only)

The subsequent focused review closed the request-lifetime memory finding but
identified a separate P1: two authenticated incomplete uploads could hold both
request slots indefinitely while awaiting another body chunk. A keep-alive
timeout did not bound active uploads. The historical verdict above does not
cover that finding; this section records its narrow local fix.

### Absolute upload contract

- `UPLOAD_ABSOLUTE_TIMEOUT_SECONDS = 120.0`, with an internal maximum of 180s.
  `create_app` validates composition-time configuration: exact numeric type,
  finite, positive, bounded. Zero, negative, bool, NaN, infinity, strings and
  excessively large values fail startup. There is no HTTP/env/client override.
  Shorter test-only composition values never enter the public API schema.
- Immediately on entering `bounded_upload` after admission, fix one deadline
  with AnyIO's monotonic clock. It covers parser start through final ASGI body
  completion, not merely the closing multipart boundary. Wall/client clocks
  and progress bytes cannot change this deadline.
- The existing parser runs inside a same-task `CancelScope(deadline=...)`.
  This interrupts a blocked receive without creating a detached parser/reader
  task. Explicit monotonic checks and a checkpoint also cover buffered reads;
  completion at or after the deadline fails closed. No optional idle timeout
  was added: slow-drip cannot renew the absolute allowance.
- The scope is exited before yielding the uploaded file to verification,
  quota or providers. Their existing independent timeouts are unchanged.
- On timeout, parser/body reading unwinds; Starlette closes owned spools and
  the outer upload helper closes any still-open handles synchronously. Existing
  admission cleanup drops exception-held references before releasing the slot.
  The outer close now checks `closed`, avoiding a second close after parser
  cleanup. No slot is released while an upload task or spool writer continues.
- The normal error envelope returns HTTP **408**, `AUDIO_UPLOAD_TIMEOUT`, a
  fixed safe message and `fallbackRecommended=true`. This denotes an incomplete
  client upload, not size overflow (413), busy capacity (503), or a provider
  timeout (504). No audio, multipart, temp path or implementation detail is added
  to the response or privacy log.
- Authentication, declared size, AI OFF and cheap rate gates remain before
  admission/timer/parser. The actual byte and file-count limits are unchanged.
  The max-two request reservation remains held throughout provider/accounting
  waits after successful upload.

120s is a local conservative default (~1.7 Mbit/s for 24 MiB), not an operational
latency guarantee. Deadline expiry initiates cancellation; already-running
bounded spool I/O is joined/closed before admission release, not abandoned.
Production network/cgroup sizing and server/proxy timeout alignment remain a
separate staging gate. This fixes indefinite single-upload ownership, not a
general fairness guarantee against repeated authenticated abuse.

### Regression evidence

Added **17 tests** in `tests/test_upload_deadline.py`, using real FastAPI routes,
ASGI receive/parser instrumentation, synthetic audio and fake providers:

| Case | Result |
| --- | --- |
| Two authenticated uploads, exactly 107 bytes each then stall | Both 408; verifier/materialization/provider zero; two slots restored |
| Twenty further requests while full, including a large WAV | Immediate capacity rejection; body/parser/materialization zero |
| Third user before/after timeout | Capacity rejected first; normal verified upload then 200 |
| Two continuous small-chunk uploads | Fixed original deadlines expire; progress does not renew them |
| No first byte / multipart closed but ASGI body incomplete | Both time-bounded |
| Just before deadline / exactly at deadline | Deterministic monotonic test: success with real duration proof and fake STT/parser / timeout |
| Completion vs timeout and disconnect vs timeout races | Consistent response; no partial provider invocation or double release |
| Cancel before/between chunks, near expiry, in cleanup, just after timeout | No active reader/parser; files closed; exact capacity restored |
| 500 alternating timeout/disconnect cycles with disk-backed spools | Exact capacity after every cycle; no surviving task/file/FD growth |
| Valid upload then provider blocked past upload deadline | Provider work not cancelled; admission still held until completion |
| Auth invalid/missing, AI OFF, cheap rate rejection | No admission, timer, body or provider work |
| Actual size overflow, absent/false Content-Length | Still rejected before provider; time bound does not weaken size bound |
| Privacy checks | Only safe error/request metadata; no token/audio/multipart/temp-path disclosure |

The real Uvicorn loopback regression additionally keeps both attacker sockets
open, first using declared incomplete bodies and then chunked slow-drip without
Content-Length. With a 0.75s test-only deadline both receive 408, parser count
returns to zero and capacity to two; a different user's retry gets 200. It uses
the real cheap rate limiter, not a permissive rate fake. The unchanged external
provider call count is **zero**.

### Final local verification

- Host Python 3.10.5: **257 PASS / 0 skipped**, 37.085s.
- Fresh Dockerfile image, Linux amd64 Python 3.12.14, UID 10001:
  **257 PASS / 0 skipped**, 76.028s (240 existing + 17 new).
- FFmpeg: `7.1.5-0+deb13u1`. Network disabled during container tests, read-only
  root/source, no capabilities, no-new-privileges, 2 GiB/2 CPUs/256 PIDs, bounded
  tmpfs. The local Mac runs amd64 through emulation.
- Image: `darin-ai:p1-3-upload-deadline-amd64-local-20260911`.
- Local image ID:
  `sha256:b8062314aafeb39521df6c07ba9cec3333f85cf6da9f4eba0dd67ca024643059`.
- All 31 packaged app Python files match the tested source byte-for-byte;
  sorted relative-path/content SHA256:
  `f0c2c11e8f5bbc0e92dc958f57753528e4b359b9bddbf7348bcd146320099cb4`.
- Production entrypoint startup with non-secret test placeholders, AI OFF:
  health/version 200 and unauthenticated transcribe 401. Version commit remains
  `unknown`: this image is uncommitted local verification, not deployment provenance.
- Existing large-audio memory probe: max two canonical owners; 20 denied
  requests consume/materialize zero bytes. Container waiting heap 44.26 MiB,
  peak 88.20 MiB, denied incremental peak 1.39 MiB. These are Python heap
  measurements, not total Cloud Run RSS guarantees.
- Duration/FFmpeg cleanup, P1.2 ledger/counter/concurrency, JWT/P1.1,
  Voice 216 combinations, safe claims, upload/auth P0 and memory suites all
  remain in the passing full run. Typecheck, AI policy, architecture, secrets,
  voice-scope, Python compile (51 app/test files), diff whitespace checks PASS.
- Early new-test assertions were corrected: compare fake quota state against
  its seeded config, not an empty store; drain completed ASGI/gather callbacks
  before the no-surviving-handle assertion. No product limits or regression
  assertions were relaxed. Final full suites have no failures/skips.

This follow-up changes only `app/upload.py`, the timeout wiring in
`app/factory.py`, new `tests/test_upload_deadline.py`, and this document.
Reversing only the new factory wiring in memory reproduced the prior 12-file
worktree digest `77e7e3814c333fbe07a44fba3231d478cf3373fcb3db90a56e7fb0e0bd526c59`;
unrelated pre-existing work was preserved. HEAD is still
`6970c6d60d72d4608c1e5e7263bf9931720be947`; index empty. No stage, commit, push,
deploy, cloud setting, mobile/EAS/Supabase, secret change or actual provider call.

No remaining P0/P1 was identified in this targeted local fix; focused independent
security re-review is still required before a separate container/commit gate.
Previously deferred broader multilingual/time grounding and provider/Cloud
Logging retention verification remain outside scope. Existing FFmpeg apt
version/provenance/update P2 is unchanged. Cloud Run behavior remains UNVERIFIED.

Verdict: `P1.3 UPLOAD DEADLINE FIXED LOCALLY — READY FOR FOCUSED SECURITY RE-REVIEW`.
