# Production deployment manifest

Last read-only verification: 2026-08-28 (America/Los_Angeles)

이 파일은 production의 현재 상태를 설명하는 운영 원장이다. 새 변경은 실제 배포가 검증된 뒤 version, source commit/hash, 적용 시각과 rollback/forward-fix를 함께 갱신한다.

## Database

다음 migration version이 `supabase_migrations.schema_migrations`에 기록되어 있음을 read-only로 확인했다.

- `202607310001`
- `202608220001`
- `202608220002`
- `202608260001`
- `202608260002`
- `202608260003`
- `202608260004`

care reminder tables, `notification_events`, `push_tokens`, `memory_friends`가 존재한다. migration 파일은 `supabase/migrations/`의 timestamp 순서를 source of truth로 유지한다.

## Edge Functions

| Function | Production version | Current repository source SHA-256 |
|---|---:|---|
| `delete-account` | 4 | `7d87257cef0f8a1536386e6f58d63af74192bd41dd8795273a2cf097912bde84` |
| `send-push-notification` | 8 | `574fa96cf2c76aabb8d4cc6e4d9be9beeeedb90b922a9cd1d340680071f106dd` |
| `process-care-reminders` | 2 | `711503f637c46cfdb10cc145994752f52385c4874c81e0609af1bae6be4fbcf6` |
| `_shared/notificationRuntime.ts` | shared source | `61ff8c41a40271f5950afe36d0767913c2802d03706effdbe6ec6951956c935a` |

위 hash는 현재 저장소 파일 식별자다. shared runtime을 도입한 현재 로컬 source는 아직 production에 배포하지 않았다. Supabase version과 source hash의 일치는 다음 QA/production 배포 시 배포 로그/commit으로 다시 증명한다.

## Scheduler and secrets

- active cron: `process-care-reminders-every-minute` 1개
- Vault secret names: `project_url`, `care_reminder_cron_secret` 각 1개
- worker request auth: `x-cron-secret`
- Function secret: `CARE_REMINDER_CRON_SECRET`

복호화된 값과 token은 이 문서나 로그에 기록하지 않는다.

## Stop / forward-fix

1. care reminder cron을 unschedule한다.
2. `care_reminder_settings.enabled=false`로 신규 claim을 중단한다.
3. 필요하면 `CARE_REMINDER_CRON_SECRET`을 회전하거나 worker를 비활성화한다.
4. schema/data 삭제보다 새 timestamp migration을 통한 forward-fix를 우선한다.
5. notification event constraint 변경은 기존 event type과 실제 행을 보존한다.
