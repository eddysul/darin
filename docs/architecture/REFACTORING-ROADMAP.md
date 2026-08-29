# Darin architecture refactoring roadmap

This document tracks codebase cleanup that is safe to complete before the next release candidate. It is deliberately separate from production deployment state. None of the items below authorizes a database migration, Function deployment, cron change, EAS build, or store submission.

## Completed checkpoints

### Phase 1 — environment and release-source safety

- QA and production project refs are centrally guarded.
- client Expo commands load public QA variables only and strip server-only secrets.
- release-critical files are tracked and the local Supabase CLI is not left linked to production.
- notification Functions share one pinned runtime module.
- navigation/settings responsibilities were moved out of `App.tsx`.
- confirmed unused legacy files and direct dependencies were removed.

### Phase 2 — state and query boundaries

- legacy BabyLog sample data is isolated under `src/demo` and loaded only by the QA restore action.
- chat defaults and pure BabyLog context helpers have dedicated modules.
- scoped AsyncStorage persistence effects are isolated from `BabyLogContext` in `useBabyLogCachePersistence`.
- unused legacy i18n demo report helpers were removed.
- family and friend Memories feeds read bounded pages and batch child-table queries per page.
- CareLog hydration uses bounded 500-row requests, avoiding silent truncation at the API row limit while preserving the current full-history context contract.

## Next refactoring phases

### Phase 3 — BabyLog hydration controller

Completed: account/baby scope resolution, parallel cache hydration, CareLog normalization, and server bootstrap live in `babyLogHydrationService`. Diary, family, GrowthBook, stickers, growth records, and caution-food hydration live in `babyLogDomainHydrationService`. React state application remains in the context so stale hydration runs can still be discarded.

### Phase 4 — i18n catalog ownership

Completed: ko/en legacy messages and ja/es/zh legacy overrides have dedicated catalog modules. `i18n.ts` now owns only `Locale`, `MessageKey`, fallback rules, and `createT`. Critical five-language catalogs remain independent and continue to pass `qa:i18n:release`.

### Phase 5 — historical CareLog loading

Completed for zero-candidate accounts: the context exposes repository-backed range, id, and paginated category loaders with active-baby stale-result rejection. Record navigation/deep links, selected-day contraction repair, stored-milk inventory, medication/ingredient history, contraction history, Reports, Diary, Consult, and restored timer-linked ids have explicit boundaries. Range/category replacement and account+baby scoped coverage metadata preserve deletion and offline semantics. Startup uses a bounded 90-day window only after one full verification and while the legacy migration-candidate count is zero; candidate-bearing accounts safely remain full-history pending a separate user-reviewed resolution flow. See `CARE-LOG-HISTORY-CONTRACT.md`.

### Phase 6 — repository contracts and database evidence

Completed safe code-only changes: CareLog reads use an explicit mapper projection; push-token registration and contact submission no longer request unused rows; notification settings omit timestamp columns; Diary full hydration uses deterministic 100-row pages with page-scoped media batches. Existing row mappers that consume complete models and data export intentionally retain broad selects.

Deferred evidence-based changes: move offset-based Memories/Diary pagination to cursor pagination only if concurrent-feed churn is measurable, and run `EXPLAIN (ANALYZE, BUFFERS)` in QA before proposing any index. The existing CareLog `(baby_id, date_key)`, Diary `(baby_id, entry_date desc, created_at desc)`, and Memories `(baby_id, created_at desc)` indexes already match the new leading filters/orders. No migration is authorized by this refactor.

## Release gates after each phase

- `pnpm typecheck`
- environment/build guards
- feature flag audit
- i18n release QA
- MVP and repository query-shape QA
- architecture boundary QA
- notification/care-reminder policy smokes
- CareLog history contract QA
- secret scan and `git diff --check`
- guarded local iOS bundle export
