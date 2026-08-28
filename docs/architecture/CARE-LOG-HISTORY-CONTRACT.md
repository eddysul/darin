# CareLog history loading contract

## Current release-safe behavior

`BabyLogContext.logs` is a full-history collection. Server hydration uses bounded 500-row requests and merges duplicate ids deterministically, but it deliberately continues loading every page. This preserves editing, deep links, pregnancy/contraction calculations, food and medication history, weekly reports, diary summaries, AI context, and offline cache behavior.

## Target windowed behavior

The initial authenticated bootstrap may eventually load the most recent 90 calendar days. That optimization is allowed only after every consumer that can request older data uses an explicit date-range loader.

Required contract:

1. Context exposes coverage metadata (`full` or a concrete inclusive date range).
2. Record date navigation requests the selected day when it falls outside coverage.
3. Weekly/report/consult flows request their complete calculation range before computing.
4. Notification and deep-link targets fetch the target id or day before declaring it missing.
5. Active timers and linked records remain in the bootstrap window regardless of age.
6. A partial server window never overwrites a full local cache. Window pages must merge by log id.
7. Offline range requests return the covered device cache and an explicit incomplete result; they must not present an empty day as authoritative.
8. Baby switching resets both rows and coverage so Baby A history cannot satisfy Baby B requests.

## Implemented transition boundary

- `BabyLogContext` exposes `careLogCoverage`, `ensureCareLogsForRange`, and `ensureCareLogById`.
- Record day navigation and record notification deep links load missing rows explicitly.
- Record creation remains disabled until the selected day's coverage is complete, so contraction sibling repair and edits never run against a known-partial day.
- Reports secure their 15-day calculation window before producing weekly narratives.
- Consult secures its seven-day evidence window immediately before each AI request and marks incomplete evidence as partial.
- Diary secures today's summary and notification target day before compose entry.
- Restored timers fetch every linked log id before activation and re-check a missing linked sleep log before stop persistence.
- Stored-milk inventory, medication dose history, food ingredient history, and contraction history use paginated category-specific loaders; incomplete category reads never masquerade as complete history.
- Successful range reads replace that cache window, and successful complete-category reads replace that category history. This removes rows deleted on another device instead of reviving them through an id-only merge.
- Range and id results are discarded when the active user/baby scope changes while the request is in flight.
- Offline or failed reads return cached rows with `complete: false`; screens must not render an authoritative empty result.

The initial bootstrap remains full-history. Range/category reconciliation is implemented, but the remaining blocker for a 90-day switch is startup authority metadata: offline startup and legacy unsynced local migration candidates must be distinguishable from a previously verified server window. The collapsed quick grid already ranks only the latest 30 days, so it does not require older coverage. Silently changing cache authority is not allowed.

## Migration sequence

1. Introduce typed coverage and merge helpers (completed).
2. Add range/id context methods and migrate Record, Reports, Diary/AI, and notification targets (completed).
3. Add offline and multi-baby stale-result QA (completed for the transition boundary).
4. Add category-specific history contracts for stored milk, medication, ingredients, and contractions (completed). Quick-action ranking already has a 30-day contract.
5. Reconcile successful range/category reads by replacement so remote deletions win (completed).
6. Persist startup coverage/authority metadata and handle legacy unsynced migration candidates and offline startup.
7. Only then switch bootstrap from `full` to the 90-day range.

No database migration or new index is required for this contract. The existing `(baby_id, date_key)` index supports date-range reads; production index changes require QA `EXPLAIN (ANALYZE, BUFFERS)` evidence.
