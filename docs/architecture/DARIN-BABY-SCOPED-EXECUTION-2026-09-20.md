# 아기별 공유·권한 및 UI 안정화 실행 기록

계획: [DARIN-BABY-SCOPED-SHARING-UI-STABILIZATION-PLAN-2026-09-20.md](./DARIN-BABY-SCOPED-SHARING-UI-STABILIZATION-PLAN-2026-09-20.md)

상태: G0–G6 로컬/QA 실행과 최종 provenance·잔여 위험 정리를 완료했다. Production 적용은 수행하지 않았다.

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

## G5 QA migration 및 실제 API 통합 공격 회귀

### QA preflight와 적용 범위

- 대상은 QA project `rkveopusmgleuarbcrnt`로 고정했고 Production ref가 포함되면 중단하는 guard를 사용했다.
- QA에는 target 직전 migration 중 `202609170004_search_invite_profiles.sql`과 `202609180002_delete_created_baby.sql`이 적용되지 않은 상태였다. 전자는 현재 G3 invite 검색 RPC의 직접 dependency이고, 후자는 G2/G4 lifecycle migration이 전제하는 creator-only 삭제·guard의 직접 dependency라 target과 같은 transaction에 포함했다.
- `202608220002`, `202608260003`, `202609170001`, `202609170002`는 target과 독립이므로 적용하지 않았다. fake history mark, timestamp 변경, rename/delete는 하지 않았다.
- 아래 다섯 source를 하나의 transaction에서 실제 SQL 실행 후 실제 migration history에 기록했다. 실패 시 전체가 rollback되는 경계로 적용했다.

| migration | source SHA-256 |
| --- | --- |
| `202609170004_search_invite_profiles.sql` | `6f3b9387942e878610bea8a6363729b4b4ad200e1dde9a54f0cf71990f78964c` |
| `202609180002_delete_created_baby.sql` | `01513d38192bcb3288ef0228387d74c92d543d82c28ec1d99b10b4bcfe76680d` |
| `202609200001_baby_scoped_permissions.sql` | `2afc4e56f690c0ecc0cd6aae79643db07999637b6ca1c80588275de5ed2e1b22` |
| `202609200002_baby_scoped_extended_enforcement.sql` | `69893e760a7572b5154d5ea5f324f3b0315927e285a21cd74eaad1722de4c03a` |
| `202609200003_baby_scoped_account_lifecycle.sql` | `f6404149414716a586835e2682b51c3431db2a8d9bbc52edc8718d03e1ee3935` |

적용 직후 `baby_access_permissions`, invite search, creator delete/cleanup, access toggle, Full Admin promotion, account lifecycle, 내부 helper grant 회수, 기존 3-column media resolver가 실제 QA schema에 존재하는지 확인했다. permission dependency 위반 행과 현재 관계가 없는 orphan permission 행은 모두 0이다.

### 데이터 integrity와 fail-closed 처리

- preflight에서 membership/friend의 NULL status·role, 중복 membership/friend는 0이었다.
- 기존 QA에는 active Full Admin이 없는 legacy baby가 있었다. 신뢰할 수 있는 creator/current-authority 근거 없이 누구에게도 권한을 추정·부여하지 않았다. 최종 broader postflight 기준 28개가 계속 fail-closed 상태다.
- 이 legacy data는 기존에도 현재 RLS에서 접근 불가능했으며 이번 migration이 노출하거나 자동 승격하지 않았다. 별도 운영 data-cleanup 결정으로 남긴다.

### 실제 QA API 공격 회귀

- B0.4b 실제 Storage API/signed-URL/cleanup matrix: `146 PASS / 0 skipped`.
- G5 disposable authenticated account API matrix: `26 PASS / 0 skipped`.
- Full Admin backfill, 독립 `care.read/write`, friend moments-only, no-moments family, social comment/react positive control을 확인했다.
- cross-baby care read/write, arbitrary-user helper 호출, 직접 Full Admin role grant, non-admin invite search, 초대 Full Admin의 creator-only 삭제를 차단했다.
- 전용 Full Admin promotion, creator 삭제, last noncreator Full Admin account-lifecycle 정리를 정상 control로 확인했다.
- permission 철회 후 새 Moment 조회와 comment가 즉시 거부됐고, B0.4b matrix에서 새 signed URL 발급도 즉시 거부됐다. 이미 발급된 URL의 bounded TTL 계약은 그대로다.
- 두 인증 세션의 Full Admin 이탈을 동시에 실행해 정확히 한 membership만 제거되고 active Full Admin 1명이 남는 것을 실제 QA에서 확인했다.
- 일회용 synthetic fixture만 사용했고 종료 후 `G5 baby scoped %` baby와 `qa-g5*@darin.invalid` Auth 사용자는 모두 0이다.

### postflight와 Production isolation

- 적용 migration history는 `202609170004`, `202609180002`, `202609200001`, `202609200002`, `202609200003` 다섯 건과 일치한다.
- 의도적으로 제외한 `202608220002`, `202608260003`, `202609170001`, `202609170002`는 계속 pending이다.
- `typecheck`, baby-scoped static, permissions/extended/lifecycle local PostgreSQL, B0.4b static, architecture, repository-query, secrets, `git diff --check`가 PASS했다. sandbox 안의 PostgreSQL 최초 실행은 OS shared-memory 제한으로 시작 전에 실패했으며, 동일 명령을 정상 local execution boundary에서 재실행해 세 suite 모두 PASS했다.
- Production project `efipxojpdirvkeyfdfzl`에는 위 다섯 target migration이 여전히 0건임을 read-only로 확인했다. Production schema/data mutation, EAS/mobile, Storage object, Supabase function 배포는 수행하지 않았다.

G5에서 새 P0/P1은 확인되지 않았다. QA runtime에 남은 운영 항목은 기존 legacy orphan baby의 별도 cleanup 판단과, 미래 `202609170001`/`002` 적용 전에 현재 media resolver와의 migration ordering을 다시 검증하는 것이다.

## G6 최종 provenance 및 Phase 1–4 인계 기준선

### Source / QA provenance

| 범위 | 기준 |
| --- | --- |
| G0–G3 구현 | commit `96891a4833ae009b8d95ab0dfda76c5562c86731` |
| G4 security hardening | commit `741546f4237a01a1347d7198cb4375bacbaa3de4` |
| QA 권한 runtime source | `741546f...`의 `170004`, `200001`, `200002`, `200003` + 이 문서와 함께 provenance commit된 `180002` |
| QA migration history | `170004`, `180002`, `200001`, `200002`, `200003` applied |
| Production migration history | 위 target 5개 모두 unapplied |
| QA API 증거 | Storage/API `146 PASS`, baby-scoped authenticated API `26 PASS`, postflight `5 PASS` |

`202609180002_delete_created_baby.sql`은 SHA-256 `01513d38192bcb3288ef0228387d74c92d543d82c28ec1d99b10b4bcfe76680d`로 QA 적용 source와 일치하며 이 문서·G5 재현 도구와 같은 provenance commit에 포함했다. 재현 도구의 exact SHA는 다음과 같다.

- `verify-qa-baby-scoped-g5.mjs`: `59c895b436e262d8ceb42c5bc1b3321e75d3cec93282bd2926c9d109e5e1fae0`
- `verify-qa-baby-scoped-g5-postflight.mjs`: `785246223133bdd50e290570bede33b010b667080c7b632ccad5eebd899cfdb6`
- `verify-production-baby-scoped-g5-untouched.mjs`: `e1cf045ac45c4278b5457fa781ae22c80aba8691da4e1af6398cc68c90f2f57b`

최종 기준선은 **commit `741546f...` + 이 문서와 `180002`·G5 증빙 도구를 포함하는 provenance commit**이다. 사용자의 commit 요청에 따라 이 범위만 stage했고 무관한 worktree 변경은 stage/revert하지 않았다.

### 최종 자동·보안 gate

- `typecheck`, mobile UI, Overview growth/category/category-compare, pregnancy Overview, baby switch responsiveness, baby deletion UI, logout timeout: PASS
- weekly AI cache, report, build12 multi-baby, Diary save, Voice scope, architecture, repository query: PASS
- invite search/response, five-locale i18n audit/coverage/release, secrets: PASS
- B0.4a P0, ID invite, ownership/visibility, final authorization 정적 및 local PostgreSQL authorization/concurrency: PASS
- baby-scoped permission/extended/lifecycle 정적 및 local PostgreSQL authorization/concurrency: PASS
- B0.4b Storage 정적 + G4 local API `184 PASS` + G5 actual QA API `146 PASS`: PASS
- B0.4c Notification 정적 및 local PostgreSQL: PASS
- G5 QA postflight와 Production target-unapplied read-only 확인: PASS
- `git diff --check`: PASS

샌드박스 안에서 `pnpm dlx`의 registry/IPC와 local PostgreSQL shared-memory가 차단된 실행은 코드 실패로 분류하지 않았다. 동일 명령을 정상 local execution boundary에서 재실행해 모두 PASS를 확인했다.

### Phase 1–4가 따라야 할 확정 계약

1. 모든 sharing/data/cache/mutation은 account+active baby scope에 귀속하고 늦은 응답의 화면·저장을 차단한다.
2. 관계 label은 표시 metadata다. authorization은 current relation과 baby-scoped capability의 교집합으로 결정한다.
3. Full Admin은 기존 admin의 전용 승인 RPC로만 추가한다. 직접 role 변경이나 관계 label로 승격하지 않는다.
4. care와 moments/social 권한은 독립적이며 write→read, social→moments.read dependency를 UI와 서버 모두 검증한다.
5. Care/Diary/Growth/Moment의 기존 author ownership, published/privacy/recipient 조건을 capability가 우회하지 않는다.
6. 직접 baby 삭제는 creator-only다. 계정 삭제의 last-admin cleanup은 parent lock, graph cascade, Storage cleanup queue 계약을 따른다.
7. 철회 후 신규 query/mutation/upload/signed URL은 즉시 거부한다. 기존 signed URL은 승인된 180–300초 TTL 만료까지 유효할 수 있다.
8. Overview rhythm은 오늘 현재 시각 vs 어제 같은 시각, 독립 row cursor, 실제 동적 category와 원본 event 의미를 유지한다.
9. 현재 polished UI와 동일 오리 identity를 기준선으로 유지하며 전체 redesign이나 관계 기반 공개 SNS 확장을 하지 않는다.

### 남은 위험과 미실행 범위

- QA의 기존 legacy orphan baby 28개는 fail-closed다. 임의 사용자에게 권한을 부여하지 않았으며 별도 data cleanup/보존 결정을 내려야 한다.
- pending `202609170001_memory_video_media.sql`과 `202609170002_dismiss_notification_event.sql`은 적용 전 현재 media resolver 반환형·capability enforcement와 migration ordering을 다시 확인해야 한다.
- 실제 account X→Y 수동 UI, 작은 Android 화면, media partial-failure UI, 장시간 메모리/중복 subscription 계측은 별도 UI release gate다. 실기기 검증은 승인된 계획 범위에서 제외했다.
- signed URL 즉시 강제 철회는 제공하지 않는다. 승인된 계약은 신규 발급 즉시 차단 + 기존 bearer의 bounded expiry다.
- QA PASS는 Production release approval이 아니다. Production migration, EAS/mobile, Supabase function 배포는 모두 수행하지 않았다.
- QA 적용 source와 G5 증빙은 동일 provenance commit으로 고정했다.

위 항목은 현재 검증 범위에서 권한 우회나 데이터 노출로 재현된 미해결 P0/P1이 아니다. Production 전에는 orphan-data disposition, pending migration ordering과 별도 Production migration gate를 승인해야 한다.

현재 verdict: `DARIN BABY-SCOPED SHARING MODEL LOCAL/QA PASS`
