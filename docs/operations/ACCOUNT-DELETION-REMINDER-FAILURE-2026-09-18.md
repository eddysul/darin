# TestFlight 계정 삭제 잔여 실패 — 리마인더 FK 충돌

## 확인한 원인과 실제 오류

로그아웃 수정 후에도 남은 계정 삭제 오류는 서버의 `babies` 삭제 cascade와 리마인더 상태 갱신 트리거가 충돌하는 문제다. 마지막 관리자의 아기 공간에 `breast`, `formula`, `storedMilk`, `sleep` 기록이 있으면 해당 기록의 DELETE 트리거가 실행된다. 부모 `babies` 행은 이미 삭제된 상태지만 `sync_care_reminder_state()`가 `care_reminder_state`를 INSERT/UPSERT하려고 하여 FK가 거부한다. 알림 설정이 꺼져 있거나 설정 자체가 없어도 `disabled` 상태를 저장하려 하므로 실패한다.

Production 서버 로그에서 2026-09-18 06:23:48, 06:23:54 PDT(13:23 UTC)에 아래 오류를 확인했다. 첨부 화면의 06:23과 일치하는 시간대이지만, 화면 자체에는 request ID가 없어 특정 기기 요청과의 일대일 연결까지 주장하지 않는다. 같은 서버 오류가 당일 더 이른 네 번의 요청에도 기록되어 있다.

| 구분 | 실제 값 |
| --- | --- |
| 요청 | `POST /functions/v1/delete-account` |
| HTTP | `503` |
| Edge code | `ACCOUNT_DELETION_TEMPORARY_FAILURE` |
| Edge stage | `db_prepare` |
| PostgreSQL / PostgREST code | `23503` |
| 실패 테이블 | `public.care_reminder_state` |
| 제약조건 | `care_reminder_state_baby_id_fkey` |
| 실패 작업 | 부모가 삭제된 뒤 리마인더 상태 INSERT/UPSERT |
| 분류 | DB cascade / trigger 순서 문제. 이번 오류의 직접 원인은 RLS·Storage·Auth·클라이언트가 아니다. |

Production PostgreSQL 로그의 실제 context:

```text
sync_care_reminder_state(uuid,text) line 19: INSERT INTO care_reminder_state
on_care_log_sync_reminders() line 9: sync_care_reminder_state(old.baby_id, v_type)
prepare_account_deletion() line 43: DELETE FROM public.babies
```

이전 계정 삭제 테스트의 `care_logs` fixture는 `memo`만 사용해 수유·수면 DELETE 트리거를 실행하지 않았다. 따라서 기존 A–K 성공만으로 이 경로가 검증되지 않았다.

## 정확한 호출 경로와 실패 위치

```text
MenuScreen: 확인 문구 “삭제” → deleteServerAccount()
→ Edge delete-account: JWT getUser 검증 + confirmationText 검증
→ 사용자 JWT로 prepare_account_deletion() RPC
→ 대상 아기 잠금 + 다른 활성 관리자 존재 여부 판단
→ 마지막 관리자 / 복구 가능한 creator-linked legacy 공간의 babies 삭제
→ FK ON DELETE CASCADE로 care_logs 삭제
→ AFTER DELETE care_logs_sync_care_reminders
→ on_care_log_sync_reminders()
→ sync_care_reminder_state()
→ care_reminder_state INSERT/UPSERT
→ 23503: 이미 삭제된 baby_id 참조
→ RPC 트랜잭션 전체 롤백 → Edge db_prepare / HTTP 503
→ 클라이언트 “잠시 후 다시 시도해주세요.”
```

이 실패에서는 이후 단계인 미첨부 업로드 cleanup queue 등록, 남은 기록 작성자 익명화, 개인 알림·푸시·멤버십 정리, `auth.admin.deleteUser()`, 로컬 데이터 정리, 로그아웃까지 도달하지 않는다. 같은 RPC 안에서 앞서 수행한 삭제 및 큐 변경도 롤백된다.

## 최소 수정

`supabase/migrations/202609180001_account_deletion_reminder_cascade.sql`은 `sync_care_reminder_state(uuid,text)` 함수 하나만 교체한다.

```sql
perform 1 from public.babies where id = p_baby_id for key share;
if not found then return; end if;
```

부모 아기가 cascade로 없어졌으면 리마인더 상태를 재생성하지 않는다. 살아 있는 아기에는 기존 계산을 수행하고, key-share 잠금으로 확인과 UPSERT 사이의 동시 부모 삭제를 막는다. 일반 기록 삭제 시 이전 수유·수면 기록으로 상태를 다시 계산하는 동작은 유지한다.

기존 제품 정책(다른 관리자 존재 시 보존, 마지막 관리자 탈퇴 시 아기 공간 정리), RPC/Edge 계약, Auth 순서, 비동기 Storage 큐는 그대로다. FK 제거, 트리거 비활성화, RLS 완화, public bucket 전환은 없다. `CREATE OR REPLACE` 전후 함수 실행 권한은 `postgres`와 `service_role`만 유지하며, `SECURITY DEFINER` 및 고정 `search_path=public`도 동일하다.

변경 파일:

- 새 SQL migration: 위 단일 함수 수정.
- `scripts/apply-account-deletion-reminder-fix.mjs`: QA/Production 환경 guard, 배포된 함수 원문 확인, QA 승인 소스 SHA-256 확인, 단일 migration 적용, 권한/FK/기존 삭제 정책 불변 검사.
- `scripts/verify-qa-account-deletion-lifecycle.mjs`: 수정 전 재현 모드, 모든 content fixture에 수유·수면 유형 추가, 알림 설정 없음/켜짐/꺼짐, reminder 관련 cascade 검증.
- 이 보고서와 기존 TestFlight 보고서: 잔여 서버 원인 및 검증 기록.

이번 수정에 UI 및 모바일 빌드 변경은 없다.

## 검증과 데이터 안전성

수정 전 QA 일회용 계정에서 `formula`, `sleep` 각각 RPC `23503`과 실제 Edge HTTP `503`을 재현했다. 실패 뒤 Auth 사용자, 아기, 활성 관리자 멤버십, 원본 기록이 남는 것을 확인했다. 실제 사용자 계정을 테스트 삭제하지 않았다.

수정 후 필요한 검증:

- A–K 전체 삭제 정책 회귀: 아기 없음, 일반 멤버, 친구, 다른 관리자 존재, 마지막 관리자 + viewer/editor/friend, 단독 멤버, 주의 음식 FK, Auth 실패 후 재시도, legacy 부분 삭제 재시도, 비동기 Storage, 삭제된 토큰 재요청.
- 모든 콘텐츠 사례에 모유·분유·저장모유·수면 기록 포함. 삭제되는 공간의 reminder settings/state/member preferences도 0행 확인.
- L: feeding/sleep 알림 설정이 켜져 있거나 꺼져 있어도 Edge 200 및 Auth 삭제 완료.
- 기존 reminder 통합 테스트: 일반 최신 기록 삭제 후 이전 기록 재선택, duration/과거 기록/알림 OFF 처리, viewer/outsider 차단과 worker-owned state 쓰기 제한.

이번 `db_prepare / 23503` 실패 자체는 RPC 전체 롤백이므로 부분 삭제를 커밋하지 않는다. 이 결론은 해당 오류 경로에 대한 것이며, 과거의 별도 `auth_delete` 실패로 생긴 상태까지 소급하여 없었다고 단정하지 않는다. 기존 legacy retry 로직은 유지된다. 실패 상태에서 재시도해도 중복 부분 삭제가 누적되지 않으며, 수정 전에는 같은 조건에서 다시 실패한다. 수정 후에는 정상 삭제 정책이 실행된다.

마지막 관리자 탈퇴 시 아기 공간이 삭제되는 것은 승인된 제품 정책이다. 다른 활성 관리자가 남으면 공유 아기 데이터가 보존되고, 다른 멤버/친구의 Auth 계정은 삭제하지 않는다. 비동기 Storage cleanup 작업을 Production에서 수동 실행하지 않는다.

## 배포 및 최종 판정

검증/배포 결과는 아래에 기록한다. QA 검증을 통과한 SQL SHA-256은 `8fe0633b1eaceba6802d4eec4e18f05c4f5a14d44c2c1a762053e72a88a6cf5b`다. 이전에 받은 Production 배포 승인 범위에서 이 migration만 적용하며, 관련 없는 대기 migration이나 작업 트리 변경은 포함하지 않는다.

2026-09-18 13:36 UTC 기준 완료:

- 수정 전 QA 재현: formula/sleep 각각 RPC 23503, Edge 503, 트랜잭션 롤백 확인 — PASS.
- QA `verify-qa-account-deletion-lifecycle.mjs`: A–K, legacy retry, L 설정 ON/OFF 전부 PASS, 프로세스 exit 0.
- QA `verify-supabase-care-reminders.mjs`: 13개 정상 알림 계산/권한 검사 PASS, 프로세스 exit 0.
- Node 구문 검사와 `git diff --check` PASS.
- QA와 Production에 migration `202609180001` 적용 완료. Production 배포 후 함수 본문 전체가 검증한 본문과 일치하는지 확인. 함수 ACL, SECURITY DEFINER, search_path, 리마인더 FK/RLS 플래그/테이블 ACL, 기존 RPC와 트리거 함수가 모두 유지됨을 비교 확인.
- Production에서 사용자의 계정을 테스트 삭제하거나 기존 콘텐츠를 수동 정리하지 않음. 이 배포는 DB 함수 정의와 migration 이력만 변경함.
- 최종 로컬/QA 판정: 원인 재현 및 회귀 테스트 통과. 운영 반영 검증 완료. 실제 TestFlight 기기에서 삭제 완료까지의 최종 재시도 확인은 아직 받지 못함. 앱 업데이트는 필요 없음.
