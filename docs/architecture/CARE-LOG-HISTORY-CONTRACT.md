# CareLog history loading contract

## Current release-safe behavior

The first server-authoritative hydrate for an account+baby remains a full-history, bounded 500-row-page read. It establishes scoped coverage metadata and detects legacy local migration candidates without automatically uploading or deleting them. Once that full verification exists and the candidate count is zero, subsequent startup hydrates use the most recent 90 calendar days. Cached older rows remain available but are not marked authoritative until an explicit range/category/id loader verifies them.

## Windowed behavior

The authenticated bootstrap loads the most recent 90 calendar days only after the full-verification gate above passes. Every consumer that can request older data uses an explicit date-range, category, or id loader.

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
- Coverage, complete-category markers, and the verification timestamp are persisted under an account+baby scoped cache-metadata key. Logout drops memory but preserves the correct baby's offline metadata; account-data clearing removes it.
- An id cached outside verified range/category coverage is revalidated. A successful server “not found” removes the stale cache row; a network failure retains the offline row and never pretends it was authoritatively deleted.
- Range and id results are discarded when the active user/baby scope changes while the request is in flight.
- Offline or failed reads return cached rows with `complete: false`; screens must not render an authoritative empty result.

Accounts with legacy unsynced local migration candidates remain on full bootstrap. Candidate counts are stored per account+baby with the coverage metadata, so switching siblings cannot accidentally clear the gate. A partial server response cannot identify which missing local ids are deliberate offline-only candidates versus remote deletions outside the window, so those candidates are preserved and never auto-uploaded or auto-deleted. The collapsed quick grid already ranks only the latest 30 days, so it does not require older coverage.

## Migration sequence

1. Introduce typed coverage and merge helpers (completed).
2. Add range/id context methods and migrate Record, Reports, Diary/AI, and notification targets (completed).
3. Add offline and multi-baby stale-result QA (completed for the transition boundary).
4. Add category-specific history contracts for stored milk, medication, ingredients, and contractions (completed). Quick-action ranking already has a 30-day contract.
5. Reconcile successful range/category reads by replacement so remote deletions win (completed).
6. Persist startup coverage/authority metadata for offline startup (completed).
7. Gate recent bootstrap on verified metadata and zero legacy migration candidates (completed).
8. Provide a separate, user-reviewed resolution flow for accounts whose legacy candidate count is nonzero (remaining; those accounts safely stay full-history meanwhile).

No database migration or new index is required for this contract. The existing `(baby_id, date_key)` index supports date-range reads; production index changes require QA `EXPLAIN (ANALYZE, BUFFERS)` evidence.
