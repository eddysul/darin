# 아기별 공유·권한 및 UI 안정화 실행 기록

계획: [DARIN-BABY-SCOPED-SHARING-UI-STABILIZATION-PLAN-2026-09-20.md](./DARIN-BABY-SCOPED-SHARING-UI-STABILIZATION-PLAN-2026-09-20.md)

상태: G4 focused security review와 전체 로컬 회귀까지 완료하고 G5 직전에 중단. QA/Production 적용은 미실행이다. 이 문서는 적용·배포 증빙이 아니다.

## G0 변경 inventory와 기준선

시작 revision은 `e4f63f1 fix(memories): preserve historical author identity`. 작업 트리는 UI, context/repository, i18n, QA, 기존 계정 삭제 migration/function 등 여러 변경이 이미 섞여 있다. 이번 실행에서는 기존 변경을 stage, commit, revert하지 않았다.

기존 데이터 경계 확인:

| 현재 구조 | 현행 권한·enforcement | 새 계약에서 필요한 변화 |
| --- | --- | --- |
| `baby_members` | 아기+사용자 1행, `admin/editor/viewer`, 관계 label 별도. `baby_permission`/`is_baby_member`가 active status 확인 | 세부 care/moments/social 권한을 아기별로 저장하고 현재 membership와 함께 검사. 부모/admin 지정 경로 별도 보호 |
| `memory_friends` | 별도 baby-scoped 친구 행. memory visibility·social helper에서 status 검사 | 관계 metadata와 permission 분리. 친구에게 care를 허용할지의 모델 및 기본값 명시 |
| `care_logs`, growth, Diary | `current_baby_write_permission`이 현재 membership을 잠그고 editor는 본인 작성 행만 수정·삭제 | 읽기/쓰기 분리. 기존 작성자 ownership 및 role transition lock 유지 |
| `memory_posts`, child tables | published/visibility/recipient/author 조건과 current membership·friend 확인 | `moments.read/write`, `social.comment/react` 추가 시 기존 privacy·draft 경계와 교집합으로 검사 |
| Storage / signed URL | B0.4b의 restrictive `storage_security.resource_access`, post 조회 경계와 cleanup queue | 권한별 object 접근·신규 URL 발급 연결. 이미 발급한 URL의 만료/철회 계약 별도 결정 |
| 초대 | Darin ID request, invite code, current issuer revalidation. 현재 role 중심 | 신규 초대 권한 set을 서버가 검증하고 수락 직전 issuer의 현재 권한 재검증 |
| 아기 직접 삭제 | `202609180002_delete_created_baby.sql`은 creator+active admin만 허용 | 직접 삭제는 creator-only 계약 유지 |
| 계정 삭제 | `202609170005_account_deletion_lifecycle.sql`은 마지막 active admin의 baby를 삭제하려 하지만 후속 creator guard가 비creator 삭제를 거부 | 직접 삭제와 계정 삭제 예외를 분리해 last-admin noncreator도 안전하게 정리할지 구현·회귀 필요 |

현재 권한에서 새 permission으로 옮길 때의 최소 매핑(아직 migration/backfill이 아니다):

| 현재 상태 | care.read/write | moments.read/write | social.comment/react | 서버 경계·주의점 |
| --- | --- | --- | --- | --- |
| active `baby_members.admin` | 전체 read/write | 기존 visibility·ownership 조건 안의 read/write | 기존 대상 visibility 안의 소통 | `baby_permission`, `current_baby_write_permission`, 각 RLS, Storage signer; 엄마/아빠 여부는 관계 label만으로 증명되지 않음 |
| active `baby_members.editor` | 현재 member read, 자기 작성분 중심 write | 현행 게시물 RLS·visibility에 따른 read/write | 현행 interaction 조건 | 새 독립 permission으로 나눠도 타 작성자 수정 권한을 얻지 않아야 함 |
| active `baby_members.viewer` | 현재 member read, write 불가 | visibility별 read, write 불가 | 기존 post interaction 조건별 | 실제 legacy 접근보다 더 넓게 backfill하지 않음 |
| active `memory_friends`만 있음 | 없음 | `friend_circle` 등 허용된 게시물만 read | 허용된 게시물의 현재 interaction 조건 | `baby_members`로 무조건 편입하면 care 누출이므로 금지 |
| pending/inactive/revoked/NULL/ambiguous | 없음 | 없음(작성자 자신의 소유물 예외는 별도 검토) | 없음 | 기본 fail closed, 권한 승격 추정 금지 |

서버 enforcement의 영향면은 `care_logs`/growth/Diary와 Growth Book·caution foods의 SELECT/INSERT/UPDATE/DELETE, `memory_posts`·media·tags·recipients·comments·reactions, `storage_security.resource_access`, `resolve_private_media_for_signing`, 초대 코드/ID 수락 RPC, baby profile 및 계정 삭제 RPC다. 단순한 `baby_members` 컬럼 추가만으로는 이 경계가 바뀌지 않으므로 G2에서 각 객체별 forward migration과 공격 회귀가 필요하다.

현재 signed URL은 memory/sticker/avatar 180초, diary/growth-book 300초다. 사용자는 권한 철회 즉시 **신규 발급 차단**, 기존 발급 URL은 **만료까지 유효**한 계약을 승인했다. 즉시 철회나 클라이언트 캐시 삭제를 서버 측 URL 철회라고 주장하지 않는다.

G2의 다른 보호자 Full Admin 지정은 **현재 해당 아기의 admin이 전용 절차로 승인**해야 한다. 엄마·아빠라는 관계 label만으로 admin을 자동 부여하지 않는다. 기존 legacy admin은 migration 중 유지한다. 이 계약은 로컬 migration/RPC와 공격 회귀에 반영했다.

시뮬레이터 기준선은 `outputs/g1-ui-baseline/`에 출생/임신 한눈에, 기록, 주·월·전체 리포트, Diary, 우리 순간, 프로필, 초대, 가족·친구 관리 화면으로 로컬 저장했다. 이 디렉터리는 `.gitignore` 대상이며 QA 데이터가 포함될 수 있어 commit하지 않는다. iPhone 16 Pro / iOS 18.2, 기본 light/large 설정에서 캡처했다.

권한 migration에서 기존 `admin/editor/viewer/friend`가 실제로 어떤 기록/게시물/Storage 접근을 가진 상태인지 기능별로 비교해 backfill해야 한다. 관계 문자열만으로 권한을 승격하면 안 된다. 특히 기존 `memory_friends`를 `baby_members`로 무조건 편입하면 care 접근이 생길 수 있으므로 금지한다.

## G1 확인 및 수정

- 시뮬레이터: iPhone 16 Pro / iOS 18.2. 출생→임신→출생 전환, 임신 달력 다음 달, 기록↔한눈에 왕복, 출생 주/월 리포트 탭이 터치에 반응하고 화면이 로드됨. 실기기 검증은 범위 밖.
- 오래된 QA 참조를 현재 `OverviewReportScreen`, `MemoryCommentsSheet`, scope hydration service로 갱신했다. 기존 assertion의 목적은 유지했다.
- `qa:mobile-ui`, `qa:architecture`, `qa:overview-growth`, `qa:overview-category-cards`, `qa:weekly-ai-cache`, `qa:build12`, `qa:diary-save`, `qa:voice-scope`, `qa:invite-search`, `qa:repository-queries`, `qa:secrets`, `qa:report`, `typecheck`, `git diff --check` 통과.
- B0.4a P0, ID invite, ownership/visibility, B0.4b Storage, B0.4c Notification 정적 smoke 통과. B0.4a P0, ID invite, ownership/visibility 로컬 PostgreSQL 공격 회귀 통과.
- 스페인어 Overview의 `Tummy time`을 번역했다. 숫자 placeholder만 있는 스페인어 pregnancy count는 언어 중립 값으로 coverage에 명시했다. `qa:i18n:coverage`, `qa:i18n:release`, `qa:i18n:audit` 통과.
- 월간 리포트의 수유 횟수 감소가 수유 간격 안정으로 해석되던 문구를 제거했다. 기간·지표에 맞는 비교 문구로 바꾸고 회귀를 추가했다.
- 불완전/실패 조회에서 오늘 요약·리듬·AI 분석 카드를 수치 0이나 완료 통계처럼 표시하지 않게 했다.
- 성장 기록 hydrate 실패는 `기록 없음` 대신 오류 상태를 표시하도록 연결했다.
- narrative AI 표시 상태를 전체 cache identity에 연결해 계정·아기·기간·locale·사실 변화 시 규칙 기반 문장으로 즉시 대체한다.
- 아기 선택 시 새 프로필을 보여주기 전에 이전 account/baby의 로그·성장·Diary·가족·스티커·채팅·커스텀 카테고리·빠른 기록을 화면/메모리에서 숨기고 이전 hydration run을 무효화한다.
- 우리 순간 피드의 카드·댓글/미디어 overlay를 account + active baby + 접근 가능한 baby 집합의 identity에 묶었다. 이전 scope 또는 이전 fetch run의 늦은 응답은 피드 state에 반영하지 않는다.
- iPhone 16 Pro 시뮬레이터에서 같은 아기 재선택, 출생→임신→출생, 조회 중 탭·아기 전환, 우리 순간 조회 중 전환의 터치/로딩을 확인했다. Dark appearance와 accessibility-large 글자도 확인했고, 시뮬레이터 설정은 light/large로 원복했다.
- 큰 글자에서 오늘의 리듬 헤더 버튼이 잘리고 5개 시간 눈금이 겹치던 문제를, 헤더 줄바꿈과 큰 글자일 때 3개 눈금으로 수정해 시뮬레이터에서 재확인했다.
- `OverviewReportScreen`의 접근성 요약이 마침표를 중복해 읽는 문제를 수정했다.

## G2 권한·lifecycle 로컬 구현 및 검증

### 권한 계약과 서버 enforcement

- `baby_access_permissions`에 `care.read/write`, `moments.read/write`, `social.comment/react`를 baby+user 단위로 저장한다. write는 대응 read가 있어야 하며 잘못된 조합은 RPC와 DB constraint에서 거부한다.
- legacy `admin/editor/viewer`와 `memory_friends`를 실제 기존 접근 범위를 넘기지 않게 backfill한다. 친구에게 care를 주지 않고, 관계 label 변경만으로 어떤 권한도 승격하지 않는다.
- Full Admin 승격은 현재 해당 baby Full Admin만 `promote_baby_full_admin` 전용 RPC로 승인할 수 있다. 직접 role 편집을 통한 승격을 trigger가 차단하고 마지막 Full Admin 제거도 차단한다.
- care/growth/Diary, moments visibility·ownership, comments/reactions, baby profile, Growth Book, caution food, Storage upload/delete 및 신규 signed URL 발급에 capability 검사를 연결했다. 기존 게시 상태·privacy·recipient·작성자 ownership 조건은 capability와 교집합으로 유지한다.
- 권한·membership·friend 연결이 바뀌면 현재 baby/account scope의 화면 데이터를 즉시 숨기고 authoritative scope로 다시 hydrate한다. 이전 hydration run은 무효화한다.
- signed URL은 신규 발급 시 현재 권한을 검사한다. 승인된 계약대로 이미 발급된 URL은 memory/sticker/avatar 180초, diary/growth-book 300초 만료까지 유효할 수 있다.

### lifecycle

- 직접 baby 삭제의 creator-only 계약은 유지한다.
- 계정 삭제는 baby row를 잠근 뒤 다른 Full Admin이 남으면 삭제 사용자 관계만 제거한다. 삭제 사용자가 마지막 Full Admin이면 baby graph를 삭제하고 unattached Storage object를 기존 cleanup queue에 넣는다.
- 두 admin의 동시 계정 삭제는 baby lock으로 직렬화되어 관리자 없는 orphan baby가 남지 않는다. 다른 baby·다른 사용자 계정은 대상이 아니다.

### 검증 중 발견해 수정한 P1

1. 공용 relation trigger가 `memory_friends` 행에서도 `baby_members.permission_role` 필드를 평가해 신규 친구 연결을 실패시키는 문제를 table별 분기로 수정했다.
2. 친구-only 연결에서 `NULL IN (admin, editor)` 결과가 NOT NULL permission 열로 흘러가던 문제를 명시적인 `false`로 fail-closed 처리했다.

### G2 로컬 검증 결과

- `qa:baby-scoped-permissions`: PASS
- `qa:baby-scoped-permissions:local-postgres`: PASS — legacy backfill, 독립 권한, cross-baby 차단, 직접 admin 승격 차단, 전용 승격, social 권한 분리, 권한 철회/write 직렬화, 마지막 admin 보호
- `qa:baby-scoped-extended:local-postgres`: PASS — care/moments 분리, baby/Growth Book/caution RLS, Storage temp upload, signed URL descriptor/TTL, 철회 직후 신규 signing 차단
- `qa:baby-scoped-lifecycle:local-postgres`: PASS — creator-only 직접 삭제, last-admin 계정 삭제, 다른 admin 보존, cleanup queue, 동시 탈퇴 직렬화
- 위 migration은 isolated PostgreSQL에서 반복 적용 가능성도 확인했다. QA/Production에는 적용하지 않았다.

## G3 공유 관리·한눈에 UX 로컬 구현 및 검증

### 공유 관리

- 가족 초대와 초대 코드는 기본 `editor` 연결만 생성한다. 초대 화면에서 `admin`을 직접 선택하는 경로를 제거했다.
- 연결된 뒤 현재 Full Admin만 가족·친구별 `care.read/write`, `moments.read/write`, `social.comment/react`를 관리한다. UI는 write→read, social→moments.read 의존성을 함께 적용하고 서버 RPC가 같은 계약을 다시 검증한다.
- 관계 label, Full Admin 상태, 실제 permission summary를 분리해 표시한다. legacy `editor/viewer` 배지를 실제 권한처럼 보여주지 않는다.
- Full Admin은 활성 가족에 한해 별도 파괴적 확인 후 `promote_baby_full_admin` 전용 RPC로만 승격한다. 일반 toggle로 Full Admin을 제한하거나 직접 role을 바꾸는 UI는 없다.
- baby/account 전환 중 이전 권한·친구·초대 응답이 새 화면에 반영되지 않도록 refresh generation을 도입했다. 권한 조회 실패는 권한 없음으로 간주해 덮어쓰지 않고 toggle을 닫는다.

### 한눈에 rhythm·category

- 기본 비교는 오늘 현재 시각까지와 어제 같은 시각까지로 고정했다. 미래 기록과 진행 중 duration은 cutoff에서 잘라 계산한다.
- 현재 시각 선은 실제 `now`에 고정하고, 어제·오늘 행은 각자 독립 cursor로 탐색한다. 한 행을 움직여도 다른 행의 x 좌표는 바뀌지 않는다.
- 선택 tooltip은 선택한 날짜·시각, 해당 시점 사건값, 그 날짜의 누적값을 동적 category별로 표시한다. 짧은 point event는 10분 hit window만 사건값으로 인정하고 누적값은 언제나 선택 cutoff를 따른다.
- VoiceOver/스크린리더에서 두 timeline row를 adjustable control로 노출하고 15분 단위 증감 및 현재 값을 제공한다.
- 고정 수유·수면·기저귀와 실제 기록이 있는 추가 category 구조, 임신 overview 분리, 기존 pastel card/기록 진입 흐름은 유지했다.

### 오리 asset 체계

- 기존 feed/rest/diaper/sick/idle 자산의 의미·재사용 범위를 inventory했다.
- 터미타임·이유식/식사·목욕·산책·놀이는 같은 캐릭터 identity의 신규 pose가 필요하다고 분류했다.
- 파일명, transparent canvas/safe-area, 표시 비율, sprite 분리 규칙을 `docs/design/DARIN-OVERVIEW-DUCK-ASSET-INVENTORY-2026-09-20.md`에 확정했다. G3에서는 신규 이미지를 생성하거나 교체하지 않았다.

### G3 검증 결과

- `typecheck`: PASS
- `qa:mobile-ui`: PASS
- `qa:overview-growth`: PASS
- `qa:overview-category-cards`: PASS
- `qa:overview-category-compare`: PASS — same-time cutoff, 진행 duration clipping, 동적 category, 사건값/누적값, 독립 day cursor 계약
- `qa:invite-search`: PASS — 초대 admin 선택 제거 및 연결 후 별도 승인 계약
- `qa:baby-scoped-permissions`: PASS
- `qa:baby-scoped-permissions:local-postgres`: PASS — permission dependency, 전용 admin 승인, 직접 승격 차단, 철회 및 cross-baby 차단
- `qa:report`: PASS
- `qa:architecture`: PASS
- `qa:repository-queries`: PASS
- `qa:i18n:audit`, `qa:i18n:coverage`, `qa:i18n:release`: PASS
- iPhone 16 Pro / iOS 18.2 Expo Go에서 현재 소스 bundle startup까지 확인했다. Expo Go가 별도 fresh storage로 약관 화면에서 시작해 authenticated sharing/timeline 화면의 수동 UI 확인은 수행하지 않았으며 PASS로 주장하지 않는다.
- 신규 commit, QA/Production migration, Supabase mutation, 배포는 수행하지 않았다.

## G4 focused security review 및 전체 로컬 회귀

G0–G3 source 기준점은 `96891a4833ae009b8d95ab0dfda76c5562c86731`이다. G4에서는 migration/RPC trigger ordering, `SECURITY DEFINER` 실행권한, account deletion과 Storage cleanup, 모바일 account+baby scope의 늦은 응답을 함께 검토했다.

### 검토 중 발견해 수정한 P1

1. 두 Full Admin이 동시에 탈퇴·강등되면 각 transaction이 상대 관리자를 보고 모두 성공할 수 있었다. `baby_admin_transition_guard`가 baby parent row를 잠근 뒤 현재 관리자 수를 다시 검사하도록 직렬화하고, 동시 탈퇴 공격 회귀에서 정확히 한 요청만 성공하며 관리자 1명이 남는 것을 확인했다.
2. `babies` UPDATE 정책만 stable access 조회를 사용해 care.write 철회와 profile write가 직렬화되지 않았다. `current_baby_access_for_write`로 바꾸고, in-flight profile write와 철회가 순서대로 완료되며 철회 뒤 stale write가 거부되는 것을 확인했다.
3. 임의 `user_id`를 받는 내부 helper 3개가 authenticated에 직접 공개되어 다른 사용자의 연결·admin·capability 여부를 boolean으로 조회할 수 있었다. helper 실행권한을 내부 전용으로 회수하고 current-user admin wrapper만 공개했다.
4. 공유 관리 mutation과 초대 요청이 account/baby 전환 중 완료되면 이전 응답이 새 화면의 loading·toast·permission state에 반영될 수 있었다. mutation client를 캡처한 세션에 고정하고, 화면 반영은 전체 `account+baby` scope identity가 일치할 때만 허용했다.

### G4 검증 결과

- `typecheck`, `git diff --check`, secret scan: PASS
- mobile UI, Overview growth/category/compare, pregnancy Overview, baby switch responsiveness: PASS
- weekly AI cache, report, Diary save, Voice scope, architecture, repository query: PASS
- invite search/response, five-locale i18n audit/coverage/release: PASS
- B0.4a P0/ID invite/ownership-visibility/final authorization 정적 및 로컬 PostgreSQL 회귀: PASS
- baby-scoped permissions/extended/lifecycle 정적 및 로컬 PostgreSQL 회귀: PASS
- B0.4b Storage 정적 회귀와 실제 Docker Storage API + disposable PostgreSQL 공격 회귀: `184 PASS / 0 skipped`
- B0.4c Notification 정적 및 로컬 PostgreSQL 회귀: PASS
- 실제 기기 검증은 승인된 계획 범위에서 제외했다. QA/Production migration, API mutation, 배포는 0건이다.

focused review 기준 변경 경로에 남은 P0/P1은 확인되지 않았다. 이미 발급된 signed URL은 승인된 계약대로 최대 180–300초 만료까지 유효하며, 새 발급은 철회 즉시 차단한다.

## 아직 통과로 판정하지 않은 항목

- G1의 로컬 코드/정적/기존 iOS simulator 회귀는 PASS다. 다만 실제 account X→Y 수동 UI, 작은 Android 화면, media 부분 실패의 실제 UI, 장시간 메모리/중복 subscription 계측은 이번 정지점에서 실행하지 않았다. 실기기는 계획 범위에서 제외되어 있다.
- G2/G3 변경은 G4 focused security review와 전체 로컬 공격 회귀까지 PASS다. 실제 QA schema/data preflight는 G5 전 단계이므로 아직 수행하지 않았다.
- G5–G6: QA/Production migration/API 공격 회귀와 release gate는 미실행이다.
- 기존 signed URL의 만료 전 강제 철회는 승인된 계약상 제공하지 않는다. 신규 발급은 권한 철회 즉시 차단한다.

## 일시 중단 인계 — 재개 시 여기서 시작

1. G5에서 QA project identity·pending migration dependency·synthetic fixture를 read-only 확인한 뒤 migration/API 공격 회귀로 이동한다. Production은 별도 승인 전 변경하지 않는다.
2. G5에서 migration source SHA와 적용 대상을 다시 고정하고, admin/family/friend/cross-baby/removed/concurrency/Storage matrix의 실제 QA API 결과를 기록한다.
3. 별도 UI release gate 전에 아직 미실행인 authenticated sharing/timeline 수동 확인, account X→Y 전환, 작은 Android, media partial failure UI, 장시간 subscription 계측을 보완한다.

현재 소스에서 `typecheck`, mobile UI, Overview growth/category, weekly AI cache, report, build12, Diary, Voice scope, architecture, repository query, invite, i18n coverage/release/audit, secrets, B0.4a/B0.4b/B0.4c 정적 회귀와 `git diff --check`가 PASS했다.

G4에서는 QA/Production migration, Supabase 변경, 배포를 하지 않았다. 기존 무관한 dirty worktree 변경은 그대로 보존한다.

현재 verdict: `G4 SECURITY/LOCAL REGRESSION PASS — READY FOR G5 QA PREFLIGHT`
