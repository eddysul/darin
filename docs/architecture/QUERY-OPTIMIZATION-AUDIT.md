# Query optimization audit

## Applied without schema changes

- CareLog hydration, range reads, and category reads are paginated and select only fields consumed by `careLogRowToEntry`.
- The initial CareLog read becomes a 90-day window only after a full verified hydrate and a zero legacy-candidate gate.
- Diary hydration reads deterministic 100-row pages; each page batches its media lookup and signed URLs instead of constructing one unbounded `IN` request.
- Push-token registration and contact submission no longer return unused rows.
- Notification settings select only fields used by the app mapper.
- Memories family/friend feeds remain bounded and batch child tables per page.

## Intentionally retained broad rows

- Data export must serialize complete source rows.
- Repository writes that immediately map a complete domain model retain all mapper-required fields.
- Small account-scoped tables retain full-row reads where every field is used and the row count is naturally bounded.

## Deferred until runtime evidence exists

- Cursor conversion for Memories and Diary pagination. Current deterministic offset pages are safe for hydration; cursor complexity is justified only if concurrent inserts during multi-page reads are observed.
- New indexes. Existing migrations already define the leading indexes used by CareLog, Diary, and Memories queries. Any additional index requires QA `EXPLAIN (ANALYZE, BUFFERS)` output and a separate migration review.

No production query, migration, Function, cron, EAS build, or store submission was executed during this audit.
