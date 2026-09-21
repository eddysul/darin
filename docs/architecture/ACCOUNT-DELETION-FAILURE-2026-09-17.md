# Darin 계정 삭제 서버 실패 조사

> 이 문서는 수정 전 실패의 조사 기록입니다. 아래의 “마지막 관리자 삭제 차단” 제안은 이후 확정된 제품 정책으로 대체됐습니다. 구현·QA 결과와 현행 정책은 [계정 삭제 구현 보고서](ACCOUNT-DELETION-IMPLEMENTATION-2026-09-17.md)를 보세요.

2026-09-17. QA의 합성 계정으로 재현했다. Production에는 배포하거나 Production 계정·데이터를 조회하지 않았다. 첨부 화면의 문구는 클라이언트가 서버 오류를 숨긴 결과이며 원인 자체는 아니다.

## 판정

**첫 실패 지점은 Supabase Auth 사용자 삭제다.** `prepare_account_deletion()`은 성공해 별도 DB 트랜잭션으로 커밋된다. 이후 `auth.admin.deleteUser()`가 프로필을 삭제하려 할 때, 보존 대상 공유 아기의 `baby_caution_foods.created_by`가 프로필을 `ON DELETE RESTRICT`로 참조하여 거절된다. QA PostgreSQL의 실제 오류는 `23503`, 제약 이름은 `baby_caution_foods_created_by_fkey`다.

FK를 `ON DELETE SET NULL`로 바꾸기만 하면 `baby_caution_food_identity_guard()`가 작성자 변경을 막아 **두 번째 오류 `42501`**이 나온다. FK의 신뢰된 `SET NULL` 트리거 경로만 허용해야 한다. 두 변경을 한 트랜잭션 안에서 가정하고 Auth 행 삭제를 시험했을 때 `DELETE 1`이 성공했으며, 트랜잭션은 롤백했다. 따라서 이 두 가지가 재현된 FK/트리거 실패의 최소 결합 수정이다.

현재 구현에는 별도 **소유권 결함**도 있다. 유일한 관리자에게 다른 활성 구성원이 있으면 RPC가 그 관리자의 멤버십을 먼저 삭제하고, 공유 아기는 보존한다. QA에서 Auth 오류가 사라진 뒤 재시도하면 사용자 계정은 삭제되고 해당 아기에는 `viewer`만 남았다. 이 경우 자동 권한 승격도, 아기 삭제도 안전한 기본값이 아니다. 삭제 전에 다른 관리자를 지정하도록 막아야 한다.

## 정확한 호출 경로

1. [MenuScreen.tsx](</Users/joon/Downloads/Childcare Management App/src/screens/tabs/MenuScreen.tsx:121>): 입력값을 번역된 ‘삭제’와 비교하고, 일치하면 `deleteServerAccount("삭제")` 호출. 화면의 ‘이 기기의 로컬 데이터도 삭제’ 기본값은 켜져 있다.
2. [accountDeletion.ts](</Users/joon/Downloads/Childcare Management App/src/utils/accountDeletion.ts:15>): Supabase `functions.invoke("delete-account", POST, { confirmationText })`. 비 Supabase 구성에서는 `/v1/account` DELETE 대체 경로가 있으나 이번 재현 경로는 Supabase다.
3. [delete-account/index.ts](</Users/joon/Downloads/Childcare Management App/supabase/functions/delete-account/index.ts:14>): Authorization 헤더, `auth.getUser(token)`, 서버의 ‘삭제’ 확인. `anon` 키+사용자 토큰으로 RPC 클라이언트를 만들고, 서버 환경의 service role 키로 별도 관리자 클라이언트를 만든다. service role 키를 앱에 보내지 않는다.
4. 같은 Edge Function → `userClient.rpc("prepare_account_deletion")`. 최신 정의는 [202609150006_b04a_p1_profile_baby_authorization.sql](</Users/joon/Downloads/Childcare Management App/supabase/migrations/202609150006_b04a_p1_profile_baby_authorization.sql:101>)이다. `SECURITY DEFINER`, `auth.uid()` 기반이다.
5. RPC: 다른 활성 멤버가 없는 본인 아기 삭제 → 공유 아기의 일부 `created_by`/`used_by`와 notification actor/contact user 익명화 → 본인 push token/settings/recipient events 삭제 → 본인 `baby_members` 삭제. `babies.created_by`는 Auth→profile FK `SET NULL`에 맡긴다. 함수의 각 문장은 RPC 트랜잭션 안에서 원자적이나 **다음 Auth Admin HTTP 호출과는 원자적이지 않다**.
6. Edge Function → `adminClient.auth.admin.deleteUser(user.id)`. Auth→profiles `CASCADE`가 프로필에 연결된 FK와 트리거를 실행한다. 여기서 `baby_caution_foods`의 `RESTRICT`가 실패한다.
7. 성공 시에만 Edge Function이 `claim_media_cleanup`/Storage remove/`finish_media_cleanup`을 최대 100개 진행한다. 실패하거나 초과한 작업은 durable queue와 `storage-cleanup` 유지보수 경로가 맡는다. 현재 재현은 이 단계 **이전**에 중단된다.
8. `deleted: true` 응답 후에만 클라이언트가 기본 켜진 로컬 삭제 옵션에 따라 `clearAllUserData()` → `clearLocalAppData()` → `resetSettings()` → `logout()`을 진행한다. [App.tsx](</Users/joon/Downloads/Childcare Management App/App.tsx:250>)의 logout은 push unregister → 로그아웃 준비 → 세션 삭제 순서다. 서버 실패 시 이 과정은 실행되지 않는다.

## 실제 QA 오류와 증거

QA 프로젝트 가드를 통과한 뒤 합성 소유자, 활성 viewer, 공유 아기, 소유자가 만든 주의 음식 한 건을 만들었다. 합성 사용자와 아기는 매회 제거했다. 계정·토큰·비밀값은 로그에 출력하지 않았다.

| 관측 지점 | 결과 |
| --- | --- |
| 확인값 `삭제` | 통과. RPC까지 실행됨 |
| `prepare_account_deletion` | 성공, PostgREST 오류 없음 |
| `delete-account` Edge Function | HTTP **500**, `FunctionsHttpError`, body `{"error":"Auth account deletion failed","retryable":true}` |
| Auth Admin 직접 호출 | HTTP **500**, `AuthRetryableFetchError`, SDK `code` 없음, 메시지 `{}` |
| 동일 합성 Auth 행을 QA PostgreSQL에서 트랜잭션 내 삭제·롤백 | **SQLSTATE 23503**, `profiles` 삭제가 `baby_caution_foods_created_by_fkey` 위반. 실패 연산은 `auth.users` 삭제가 유발한 프로필 FK cascade |
| FK만 `SET NULL`로 가정한 트랜잭션·롤백 | **SQLSTATE 42501**, `baby_caution_food_identity_guard()`의 “caution food identity columns are immutable” |
| FK+신뢰된 FK `SET NULL`만 허용하는 guard를 함께 가정한 트랜잭션·롤백 | Auth 행 `DELETE 1`, 해당 합성 사례에서 추가 제약 오류 없음 |
| 최초 실패 후 | Auth 사용자 **존재**, 공유 아기 **존재**, 주의 음식 **존재**, 멤버십은 viewer 한 명만 남음. RPC의 멤버십 변경은 이미 커밋됨 |
| 합성 주의 음식만 제거한 뒤 Edge Function 재시도 | HTTP **200**, `deleted: true`, Auth 사용자 없음, 공유 아기에 viewer만 남음. 이는 데이터 삭제 해결책이 아니라 재시도·소유권 상태를 측정한 QA 실험이다 |

현재 Edge Function은 RPC 오류와 Auth 오류의 실제 코드를 로그·응답에 보존하지 않고 둘 다 generic 500으로 축약한다. 클라이언트 [accountDeletion.ts](</Users/joon/Downloads/Childcare Management App/src/utils/accountDeletion.ts:20>)는 `FunctionsHttpError`만 다시 포장하고, [familyDisplay.ts](</Users/joon/Downloads/Childcare Management App/src/utils/familyDisplay.ts:112>)가 이를 ‘계정 삭제 요청을 완료하지 못했어요’로 치환한다. 첨부 화면의 두 문구는 이 경로와 일치한다.

이 재현은 **QA 스키마와 합성 계정**에 대한 직접 관측이다. 첨부 화면의 실제 사용자가 주의 음식을 만들었는지, Production의 현재 마이그레이션 상태와 Edge 로그가 QA와 완전히 같은지는 확인하지 못했다. 따라서 그 사용자의 행별 실패 원인과 부분 삭제 여부를 원격에서 단정하지 않는다.

## 종속 관계 감사

QA DB에서 `auth.users` 또는 `public.profiles`를 참조하는 FK 44개를 조회했다. 직접적인 `RESTRICT`는 `baby_caution_foods_created_by_fkey` 한 개였다. 주의 음식은 [202608130001_multi_baby_caution_foods.sql](</Users/joon/Downloads/Childcare Management App/supabase/migrations/202608130001_multi_baby_caution_foods.sql:5>)에서 `created_by NOT NULL ... ON DELETE RESTRICT`로 생성됐다. 나중에 [202609150007_b04a_p1_growthbook_caution_authorization.sql](</Users/joon/Downloads/Childcare Management App/supabase/migrations/202609150007_b04a_p1_growthbook_caution_authorization.sql:447>)이 그 필드를 변경 불가로 만드는 트리거를 추가했다. 계정 삭제 RPC는 이 두 변경을 반영하지 않았다.

- `baby_members`, `memory_friends`, `user_friendships`, 초대 요청의 사용자 관계, `memory_reactions`, `memory_saves`, `memory_selected_people`, 가족 태그 대상은 프로필 삭제 시 cascade다.
- 공유 아기의 `babies.created_by`, 일기·추억 게시물·댓글·태그의 작성자, 성장책의 작성자, 스티커 작성자 등은 FK `SET NULL` 또는 RPC의 명시적 익명화로 보존된다. 소유자가 작성한 공유 게시물의 media 행도 부모가 남는 한 보존된다.
- 본인 대상 알림과 push token/settings는 RPC에서 지워지고 FK cascade도 뒷받침한다. 다른 사람의 알림에 본인이 actor였던 경우 actor를 null로 만든다.
- Storage 물리 삭제는 필수 동기 단계가 아니다. [202609150009_b04b_storage_cleanup_queue.sql](</Users/joon/Downloads/Childcare Management App/supabase/migrations/202609150009_b04b_storage_cleanup_queue.sql:1>)은 삭제된 아기·프로필·미디어의 정규 경로를 큐에 넣는다. 기존 첨부 파일은 `key_attached`로 제외하며 미완료 작업은 lease 후 재시도한다. 이번 HTTP 500은 Storage remove 전에 발생했다. 큐 접근을 위해 버킷을 public으로 바꾸거나 RLS를 약화할 이유가 없다.
- RPC는 `SECURITY DEFINER`이며 서버가 확인한 `auth.uid()`만 대상으로 한다. QA에서 RPC 자체는 성공했다. 재현된 실패는 클라이언트 확인값이나 일반 RLS 거부가 아니라 **Auth cascade의 FK+트리거 충돌**이다.

## 소유권별 기대 동작과 현재 위험

| 경우 | 현재 구현의 결과 | 안전한 정책 |
| --- | --- | --- |
| A. 아기/가족 없음 | RPC가 사실상 정리할 멤버십이 없고 Auth 프로필 삭제로 진행 | 삭제 허용. 소셜 관계·본인 알림/토큰은 정리. QA 직접 실행은 아직 없음 |
| B. 일반 가족 멤버 | 다른 활성 멤버가 있으면 공유 아기를 남기고 본인 멤버십 삭제 | 삭제 허용. 다른 구성원의 기록·아기 데이터 유지. 작성한 주의 음식이 있으면 FK/guard 수정 필요 |
| C. 친구/공유 수신자만 있음 | Auth→profile 삭제가 `memory_friends`·친구 관계·본인 반응/선택 관계를 정리 | 삭제 허용. 원래 가족의 아기·게시물은 유지. 본인 댓글은 익명화 |
| D. 관리자이며 다른 관리자 존재 | 공유 아기 유지, 본인 멤버십 제거 | 삭제 허용. 남은 관리자가 운영 가능. 주의 음식 FK/guard 수정 필요 |
| E. 유일한 관리자, 다른 활성 구성원 존재 | **QA 재현: viewer만 남는 관리자 없는 아기** | 삭제 전에 다른 관리자를 지정하도록 **중단**. viewer/editor를 자동 승격하지 않음. 아기를 삭제하지 않음 |
| F. 유일한 구성원 | 아기와 자식 행을 cascade 삭제하고 미디어 삭제를 큐에 넣음 | 본인만의 데이터라는 검증 후 해산 허용. 활성 친구 수신자나 다른 사람의 작성·댓글·미디어가 있으면 중단하고 안전한 소유권 정리 필요 |
| G. 타인에게 공유된 추억·미디어의 소유자 | 공유 아기에 다른 활성 멤버가 있으면 게시물·미디어 보존, 작성자 null. 본인이 아기의 유일한 멤버면 아기 cascade로 함께 삭제 가능 | 다른 사용자가 접근/작성한 공유 데이터는 보존. 공유 아기 삭제 전 수신자·타인 기여 여부 검증 |

기존 [verify-supabase-account-deletion.mjs](</Users/joon/Downloads/Childcare Management App/scripts/verify-supabase-account-deletion.mjs:1>)는 단독 아기 삭제와 소유자+viewer 공유 아기 보존을 확인하지만, 공유 아기의 **남은 관리자 존재 여부**, `baby_caution_foods`의 작성자 FK, Auth 실패 뒤 재시도·부분 삭제, 친구 수신자만 있는 단독 아기, 다른 사람의 공유 콘텐츠 보존은 검사하지 않는다. 기존 B0.4b Storage smoke는 성공했으며, 미디어 삭제 실패가 큐에 남는 동작을 확인한다.

## 최소 안전 수정안과 오류 계약

1. 새 순방향 마이그레이션에서 `baby_caution_foods.created_by`를 nullable로 바꾸고 `baby_caution_foods_created_by_fkey`를 `ON DELETE SET NULL`로 재생성한다. 기록 행과 주의 음식 이름은 삭제하지 않는다. 기존 마이그레이션 파일을 소급 수정하지 않는다.
2. `baby_caution_food_identity_guard()`에서 `created_by`가 null로 바뀌는 **FK cascade 내부 경로**만 허용한다. 현재 다른 성장책·스티커 guard가 쓰는 `new.created_by IS NULL AND pg_trigger_depth() > 1` 패턴이 QA 롤백 시험에서 성공했다. 사용자가 직접 작성자나 아기 ID를 바꾸는 것은 계속 거부한다.
3. `prepare_account_deletion()`의 첫 변경 전에 권한 전수검사를 둔다. 본인이 마지막 활성 관리자이고 다른 활성 구성원이 있으면 `OWNERSHIP_TRANSFER_REQUIRED`로 중단한다. 유일한 멤버의 아기를 삭제할 때 활성 친구 수신자나 타인 소유 콘텐츠가 있으면 `SHARED_CHILD_DATA_REQUIRES_TRANSFER`로 중단한다. 검사와 변경은 같은 RPC 트랜잭션에서 행을 잠가 경쟁 상태를 막아야 한다. 기존 권한을 무조건 승격하거나 다른 구성원의 데이터를 삭제하지 않는다.
4. Edge Function은 내부 `error.code`와 단계만 민감 정보 없이 서버 로그에 남긴다. 클라이언트에는 안정적인 코드만 준다: 권한 이양 필요 **409**, 진행/중복 요청 **409**(상태를 실제로 저장할 때만), 일시적 DB/Auth 정리 실패 **503 + retryable**, 성공 **200 + mediaCleanupPending**. SQL 메시지·경로·토큰은 응답에 싣지 않는다. 현재 UI는 이 코드를 읽지 못하므로 메시지 반영은 별도 클라이언트 작업이다.
5. 엄격한 재시도 보장을 위해 RPC 커밋과 Auth Admin 삭제 사이의 실패를 durable 상태로 기록하고 서버에서 재시도할 수 있게 하거나, 안전하게 검증된 단일 트랜잭션 삭제 경로를 설계해야 한다. 지금은 FK 수정 뒤 사용자가 같은 세션으로 재시도하면 진행 가능하지만, Auth 서비스 장애나 다른 미래 제약이 있으면 가족에서 이미 빠진 활성 계정이 남는다. 이 문제를 단지 `retryable: true`로 해결했다고 간주하면 안 된다.
6. 서버가 `deleted: true`를 보낸 뒤 로컬 정리나 push unregister가 실패할 경우 이미 삭제된 계정에 generic ‘삭제 실패’를 보여주고 로그아웃도 막을 수 있다. 서버 성공과 로컬 정리 실패를 분리하고, 로그아웃·세션 제거를 `finally`에서 보장하는 후속 클라이언트 안정화가 필요하다. 화면 재설계는 필요하지 않다.

## 필요한 회귀 테스트

1. A–G 각각 QA 합성 사용자로 실행. 성공 케이스는 Auth·멤버십·알림·친구 관계·댓글·반응·저장·미디어 보존/큐를 검증한다. 중단 케이스는 RPC 이전/이후 행 수가 같은지 검증한다.
2. 공유 아기의 주의 음식을 삭제 계정이 작성한 경우, Auth 삭제 후 음식은 남고 `created_by`만 null인지 확인한다. FK만 바꾼 경우의 `42501`도 회귀 가드로 잡는다.
3. Auth Admin 장애를 주입해 RPC 성공 뒤 재시도/세션 만료를 시험하고, 두 번째 요청이 다른 사용자 데이터를 중복 삭제하지 않는지 확인한다.
4. 마지막 관리자와 활성 viewer/editor, 다른 관리자 존재, 유일한 멤버+친구 수신자, 탈퇴한 타인의 옛 콘텐츠를 포함해 소유권/보존 정책을 검증한다.
5. Storage remove 실패를 주입해 계정 삭제 HTTP 성공, 큐 보존, worker 재시도, 이미 붙은 공유 미디어의 미삭제를 확인한다.
6. 확인 문구 불일치 400, 유효 세션 없음 401, ownership 409, 일시 오류 503과 사용자에게 보일 안정 문구를 검증한다.
7. `deleteLocal` 켜짐/꺼짐 모두 서버 성공 뒤 로컬 정리·로그아웃 실패 경로를 검증한다.

## 데이터 위험과 현지 결론

- **기존 사용자 데이터 손실:** 이번 QA에서는 합성 데이터만 만들고 제거했다. 첨부 화면 사용자에게 실제 데이터 손실이 있었는지는 확인하지 못했다. 같은 500이라면 RPC는 이미 공유 멤버십을 제거했을 가능성이 높다. 복구 전에 실제 해당 계정의 Auth 존재, 멤버십·관리자 수, 주의 음식, 미디어 큐를 읽기 전용으로 점검해야 한다.
- **부분 삭제:** QA에서는 확정됐다. Auth 계정은 남고 멤버십은 제거됐으며 공유 아기는 보존됐다. 메모리·댓글 등의 authored-by null 전환은 Auth 삭제 전에는 일반적으로 아직 발생하지 않는다. RPC가 직접 null 처리하는 항목과 푸시·알림 삭제는 이미 적용된다.
- **현재 재시도:** 동일 주의 음식 FK가 남아 있으면 반복 실패한다. 첫 RPC가 이미 멤버십을 제거하므로 재시도는 원래 가족 관계를 복원하지 않는다. 합성 주의 음식을 제거한 QA 실험에서는 두 번째 요청이 200으로 끝났지만 관리자 없는 아기를 남겼다. 현재 상태를 일반적으로 ‘안전하게 재시도 가능’하다고 표시해서는 안 된다.
- **최종 local verdict:** 원인은 QA에서 PostgreSQL `23503` + 후속 `42501`까지 재현됐다. Storage/RLS/확인 문구가 첫 원인이 아니다. 두 제약의 안전한 결합 수정과 사전 소유권 검사가 필요하다. 이 조사에서는 코드·DB 마이그레이션을 적용하거나 배포하지 않았다.
