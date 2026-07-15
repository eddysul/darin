# Darin (Childcare Management App) — 작업 문서

**다린(Darin)** AI 돌봄 커뮤니케이션 앱 UI입니다.  
**Expo React Native** 프로토타입이 메인 실행 대상이며, 실제 백엔드·SMS·OAuth·결제 연동은 없습니다.

- **GitHub:** https://github.com/eddysul/darin
- **작업 브랜치:** `joon-safe-port-main-features` (Joon 베이스 + main/dh 기능 안전 포트)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | **React Native** + Expo 52 + TypeScript |
| 네비게이션 | React Navigation (Bottom Tabs) |
| UI | React Native StyleSheet, expo-linear-gradient |
| 이미지 | expo-image, expo-image-picker |
| 오디오 | expo-av (음성 녹음·metering) |
| 로컬 저장 | `@react-native-async-storage/async-storage` (이벤트·리포트) |
| AI | OpenAI `gpt-4o-mini` (Get advice), dh FastAPI (전사·리포트 생성) |
| 아이콘 | lucide-react-native |
| 상태 | React Context (`Language`, `App`, `Chat`, `Schedule`, `CareFlow`, `VoiceRecording`) |
| 패키지 매니저 | pnpm |

> **단일 코드베이스:** Expo React Native (`src/`)만 유지합니다. Web 레거시(`src/app/`, `legacy/web/`)는 제거되었습니다.

---

## 프로젝트 구조 (RN 메인)

```
Childcare Management App/
├── App.tsx                     # RN 루트 (Provider + phase 관리)
├── .env / .env.example         # API 키, TRANSCRIBE URL
├── docs/
│   └── main-joon-diff.md       # main vs Joon 브랜치 비교 노트
├── scripts/
│   ├── verify-ai-event-context.mjs
│   └── verify-ai-report-context.mjs
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
│   │   ├── RoleSelectScreen.tsx
│   │   ├── ParentSetupScreen.tsx
│   │   ├── CaregiverSetupScreen.tsx
│   │   ├── AIChatScreen.tsx        # Get advice (OpenAI)
│   │   ├── MainTabs.tsx
│   │   └── tabs/
│   │       ├── HomeScreen.tsx
│   │       ├── ReportScreen.tsx
│   │       ├── LogScreen.tsx
│   │       ├── MatchScreen.tsx / CaregiverFindView.tsx
│   │       └── ProfileScreen.tsx
│   ├── components/
│   │   ├── ParentProfileView.tsx       # 부모 프로필 (접기/펼치기)
│   │   ├── CareScheduleModal.tsx       # 월간 달력 + 주간 일정
│   │   ├── ScheduleProposalModal.tsx
│   │   ├── ScheduleProposalCard.tsx
│   │   ├── CareInboxModal.tsx
│   │   ├── CareProposalChatModal.tsx
│   │   ├── CarePlanNegotiationBlocks.tsx
│   │   ├── ChildCareSnapshotModal.tsx
│   │   ├── VoiceWaveform.tsx
│   │   └── ...
│   ├── context/
│   │   ├── AppContext.tsx
│   │   ├── ChatContext.tsx
│   │   ├── ScheduleContext.tsx         # 케어 일정 제안·수락
│   │   ├── CareFlowContext.tsx
│   │   └── VoiceRecordingContext.tsx
│   ├── demo/
│   │   ├── caregivers.ts
│   │   ├── careFlow.ts
│   │   ├── dailyReport.ts
│   │   ├── daily-events.json   # 7일치 mock 케어 이벤트 (AI 컨텍스트)
│   │   ├── reportHistory.ts
│   │   ├── parentProfile.ts
│   │   ├── schedules.ts
│   │   ├── childProfile.ts
│   │   └── incomingCareRequests.ts
│   ├── types/
│   │   ├── profile.ts, dailyReport.ts, parentProfile.ts
│   │   ├── schedule.ts, careFlow.ts, log.ts
│   │   └── transcribe.ts, voiceNote.ts
│   ├── utils/
│   │   ├── reportPresentation.ts
│   │   ├── eventStore.ts           # voice note 이벤트 저장
│   │   ├── reportStore.ts          # dailyReport 히스토리 저장
│   │   ├── aiReportContext.ts      # AI system prompt 구성
│   │   ├── scheduleCalendar.ts
│   │   ├── trialCalendar.ts
│   │   └── categorize.ts
│   ├── i18n.ts
│   ├── theme.ts
│   └── app/                         # Web 레거시 (Vite)
└── work.md
```

**dh 서버 (별도 worktree):** `../darin-dh` (`origin/dh`) — `script/main.py` (FastAPI)

---

## 앱 실행 흐름 (App Phase)

```
splash → login → onboarding → role-select → parent-setup / caregiver-setup → main
                                                              ↓
                                                    (회원가입·역할 선택 후)
```

| Phase | 컴포넌트 | 설명 |
|-------|----------|------|
| `splash` | `SplashScreen` | Darin 로고, 약 2.6초 후 자동 전환 |
| `login` | `LoginScreen` | 로그인 / 회원가입 (검증 없음) |
| `onboarding` | `OnboardingScreen` | 기본 온보딩 |
| `role-select` | `RoleSelectScreen` | 부모 / 케어기버 역할 선택 |
| `parent-setup` | `ParentSetupScreen` | 부모 프로필 설정 |
| `caregiver-setup` | `CaregiverSetupScreen` | 케어기버 프로필 설정 |
| `main` | `MainTabs` | Home · Reports · Log · Find · Profile |

### Provider 계층 (`App.tsx`)

```
LanguageProvider → AppProvider → ChatProvider → ScheduleProvider → CareFlowProvider → VoiceRecordingProvider
```

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

---

## 메인 앱 (5탭)

### 1. Home (홈)

**부모 역할**
- 인사 + Emma · 돌보미 상태 카드
- **Messages** → `CareInboxModal`
- **Quick Actions**
  - Message Ji-yeon (채팅 직진)
  - **Schedule** → `CareScheduleModal` (월간 달력 + 주간 일정)
  - Translate Report, View History (UI만)
- **Upcoming schedule** 미리보기 + pending badge
- **Today's Report** — 저장된 AI 일일 리포트 미리보기
- **AI Draft Reply**
- 매칭 확정 후 **Active Care Relationship** + Care Plan Draft / Agreement Tracker

**케어기버 역할**
- 별도 `CaregiverHome` UI — Find 탭으로 incoming care requests 이동

### 2. Reports (리포트)

- Ji-yeon Park 제출 타임라인 (June 20 · 19 · 18)
- **당일:** Log에서 저장한 `AppContext.dailyReport`
- **히스토리:** `demo/reportHistory.ts` mock
- **리포트 카드 (progressive UX)**
  - 5개 요약 pill + 오늘 돌봄 요약
  - 상세 보기 → Full Report + 11항목 Detailed Care Log
  - EN/KO toggle
- **Get advice** (우측 상단) → `AIChatScreen` (OpenAI 실연동)
  - 저장된 dailyReport + reportStore 히스토리 + 7일 이벤트 로그를 system prompt에 포함
  - 리포트 저장 시 컨텍스트 자동 갱신

> **변경:** 이전 Ask Darin (리포트 다중 선택 → mock 상담) 플로우는 **Get advice 단일 AI 채팅**으로 대체됨.

### 3. Log (기록)

- **Voice Note**
  - Log 탭 **Record / Stop** 버튼 (탭 hold 0.6초 또는 직접 녹음)
  - 웨이브폼 + 전사 (dh `/transcribe`, 90s 타임아웃)
  - 에러 상태: mic 권한 거부, 녹음 실패, 너무 짧음, 전사 실패 등
- **Quick Notes** + categorized log entries (케어기버 역할)
- **일일 리포트 생성** → dh `/generate-report` 또는 fallback
- **리포트에 저장** 시:
  - `AppContext.dailyReport` 업데이트
  - `reportStore` 영구 저장 (최근 7개)
  - voice note `events` → `eventStore` append (당일)
- 저장 후 Log 화면 초기 상태로 복귀

### 4. Find (돌봄 찾기)

**부모:** HeyDealer 스타일 Care Request → Proposal → Chat → Match  
**케어기버:** `CaregiverFindView` — incoming care requests

전체 플로우는 이전과 동일 (Care Request modal → 3 Proposals → CareProposalChatModal → Care Plan 협상 → Confirm Match → Active Relationship).

채팅 내 **Schedule Trial** 수락 시 `ScheduleContext`에 일정 이벤트 생성 · `ScheduleProposalCard` 표시.

### 5. Profile (프로필)

**부모 역할 — `ParentProfileView`**

| 상태 | 표시 |
|------|------|
| **접힘 (기본)** | 이름·관계·위치·언어·연락 + 간단 요약 2줄 |
| **펼침 (카드 탭)** | Communication Preferences · Care Style · Household & Logistics · Trust & Verification · Privacy |
| **항상 표시** | **Child Snapshot** (Emma) + View Child Care Snapshot 버튼 |

- 우측 상단 연필 → `ProfileEditModal` (기본 정보 수정)
- Edit Preferences 버튼 **제거**
- Care Needs는 펼침 시에도 **미표시** (요청 반영)

**케어기버 역할:** 기존 프로필 카드 + Settings

#### Child Care Snapshot (`ChildCareSnapshotModal`)

Emma child card / View Snapshot → Basic Info, Health & Safety, Special Notes, Daily Routine, Care Preferences, Authorized Pickup.

---

## Schedule (케어 일정)

### `CareScheduleModal` (Home → Schedule)

1. **월간 달력** — 날짜 선택
2. 선택 시 **아래 주간 스트립** + 필터 (All / Pending / Accepted) + 일정 목록
3. **New schedule** → `ScheduleProposalModal`
4. 채팅에서 trial/schedule 제안 → `ScheduleProposalCard` (Accept / Counter / Decline)

### `ScheduleContext`

- `events[]` — propose / accept / decline / counter
- `getUpcomingEvents`, `getPendingEventsForRole`, `getEventsForDate`
- demo seed: `demo/schedules.ts`

---

## Get advice — AI 상담 (`AIChatScreen`)

### 데이터 소스 (system prompt)

| 소스 | 파일 | 설명 |
|------|------|------|
| 최신 리포트 | `AppContext.dailyReport` | Log 저장 직후 반영 |
| 리포트 히스토리 | `reportStore.ts` | AsyncStorage, 최근 7개 |
| 이벤트 로그 | `eventStore.ts` + `src/demo/daily-events.json` | voice note events + mock 7일 |
| 추출 유틸 | `aiReportContext.ts` | summary, details, items, source note 구조화 |

### OpenAI 호출

- 모델: `gpt-4o-mini`, max_tokens 300
- `.env` **`EXPO_PUBLIC_OPENAI_API_KEY`** 필수 (Expo 클라이언트용)
- 키 없으면 명확한 안내 메시지 표시

### 검증 스크립트

```bash
node scripts/verify-ai-event-context.mjs   # 이벤트 로그 기반 답변
node scripts/verify-ai-report-context.mjs  # 리포트 추출 기반 답변
```

---

## Messages / Chat

### `CareInboxModal`

- Home Messages → 목록 ↔ 채팅 (단일 Modal)
- Message Ji-yeon → Ji-yeon 채팅 직진
- 매칭 후 Care Plan Draft / Agreement Tracker / Adjust Care Plan

### `CareFlowContext` + `ChatContext`

기존과 동일 — proposals, negotiations, match confirmation, active relationship, mock threads.

---

## Mock 데이터 (`demo/`)

| 파일 | 내용 |
|------|------|
| `caregivers.ts` | Ji-yeon (94%), Sarah, Min-jun |
| `careFlow.ts` | Care Request, 3 proposals, chat seeds, care plan |
| `parentProfile.ts` | 부모 프로필 EN/KO (care needs, communication, care style 등) |
| `schedules.ts` | 케어 일정 demo events |
| `reportHistory.ts` | June 19·18 mock 리포트 |
| `childProfile.ts` | Emma Child Care Snapshot |
| `incomingCareRequests.ts` | 케어기버 Find용 요청 |
| `dailyReport.ts` | API 실패 fallback |

---

## 다국어 (i18n)

- `LanguageContext` + `src/i18n.ts` — 한/영
- Schedule, Parent Profile, AI Chat, Voice/Log 에러, Caregiver Home 등 포함

---

## 로컬 실행

```bash
pnpm install
pnpm ios              # iOS Simulator
pnpm run android
pnpm run typecheck
pnpm server:dh        # dh FastAPI (별 터미널)
```

시뮬레이터 새로고침: `Cmd + R`  
**.env 변경 후 Metro 재시작 필수**

### 환경 변수 (`.env`)

```env
BIZCRUSH_API_KEY=...
OPENAI_API_KEY=...                        # dh 서버 + 검증 스크립트
EXPO_PUBLIC_OPENAI_API_KEY=...              # Get advice (Expo 클라이언트)
EXPO_PUBLIC_TRANSCRIBE_URL=http://127.0.0.1:8000
```

---

## 데모 시나리오

### Get advice (AI 상담)

1. Log → voice note 녹음 → 리포트 생성 → **리포트에 저장**
2. Reports → **Get advice**
3. 「오늘 낮잠은 몇 시간?」「점심 후 기침 있었나?」 등 질문
4. 저장된 리포트 + 이벤트 로그 기반 답변 확인

### Schedule

1. Home → **Schedule**
2. 월간 달력에서 날짜 탭 → 주간 스트립 + 일정 목록
3. **New schedule** → 제안 생성

### 부모 프로필

1. Profile → 부모 프로필 카드 **탭** → Communication / Care Style / Household / Trust 펼침
2. **Child Snapshot** 항상 표시 → View Snapshot → 상세 모달

### Care Proposal (기존)

1. Find → View Profile → Request Proposal → Send → Chat → Adjust → Confirm Match

---

## 프로토타입 한계 (미구현)

- 실제 OAuth, SMS, 백엔드 DB, 결제, 캘린더 OS 연동
- Caregiver Accept/Counter mock
- Parent Profile · Child Snapshot Edit — mock 토스트
- Settings, Billing UI만
- Ask Darin (리포트 다중 선택 mock) — **Get advice OpenAI로 대체** (`DarinCareChatModal` 삭제)

---

## 작업 이력 요약

### 초기 · 공통 (1–32)

스플래시/로그인/온보딩, i18n, Darin 테마, Find Care Request·Proposal 플로우, Chat/Messages, Care Plan 협상, Home Active Care, Child Care Snapshot, Voice·dh API, Reports progressive UX 등 — **이전 work.md 참고**

### dh 브랜치 포트 · AI Chat (33–38)

33. **`src/demo/daily-events.json`** — 2026-06-10~20 mock 케어 이벤트
34. **`eventStore.ts`** — voice note events 저장 (Web localStorage / Native AsyncStorage)
35. **`AIChatScreen.tsx`** — Get advice, 7일 이벤트 + 리포트 system prompt, `useMemo`
36. **`LogScreen`** — 저장 시 `appendEventsForToday(savedNote.events)`
37. **`reportStore.ts`** — dailyReport 최근 7개 AsyncStorage 저장
38. **`aiReportContext.ts`** — 리포트 구조화 추출 + prompt 빌드, 리포트 갱신 시 AI 반영

### Scheduler (39–44)

39. **`ScheduleContext`** + `demo/schedules.ts` + `scheduleCalendar.ts`
40. **`CareScheduleModal`** — 월간 달력 → 날짜 선택 → 주간 스트립 + 일정 목록
41. **`ScheduleProposalModal`** / **`ScheduleProposalCard`**
42. Home Quick Action **Schedule**, upcoming preview, pending badge
43. Chat trial/schedule → schedule events, negotiation cards wired
44. i18n schedule keys

### Parent Profile (45–47)

45. **`ParentProfileView`** — 부모 전용 Profile 탭 UI
46. **`demo/parentProfile.ts`** + `types/parentProfile.ts`
47. 접기/펼치기 UX — 펼침: Communication · Care Style · Household · Trust / 항상: Child Snapshot

### Voice · Log 개선 (48–50)

48. Hold 3s → **0.6s**, 권한 거부 시 fake recording 제거
49. Log 탭 **Record/Stop** 직접 UI, transcribe 90s timeout
50. 명확한 recording error 메시지 (i18n)

### Onboarding · Role (51–53)

51. **`RoleSelectScreen`**, **`ParentSetupScreen`**, **`CaregiverSetupScreen`**
52. **`CaregiverFindView`** + `incomingCareRequests` demo
53. Home 역할별 분기 (parent vs caregiver)

### Reports · Get advice (54–55)

54. Ask Darin 선택 플로우 제거 → **Get advice** 단일 `AIChatScreen`
55. `EXPO_PUBLIC_OPENAI_API_KEY` + API 키 미설정 안내

### Git

56. 브랜치 `joon-safe-port-main-features` — Joon 베이스 + main/dh 기능 안전 포트
57. `pnpm run typecheck` 통과

---

## 주요 RN 컴포넌트 참조

| 파일 | 역할 |
|------|------|
| `AIChatScreen.tsx` | Get advice — OpenAI + report/event 컨텍스트 |
| `CareScheduleModal.tsx` | 월간 달력 + 주간 일정 UI |
| `ScheduleContext.tsx` | 일정 propose/accept/decline/counter |
| `ParentProfileView.tsx` | 부모 프로필 (접기/펼치기 + Child Snapshot) |
| `eventStore.ts` | voice note 이벤트 영구 저장 |
| `reportStore.ts` | dailyReport 히스토리 영구 저장 |
| `aiReportContext.ts` | AI system prompt 구성 |ㅇ
| `ReportScreen.tsx` | 리포트 타임라인 + Get advice |
| `LogScreen.tsx` | Voice Note, categorized logs, 리포트 저장 |
| `HomeScreen.tsx` | Messages, Schedule, Active Care |
| `MatchScreen.tsx` / `CaregiverFindView.tsx` | Find 탭 (역할별) |
| `ProfileScreen.tsx` | ParentProfileView / caregiver profile |
| `CareProposalChatModal.tsx` | 제안 채팅 + Care Plan + Schedule cards |
| `VoiceRecordingContext.tsx` | 녹음·전사·에러 상태 |

---

## 일일 리포트 & dh API 연동

### End-to-end 흐름

```
[Log] Record → POST /transcribe → events[] + transcript
  → [일일 리포트 생성] → POST /generate-report
  → [리포트에 저장]
       ├─ AppContext.dailyReport
       ├─ reportStore (AsyncStorage, max 7)
       └─ eventStore.appendEventsForToday(events)
  → Reports 탭 반영
  → Get advice system prompt 자동 갱신
```

### dh FastAPI

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/health` | bizcrush/openai configured |
| `POST` | `/transcribe` | multipart audio → raw_text, events |
| `POST` | `/generate-report` | JSON → reportEn/Ko, items, details |

```bash
pnpm server:dh                    # http://127.0.0.1:8000
curl http://127.0.0.1:8000/health
pnpm ios
```

### Fallback

| 상황 | 동작 |
|------|------|
| 서버 미연결 | 데모 성공 없음 → 재시도 / 직접 입력 CTA (임시 오디오 유지로 재분석) |
| API 타임아웃 | 재시도 / 직접 입력 |
| OpenAI 키 없음 | Get advice 안내 메시지 |

### 음성 AI 기록 (2.2.x · CareLog)

| 항목 | 상태 |
|------|------|
| 2.2.3 확인·수정·저장 | 결과 제목 「이렇게 이해했어요」, 카드별 수정/삭제, 전사 접기, `rawTranscript`+events 저장 |
| 2.2.4 다중 이벤트 | 한 음성 → 여러 카드, 개별 삭제 후 「기록에 추가」 |
| 2.2.5 표현·시간 | `voiceToBabyLog` 육아 사전 + `voiceTime` (방금/아까/새벽/어제/오전·오후 애매) + confidence |
| 2.2.6 실패 UX | 한국어 에러, 재분석, 직접 입력 (메모 시트) |
| 2.2.7 영속화·출처 | AsyncStorage `darin:baby-logs`, `source=voice`, `createdBy`, 성공 후 오디오 URI 폐기 |

### 리포트 · 상담 · 가족 (2.4–2.6)

| 항목 | 상태 |
|------|------|
| 2.4 리포트 실집계 | `reportAggregates` dateKey 7일, mock bars 제거, 요약 3카드(rule), empty state |
| 2.5 상담 context pack | 배너 + `buildCareContextPack`, 질문 focus 로그, 의료 안전, chat AsyncStorage |
| 2.6 가족 프로토타입 | `FamilyMember` 역할, 초대 모달(링크 mock), 권한 제한, timeline createdBy |
| 2.7 영속화 | logs / diary / chat / family · `STORAGE_KEYS` · `storageReady` · dateKey 통일 |
| 2.8 신뢰·안전 UX | 참고 정보 모달, 기록 부족 배너, 의료 위험 안내, 로컬 “판단하기 어려워요” |
| 2.9 상태 | loading/empty/error(OpenAI key)·초대 mock 문구 |

---

## 알려진 제한

- BizCrush STT `language_hints=ko` 고정
- Get advice는 OpenAI 직접 호출 (dh 서버 경유 아님)
- Parent Profile Edit Preferences — mock alert
- Schedule · Care Plan — in-memory + AsyncStorage (서버 sync 없음)

---

*마지막 업데이트: 2026-06-20 — Get advice (OpenAI + report/event store), Scheduler, Parent Profile UX, dh 이벤트 포트, AsyncStorage 영구 저장*
