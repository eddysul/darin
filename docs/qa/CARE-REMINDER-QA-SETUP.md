# Care reminder QA/Staging setup

이 문서는 수유 알림 서버 기능의 QA 전용 준비 및 중지 절차다. production 프로젝트에는 별도 승인 전까지 이 migration, Function, Vault secret, cron을 적용하지 않는다.

## 1. QA 프로젝트 체크리스트

- production과 다른 Supabase project/ref를 생성하거나 기존 QA project/ref를 확정한다.
- Region, Postgres version, Auth provider, redirect URL을 기록한다.
- production 데이터를 복제하지 않는다. 합성 테스트 계정과 아기만 사용한다.
- 저장소의 선행 migration 전체를 순서대로 QA에 적용한다.
- `create_baby_with_owner`, `baby_permission`, `is_baby_member`, `set_updated_at`, `care_logs`, `baby_members`, `profiles`, `push_tokens`, `notification_events` 존재를 확인한다.
- care reminder DB migration은 `202608220001`만 먼저 적용한다.
- `qa:supabase:care-reminders`와 notification QA가 통과하기 전 Function을 배포하지 않는다.
- Function은 QA project에만 JWT gateway 검증을 끈 상태(`--no-verify-jwt`)로 배포하고, Function 내부의 `x-cron-secret` 검증을 cron 없이 수동 호출로 확인한다. JWT gateway를 켜면 전용 header 요청이 Function까지 도달하지 않는다.
- 실제 iOS/Android fan-out을 통과한 뒤 Vault를 구성하고 `202608220002`를 마지막에 적용한다.
- cron 적용 후 30~60분간 claim, dedupe, skip, retry와 로그를 관찰한다.

## 2. 환경변수와 secret

앱의 QA 전용 public 환경변수:

- `EXPO_PUBLIC_SUPABASE_URL`: QA project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: QA anon/publishable key
- `EXPO_PUBLIC_FEATURE_ENV=qa`
- `EXPO_PUBLIC_FEATURE_PROFILE=internal`
- `EXPO_PUBLIC_FEATURE_ALLOWLIST`: 최소 `feedingReminder,careReminderServer`

Edge Function env/secret:

- `SUPABASE_URL`: QA project URL
- `SUPABASE_SERVICE_ROLE_KEY`: QA service-role key; 앱, Expo public env, EAS public env에 저장 금지
- `CARE_REMINDER_CRON_SECRET`: 충분히 긴 QA 전용 무작위 값

QA Vault secret:

- `project_url`: QA project URL
- `care_reminder_cron_secret`: Function의 `CARE_REMINDER_CRON_SECRET`과 같은 QA 전용 값

production과 반드시 분리할 값:

- Supabase project/ref와 URL
- anon/publishable key 및 service-role key
- cron secret과 Vault entries
- Auth 사용자, redirect URL, push token, 테스트 데이터
- Edge Function deployment와 cron job
- 앱 QA environment/profile/allowlist

secret 값을 저장소, 문서, 로그, issue, 앱 bundle에 기록하지 않는다. 수동 worker 호출에서도 shell history에 secret을 직접 남기지 않는 방법을 사용한다.

## 3. QA 가족 구성

최소 계정 다섯 개와 아기 두 명을 사용한다.

| 계정 | baby A | baby B | 초기 수신 | 기기 |
|---|---|---|---|---|
| 엄마 | admin/작성자 | 미가입 | ON | iOS |
| 아빠 | editor | admin | ON 후 OFF 시험 | Android |
| viewer | viewer | 미가입 | 기본 OFF 후 직접 ON | 별도 기기 또는 token |
| friend | friend 관계만, baby_members 미가입 | 미가입 | 수신 불가 | 선택 |
| outsider | 미가입 | 미가입 | 접근 불가 | 불필요 |

추가 데이터:

- baby A: breast/formula/storedMilk/pump, backdated, quiet-hours, 최신 기록 삭제 시나리오
- baby B: baby A와 겹치는 시간의 수유 기록으로 격리 확인
- 정상 token, token 없음, disabled token, 의도적으로 폐기된 DeviceNotRegistered token

## 4. QA 적용 순서

1. QA project/ref와 앱 QA env를 확정한다.
2. 선행 migration 전체를 적용한다.
3. `202608220001_care_reminders.sql`을 적용하고 동일 파일 재실행을 확인한다.
4. RLS/RPC/trigger 자동 QA를 실행한다.
5. `process-care-reminders`를 QA에만 배포한다.
   - custom cron header를 사용하므로 QA 배포 시 `--no-verify-jwt`가 필요하다.
   - 무인 endpoint 보호는 Function의 필수 `CARE_REMINDER_CRON_SECRET` 검증이 담당한다.
6. cron 없이 올바른/잘못된 `x-cron-secret`으로 worker 인증을 확인한다.
7. 실제 iOS/Android token으로 가족 fan-out을 확인한다.
8. QA Vault에 `project_url`, `care_reminder_cron_secret`을 생성한다.
9. `202608220002_schedule_care_reminders.sql`을 적용한다.
10. 매분 실행을 30~60분 관찰한다.
11. 같은 dedupe key 재발송 없음, quiet skip, no-token, permission/disabled, retryable/permanent 결과를 확인한다.
12. production 배포 여부는 별도 승인한다.

## 5. 중지 및 forward-fix runbook

문제 발생 시 데이터 삭제보다 실행 경로 중지를 우선한다.

1. `cron.unschedule('process-care-reminders-every-minute')`로 QA cron을 중지한다.
2. 모든 `care_reminder_settings.enabled`를 false로 바꾸고 state가 `disabled`인지 확인한다.
3. 필요하면 QA Edge Function을 비활성화하거나 cron secret을 회전한다.
4. trigger 격리가 필요하면 다음 trigger만 제거한다.
   - `care_logs_sync_feeding_reminder`
   - `care_reminder_settings_changed`
   - `baby_members_care_reminder_default`
5. 중간 migration 실패는 오류가 지목한 누락 컬럼/unique constraint를 별도 forward-fix migration으로 복구한 뒤 원 migration을 재실행한다. 적용 이력이 있는 migration 파일을 production 적용 후 수정하지 않는다.
6. `notification_events_event_type_check`는 기존 허용 타입과 실제 사용 타입을 보존한 상태로 `feeding_reminder`만 추가한다. 복원할 때는 배포 직전 저장한 `pg_get_constraintdef` 결과를 사용한다.
7. 테이블/이벤트 삭제는 합성 데이터만 있는 QA 프로젝트에서 명시적 승인 후 수행한다. production에서는 우선 cron 중지, 설정 OFF, Function 비활성화 후 forward-fix migration을 사용한다.

관찰해야 할 P1 잔여 위험: 발송 직전 version/enabled/log를 재검사하지만 검사 완료와 Expo 요청 사이의 매우 짧은 stale push 가능성은 남는다. QA에서 설정 OFF 및 새 수유 기록을 worker 호출과 경쟁시켜 관찰한다.
