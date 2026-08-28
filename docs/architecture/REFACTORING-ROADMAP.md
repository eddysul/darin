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

Move account/baby scope resolution, local cache hydration, and server bootstrap into a controller that returns an explicit snapshot. Keep React state application in the context so stale hydration runs can still be discarded. Split by domain (care logs, diary, family, growth, stickers) rather than creating one generic storage abstraction.

### Phase 4 — i18n catalog ownership

Move the remaining legacy `messages` catalog and locale overrides out of `i18n.ts`; keep `Locale`, `MessageKey`, fallback rules, and `createT` as the public boundary. Critical five-language catalogs remain independent and must continue to pass `qa:i18n:release`.

### Phase 5 — historical CareLog loading

The current context still retains all history for compatibility. Introduce an explicit recent-window bootstrap plus repository-backed date-range loading for reports and historical screens before limiting in-memory history. This must include offline-cache behavior and cannot be a silent retention change.

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
- notification/care-reminder policy smokes
- secret scan and `git diff --check`
- guarded local iOS bundle export
