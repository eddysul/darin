# B0.4c Notification Security Closure

Date: 2026-09-17
Final verdict: `B0.4c CLOSED — QA, PRODUCTION, AND REAL-DEVICE PUSH PASS`

## Scope and architecture

The verified path is:

`authenticated action → server-owned event/resource validation → current recipient derivation → notification_events claim → current authorization recheck → active proof-bound push token → Expo Push → authorized deep link/in-app fetch`

The final security invariant is that client-supplied actor, recipient, token owner, notification copy, and resource identifiers are not independently trusted. Server-side policy derives or revalidates the actor, current resource, recipient, visibility, delivery claim, and token ownership.

## Deployment provenance

- Initial final-cutover migrations: `202609160000` through `202609160003`
- Disabled legacy device-ID release migration: `202609160004`
  - SHA-256: `5ebf30cbbae86f0027911e28c9315dc61e34765b50ced091cb9ba4b17c429c27`
- Disabled proofless legacy token recovery migration: `202609160005`
  - SHA-256: `7a62a76425d0df23e4fad477eab000148efc48e57f89cf8dae6dc771436710d5`
- Runtime/source provenance commit: `c4e98a09b134f31713b13403cb05abdddf1f1c69`
- `send-push-notification` and `process-care-reminders` were deployed to Production after the final-cutover gate. Both rejected unauthenticated smoke requests with HTTP 401.

The `004` and `005` sources committed above exactly match the SHA-256 values applied to QA and Production. Both environments record each migration exactly once.

## Token ownership and rollout recovery

- Direct authenticated INSERT/UPDATE/DELETE policies on `push_tokens` are absent.
- Public registration binds ownership to `auth.uid()` through a security-definer wrapper.
- The implementation helper remains non-executable by `authenticated`.
- Same-account device-ID replacement retains one active token.
- Account transfer with a proof-bound active token requires matching installation proof.
- A disabled proofless pre-cutover device ID cannot reserve a local device ID forever.
- A disabled proofless pre-cutover Expo token can be consumed once by an authenticated app that currently possesses that exact high-entropy provider token.
- Immediately after recovery, the token is proof-bound. A second account with a different installation proof is rejected.
- Active unproven fixtures and disabled proof-bound fixtures remain protected from cross-account claims.
- One approved disabled tester legacy row was deleted to remove a rollout collision. It is recoverable only from backup; the affected tester must re-register on the current client.

## Regression results

- Local PostgreSQL B0.4c notification security suite: PASS
- QA integrated notification attack regression: 11/11 PASS
- Static notification security smoke: PASS
- Shared notification runtime smoke: PASS
- Push worker smoke: PASS
- TypeScript typecheck: PASS
- Architecture boundary smoke: PASS
- Repository query shape smoke: PASS
- Invite-response notification smoke: PASS
- B0.4a P0 authorization smoke: PASS
- B0.4b storage smoke: PASS
- Secret scan: PASS
- `git diff --check`: PASS

The attack matrix covers spoofed actor/recipient inputs, missing or deleted resources, removed recipients, visibility downgrade, token takeover, account switching, same-account device replacement, disabled legacy recovery, active/proof-bound ownership, direct token writes, duplicate dispatch/replay, revoked tokens, and stale inbox authorization.

## Production real-device gate

- Client: TestFlight build 21 on an iPhone with notification permission enabled.
- Registration state before dispatch:
  - active tokens: 1
  - active proof-bound tokens: 1
  - target-account active tokens: 1
  - active unproven tokens: 0
- Expo provider requests: exactly 1; no automatic retry.
- Provider response: HTTP 200, ticket status `ok`, no provider error category.
- Device result: the user confirmed receipt of the generic Darin test notification.
- No real baby, diary, memory, health, invite, or family content was sent.

## Privacy and observability

- The test script does not print or persist the Expo token or provider ticket ID.
- A two-hour aggregate scan of Production `edge_logs`, `postgres_logs`, `function_logs`, and `function_edge_logs` found zero occurrences of an Expo token pattern, the test title, or the test body.
- Push payload policy remains generic and server-owned; private source content and invite secrets are excluded.
- Dispatch state, suppression reason, attempt count, expiry, and invalid-token cleanup remain observable without logging raw tokens or private notification content.

## Remaining severity

- Remaining P0: none identified.
- Remaining P1: none identified.
- Non-blocking operational follow-up: add provider receipt polling/dashboarding if delivery diagnostics beyond provider acceptance and user confirmation are needed.

## Phase verdict

- `B0.4a AUTHORIZATION CLOSED`
- `B0.4b STORAGE SECURITY CLOSED`
- `B0.4c NOTIFICATION SECURITY CLOSED`
- `B0.4 CLOSED`
- `PHASE 0 CLOSED`
