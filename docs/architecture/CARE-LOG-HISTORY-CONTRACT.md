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

## Migration sequence

1. Introduce typed coverage and merge helpers (completed).
2. Add a range-loading context method returning `{ logs, complete, coverage }`.
3. Convert Record, Reports, Diary/AI context, timers, and deep links.
4. Add offline and multi-baby range QA.
5. Only then switch bootstrap from `full` to the 90-day range.

No database migration or new index is required for this contract. The existing `(baby_id, date_key)` index supports date-range reads; production index changes require QA `EXPLAIN (ANALYZE, BUFFERS)` evidence.
