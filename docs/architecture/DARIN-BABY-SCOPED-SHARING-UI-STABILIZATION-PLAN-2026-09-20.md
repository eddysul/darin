# Darin 아기별 공유·권한 모델 + UI 안정화 통합 계획

작성일: 2026-09-20

상태: 계획 업데이트. 구현·테스트·배포 완료를 의미하지 않는다.

## 1. 목적과 실행 경계

최근 개선한 UI를 디자인 기준선으로 고정하고, Phase 1–4의 구조 개선에 앞서 UI 안정성과 아기별 공유·권한 계약을 검증한다. Darin은 공개 SNS가 아니라 **아기마다 초대된 가족·지인만 사용하는 private family space**다.

이 문서는 첨부된 제품 방향에 UI 안정화 검증을 통합한 실행 계획이다. 이번 문서 작업에서는 앱 코드·DB·환경 설정을 변경하지 않는다. 실제 구현과 QA 적용은 후속 실행 단계다.

- 실기기 확인, TestFlight 설치·배포·수신 확인은 이번 계획의 실행 및 완료 조건에서 제외한다.
- 자동 검사, 로컬 DB/API 검증, 시뮬레이터 상호작용, 승인된 QA 환경 통합 검증을 사용한다.
- 시뮬레이터 결과를 실기기 검증으로 표현하지 않는다. 실제 기기의 성능·미디어·OS 권한 동작은 미검증 범위로 명시한다.
- Production 배포·데이터 변경은 하지 않는다. EAS/mobile 배포, AI provider 실호출도 포함하지 않는다.
- 현재 polished UI, 캐릭터 스타일, 무관한 worktree 변경을 보존한다.
- 각 gate가 PASS해야 다음 단계로 이동한다. 실패는 원인을 구분하고 해당 범위만 수정·재검증한다.

## 2. 단계와 통과 조건

| 단계 | 작업 | 다음 단계 조건 |
| --- | --- | --- |
| G0 | 변경 inventory, 디자인·동작 기준선, 기존 보안 모델 audit | 범위·기존 실패·권한 매핑·미확정 계약 기록 |
| G1 | 현재 UI 안정화 및 핵심 동작 회귀 | 멈춤·터치 차단·잘못된 데이터 표시·scope 누출 없음 |
| G2 | 아기별 권한·lifecycle 설계 확정 및 로컬 구현 | 서버 enforcement, backfill, 동시성·cleanup 테스트 PASS |
| G3 | 공유 UX 및 Overview 최소 수정 | 승인된 디자인 기준선 유지, 데이터·i18n·접근성 회귀 PASS |
| G4 | focused security review + 전체 로컬 회귀 | 신규/변경 경로에 미해결 P0/P1 없음 |
| G5 | QA migration 및 실제 QA API 통합 공격 회귀 | 대상 환경 확인, positive/negative controls·cleanup PASS |
| G6 | 결과·provenance·남은 위험 기록 | LOCAL/QA 판정 및 Phase 1–4에 넘길 기준선 확정 |

기존 Phase 0의 완료 기록을 무조건 다시 여는 것은 아니다. 변경하는 경계의 보안 계약은 다시 검증한다. 새 권한 계약과 UI 기준선이 확정된 뒤 기존 Phase 1–4 설계의 대상 파일·계약 참조를 갱신한다.

## 3. G0 — 기준선 및 현재 모델 audit

### 3.1 변경과 화면 기준선

- 현재 diff를 UI, 데이터/state, repository/API, 권한/DB, asset, QA로 분류한다.
- 기존 변경과 이번 작업의 변경을 분리하고 기존 migration·배포 상태를 추정하지 않는다.
- 시뮬레이터에서 한눈에(출생/임신), 기록, 리포트, 프로필, 공유 관리, 우리 순간, Diary, 주요 modal/sheet의 기준 스크린샷을 남긴다.
- 화면별 loading / empty / error / partial / success 상태와 탭·modal 전환 동작을 기록한다.
- QA가 옛 컴포넌트명·배치에 의존하는지 확인한다. 테스트를 삭제하거나 보안 assertion을 완화하지 않고 현재 구조의 동등한 동작을 검증하도록 갱신한다.

### 3.2 보안·데이터 audit

`baby_members`, family/friend relationships, invitations, memories/visibility, care authorization, profile visibility, RLS, SECURITY DEFINER RPC, signed media authorization을 조사한다.

산출물은 `현재 권한 → 새 permission → 서버 enforcement 위치 → 영향 UI → migration/backfill → 회귀 테스트` 매핑이다. 기존 B0.4a ownership/visibility, B0.4b Storage, B0.4c Notification 경계를 보존한다.

## 4. G1 — 대규모 UI 업데이트 안정화

### 4.1 멈춤·전환·리소스

- 출생 ↔ 임신 프로필 전환, 한눈에 ↔ 기록 ↔ 리포트 반복 진입, 아기 선택 sheet 열기·닫기를 반복한다.
- 같은 아기 재선택, 빠른 연속 전환, 조회 중 전환, 오류 후 재진입에도 터치·스크롤·뒤로가기가 살아 있어야 한다.
- modal이 닫힌 뒤 backdrop이 터치를 차단하지 않는지 확인한다.
- 임신 프로필의 기록 부족/조회 지연에서 무한 render/effect가 발생하지 않는지 확인한다.
- 긴 목록·이미지·영상·오리 애니메이션에서 중복 구독, 타이머, 재생, 과도한 재요청, 계속 증가하는 메모리를 검사한다.
- 시뮬레이터 성능은 동일 환경 전후 비교로 기록하며 실제 기기 성능을 보증하지 않는다.

### 4.2 데이터와 scope

- account X→Y, baby A→B, locale·날짜 변경 직후 이전 데이터·AI 문장·권한이 노출되지 않도록 확인한다.
- 늦은 응답, 실패, 취소, 재시도로 이전 scope의 화면·캐시·저장 대상이 바뀌지 않아야 한다.
- loading, 진짜 기록 없음, 조회 실패, 일부만 조회됨을 분리한다. 실패를 빈 목록·0으로 표시하지 않는다.
- 성장 기록 없음, 한 번 측정, 증가, 감소, 동일, 부분 측정, 발달 기록 없음 각각을 검사한다. 데이터 없는 증가·완료·상승 문구를 금지한다.
- 리포트는 조회가 완전하지 않은 상태를 완료된 통계처럼 표시하지 않는다.
- 오늘/어제, 자정, 시간대, 연도 변경 및 기록 수정·삭제 후 합계와 그래프를 검사한다.

### 4.3 저장·표현 품질

- 기록·Diary·사진/영상의 저장 성공, 실패, 부분 실패, 중복 탭, 재시도, 초안 복구를 검사한다.
- 작은 화면, 큰 글자, 키보드, safe area, 앱이 지원하는 테마에서 잘림·겹침을 확인한다.
- ko/en/ja/es/zh-CN 문구, 한국어 fallback 누출, 사용자 단위 설정, 날짜·숫자 형식을 검사한다.
- 터치 타깃(iOS 44pt / Android 48dp), label/role/state, 대비, 색상 외 구분, reduced-motion을 확인한다.
- sprite 프레임 잘림, 발 기준선, 이미지 비율·로딩 실패를 검사한다. asset 재제작·전체 redesign은 하지 않는다.

## 5. G2 — 확정할 아기별 권한 계약

### 5.1 Baby → Members → Permissions

- 모든 접근은 baby-scoped다. 동일 사용자가 아기 A에 초대되어도 B 접근 권한은 생기지 않는다.
- family/friend는 관계 metadata이고 권한을 자동 부여하지 않는다. UI는 이름·관계·권한 요약을 분리한다.
- 권한은 `care.read`, `care.write`, `moments.read`, `moments.write`, `social.comment`, `social.react`를 기본으로 한다.
- 멤버 관리 등 관리자 권한은 별도다. 초기 UI는 기록 보기/작성, 사진·영상 보기/올리기, 댓글·반응처럼 간결하게 제공한다.
- write/read 의존성, 댓글·반응의 대상 읽기 권한, 권한 철회 시 동작을 명시적으로 정의한다. 잘못된 조합은 서버에서도 거부한다.

### 5.2 엄마·아빠 Full Admin

인증·승인된 해당 아기의 엄마/아빠는 프로필, care, moments, 소통, 초대/제거, 권한·관계·공유 설정 및 lifecycle 관리 권한을 가진다. 일반 permission toggle로 핵심 관리자 권한을 제거할 수 없다.

단순 관계명 편집이나 초대 수락 payload로 부모/admin이 될 수 없어야 한다. 부모 지정·변경·관리자 이관의 승인 경로를 서버에서 검증한다.

### 5.3 독립적인 care / moments

| 예시 | Care | Moments | 소통 |
| --- | --- | --- | --- |
| 베이비시터 | 읽기·작성 | 없음 | 별도 설정 |
| 친구 | 없음 | 읽기 | 댓글·반응 허용 가능 |
| 할머니 | 읽기 | 읽기 | 댓글·반응 허용 가능 |

가족/친구 관계만으로 위 권한을 하드코딩하지 않는다. `write`가 타 작성자의 기록 수정·삭제를 자동 허용하지 않도록 기존 ownership 계약을 유지한다. moments 권한은 기존 unpublished/visibility/선택 공유 조건을 우회하지 않는다.

### 5.4 서버 enforcement 및 철회

- UI hide뿐 아니라 실제 SELECT, INSERT, UPDATE, DELETE, 업로드, signed URL 발급, 댓글·반응 mutation 경계를 검증한다.
- current membership와 권한을 mutation 직전에 확인한다. removed/demoted/stale JWT/cache로 우회할 수 없어야 한다.
- 권한 변경 시 화면 및 로컬 캐시를 무효화하고 이전 scope 응답을 차단한다.
- 기존 signed URL은 발급 이후 만료까지 유효할 수 있다. 신규 발급 거부와 기존 URL 철회를 구분한다. 즉시 철회 요구를 만족할 기존 메커니즘이 있는지 조사하고, 없으면 명시적으로 설계 결정을 받아야 한다. 캐시 삭제만으로 서버 철회를 구현했다고 보고하지 않는다.

## 6. 계정 삭제와 baby lifecycle

- 다른 admin이 남으면 삭제 사용자만 제거하고 baby space와 데이터를 유지한다.
- 마지막 admin이면 해당 baby와 membership, care, growth, Diary, memories/media, 댓글·반응, 초대, 공유 관계, 알림 참조 및 기타 baby-owned 데이터를 정리한다.
- 다른 공유자의 사용자 계정이나 다른 아기의 데이터는 삭제하지 않는다.
- 동시 탈퇴·삭제·admin 변경에도 관리자 없는 baby가 남지 않도록 서버 transaction/locking 경계를 검증한다.
- DB와 Storage는 하나의 원자적 transaction이 아니므로 기존 안전한 cleanup/retry 패턴을 조사·재사용한다. 접근 차단, 작업 상태, 재시도·중복 실행 안전성, 최종 orphan 검증을 명시한다.
- 직접 “아기 삭제”, 공유자 “나가기”, “계정 삭제에 따른 마지막 admin 정리”는 별개 정책이다. 기존 creator-only 직접 삭제 규칙과 새 부모 lifecycle 계약의 충돌 여부를 G0에서 확인하고, 임의로 삭제 가능 대상을 확장하지 않는다.
- 파괴적 확인에는 해당 아기·영향 범위를 표시한다. 로컬/QA synthetic 데이터로만 삭제 회귀를 수행한다.

## 7. G3 — 최소 UX 변경

### 7.1 초대와 공유 관리

- 현재 친구찾기를 audit하고 공개 discover/search 성격은 제거·축소한다.
- Darin ID 직접 입력, 초대 코드/링크 중심으로 정리한다. 검색을 유지한다면 private sharing에 필요한 secondary 기능으로 제한한다.
- 기존 안전한 invitation/current-authority 계약을 보존한다.
- “해린 공유 관리”처럼 아기 이름, 가족/친구 수, 관계, admin 상태, 권한 요약을 보여준다.
- 부모/admin만 해당 아기의 멤버 권한을 변경한다. 다른 아기의 권한과 섞이지 않는다.
- 댓글/반응은 유지하되 follower, 인기 순위, 공개 탐색 등 SNS 기능은 추가하지 않는다.

### 7.2 오늘의 리듬

- 기본 비교는 오늘 현재 시각까지 누적 vs 어제 같은 현지 시각까지 누적이다.
- 비교 cutoff와 탐색 cursor를 분리한다. 어제/오늘 cursor는 각 행에서 독립적으로 움직이며 x좌표를 강제로 동기화하지 않는다.
- tooltip은 이벤트 시각, 해당 이벤트 값, 그 지점까지의 누적을 함께 보여준다.
- 수면은 구간 길이·cutoff까지 겹치는 시간, 기저귀는 종류·횟수처럼 category 의미에 맞춘다.
- 카테고리별 실제 기록에 기반해 비교하며 수유·수면 두 항목으로 고정하지 않는다.
- 빈 날, 한쪽 날짜만 기록, 진행 중 수면, 자정 걸침, 수정·삭제, 단위/locale 변경을 테스트한다. 그래프 미관 때문에 원래 시각·기간·의미를 왜곡하지 않는다.

### 7.3 카테고리·기록 화면·오리

- 출생 후 Overview는 수유 → 수면 → 기저귀를 항상 표시하고, 실제 기록이 있는 추가 category만 뒤에 배치하는 horizontal carousel을 유지한다.
- 추가 category의 “기록 존재” 조회 범위·순서는 현재 데이터 계약을 확인해 고정한다. 조회 실패/부분 결과로 category가 잘못 사라지지 않아야 한다.
- 임신 Overview의 별도 상태·정보 구조를 보존한다. 출생 후 고정 세 category를 임신 화면에 자동 적용하지 않는다.
- 기록 화면은 기존 flow를 유지하면서 white-first 배경/카드, 연한 neutral border, pastel icon, charcoal text, 최소 shadow, 중앙 voice amber를 사용한다.
- 기존 오리 inventory와 category mapping을 작성한다. feeding/sleep/diaper/tummy/health/bath/play 및 기타에 기존 asset을 우선 재사용한다.
- 없는 asset은 파일명·pose/action·용도·크기를 missing manifest로 남긴다. 같은 얼굴·비율·outline·기본 색상·그림체를 유지하며 이 단계에서 새 이미지 생성은 하지 않는다.

## 8. Migration / QA 적용 안전성

- 기존 migration을 수정하지 않고 forward-only 변경을 사용한다.
- 기존 관계·실제 권한을 조사해 backfill 규칙을 문서화한다. family/friend 문자열만으로 관리자나 광범위 권한을 새로 부여하지 않는다.
- 모호한 legacy 행, NULL, 중복 membership, removed 상태를 따로 분류한다. 불명확한 권한은 임의 승격하지 않는다.
- pending migration 의존성, transaction 안전성, 데이터 양, 제약 조건, 적용/복구 절차를 검토한다.
- 로컬 검증과 focused security review PASS 후에만 QA 적용 단계로 이동한다. QA project identity·대상 migration·synthetic fixture·cleanup을 먼저 확인한다.
- QA에서 공격 실패뿐 아니라 정상 admin/초대 사용자 흐름 성공도 증명한다. Production은 건드리지 않는다.

## 9. 필수 회귀 matrix

| 케이스 | 기대 결과 |
| --- | --- |
| A/B: 승인된 엄마·아빠 | 해당 baby Full Admin, 일반 toggle로 핵심 권한 제거 불가 |
| C: 가족 + care.read | 읽기만, 쓰기 우회 거부 |
| D: 가족 + care.write 및 필요한 read | 허용된 기록 작성, 타 작성자 ownership 유지 |
| E: 친구 + moments.read | 허용된 사진/영상만, care 거부 |
| F: 친구 + moments.read + comment | 허용 대상 댓글 가능, 다른 mutation은 별도 검증 |
| G: moments 권한 없음 | memory/media 조회 및 신규 signed URL 발급 거부 |
| H: care 권한 없음 | UI·직접 API 모두 care 접근 거부 |
| I: 동일 사용자의 baby A/B 권한 상이 | 조회·mutation·캐시·늦은 응답까지 분리 |
| J: 마지막 admin 계정 삭제 | baby space 정리, 타 계정·타 baby 보존 |
| K: 다른 admin 존재 | baby 데이터 유지, 삭제 사용자 접근 제거 |
| L: 권한 변경 직후 | stale 화면/캐시 차단, signed URL 철회/만료 계약 검증 |
| M: 자기 부모 지정·role 위조·removed/demoted | privilege escalation 거부 |
| N: 동시 admin 삭제·권한 변경·초대 수락 | orphan/권한 부활/잘못된 접근 없음 |
| O: Storage/DB cleanup 일부 실패·재시도 | 접근 차단 유지, 중복 안전, 정리 완료 확인 |
| P: 임신 ↔ 출생, 빠른 profile/tab/modal 전환 | 멈춤·무한 재조회·터치 차단 없음 |
| Q: growth 모든 상태 및 불완전 조회 | unsupported trend/완료 문구 없음, 상태 정확 |
| R: 리듬·tooltip·동적 category | 날짜·누적·독립 cursor·단위·실제 기록 의미 보존 |

## 10. 자동 검사와 결과 기록

구현 후 기존 명령을 실행하되 정적 PASS와 실제 동작 PASS를 구분한다.

```bash
npm run typecheck
npm run qa:mobile-ui
npm run qa:overview-growth
npm run qa:overview-category-cards
npm run qa:weekly-ai-cache
pnpm qa:report
npm run qa:diary-save
npm run qa:voice-scope
npm run qa:architecture
npm run qa:repository-queries
npm run qa:i18n:audit
npm run qa:i18n:coverage
npm run qa:i18n:release
npm run qa:invite-search
npm run qa:invite-response-notifications
npm run qa:b04a:p0
npm run qa:b04a:p1-id-invite
npm run qa:b04a:p1-ownership-visibility
npm run qa:b04b:storage
npm run qa:b04c:notifications
npm run qa:secrets
git diff --check
```

추가로 pregnancy-overview, baby-switcher-responsiveness, baby-deletion-ui, logout-timeout, overview-category-compare 관련 standalone smoke를 검사 실행 경로에 포함한다. 기존 local PostgreSQL concurrency/authorization와 Storage API 회귀, 신규 permission/lifecycle/리듬 테스트도 실행한다.

- 원격 mutation을 포함하는 QA 도구는 로컬 smoke와 분리하고 G5에서만 실행한다.
- 의존성 다운로드·네트워크·런타임 부족으로 실행하지 못한 검사는 NOT RUN/BLOCKED다. PASS로 간주하지 않는다.
- 기존 실패, 이번 변경으로 생긴 실패, obsolete test assertion을 구분한다. 완료 gate에 필요한 실패는 원인을 해결해야 한다.
- 테스트명, 실행 환경, source revision/worktree 상태, 결과, 증거 위치를 기록한다. 실기기 확인 항목은 생성하지 않는다.

## 11. 보존 범위

현재 profile UI, Memory feed layout, notification list UI, side menu layout, Diary editor는 필요한 권한 연결 외에 redesign하지 않는다. unrelated Storage/Notification 구현, AI backend, 기존 worktree 변경을 정리·revert·묶음 commit하지 않는다.

## 12. 완료 산출물과 판정

1. 기존 모델 audit 및 새 baby-scoped 관계/permission 매핑
2. parent Full Admin, invited permissions, care/moments 분리 계약
3. 초대·친구찾기·아기별 공유 관리 변경 내역
4. RLS/RPC, forward migration, backfill 및 QA 적용 증거
5. 계정 삭제·baby lifecycle·동시성·Storage cleanup 결과
6. UI 기준선과 안정화 수정, rhythm/tooltip/category 변경 내역
7. 기존 오리 inventory, category mapping, missing asset manifest
8. 자동/시뮬레이터/로컬 API/QA API별 테스트 결과와 security review
9. 변경 파일, 무관한 변경 보존 내역, 미실행 항목, 잔여 위험
10. Phase 1–4에서 사용할 확정 계약·화면 기준선·후속 작업 목록

실기기 검증은 제외되며 Production release readiness를 선언하지 않는다. commit은 별도 요청이 있을 때 범위별 staged diff·QA 확인 후 수행한다.

필수 local/QA gate가 모두 충족되고 미해결 P0/P1이 없을 때:

`DARIN BABY-SCOPED SHARING MODEL LOCAL/QA PASS`

필수 계약 미확정, 보안 회귀, 필수 검증 미실행 또는 실패가 있을 때:

`DARIN BABY-SCOPED SHARING MODEL BLOCKED — DO NOT DEPLOY`

현재는 계획 수립 단계이므로 어느 실행 verdict도 아직 부여하지 않는다.
