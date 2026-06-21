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
| 오디오 | expo-av (음성 녹음·metering) |
| 아이콘 | lucide-react-native |
| 상태 | React Context (`Language`, `App`, `Chat`, `CareFlow`, `VoiceRecording`) |
| 패키지 매니저 | pnpm |

> **Web 레거시:** Vite + React 프로토타입은 `src/app/`에 별도로 존재합니다. HeyDealer 스타일 Care Request 플로우가 web에도 구현되어 있으나, **iOS 시뮬레이터(`pnpm ios`) 기준 메인 코드는 `src/` (RN)** 입니다.

---

## 프로젝트 구조 (RN 메인)

```
Childcare Management App/
├── App.tsx                     # RN 루트 (Provider + phase 관리)
├── .env / .env.example         # BIZCRUSH, OPENAI, EXPO_PUBLIC_TRANSCRIBE_URL
├── assets/
│   └── darin-logo.png
├── src/
│   ├── api/
│   │   ├── transcribe.ts       # POST /transcribe
│   │   └── generateReport.ts   # POST /generate-report
│   ├── config/
│   │   └── api.ts              # TRANSCRIBE_API_URL (플랫폼별 호스트)
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── MainTabs.tsx        # 중앙 Log 버튼 3초 hold 녹음
│   │   └── tabs/
│   │       ├── HomeScreen.tsx
│   │       ├── ReportScreen.tsx
│   │       ├── LogScreen.tsx
│   │       ├── MatchScreen.tsx      # Find 탭
│   │       └── ProfileScreen.tsx
│   ├── components/
│   │   ├── CareInboxModal.tsx       # 메시지 목록 + 채팅 (단일 Modal)
│   │   ├── CareProposalChatModal.tsx # 제안 채팅 + Care Plan 협상
│   │   ├── CarePlanNegotiationBlocks.tsx  # Draft / Tracker 공유 UI
│   │   ├── DarinCareChatModal.tsx     # Ask Darin · 리포트 상담 채팅
│   │   ├── VoiceWaveform.tsx
│   │   ├── VoiceRecordingOverlay.tsx
│   │   ├── CareRequestModal.tsx
│   │   ├── CareProposalsSheet.tsx
│   │   ├── CarePlanModal.tsx
│   │   ├── CarePlanAdjustModal.tsx
│   │   ├── ScheduleTrialModal.tsx
│   │   ├── CaregiverDetailSheet.tsx
│   │   ├── ChildCareSnapshotModal.tsx # 아이 돌봄 스냅샷 (Profile)
│   │   ├── ContactMessageModal.tsx
│   │   └── ...
│   ├── context/
│   │   ├── AppContext.tsx
│   │   ├── ChatContext.tsx
│   │   ├── CareFlowContext.tsx      # Care Request / Proposal / Match 상태
│   │   └── VoiceRecordingContext.tsx
│   ├── demo/
│   │   ├── caregivers.ts
│   │   ├── careFlow.ts              # mock proposals, chat seeds
│   │   ├── dailyReport.ts           # API 실패 시 fallback 리포트
│   │   ├── reportHistory.ts         # June 19·18 mock 히스토리 리포트
│   │   ├── reportConsultation.ts    # Ask Darin mock 응답
│   │   └── childProfile.ts          # Emma mock child profile
│   ├── types/
│   │   ├── profile.ts
│   │   ├── dailyReport.ts
│   │   ├── reportConsultation.ts
│   │   ├── transcribe.ts
│   │   ├── voiceNote.ts
│   │   ├── careFlow.ts
│   │   └── childProfile.ts
│   ├── utils/
│   │   ├── fetchWithTimeout.ts
│   │   └── reportPresentation.ts    # 5+11 카테고리 정규화·fallback
│   ├── i18n.ts
│   ├── theme.ts
│   └── app/                         # Web 레거시 (Vite)
└── work.md
```

**dh 서버 (별도 worktree):** `../darin-dh` (`origin/dh`) — `script/main.py` (FastAPI)

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
- **Today's Report** — Log에서 저장한 AI 일일 리포트 미리보기
- **AI Draft Reply**
- **매칭 확정 후:** **Active Care Relationship** 카드
  - Ji-yeon Park · Mon–Fri 3 PM–8 PM
  - Open Chat · View Care Plan
  - **Care Plan Draft** + **Agreement Tracker** + **Adjust Care Plan** (Find 채팅과 동일 블록)
  - Home Messages 채팅(`CareInboxModal`)에서도 협상 UI 표시

### 2. Reports (리포트)

- Ji-yeon Park 제출 타임라인 (June 20 · 19 · 18)
- **당일:** Log에서 **리포트에 저장**한 `AppContext.dailyReport`
- **히스토리:** `demo/reportHistory.ts` mock (June 19·18 — 선택·Ask Darin 테스트용)
- **리포트 카드 (progressive UX)**
  - 기본: 5개 요약 pill (배변·수면·식사·성장·진료) + **오늘 돌봄 요약**
  - **상세 보기** → Full Report + 11항목 Detailed Care Log
  - **한국어 보기 / English** — 카드별 view toggle (별도 번역 박스 없음)
- **Ask Darin** (우측 상단)
  1. 선택 모드 진입 → 리포트 카드 다중 선택 (노란 하이라이트)
  2. Select all / Clear all
  3. 하단 sticky bar → **Ask Darin** → `DarinCareChatModal`
  4. 선택 리포트 기반 mock 상담 (수면·식사·배변·건강·케어기버 메시지·케어 플랜)
- 생성·API 흐름 → **문서 하단 「일일 리포트 & dh API」** 참고

### Ask Darin 데모 (요약)

1. **Reports** → **Ask Darin**
2. June 19·18 (또는 오늘 저장 리포트) 선택
3. 하단 **Ask Darin** → Darin Care Chat
4. 칩 또는 직접 입력 (예: 「최근 수면 변화 요약해줘」)

### 3. Log (기록)

- **Voice Note** — 하단 탭 **중앙 Log 버튼 3초 길게 누르기** → 녹음(웨이브폼) → 다시 탭하면 저장·전사
- 녹음 전: 「중앙 기록 노란 버튼을 길게 눌러주세요」
- 저장 후: 전사문 + 이벤트 칩 → **Retake** / **일일 리포트 생성**
- **Quick Notes** — 텍스트만으로도 리포트 생성 가능 (음성 없을 때 버튼 표시)
- **리포트에 저장** 후 Log 화면 **초기 상태로 자동 복귀**
- **Today's Log** — 데모 타임라인 항목

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

- 프로필 카드 (UserCog → 프로필 수정)
- **Children** (부모 역할만) — Emma 카드 **탭 가능**
- Settings, Language Preference

#### Child Care Snapshot (`ChildCareSnapshotModal`)

Emma child card 탭 시 bottom sheet / modal 오픈.

- **제목:** Child Care Snapshot
- **부제:** Shared only with confirmed caregivers.
- **우측 상단:** ✏️ Edit + 닫기(X) — Edit는 mock 토스트

| 섹션 | 내용 |
|------|------|
| **Basic Info** | Emma Kim, 8 months, DOB, Female, Blood O, Preferred name Emma |
| **Health & Safety** | Peanuts allergy, mild eczema, Seattle Children's Clinic, emergency contact + Edit 칩 |
| **Special Notes** | Note type (Allergy/Condition/…/Other) + 텍스트 → **Save note** (로컬 state 목록 추가) |
| **Daily Routine** | Feeding, nap, diaper, comfort, favorite activity |
| **Care Preferences** | Korean/English, report language, update topics, communication style |
| **Authorized Pickup** | Jisoo Kim (Mother), Daniel Kim (Father) |
| **Privacy notice** | 확정 케어기버에게만 공유 안내 |

**하단 액션:**

- **Edit Info** → mock 토스트
- **Share with Caregiver** → “Child Care Snapshot shared with confirmed caregiver.”

Mock 데이터: `EMMA_CHILD_PROFILE` (`src/demo/childProfile.ts`)  
타입: `ChildProfile` (`src/types/childProfile.ts`)

RN: `ProfileScreen.tsx` · Web: `src/app/App.tsx` ProfileTab (동일 UX)

---

## Messages / Chat

### `CareInboxModal` (Home 진입)

- **단일 full-screen Modal** — 목록 ↔ 채팅 전환 (iOS nested Modal 버그 회피)
- Home **Messages** → 목록 → 대화 탭
- Home **Message Ji-yeon** → `startThreadId=1` 로 Ji-yeon 채팅 **직진**
- 매칭 후: Saved chat · Active care relationship 배지
- 매칭 확정 시 채팅 내 **Care Plan Draft / Agreement Tracker / Adjust Care Plan** 표시

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

### Child Profile (`childProfile.ts`)

- `EMMA_CHILD_PROFILE` — Basic info, health, routine, care preferences, pickup, seed special notes
- `CHILD_NOTE_TYPES` — Allergy, Condition, Medication, Behavior, Food, Sleep, Other

---

## 다국어 (i18n)

- `LanguageContext` + `src/i18n.ts` — 한/영
- Care Request, Proposals, Chat, Negotiation, Care Plan, Home active care, **Child Snapshot**, **Log 음성·리포트** 문자열 포함
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
6. **Home** → Active Care Relationship + Care Plan 블록 확인

### Child Care Snapshot 데모

1. **Profile** → **Children** → **Emma** 카드 탭
2. Basic Info · Health & Safety · Routine 확인
3. Special Notes에 Allergy + 텍스트 입력 → **Save note**
4. **Share with Caregiver** → mock 확인 토스트

### Voice → 일일 리포트 데모 (요약)

1. dh 서버 실행 (`pnpm server:dh`) — **문서 하단** 상세 참고
2. **Log** → 중앙 버튼 3초 hold → 녹음 → 탭으로 저장
3. **일일 리포트 생성** → AI EN/KO 초안 확인
4. **리포트에 저장** → **Reports** 탭에서 카테고리 아이콘·본문 확인

---

## 프로토타입 한계 (미구현)

- 실제 OAuth, SMS, 백엔드 DB, 결제, 캘린더 연동 (리포트·전사는 **로컬 dh FastAPI** 프로토타입만)
- Caregiver Accept / Counter는 mock (Accept → 즉시 수락 메시지)
- Special Notes · Edit Info · Share — **로컬 state / mock 토스트만** (백엔드 저장 없음)
- Settings, Billing, Forgot password 등 UI만
- 리포트·전사 결과 **영구 저장 없음** (`AppContext` in-memory)
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

### Profile · Child Snapshot

28. **`ChildCareSnapshotModal`** — RN + Web Profile Children → Emma 탭
29. `ChildProfile` 타입, `EMMA_CHILD_PROFILE` mock, Special Notes 로컬 추가, Edit/Share mock

### Home · 매칭 후 Care Plan

30. **`CarePlanNegotiationBlocks.tsx`** — Draft / Tracker 공유 컴포넌트
31. **Home** 매칭 확정 후 Care Plan Draft · Agreement Tracker · Adjust Care Plan 표시
32. **`CareInboxModal`** Home 채팅에서도 동일 협상 UI

### Voice · Log · dh API

33. **`VoiceRecordingContext`** — 3초 hold, metering 웨이브폼, stop/save
34. **`MainTabs`** 중앙 Log 탭 hold/save, **`VoiceRecordingOverlay`**
35. **Log UI** — mic 버튼 제거, hold 안내, 전사문 + Retake / 일일 리포트 생성
36. **`src/api/transcribe.ts`** + **`config/api.ts`** — dh `POST /transcribe` 연동
37. **`src/api/generateReport.ts`** — dh `POST /generate-report` (GPT EN/KO 요약)
38. **Reports** — 2단 UI: 5 요약 pill + 11항목 detail log (`reportPresentation.ts`)
39. **Reports** — progressive card (요약만 → 상세 보기, EN/KO toggle)
40. **리포트에 저장** 후 Log **기본 화면 자동 복귀**
41. API URL `:800` 오타 보정, `fetchWithTimeout`, 생성 후 스크롤
42. dh 서버: BizCrush STT + OpenAI categorize/generate-report, CORS, lazy OpenAI init

### Reports · Ask Darin

43. **`DarinCareChatModal`** — 선택 리포트 기반 Darin Care Chat (mock)
44. **Report selection mode** — 다중 선택, Select all/Clear, sticky bottom bar
45. **`demo/reportHistory.ts`** — June 19·18 mock 리포트 타임라인
46. **`demo/reportConsultation.ts`** — `report_consultation` payload + mock 응답
47. **`types/reportConsultation.ts`** — API-ready 상담 payload 타입

### Git / PR

48. `Joon` → [PR #2](https://github.com/eddysul/darin/pull/2) (Care Request · proposal chat · Messages)
49. `joon-into-dh` → [PR #3](https://github.com/eddysul/darin/pull/3) (Joon + dh 병합, unrelated histories)

---

## 주요 RN 컴포넌트 참조

| 파일 | 역할 |
|------|------|
| `MatchScreen.tsx` | Find 탭, Care Request → Proposals → Chat 연결 |
| `HomeScreen.tsx` | Messages, Quick Actions, Active Care + Care Plan 블록 |
| `LogScreen.tsx` | Voice Note, Quick Notes, AI 리포트 생성·저장 |
| `ReportScreen.tsx` | 일일 리포트 타임라인 · Ask Darin 선택 · progressive card |
| `DarinCareChatModal.tsx` | 선택 리포트 기반 Darin AI 상담 (mock) |
| `reportPresentation.ts` | main/detail 카테고리 정규화·fallback |
| `demo/reportHistory.ts` | June 19·18 mock 히스토리 |
| `demo/reportConsultation.ts` | report_consultation mock 응답 |
| `MainTabs.tsx` | 중앙 Log hold 녹음, 탭 바 |
| `VoiceRecordingContext.tsx` | 녹음·전사 상태 |
| `CarePlanNegotiationBlocks.tsx` | Care Plan Draft / Agreement Tracker |
| `CareProposalChatModal.tsx` | 제안 채팅 + Care Plan 협상 + Match 확정 |
| `CareInboxModal.tsx` | Home 메시지 inbox + saved chat + 협상 UI |
| `CareRequestModal.tsx` | Care Request 폼 |
| `CareProposalsSheet.tsx` | 3 proposals 비교 |
| `CarePlanAdjustModal.tsx` | Care Plan Update 편집 |
| `ScheduleTrialModal.tsx` | 시범 세션 제안 |
| `CarePlanModal.tsx` | 확정 Care Plan 상세 |
| `CareFlowContext.tsx` | 플로우·협상·매칭 전역 상태 |
| `ChatContext.tsx` | 대화 thread·메시지 |
| `ChildCareSnapshotModal.tsx` | Profile → Emma Child Care Snapshot |
| `ProfileScreen.tsx` | Children 카드 탭 → snapshot 오픈 |
| `api/transcribe.ts` | 오디오 업로드 → 전사 + events |
| `api/generateReport.ts` | 전사·메모 → AI 일일 리포트 |

---

## 일일 리포트 & dh API 연동

음성/텍스트 기록 → AI 전사·분류 → 일일 리포트 생성 → Reports 탭 저장까지의 **전체 파이프라인**입니다.

### End-to-end 흐름

```
[Log] 중앙 버튼 3초 hold → 녹음 (웨이브폼)
  → 탭으로 저장 → POST /transcribe
       ├─ BizCrush STT (language_hints=ko)
       └─ GPT → events[] (식사, 수면, 배변, …)
  → 전사문 + 이벤트 칩 표시
  → [일일 리포트 생성] → POST /generate-report
       └─ GPT → reportEn, reportKo, parentReplyDraft, items[]
  → AI 리포트 초안 카드 (원본 / EN / KO / 부모 답장 초안)
  → [리포트에 저장] → AppContext.dailyReport
  → Log 화면 초기화 · Reports 탭에 타임라인 반영
```

**Quick Notes만** 입력해도 `/generate-report` 호출 가능 (음성 없이 텍스트만).

### Reports UI — 2단 카테고리 구조

**상단 5개 요약 pill (항상 라벨 표시):** bowel · sleep · meal · growth · clinic  
- 기록 있음: `#FFF8E7` / `#E0B23F` · 없음: neutral gray

**Detailed Care Log (11항목, 상세 보기 시):**  
bowel · meal · sleep · growth · bath · clinic · environment · supplement · tummy_time · snack · medication

`reportPresentation.ts`가 API `items`, transcribe `events`, 텍스트에서 카테고리를 추론하고 fallback을 채웁니다.

### Reports UI — legacy items 매핑

서버 `items[].type` (meal · nap · activity · health · reminder)은 하위 호환용으로 유지됩니다.

| legacy type | 매핑 |
|-------------|------|
| `meal` | meal |
| `nap` | sleep |
| `activity` | tummy_time |
| `health` | clinic |
| `reminder` | snack |

### Ask Darin · report_consultation (프로토타입)

향후 Darin AI API 연동용 payload:

```json
{
  "task": "report_consultation",
  "childName": "Emma",
  "selectedReports": [ "...DailyReport[]" ],
  "childProfile": "...",
  "activeCarePlan": "...",
  "userQuestion": "..."
}
```

현재는 `getMockConsultationResponse()` 로컬 mock만 사용합니다.

### Reports UI — 카테고리 아이콘 (legacy)

서버가 내려주는 `items[].type`에 따라 아이콘이 매핑됩니다 (앱이 키워드 파싱하는 것이 아님).

| type | 아이콘 | 예 |
|------|--------|-----|
| `meal` | 수저 | 점심 식사 |
| `nap` | 달 | 낮잠 |
| `activity` | 활동 | 놀이 |
| `health` | 체온계 | 기침·건강 |
| `reminder` | 벨 | 여벌 옷 등 |

`/transcribe` 단계의 `events` (한국어 카테고리)와 `/generate-report`의 `items` (영문 type)는 **별도 GPT 단계**입니다.

### dh FastAPI 서버

| 항목 | 경로 |
|------|------|
| dh worktree | `../darin-dh` (`origin/dh` checkout) |
| FastAPI | `../darin-dh/script/main.py` |
| 앱 transcribe 클라이언트 | `src/api/transcribe.ts` |
| 앱 report 클라이언트 | `src/api/generateReport.ts` |
| URL 설정 | `src/config/api.ts` · `.env` `EXPO_PUBLIC_TRANSCRIBE_URL` |

**API 엔드포인트**

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/health` | `bizcrush_configured`, `openai_configured` |
| `POST` | `/transcribe` | multipart `file` → `{ raw_text, events, date }` |
| `POST` | `/generate-report` | JSON `{ raw_text, events, quick_notes, child_name, caregiver_name }` → `{ reportEn, reportKo, parentReplyDraft, items }` |

**환경 변수 (앱 `.env` + dh `script/.env`)**

```env
BIZCRUSH_API_KEY=...
OPENAI_API_KEY=...
EXPO_PUBLIC_TRANSCRIBE_URL=http://127.0.0.1:8000
```

- iOS 시뮬레이터: `127.0.0.1:8000`
- Android 에뮬레이터: `10.0.2.2:8000`
- 실기기: ngrok/배포 URL (HTTPS 권장) — **앱은 dh 레포에 묶이지 않음**, URL만 맞으면 자체 서버 가능
- **ffmpeg** 필요 (`brew install ffmpeg`)
- `.env` 변경 후 Expo **재시작** 필요
- 포트 `:800` 오타는 `api.ts`에서 `:8000`으로 자동 보정

**로컬 실행**

```bash
# 1) dh 서버 (별 터미널)
cp .env ../darin-dh/script/.env
pnpm server:dh                    # http://127.0.0.1:8000

# 2) 헬스 체크
curl http://127.0.0.1:8000/health

# 3) Expo 앱
pnpm ios
```

### Fallback 동작

| 상황 | 동작 |
|------|------|
| 서버 미연결 / 전사 실패 | `DEMO_VOICE_TRANSCRIPT` (Emma 점심·낮잠 데모) |
| `/generate-report` 실패 | `demo/dailyReport.ts` 로컬 fallback (입력 텍스트 기반) |
| API 타임아웃 | 30초 후 fallback (`fetchWithTimeout.ts`) |

데모 전사문과 **동일한** 입력일 때만 Emma 고정 5카테고리 리포트가 나옵니다. 실제 녹음/메모 내용이면 입력 기반 또는 AI 결과가 표시됩니다.

### 자체 서버 배포

dh `main.py`를 Railway / Render / VPS 등에 배포하고 `EXPO_PUBLIC_TRANSCRIBE_URL`만 변경하면 됩니다. STT를 Whisper 등으로 바꿔도 **응답 JSON 형식**만 맞추면 앱 수정 없이 동작합니다.

### 알려진 제한

- BizCrush STT `language_hints=ko` 고정
- `/generate-report` `items`가 label/value 없이 type만 오는 경우 있음 (프롬프트 개선 여지)
- 리포트·전사 **DB 저장 없음** — 앱 재시작 시 소실
- dh 브랜치와 Joon 브랜치 **git history 분리** — PR #3으로 통합 진행 중

---

*마지막 업데이트: 2026-06-20 — Reports progressive UX, Ask Darin 선택·상담, 2단 카테고리, PR #3*
