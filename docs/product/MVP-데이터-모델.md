# K-Nanny MVP 데이터 모델

코드 기준 인덱스: `src/types/mvpModels.ts`  
저장 키: `src/utils/storageKeys.ts`

## 관계

```text
Baby
 ├─ CareLog[] ──> ReportSummary (실시간 파생)
 │      └────────> Diary.careLogSummarySnapshot (저장 시점 고정)
 ├─ Diary[]
 │      ├─> GrowthBookItem[] (includedInGrowthBook=true 투영)
 │      └─> GrowthBookDocument (편집본, 별도 저장)
 ├─ BabySticker[]
 ├─ Caregiver[] ─> CareLog.createdBy / Diary.createdBy
 ├─ ActiveTimer[] (진행 중 타이머, 앱 재시작 복원)
 └─ AIConsultMessage[] <─ Baby + CareLog + Diary + ReportSummary

VoiceRecord ──> CareLog(source="voice", rawTranscript, confidence, flags)
```

## 엔터티

### Baby
- 저장 원본: `CareSetup.child` (`darin:care-setup`)
- 필드: `id`(경계용), `childName`, `birthDate?`, `dueDate?`, `childStatus`,
  `gestationalAgeWeeks?`, `birthWeight?`, `specialNotes?`
- MVP는 단일 아기. 서버용 `id`는 경계에만 예약.

### CareLog
- 코드: `BabyLogEntry`
- 저장: `darin:baby-logs`
- 필드: `id`, `cat`, `dateKey?`, `time`, `chip?`, `chip2?`, `stoolState?`,
  `amount?`, `duration?`, `notes?`, `title?`, `details?`, `nextAt?`,
  `voice?`, `source?`, `rawTranscript?`, `confidence?`, `flags?`, `createdBy?`
- 신규 쓰기에서 `dateKey`, `source`, `createdBy`는 provider가 보정.
- 변경 시 타임라인·오늘 요약·리포트·AI 컨텍스트가 즉시 재계산.

### Diary
- 코드: `DiaryEntry`
- 저장: `darin:diary-entries`
- 필드: `id`, `babyId`, `date`, `dateKey`, `photos`, `comment`, `weatherStamp`,
  `moodStamp`, `careLogSummarySnapshot`, `momentSuggestionsUsed`, `milestoneTag`,
  `customMilestoneTag`, `includedInGrowthBook`, `stickerIds?`, `createdBy?`,
  `createdAt`, `updatedAt`, `source`, `draftStatus`
- `careLogSummarySnapshot`은 작성 당시 Care Log를 고정. 이후 로그 수정으로 덮어쓰지 않음.

### GrowthBookItem
- 별도 저장소 없음. `Diary.includedInGrowthBook === true` 일기의 시간순 투영.
- 필드: `diaryId`, `diary`, `orderKey`

### GrowthBookDocument
- 코드: `GrowthBookEdit`
- 저장: `darin:growth-book-edit`
- 일기와 분리된 편집본(표지·페이지 레이아웃·편지·코멘트).
- PDF는 기기에서 `expo-print` / `expo-sharing`으로 생성·공유 (서버 없음).

### BabySticker
- 코드: `BabySticker`
- 저장: `darin:baby-stickers`
- 원본/누끼/최종 URI. 일기·성장책·상담에 `stickerIds`로 첨부.

### ActiveTimer
- 코드: `ActiveTimer`
- 저장: `darin:active-timers`
- 원터치 **롱프레스** 타이머(모유·수면·유축·터미타임·놀이).
- 종료 시 CareLog로 저장. 앱 재시작 후에도 진행 중 상태 복원.
- 수면은 open CareLog(`duration` 없음)와 연동 가능.

### Caregiver
- 코드: `FamilyMember`
- 저장: `darin:family-members`
- 필드: `id`, `name`, `emoji?`, `role`, `relationshipLabel?`, `contact?`,
  `inviteLink?`, `inviteCode?`, `status`, `isMe?`
- 역할: `owner | admin | editor | viewer | caregiver`
- 상태: `pending | active | inactive`
- 서버 공유 전 로컬 목업.

### VoiceRecord
- 별도 오디오 저장소 없음.
- CareLog에 `source="voice"`, `rawTranscript`, `confidence`, `flags`로 보존.
- 녹음 파일 URI는 MVP 영속화 범위 밖.

### ReportSummary
- 코드: `TodaySummary`
- 저장하지 않고 CareLog에서 실시간 파생.
- 수유·수면·기저귀 집계와 7일 평균·플래그 포함.

### AIConsultMessage
- 코드: `ChatMessage`
- 저장: `darin:consult-chat`
- 필드: `id`, `role`(`user | ai`), `text`, `stickerId?`

## 시간·출처 규칙
- `dateKey`: 기기 로컬 `YYYY-MM-DD`
- `time`: 기기 로컬 벽시계 `HH:mm`
- 날짜·7일 계산은 `src/utils/dateKey.ts`만 사용.
- 신규 CareLog·Diary에는 현재 가족 멤버 기반 `createdBy`를 기록.
