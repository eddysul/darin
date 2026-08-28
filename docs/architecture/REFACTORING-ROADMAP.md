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

The current context still retains all history for compatibility. Typed coverage/range/merge helpers and the no-data-loss transition contract are now in place. Next, introduce a repository-backed range-loading context method and migrate historical screens before limiting in-memory history. This must include offline-cache behavior and cannot be a silent retention change. See `CARE-LOG-HISTORY-CONTRACT.md`.

### Phase 6 — repository contracts and database evidence

- replace remaining broad `select("*")` calls with typed field lists where models do not require the whole row;
- move offset-based Memories pagination to a stable `(created_at, id)` cursor if concurrent-feed churn becomes measurable;
- run `EXPLAIN (ANALYZE, BUFFERS)` in QA before proposing any new index;
- keep migrations forward-only and do not add indexes based solely on static code inspection.

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
