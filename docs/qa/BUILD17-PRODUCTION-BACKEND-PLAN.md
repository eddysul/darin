# Build 17 production backend status and approval plan

이 문서는 production 상태와 남은 승인 항목을 함께 기록한다. 새 production 변경은 항상 별도 승인 후 수행한다.

## Current production status (2026-08-26)

- DB에는 `202608220001`, `202608260001`, `202608260002`와 forward-fix `202608260003`의 기능이 반영되어 있다.
- 위 변경은 현재 `supabase_migrations.schema_migrations`에서 재현 가능한 적용 이력으로 확인되지 않는다. 다음 migration 실행 전에 별도의 history reconciliation 승인이 필요하다.
- `process-care-reminders`, `send-push-notification`은 배포되어 있으나 이 저장소의 최신 P0 push safety patch는 아직 production에 배포하지 않았다.
- Function secret `CARE_REMINDER_CRON_SECRET`은 존재한다. Vault의 `project_url`, `care_reminder_cron_secret`과 care reminder cron은 아직 없다.
- 앱의 `feedingReminder`, `sleepReminder`, `careReminderServer`는 Build 17 승인에 따라 `beta`로 두어 production에 노출한다. Vault/cron과 실기기 push 검증 상태는 release checklist에서 별도로 추적한다.

## Required production migrations

1. `202608220001_care_reminders.sql`
   - 가족 공유 설정/개인 수신 설정/state, RLS, trigger, claim RPC, `feeding_reminder` event type
2. `202608260001_friend_memory_ui_scope.sql`
   - friend Memories safe summary/signed URL와 friend-only 접근 경계
3. `202608260002_build17_sleep_reminders_and_notification_locale.sql`
   - sleep state 계산/trigger/claim, `sleep_reminder`, recipient locale 기반 DB notification copy
4. `202608260003_notification_event_type_constraint_cleanup.sql`
   - 기존 notification type을 보존하는 forward-fix
5. `202608220002_schedule_care_reminders.sql` — 마지막 단계에만 적용
   - Vault의 `project_url`, `care_reminder_cron_secret`을 읽어 매분 worker 호출

적용 전에 production migration history와 각 relation/function/constraint의 현재 정의를 다시 저장하고 diff한다. 이미 적용된 동일 기능 migration이 있다면 재적용하지 않고 forward-fix migration으로 바꾼다.

## Required Edge Functions

- `process-care-reminders`: 수유·수면 due claim, 가족 fan-out, recipient locale, quiet hours, dedupe, token 영구/일시 실패 분류
- `send-push-notification`: 초대/수락/거절/댓글/반응/일기/테스트 push의 recipient locale 처리
- friend Memories 배포에서 기존 Function 변경이 필요하면 production 배포 목록에 별도로 추가한다.

모든 Function은 production ref를 명시하고 배포 직전 source hash를 기록한다. `SUPABASE_SERVICE_ROLE_KEY`는 Function secret으로만 두며 앱/Expo/EAS public env에 넣지 않는다.

## Required cron and Vault

- Vault: `project_url`, `care_reminder_cron_secret`
- Function secret: `CARE_REMINDER_CRON_SECRET`
- cron: `process-care-reminders-every-minute`
- cron 요청은 `x-cron-secret`; service-role key를 Bearer로 전송하지 않는다.

적용 순서: DB/RLS → 자동 QA → Functions → cron 없는 수동 호출 → iOS/Android real push → Vault → cron → 30~60분 관찰.

## Storage/RLS

- friend UI는 `202608260001`의 safe baby summary와 허용된 media signed URL만 사용한다.
- active friend라는 이유만으로 전체 baby avatar/media bucket을 읽을 수 없어야 한다.
- care reminder tables는 active `baby_members`만 읽고, shared setting은 admin/editor만 수정하며, 개인 preference는 본인만 수정한다.

## Stop / forward-fix

1. cron을 unschedule한다.
2. 모든 `care_reminder_settings.enabled=false`로 전환한다.
3. `CARE_REMINDER_CRON_SECRET`을 회전하거나 worker endpoint를 비활성화한다.
4. 필요하면 `care_logs_sync_care_reminders`, `care_reminder_settings_changed`, `baby_members_care_reminder_default` trigger를 제거한다.
5. 데이터/테이블 삭제 대신 새 migration으로 constraint/function/policy를 forward-fix한다.
6. notification event type constraint는 적용 전 저장한 정의와 실제 행의 타입을 모두 보존한다.

남은 production 승인에는 migration history reconciliation, 최신 Function source hash, Vault 2개, cron 1개의 정확한 대상 ref와 실행 창이 포함되어야 한다.
