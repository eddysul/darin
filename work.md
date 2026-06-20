# Darin (Childcare Management App) — 작업 문서

**다린(Darin)** AI 돌봄 커뮤니케이션 앱 UI입니다.  
**Expo React Native** 프로토타입이 메인 실행 대상이며, 실제 백엔드·SMS·OAuth·결제 연동은 없습니다.

- **GitHub:** https://github.com/eddysul/darin
- **작업 브랜치:** `Joon` (main 직접 푸시 지양)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | **React Native** + Expo 52 + TypeScript |
| 네비게이션 | React Navigation (Bottom Tabs) |
| UI | React Native StyleSheet, expo-linear-gradient |
| 이미지 | expo-image, expo-image-picker |
| 아이콘 | lucide-react-native |
| 상태 | React Context (`Language`, `App`, `Chat`, `CareFlow`) |
| 패키지 매니저 | pnpm |

> **Web 레거시:** Vite + React 프로토타입은 `src/app/`에 별도로 존재합니다. HeyDealer 스타일 Care Request 플로우가 web에도 구현되어 있으나, **iOS 시뮬레이터(`pnpm ios`) 기준 메인 코드는 `src/` (RN)** 입니다.

---

## 프로젝트 구조 (RN 메인)

```
Childcare Management App/
├── App.tsx                     # RN 루트 (Provider + phase 관리)
├── assets/
│   └── darin-logo.png
├── src/
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── MainTabs.tsx
│   │   └── tabs/
│   │       ├── HomeScreen.tsx
│   │       ├── ReportScreen.tsx
│   │       ├── LogScreen.tsx
│   │       ├── MatchScreen.tsx      # Find 탭
│   │       └── ProfileScreen.tsx
│   ├── components/
│   │   ├── CareInboxModal.tsx       # 메시지 목록 + 채팅 (단일 Modal)
│   │   ├── CareProposalChatModal.tsx # 제안 채팅 + Care Plan 협상
│   │   ├── CareRequestModal.tsx
│   │   ├── CareProposalsSheet.tsx
│   │   ├── CarePlanModal.tsx
│   │   ├── CarePlanAdjustModal.tsx
│   │   ├── ScheduleTrialModal.tsx
│   │   ├── CaregiverDetailSheet.tsx
│   │   ├── ContactMessageModal.tsx
│   │   └── ...
│   ├── context/
│   │   ├── AppContext.tsx
│   │   ├── ChatContext.tsx
│   │   └── CareFlowContext.tsx      # Care Request / Proposal / Match 상태
│   ├── demo/
│   │   ├── caregivers.ts
│   │   └── careFlow.ts              # mock proposals, chat seeds
│   ├── types/
│   │   ├── profile.ts
│   │   ├── dailyReport.ts
│   │   └── careFlow.ts
│   ├── i18n.ts
│   ├── theme.ts
│   └── app/                         # Web 레거시 (Vite)
└── work.md
```

---

## 앱 실행 흐름 (App Phase)

`App.tsx`에서 `phase` 상태로 화면을 전환합니다.

```
splash  →  login  →  onboarding  →  main
(스플래시)   (로그인)   (프로필 설정)   (MainTabs)
                ↑
         회원가입 시에만 onboarding 경유
         로그인·소셜은 main으로 바로 진입 (검증 없음)
```

| Phase | 컴포넌트 | 설명 |
|-------|----------|------|
| `splash` | `SplashScreen` | Darin 로고, 약 2.6초 후 자동 전환 |
| `login` | `LoginScreen` | 로그인 / 회원가입 (이메일·비밀번호 입력 **필수 아님**) |
| `onboarding` | `OnboardingScreen` | 역할 선택 + 프로필 설정 (회원가입 후) |
| `main` | `MainTabs` | Home · Reports · Log · Find · Profile |

### 로그인 (프로토타입)

- **Log in** / **Continue with Google** / **Apple** 아무거나 누르면 Home 진입
- 별도 계정·비밀번호 없음
- **Sign up** → 온보딩 → 메인

---

## 디자인 토큰 (`src/theme.ts`)

Darin 미니멀 **흑백 + 옅은 노랑** 팔레트:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `background` | `#FFFFFF` | 메인 배경 |
| `backgroundSecondary` | `#FAFAF8` | 보조 배경 |
| `text` | `#111111` | 본문 |
| `muted` | `#666666` | 보조 텍스트 |
| `border` | `#EAEAEA` | 테두리 |
| `black` / `primary` | `#1A1A1A` | 버튼·강조 |
| `yellow` | `#E0B23F` | AI·매칭·협상 하이라이트 |
| `yellowSoft` | `#FFF8E7` | AI 배지·칩 배경 |

노란색은 AI 배지, 매칭 점수, 협상 중 상태, 확정 하이라이트에만 사용.

---

## 메인 앱 (5탭)

### 1. Home (홈)

- 인사 + Emma · 돌보미 상태 카드
- **Messages** 카드 → `CareInboxModal` (대화 목록)
- **Quick Actions**
  - **Message Ji-yeon** → Ji-yeon 채팅방 **바로** 열기 (목록 생략)
  - Schedule Pickup, Translate Report, View History (UI만)
- **Today's Report** — AI 번역 일일 리포트
- **AI Draft Reply**
- **매칭 확정 후:** **Active Care Relationship** 카드
  - Ji-yeon Park · Mon–Fri 3 PM–8 PM
  - Chat saved · Daily reports enabled
  - Open Chat · View Care Plan

### 2. Reports (리포트)

- Emma 돌봄 기록 타임라인, 날짜별 카드

### 3. Log (기록)

- Voice Note, Quick Notes, Today's Log

### 4. Find (돌봄 찾기) — `MatchScreen`

**HeyDealer 영감 Care Request / Care Proposal 플로우** (bid/입찰 용어 **미사용**)

#### 카드 UI (롤백 반영)

- 카드 하단: **요금 + View Profile** 만 표시
- **Request Proposal** 은 카드에 **없음** → 프로필 시트에서만

#### 전체 데모 플로우

```
Find
  → View Profile
  → Request Proposal (프로필 시트)
  → Care Request modal (Emma prefilled)
  → Send Care Request
  → Care Proposals 비교 (3건)
  → Chat / Accept Proposal
  → Care Plan Draft + Agreement Tracker (채팅)
  → Adjust Care Plan / Schedule trial
  → Care Plan Update 수락 (mock)
  → Confirm Match
  → Simulate caregiver confirmation
  → Darin Match Confirmed
  → Saved Chat + Home Active Care Relationship
```

#### Care Request modal (`CareRequestModal`)

Prefilled mock:

- Child: Emma, 8 months
- Location: Seattle, Capitol Hill
- Schedule: Mon–Fri, 3 PM–8 PM
- Language: Korean/English
- Care needs, Budget $18–25/hr, Start: Next Monday
- Button: **Send Care Request**

#### Care Proposals (`CareProposalsSheet`)

- Header: **3 Care Proposals received**
- Darin AI comparison summary
- 3 proposals: Ji-yeon (94%), Sarah (91%), Min-jun (87%)
- 카드당: View Profile · Chat · Shortlist · Accept Proposal

#### 제안 채팅 (`CareProposalChatModal`)

Find 탭 Proposals에서 Chat 시 사용. **CareInboxModal과 분리.**

**Care Plan Draft** (메시지 상단):

- Child, Caregiver, Schedule, Rate, Start date, Care needs, Trial session
- Status chips: Schedule agreed · Rate discussing · Trial needed · Daily report included

**Agreement Tracker:**

- Schedule / Care scope / Daily report language / Rate / Trial session
- agreed · discussing · needs confirmation (노란 강조)

**액션 버튼:**

- Draft with AI · Translate · Schedule trial · **Adjust Care Plan** · Confirm Match

**Adjust Care Plan** (`CarePlanAdjustModal`):

- Schedule, Rate, Trial, Start date, Care needs checkboxes, Message
- Prefill: $21/hr, Friday 4 PM trial 등
- **Send Care Plan Update** → 채팅에 구조화 카드 (Accept / Counter / Ask Darin)

**Schedule Trial** (`ScheduleTrialModal`):

- Friday 4 PM 제안 → 부모·케어기버 mock 메시지 → Draft trial 상태 갱신

**매칭 확정:**

1. Confirm Match → Parent confirmed · Waiting for caregiver
2. **Simulate caregiver confirmation** (프로토타입)
3. **Darin Match Confirmed** 카드 → Go to Active Chat · View Care Plan · Start Daily Reports

### 5. Profile (프로필)

- 프로필 카드, Children, Settings, Language Preference

---

## Messages / Chat

### `CareInboxModal` (Home 진입)

- **단일 full-screen Modal** — 목록 ↔ 채팅 전환 (iOS nested Modal 버그 회피)
- Home **Messages** → 목록 → 대화 탭
- Home **Message Ji-yeon** → `startThreadId=1` 로 Ji-yeon 채팅 **직진**
- 매칭 후: Saved chat · Active care relationship 배지

### `ChatContext`

- Mock threads: Ji-yeon, Sarah, Min-jun
- `sendMessage`, `markThreadSaved`, `ensureProposalThread`
- Ji-yeon thread: 매칭 전 `savedChat: false` (확정 후 true)

### `CareFlowContext`

| 상태 | 설명 |
|------|------|
| `proposalsReceived` | Care Request 전송 후 proposals 배너 |
| `shortlisted` | Shortlist caregiver IDs |
| `selectedProposalId` / `acceptedProposalId` | 선택·수락 proposal |
| `matchStatus` | none · parent_pending · confirmed |
| `activeRelationship` | 확정 후 활성 돌봄 관계 |
| `negotiations[cid]` | Care Plan Draft, Agreement terms, negotiation chat items |

---

## Mock 데이터 (`demo/`)

### Caregivers (`caregivers.ts`)

- **Ji-yeon Park** (id: 1) — 94% match, $22/hr, background check complete
- **Sarah Kim** (id: 2)
- **Min-jun Lee** (id: 3)

### Care Flow (`careFlow.ts`)

- `DEFAULT_CARE_REQUEST`, `CARE_PROPOSALS` (3건)
- `INITIAL_CHAT_MESSAGES`, AI draft/translate/summary
- `DEFAULT_CARE_PLAN_ADJUST` ($21/hr, Friday 4 PM trial)
- `buildCarePlan()`, `buildDefaultCarePlanDraft()`

---

## 다국어 (i18n)

- `LanguageContext` + `src/i18n.ts` — 한/영
- Care Request, Proposals, Chat, Negotiation, Care Plan, Home active care 문자열 포함
- Profile → Language Preference

---

## 로컬 실행

```bash
pnpm install
pnpm ios          # iOS Simulator
pnpm run android
pnpm run typecheck
```

시뮬레이터 새로고침: `Cmd + R`

### Ji-yeon Care Proposal 데모 (요약)

1. Log in (아무 버튼)
2. **Find** → Ji-yeon **View Profile** → **Request Proposal**
3. **Send Care Request** → Proposals → Ji-yeon **Chat**
4. **Adjust Care Plan** → Send → 카드 **Accept**
5. **Confirm Match** → **Simulate caregiver confirmation**
6. **Home** → Active Care Relationship 확인

---

## 프로토타입 한계 (미구현)

- 실제 OAuth, SMS, 백엔드, DB, 결제, 캘린더 연동
- Caregiver Accept / Counter는 mock (Accept → 즉시 수락 메시지)
- Settings, Billing, Forgot password 등 UI만
- `CareChatScreen.tsx`, `CareChatListScreen.tsx` — 구버전, `CareInboxModal` / `CareProposalChatModal`로 대체됨

---

## 작업 이력 요약

### 초기 · 공통

1. RN + Expo 로컬 실행 환경, GitHub `Joon` 브랜치
2. 한/영 i18n, Profile Settings / Billing UI
3. 스플래시 · 로그인 · 회원가입 · 전화 인증(데모) · 온보딩 (부모/케어기버)
4. 케어기버 면허·증명서 업로드 (base64 프로토타입)
5. Darin 로고 · 브랜드 적용

### RN UI · 테마

6. Minimal black/white + yellow (`src/theme.ts`) 팔레트 전환
7. MainTabs: Home, Reports, Log, Find, Profile
8. Find 탭 헤더 overlap 수정 (AI Recommended 배지)

### Caregiver · Find

9. CaregiverDetailSheet — View Profile, Contact, Request Proposal
10. Find 카드: **View Profile + 가격만** (Request Proposal 카드에서 제거, 프로필에서만)
11. Care Request modal + Care Proposals comparison (3 proposals, AI summary)
12. HeyDealer 스타일 플로우 — **Care Request / Care Proposal** 용어 (bid 미사용)

### Chat · Messages

13. Home Messages 카드 + `CareInboxModal` (목록 → 채팅)
14. iOS nested Modal 버그 수정 — 목록+채팅 **단일 Modal** 통합
15. Quick Action **Message Ji-yeon** → Ji-yeon 채팅 직접 진입
16. `ChatContext` — mock threads, sendMessage, savedChat

### Match · Care Flow

17. `CareFlowContext` — proposals, shortlist, match confirmation, active relationship
18. Find: Request Proposal → Proposals → **`CareProposalChatModal`** (채팅으로 직접 점프하지 않음)
19. Mutual match: Confirm Match → Simulate caregiver → Darin Match Confirmed
20. Home **Active Care Relationship** 카드 + `CarePlanModal`

### Care Plan 협상 (채팅)

21. **Care Plan Draft** 카드 + **Agreement Tracker**
22. **Adjust Care Plan** modal → **Send Care Plan Update** → 구조화 메시지 카드
23. Accept / Counter / Ask Darin (mock)
24. **Schedule Trial** modal + trial proposal 메시지
25. Darin AI agreement summary (업데이트 수락 후)
26. 확정 시 negotiated rate ($21/hr), trial (Friday 4 PM) → Active relationship · Saved chat

### Web (`src/app/`)

27. Web 프로토타입에도 CareFlowContext, MatchTab, CareChatModal 등 별도 구현 (RN과 완전 동기화 아님)

---

## 주요 RN 컴포넌트 참조

| 파일 | 역할 |
|------|------|
| `MatchScreen.tsx` | Find 탭, Care Request → Proposals → Chat 연결 |
| `HomeScreen.tsx` | Messages, Quick Actions, Active Care card |
| `CareProposalChatModal.tsx` | 제안 채팅 + Care Plan 협상 + Match 확정 |
| `CareInboxModal.tsx` | Home 메시지 inbox + saved chat |
| `CareRequestModal.tsx` | Care Request 폼 |
| `CareProposalsSheet.tsx` | 3 proposals 비교 |
| `CarePlanAdjustModal.tsx` | Care Plan Update 편집 |
| `ScheduleTrialModal.tsx` | 시범 세션 제안 |
| `CarePlanModal.tsx` | 확정 Care Plan 상세 |
| `CareFlowContext.tsx` | 플로우·협상·매칭 전역 상태 |
| `ChatContext.tsx` | 대화 thread·메시지 |

---

*마지막 업데이트: 2026-06-20 — Care Plan 협상 채팅, Find 플로우, Messages 통합 반영*
