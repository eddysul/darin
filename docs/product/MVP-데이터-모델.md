# K-Nanny MVP 데이터 모델

코드 기준 인덱스: `src/types/mvpModels.ts`

## 관계

```text
Baby
 ├─ CareLog[] ──> ReportSummary (실시간 파생)
 │      └────────> Diary.careLogSummarySnapshot (저장 시점 고정)
 ├─ Diary[]
 │      └────────> GrowthBookItem[] (includedInGrowthBook=true인 투영)
 ├─ Caregiver[] ─> CareLog.createdBy / Diary.createdBy
 └─ AIConsultMessage[] <─ Baby + CareLog + Diary + ReportSummary 컨텍스트

VoiceRecord ──> CareLog(source="voice", rawTranscript, confidence, flags)
```

## 엔터티

### Baby
- 현재 저장 원본: `CareSetup.child`
- 코드 필드: `id`(경계용), `childName`, `birthDate?`, `dueDate?`, `childStatus`,
  `gestationalAgeWeeks?`, `birthWeight?`, `specialNotes?`
- MVP는 단일 아기를 사용하며 서버 연동용 `id`는 모델 경계에 예약한다.

### CareLog
- 코드: `BabyLogEntry`
- 저장: `darin:baby-logs`
- 코드 필드: `id`, `cat`, `dateKey?`, `time`, `chip?`, `chip2?`, `stoolState?`,
  `amount?`, `duration?`, `notes?`, `voice?`, `source?`, `rawTranscript?`,
  `confidence?`, `flags?`, `createdBy?`
- 신규 쓰기에서는 `dateKey`, `source`, `createdBy`를 provider가 보정한다. optional 표기는 레거시 마이그레이션 호환용이다.
- 변경 시 타임라인·오늘 요약·리포트·AI 상담 컨텍스트가 즉시 다시 계산된다.

### Diary
- 코드: `DiaryEntry`
- 저장: `darin:diary-entries`
- 코드 필드: `id`, `babyId`, `date`, `dateKey`, `photos`, `comment`, `weatherStamp`,
  `moodStamp`, `careLogSummarySnapshot`, `momentSuggestionsUsed`, `milestoneTag`,
  `customMilestoneTag`, `includedInGrowthBook`, `createdBy?`, `createdAt`, `updatedAt`,
  `source`, `draftStatus`
- `careLogSummarySnapshot`은 작성 당시 Care Log를 보존한다. 이후 로그 수정으로 덮어쓰지 않는다.

### GrowthBookItem
- 별도 저장소를 두지 않는다.
- 코드 필드: `diaryId`, `diary`, `orderKey`
- `Diary.includedInGrowthBook === true`인 일기의 시간순 투영이다.
- 표지 → 일기 페이지 → 마지막 편지는 미리보기 시 파생한다.

### Caregiver
- 코드: `FamilyMember`
- 저장: `darin:family-members`
- 코드 필드: `id`, `name`, `emoji?`, `role`, `contact?`, `inviteLink?`, `inviteCode?`,
  `status`, `isMe?`
- 역할: `owner | admin | editor | viewer | caregiver`
- 상태: `pending | active | inactive`
- 서버 공유 전 단계의 로컬 목업이다.

### VoiceRecord
- 별도 오디오 저장소를 두지 않는다.
- 코드 필드: `id`, `careLogId`, `source="voice"`, `dateKey?`, `time`, `rawTranscript?`,
  `confidence?`, `flags?`, `createdBy?`
- 변환된 Care Log에 `source="voice"`, `rawTranscript`, `confidence`, `flags`를 보존한다.
- 녹음 파일 URI는 MVP 영속화 범위 밖이다.

### ReportSummary
- 코드: `TodaySummary`
- 저장하지 않고 Care Log에서 실시간 파생한다.
- 코드 필드: `dateKey`, `feedCount`, `sleepCount`, `totalSleepMinutes`, `diaperCount`,
  `totalCount`, `lastFeedAt?`, `lastSleepAt?`, `lastDiaperAt?`, `yesterdayFeedCount`,
  `yesterdaySleepMinutes`, `yesterdayDiaperCount`, `avgFeed7`, `avgSleepMinutes7`,
  `avgDiaper7`, `flags`

### AIConsultMessage
- 코드: `ChatMessage`
- 저장: `darin:consult-chat`
- 코드 필드: `id`, `role`(`user | ai`), `text`
- 질문 시 Baby + CareLog + 최근 Diary + ReportSummary를 컨텍스트 팩으로 구성한다.

## 시간·출처 규칙
- `dateKey`: 기기 로컬 날짜 `YYYY-MM-DD`
- `time`: 기기 로컬 벽시계 `HH:mm`
- 날짜 비교와 7일 계산은 `src/utils/dateKey.ts`만 사용한다.
- 모든 신규 Care Log와 Diary에는 현재 가족 멤버 기반 `createdBy`를 기록한다.
