# [ARCHIVE] main vs Joon 브랜치 상세 비교

> **보관용.** 브랜치 포트 당시 참고 노트입니다. 현재 제품 문서는 [`docs/README.md`](../README.md).
>
> **작성 기준:** 2026-06-20  
> **비교 대상:** `origin/main` (`66bb029`) vs `origin/Joon` (`fe845d0`)  
> **로컬 경로:** `/Users/joon/Downloads/Childcare Management App`

---

## 1. 브랜치 관계 요약

| 항목 | main | Joon |
|------|------|------|
| 최신 커밋 | `66bb029` Remove dead src/app/ folder | `fe845d0` Add Ask Darin report selection flow |
| 공통 조상 (merge-base) | `18b3a15` Add voice recording with dh transcribe API integration | 동일 |
| main만 앞선 커밋 | **16개** | — |
| Joon만 앞선 커밋 | — | **2개** (`a75b6b9`, `fe845d0`) |
| diff 규모 (main↔Joon) | 약 **78 files**, +11,733 / -910 lines (Joon 기준 diff 방향은 역방향 주의) | |

**핵심:** 두 브랜치는 `18b3a15` 이후 **크게 갈라졌습니다.**  
main은 PR #4 등으로 Joon의 초기 RN 작업 일부를 흡수한 뒤, **양쪽 역할(부모/케어기버)·입찰·계약·결제·카테고리 로그** 쪽으로 확장했습니다.  
Joon은 같은 시점 이후 **Reports/Ask Darin·AI 리포트 UX**에 집중해 2커밋만 추가했습니다.

```
                    18b3a15 (voice + dh transcribe — 공통)
                   /                    \
         main (+16)                      Joon (+2)
    66bb029                           fe845d0
```

---

## 2. 제품 방향 차이 (한 줄 요약)

| | **main** | **Joon (우리 구현)** |
|---|----------|----------------------|
| **타겟** | 산후조리/돌보미 **마켓플레이스** (부모 ↔ 케어기버 양방향) | **부모 중심** Emma 돌봄 + Care Request/Proposal 데모 |
| **온보딩** | 역할 선택 → Parent/Caregiver Setup | 로그인 → (회원가입 시) Onboarding → 바로 main |
| **Log** | 케어기버: **항목별 기록 타임라인** + 로컬/AI 카테고리 | 부모/케어기버 단일 UX: **음성 → AI 일일 리포트** |
| **Reports** | 구형 카드 (아이콘 3개 + 전체 펼침 + 번역 박스) | **2단 progressive UX + Ask Darin** |
| **Find** | 부모: 카드 목록 + **FindNavigator** / 케어기버: **부모 공고** | **HeyDealer형 Care Request → Proposals → 협상 채팅** |
| **Home** | Interview/Payment 탭, 계약, 주간 결제 | **Active Care + Care Plan Draft/Tracker + Messages** |
| **Web 레거시** | `src/app/` **삭제됨** | `src/app/` **Vite 프로토타입 그대로 존재** |

---

## 3. 앱 진입 / 온보딩

### main (`App.tsx`)

```
splash → login → role-select → parent-setup | caregiver-setup → main
```

- `RoleSelectScreen`, `ParentSetupScreen`, `CaregiverSetupScreen` 추가
- 케어기버 선택 시 `DEFAULT_CAREGIVER_PROFILE` (Ji-yeon Park) 주입
- 부모 setup: due date, budget, live-in, breastfeeding, ethnicity 등

### Joon (`App.tsx`)

```
splash → login → main
         signup → onboarding → main
```

- **역할 분기 없음** — 기본 프로필은 부모 `Jisoo Kim` (Seoul)
- 케어기버 전용 Home/Find/Log **없음**

### 차이 포인트

| 기능 | main | Joon |
|------|------|------|
| 역할 선택 | ✅ | ❌ |
| 부모 상세 setup | ✅ (Capitol Hill, 예산, 출산 예정일) | ❌ (Onboarding만) |
| 케어기버 setup | ✅ (면허, 요금, 가용 시간) | ❌ |
| 프로필 기본 location | Capitol Hill, Seattle | Seoul, Korea |

---

## 4. AppContext / 전역 상태

### main — **대폭 확장**

`src/context/AppContext.tsx`에 다음이 **추가**되어 있음:

| 상태/기능 | 설명 |
|-----------|------|
| `logEntries` + `addLogEntry` | 카테고리별 돌봄 기록 (`LogEntry[]`) |
| `generateDailyReportFromLogs` | 기록 N건 → **로컬 텍스트 리포트** 생성 (`buildDailyReportText`) |
| `scheduledInterviews` | 인터뷰 예약·완료·계약 서명 |
| `incomingRequests` | 케어기버에게 들어온 부모 요청 |
| `acceptRequest` / `caregiverSignContract` | 요청 수락·계약 |
| `weeklyPayments` + `makePayment` | 주간 결제 mock |
| `pendingTab` | 다른 화면에서 탭 점프 |
| `caregiverBidRate` | 케어기버 입찰가 Find에 반영 |

### Joon — **미니멀**

```typescript
profile, dailyReport, langPickerOpen, profileEditOpen
```

- **logEntries 없음** — Log는 “리포트 생성” 중심, 항목 타임라인은 `i18n` 데모만
- **인터뷰/계약/결제 없음**
- `dailyReport`는 Log → Generate → Save to Reports 로만 채워짐

---

## 5. Log 탭 — 가장 큰 UX/아키텍처 차이

### main: **케어기버 작업형 Log**

파일: `LogScreen.tsx` (~510 lines), **역할별 분기**

#### CaregiverLogView (케어기버)

1. 카드 상단 **Mic 버튼** → `startRecording()` (탭 한 번으로 녹음 시작)
2. dh `/transcribe` → 전사문 `TextInput` pre-fill
3. 서버 `events[0].category` → 5대 카테고리 (`diaper/sleep/meal/growth/medical`) 매핑
4. 로컬 `categorizeLog()` fallback (키워드)
5. **PressSlide** “Submit entry” → `addLogEntry()` → **타임라인에 누적**
6. 기록 1건 이상이면 **“Generate from entries”** → `generateDailyReportFromLogs()`  
   - dh `/generate-report` **호출하지 않음**
   - `utils/categorize.buildDailyReportText()`로 단순 텍스트 조합

#### ParentLogView (부모)

- `logEntries` **읽기 전용** 타임라인

#### main 전용 타입/유틸

- `src/types/log.ts` — `LogCategory`, `LogEntry`, `CATEGORY_META` (emoji 포함)
- `src/utils/categorize.ts` — 키워드 분류, summary, report text builder

### Joon: **부모·리포트 생성형 Log**

파일: `LogScreen.tsx` (~404 lines), **단일 화면**

1. **Mic 버튼 없음** — 하단 탭 **중앙 Log 3초 hold** (`MainTabs` + `VoiceRecordingContext`)
2. 저장 후: 전사문 + 이벤트 칩 + **Retake / 일일 리포트 생성**
3. Quick Notes만으로도 리포트 생성 가능
4. **`generateDailyReportFromApi()`** → dh `POST /generate-report`
5. 실패 시 `demo/dailyReport.ts` fallback
6. **리포트에 저장** → `setDailyReport()` + **화면 초기 상태 복귀**
7. Today's Log = **정적 데모** (`getLogEntries`), main처럼 `logEntries` state와 **연동 안 됨**

### 음성 녹음 (공통 vs 차이)

| | main | Joon |
|---|------|------|
| 중앙 탭 hold 3초 | ✅ (MainTabs 동일 패턴) | ✅ |
| Log 내 Mic 버튼 | ✅ (케어기버) | ❌ |
| `/transcribe` | ✅ | ✅ |
| `fetchWithTimeout` | ❌ | ✅ (30s) |
| API URL `:800` 보정 | ❌ | ✅ (`config/api.ts`) |

### Log 플로우 다이어그램

**main (케어기버):**
```
[Mic] → transcribe → 카테고리 감지 → [Submit entry] → logEntries[]
                                              ↓
                              [Generate from entries] → dailyReport (로컬 텍스트)
```

**Joon:**
```
[Center hold] → transcribe → [Generate Daily Report] → /generate-report (GPT)
                                              ↓
                              [Save to Reports] → dailyReport + Log reset
```

---

## 6. Reports 탭 — Joon이 앞선 영역

### main (`ReportScreen.tsx`)

- 헤더: 제목 + 부제만
- **오늘 리포트 1장**만 (`dailyReport`), June 19·18은 placeholder
- 상단 pill **최대 3개** (`items.slice(0,3)`), legacy type: meal/nap/activity/health/reminder
- 카드 탭 → 전체 펼침 (기본 `expanded=true`)
- **Full report + AI 번역 박스** 항상 노출 (펼침 시)
- **Ask Darin 없음**
- **히스토리 mock 없음**

### Joon (`ReportScreen.tsx`) — **우리가 구현한 것**

#### Progressive card UX

**접힌 상태 (기본):**
- 5개 요약 pill (bowel · sleep · meal · growth · clinic) — **항상 라벨**
- Today's Care Summary
- 액션: **View details** | **한국어 보기 / English**

**펼친 상태:**
- Full Report
- Detailed Care Log (11항목 row cards)

**언어:** 카드별 `languageMode` (`createT`로 라벨/본문 전환), **별도 번역 박스 제거**

#### Ask Darin 플로우

1. 헤더 **Ask Darin** → 선택 모드
2. **June 20 / 19 / 18** — real card만 선택 (`demo/reportHistory.ts`)
3. Select all / Clear all
4. Sticky bar: `N reports selected` + **Ask Darin**
5. `DarinCareChatModal` — mock `report_consultation` (수면/식사/배변/건강/케어기버/플랜)

#### Joon 전용 파일

| 파일 | 역할 |
|------|------|
| `src/utils/reportPresentation.ts` | 5+11 카테고리 정규화, API/events/items → pills + details |
| `src/demo/reportHistory.ts` | June 19·18 mock 리포트 |
| `src/demo/reportConsultation.ts` | mock Q&A + `buildReportConsultationPayload` |
| `src/types/reportConsultation.ts` | `task: "report_consultation"` 타입 |
| `src/components/DarinCareChatModal.tsx` | 상담 UI |
| `src/api/generateReport.ts` | dh `/generate-report` |

#### DailyReport 타입 차이

**main:**
```typescript
{ sourceNote, reportEn, reportKo, parentReplyDraft, items[] }
```

**Joon (추가 필드):**
```typescript
careSummaryEn/Ko, mainCategories[], details[]  // + legacy items[]
```

---

## 7. Home 탭

### main (~668 lines)

**부모 Home:**
- Interview / Payment **서브탭**
- `scheduledInterviews` — 인터뷰 일정, 완료, 계약 연결
- `weeklyPayments` — 주간 결제 카드 + `PaymentModal`
- 계약 체결 시 “My Caregiver” 카드
- **Care Plan Draft / CareInbox / Active Care Relationship 없음** (Joon 대비 후퇴)

**케어기버 Home (`CaregiverHomeScreen`):**
- incoming requests
- 계약 서명 (`CaregiverContractModal`)
- 수입/일정 요약

### Joon (~375 lines)

**부모 전용 단일 Home:**
- Messages → `CareInboxModal`
- Quick Actions (Message Ji-yeon 직진 등)
- Today's Report 미리보기
- AI Draft Reply
- **매칭 확정 후:** Active Care Relationship + **CarePlanDraftCard** + **AgreementTracker** + Adjust Care Plan
- `CareFlowContext` + `CarePlanNegotiationBlocks` 깊게 연동

### 차이 요약

| 기능 | main | Joon |
|------|------|------|
| Interview scheduling | ✅ | ❌ |
| Payment | ✅ | ❌ |
| Care Request 협상 UI on Home | ❌ | ✅ |
| CareInbox + saved chat | ❌ (FindNavigator chat 별도) | ✅ |
| 케어기버 Home | ✅ | ❌ |

---

## 8. Find / Match 탭

### main

- `MainTabs` → **`FindNavigator`** (stack-like 로컬 state)
  - `MatchScreen` (부모: caregiver 카드 목록)
  - `CaregiverDetailScreen`
  - `CaregiverChatScreen`
- 케어기버: **`CaregiverFindScreen`** — `PARENT_LISTINGS` 부모 공고 browse
- **`BidModal`** — 입찰가 제출 → `caregiverBidRate`
- **`ScheduleInterviewModal`** — 인터뷰 예약
- Care Request / Proposals / Care Plan 협상 **플로우 없음** (Joon MatchScreen 대비)

### Joon

- `MainTabs` → **`MatchScreen`** 직접
- **Care Request modal** → Send → **Care Proposals sheet** (3 proposals)
- **CareProposalChatModal** — Draft, Agreement Tracker, Adjust, Confirm Match
- `CareFlowContext` 전체 데모 플로우
- 케어기버 Find / 부모 공고 / 입찰 **없음**

### 차이 요약

| 기능 | main | Joon |
|------|------|------|
| HeyDealer Care Request → Proposal | ❌ | ✅ |
| Care Plan 협상 채팅 | ❌ | ✅ |
| 케어기버 부모 공고 | ✅ | ❌ |
| 입찰 (Bid) | ✅ | ❌ |
| 인터뷰 예약 | ✅ | ❌ |
| FindNavigator (detail/chat stack) | ✅ | ❌ (Sheet/Modal 패턴) |

---

## 9. Profile 및 기타 main 전용

### main에만 있는 주요 화면/컴포넌트

| 경로 | 설명 |
|------|------|
| `RoleSelectScreen.tsx` | 부모/케어기버 선택 |
| `ParentSetupScreen.tsx` | 부모 onboarding 필드 |
| `CaregiverSetupScreen.tsx` | 케어기버 onboarding |
| `CaregiverChatScreen.tsx` | Find stack 채팅 |
| `CaregiverDetailScreen.tsx` | Find stack 프로필 |
| `BidModal.tsx` | 입찰 |
| `CaregiverContractModal.tsx` | 케어기버 계약 |
| `ContractSigningModal.tsx` | 계약 서명 |
| `PaymentModal.tsx` | 주간 결제 |
| `ScheduleInterviewModal.tsx` | 인터뷰 (Find용) |
| `PressSlide.tsx` / `PressScale.tsx` | 슬라이드 버튼 UX |
| `demo/parents.ts` | 부모 공고, incoming requests, demo log entries |
| `demo/contractTemplate.ts` | 계약 템플릿 |
| `types/interview.ts`, `payment.ts`, `navigation.ts` | |

### Joon에만 있는 주요 파일

| 경로 | 설명 |
|------|------|
| `DarinCareChatModal.tsx` | Ask Darin 상담 |
| `api/generateReport.ts` | dh GPT 리포트 |
| `utils/reportPresentation.ts` | Reports 2단 UI |
| `utils/fetchWithTimeout.ts` | API 타임아웃 |
| `demo/reportHistory.ts` | 리포트 히스토리 mock |
| `demo/reportConsultation.ts` | 상담 mock |
| `types/reportConsultation.ts` | API payload 타입 |
| `src/app/**` | **Web Vite 레거시 전체** (main에서는 삭제) |

---

## 10. API / dh 서버 연동

| 항목 | main | Joon |
|------|------|------|
| `POST /transcribe` | ✅ | ✅ |
| `POST /generate-report` | ❌ **없음** | ✅ `generateReport.ts` |
| 리포트 생성 방식 | `logEntries` → 로컬 문자열 | GPT API + `normalizeDailyReport` |
| `config/api.ts` URL 보정 | 기본만 | `:800` → `:8000` 보정 |
| `fetchWithTimeout` | ❌ | ✅ |
| `pnpm server:dh` | ✅ | ✅ |

main의 `10770e8 Wire voice-to-log pipeline` 커밋은 **전사 → 카테고리 pre-fill → log entry**에 초점.  
Joon의 `a75b6b9`/`fe845d0`는 **GPT 일일 리포트 + Reports UX + Ask Darin**에 초점.

---

## 11. i18n / locale

| | main | Joon |
|---|------|------|
| 기본 locale | **한국어 default** (`LanguageContext` 변경) | 영어 default |
| 케어기버 Find/Log/Home 전용 키 | 다수 추가 | 없음 |
| Reports/Ask Darin/darinChat 키 | 없음 | ✅ |
| 5+11 카테고리 report.cat.* / report.detail.* | 없음 | ✅ |

---

## 12. Web 레거시 (`src/app/`)

| | main | Joon |
|---|------|------|
| Vite web prototype | **삭제** (`66bb029`) | **유지** (~1050 lines App.tsx 등) |
| RN-only 정책 | 명시적 | RN 메인 + web 병존 |

main은 RN 단일 코드베이스로 정리된 상태. Joon은 `src/app/`에 Care Request web UI가 **별도 사본**으로 남아 있어 **main과 동기화되지 않음**.

---

## 13. Joon만 앞선 커밋 (merge-base 이후)

```
fe845d0 Add Ask Darin report selection flow and care chat modal.
a75b6b9 Add AI report generation and progressive Reports card UX.
```

**포함 기능:**
- Progressive Reports card (요약 → 상세, EN/KO toggle)
- 2단 카테고리 (`reportPresentation.ts`)
- Ask Darin 다중 선택 + `DarinCareChatModal`
- `generateReport.ts`, `fetchWithTimeout`, API URL 보정
- `reportHistory` / `reportConsultation` mock

---

## 14. main만 앞선 커밋 (요약)

```
66bb029 Remove dead src/app/ folder
3e1be9d Fix PressSlide
10770e8 Wire voice-to-log pipeline (mic → STT → category → pre-fill)
99095a4 dh audio/script, Jisoo Kim demo, parent profile sheet
00d1a48 ethnic background, Interview/Payment tabs
0a29137 Merge PR #4 (Joon/chatbot merge)
7423c47 payment system, remove AI draft sections
2e1bcab categorized log system, PressSlide, daily report from logs
3a142e6 caregiver setup, bidding, Korean default
2e2c20f full caregiver-side experience
7d035b4 contract signing flow
868c04f role selection after login
...
```

**포함 기능:**
- 양방향 마켓플레이스 (부모/케어기버)
- 카테고리 Log + 타임라인
- 입찰, 인터뷰, 계약, 결제
- FindNavigator, CaregiverFindScreen
- Web 레거시 제거

---

## 15. 파일 단위 diff (Joon 기준 — main에 없고 Joon에만 있음)

```
src/api/generateReport.ts
src/components/DarinCareChatModal.tsx
src/demo/reportConsultation.ts
src/demo/reportHistory.ts
src/types/reportConsultation.ts
src/utils/fetchWithTimeout.ts
src/utils/reportPresentation.ts
src/app/  (전체 — main에서는 삭제됨)
```

## 16. 파일 단위 diff (main 기준 — Joon에 없고 main에만 있음)

```
src/components/BidModal.tsx
src/components/CaregiverContractModal.tsx
src/components/ContractSigningModal.tsx
src/components/PaymentModal.tsx
src/components/PressSlide.tsx
src/components/PressScale.tsx
src/components/ScheduleInterviewModal.tsx  (Find용 — Joon에도 ScheduleTrialModal은 Care 협상용으로 별개)
src/demo/parents.ts
src/demo/contractTemplate.ts
src/demo/caregiverChats.ts
src/screens/RoleSelectScreen.tsx
src/screens/ParentSetupScreen.tsx
src/screens/CaregiverSetupScreen.tsx
src/screens/FindNavigator.tsx
src/screens/CaregiverChatScreen.tsx
src/screens/CaregiverDetailScreen.tsx
src/screens/tabs/CaregiverFindScreen.tsx
src/types/log.ts
src/types/interview.ts
src/types/payment.ts
src/types/navigation.ts
src/utils/categorize.ts
src/utils/interviewCalendar.ts
```

---

## 17. 통합 시 예상 충돌 / 권장 방향

### 충돌이 큰 파일

1. **`LogScreen.tsx`** — 완전히 다른 UX (타임라인 vs AI 리포트)
2. **`ReportScreen.tsx`** — Joon 전면 개편 vs main 구형
3. **`AppContext.tsx`** — state surface area
4. **`HomeScreen.tsx`** — Interview/Payment vs Care Plan negotiation
5. **`MainTabs.tsx`** — 탭 순서 (main: Home·Find·Log·Reports·Profile / Joon: Home·Reports·Log·Find·Profile)
6. **`MatchScreen.tsx`** — Care Request vs listing+bid

### 기능별 merge 제안 (참고)

| 영역 | 권장 |
|------|------|
| Reports UX + Ask Darin | **Joon → main** 이식 (독립 modal/utils라 상대적으로 쉬움) |
| `/generate-report` API | **Joon → main** — main은 로컬 report builder만 있음 |
| Care Request / 협상 | **Joon 유지** — main Find와 병행하거나 역할별 분기 |
| 케어기버 Log 타임라인 | **main 유지** — Joon Log는 부모용 “리포트 생성”으로 분리 가능 |
| Interview/Payment/Contract | **main 유지** |
| `src/app/` | main 정책(deleted) vs Joon 보존 — **팀 결정 필요** |

---

## 18. QA 관점 — 같은 시나리오에서 기대 동작

| 시나리오 | main | Joon |
|----------|------|------|
| 로그인 후 첫 화면 | 역할 선택 | 바로 Home (부모) |
| 음성 녹음 | 탭 hold + Log 내 Mic(케어기버) | 탭 hold만 |
| 기록 저장 | 타임라인에 카테고리 entry 추가 | (없음) → AI 리포트 생성 |
| 부모가 Reports 확인 | 오늘 1건만, 단순 pill 3개 | 5 pill + 요약 + (선택) 상세 + 히스토리 mock |
| AI에게 리포트 질문 | ❌ | Ask Darin → Darin Care Chat |
| 케어기버 찾기 | 부모 공고 목록 | ❌ |
| 부모가 케어기버 찾기 | 카드 + 프로필 + 채팅 | Care Request → Proposals → 협상 |
| dh 서버 없을 때 | 전사 demo + 로컬 categorize | 전사 demo + 로컬 dailyReport fallback |

---

## 19. PR / GitHub 참고

| PR | 설명 |
|----|------|
| [PR #2](https://github.com/eddysul/darin/pull/2) | Joon → main (초기 RN) |
| [PR #3](https://github.com/eddysul/darin/pull/3) | joon-into-dh (dh 병합) |
| PR #4 (main) | Joon/chatbot merge — main에 Joon 일부 흡수 |

**현재 Joon 최신 (`fe845d0`)은 main (`66bb029`)에 아직 merge되지 않았습니다.**

---

## 20. 결론

- **main**은 “**양쪽 사용자 마켓플레이스 + 운영(인터뷰/계약/결제) + 케어기버 카테고리 로그**” 프로토타입.
- **Joon**은 “**부모 Emma 돌봄 데모 + Care Request 협상 + dh GPT 일일 리포트 + Reports/Ask Darin**” 프로토타입.

공통 조상 이후 **16 vs 2 커밋**으로 갈라져, 단순 fast-forward merge는 불가능에 가깝습니다.  
Reports·Ask Darin·`/generate-report`는 **Joon이 앞서 있고**, 케어기버 경험·결제·계약·카테고리 Log는 **main이 앞서 있습니다.**

---

*이 문서는 `git fetch origin main Joon` 후 `git diff origin/Joon origin/main` 및 주요 파일 `git show`로 작성되었습니다.*
