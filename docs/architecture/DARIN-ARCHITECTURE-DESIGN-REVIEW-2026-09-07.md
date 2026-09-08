# Darin 장기 구조 개선 설계 리뷰

- 작성일: 2026-09-07
- 상태: **ARCHITECTURE PLAN READY**
- 성격: Architecture / Design Review — 구현·배포 승인 문서가 아님
- 검토 대상: 실제 Expo/React Native 소스, 저장소의 SQL migration, Edge Functions, QA·운영 문서

결론부터 말하면, **Darin은 전체를 다시 만들 필요가 없습니다.** 기존 기록·일기·추억·성장책 저장 구조를 유지하면서, 그 사이에 **출처·권한·버전을 관리하는 AI 결과물 계층**을 추가하는 방향이 적합합니다.

다만 기능 확장에 앞서 해결해야 할 데이터 격리·저장 안정성 문제가 확인됐습니다.

리뷰 과정에서 코드 수정, migration 생성, DB 변경, 배포, EAS 작업은 하지 않았습니다. 이 파일은 리뷰 결과의 문서화입니다.

실행한 읽기 전용 검사 결과:

- TypeScript 검사: 통과
- Architecture boundary smoke: 통과
- Repository query shape smoke: 통과

이는 정적 검사 결과입니다. 실제 운영 RLS, 푸시 전달, AI 서버의 보안까지 검증한 것은 아닙니다.

---

## 1. Executive Summary

### 현재 구조의 가장 큰 문제

가장 큰 문제는 파일 개수나 화면 크기가 아니라 **도메인 사이의 계약이 일관되지 않다는 점**입니다.

- 기록은 저장되지만, 일부 UI는 서버 저장 완료 전에 성공처럼 처리합니다.
- 아기별 기록 캐시는 분리되어 있지만, 리포트 AI 문장 캐시는 같은 수준으로 분리되어 있지 않습니다.
- 화면의 공유 권한과 DB·Storage의 실제 권한이 일부 다릅니다.
- AI 상담, 주간 리포트, 일기 요약이 서로 다른 안전 정책을 사용합니다.
- AI 결과에 원본 기록·생성 버전·공유 대상·사용자 승인 여부를 공통으로 연결하는 구조가 없습니다.

### Darin에 가장 잘 맞는 개선 방향

**“상담을 잘하는 AI”보다 “기록을 안전하게 다음 결과물로 연결하는 AI”**로 설계해야 합니다.

핵심은 다음 네 가지입니다.

1. 확정된 생활 기록은 `care_logs`가 기준입니다.
2. 수치 계산과 사실 추출은 결정적 코드가 담당합니다.
3. AI는 구조화·문장화·번역을 담당합니다.
4. 결과물은 초안·승인·공유·수정 이력이 있는 앱 자산으로 남습니다.

### 가장 먼저 해야 할 작업

첫 수정 단위는 **리포트 AI 캐시의 계정·아기 격리**를 권합니다. 코드에서 재사용 조건이 명확하게 확인됐고, DB 변경 없이 작게 수정·검증할 수 있습니다.

동시에 우선순위 P0로 다뤄야 할 항목은 다음입니다.

- 저장 성공 확인 전 일기 초안을 삭제하는 흐름
- 음성 처리 중 취소·아기 전환에 대한 요청 범위 고정
- UI와 RLS의 기록 수정 권한 불일치
- 임시 사진 경로의 과도한 Storage 권한
- 상담 프롬프트와 Darin 제품 원칙의 충돌

### 지금 하면 안 되는 작업

- 폴더 전체 이동과 데이터 모델 변경을 한 번에 진행
- 과거 migration 파일을 고쳐 운영 상태와 이력을 더 벌리기
- AI 일기·공유 요약의 자동 공개
- 성능 측정 없이 index 추가
- 클라이언트 기능 플래그를 보안 장치로 취급
- 운영 적용 상태를 확인하지 않고 RLS가 안전하거나 취약하다고 확정
- AI 서버를 확인하지 않은 상태에서 프롬프트 수정만으로 안전성을 보장한다고 선언

---

## 2. Current Architecture

| 영역 | 현재 구현 | 평가 |
|---|---|---|
| **Record** | 화면 → `BabyLogContext` → 동기화 유틸 → `CareLogRepository` → `care_logs`. 구조화 payload와 작성자·입력 출처 저장 | 저장 기반은 유지할 가치가 큼. 비즈니스 처리와 전역 상태의 결합을 줄여야 함 |
| **Voice** | Expo 녹음 → `/transcribe` → 이벤트 변환 → 사용자 확인 → 기록 일괄 저장 | 확인 단계는 좋음. 응답 스키마 검증·요청 범위·실제 오디오 삭제 보강 필요 |
| **Diary** | 사용자 작성, 기록 요약 snapshot, 문장 제안, 사진 업로드 → `diary_entries`·`diary_media` | 과거 요약을 고정하는 방향은 좋음. 서버 성공과 초안 삭제의 순서가 문제 |
| **Memories** | 게시물·사진·태그·공개 범위·댓글·반응·저장, 친구 전용 조회 | 기능이 풍부함. 공개 범위 변경의 원자성, 임시 업로드 권한, 집계 조회 개선 필요 |
| **Growthbook** | 일기 기반 페이지 편집 → 책·페이지·미디어·댓글 테이블. 편지·롤링페이퍼 지원 | 실제 저장 구조가 존재함. 전체 페이지 재저장과 여러 요청에 걸친 순서 변경이 부담 |
| **Sharing** | 가족은 `baby_members`, 친구는 `memory_friends`. 초대 코드·Darin ID 요청 RPC | 가족과 친구의 분리는 유지. 내니·산후조리사 전용 기간·범위 제한 공유는 별도 설계 필요 |
| **Notifications** | 기기 로컬 알림 + 일반 push Edge + 서버 수유·수면 reminder worker + 앱 알림함 | 기존 기능을 통합 정책으로 정리할 단계. 수신자 검증·재시도·전달 상태 모델이 일관되지 않음 |
| **i18n** | 한국어·영어·일본어·스페인어·중국어 간체, `LanguageContext`, 사용자 `preferred_language` | UI 번역 기반은 있음. 사용자 콘텐츠의 버전 관리형 번역은 별개로 필요 |
| **AI** | 상담 `/chat`, 음성 `/transcribe`, 주간 리포트 문장화, 생활 패턴 표현 보정 | 상담은 자유 응답 중심. 리포트에는 이미 규칙 기반 fallback·판단형 문장 검사 존재 |
| **Supabase** | 도메인별 repository, Auth, RLS, private Storage, RPC | repository 분리는 이미 되어 있음. 일부 repository가 알림·파일 공유·작업 조율까지 담당 |
| **Edge Functions** | `delete-account`, `send-push-notification`, `process-care-reminders`, 공통 notification runtime | 공통화가 시작돼 있음. 배포 단위보다 내부 책임과 실행 계약을 먼저 분리하는 편이 안전 |
| **QA/Release** | 구조·쿼리·다국어·멀티아기·알림·RLS 관련 다수 검사, QA/prod 환경 보호, 기능 공개 상태표 | 기반이 상당함. 정적 문자열 검사와 실제 동작·권한 검사의 보장 범위를 구분해야 함 |

### 이미 개선된 부분은 유지해야 합니다

특히 다음을 “아직 없는 기능”으로 보고 다시 만들면 안 됩니다.

- Care Logs의 명시적 컬럼 조회와 500행 단위 페이지 처리
- 날짜 범위·카테고리·기록 ID별 추가 조회
- 계정·아기 범위에 맞지 않는 늦은 응답 폐기
- 조회 완료 범위 관리와 원격 삭제 반영
- 이관 대상 여부를 고려한 최근 기록 bootstrap
- Memories의 20개 단위 피드와 관련 테이블 일괄 조회
- Diary의 100개 단위 조회와 사진 signed URL 일괄 발급
- Growthbook의 미디어 signed URL 일괄 처리
- reminder worker의 claim/version 검증과 발송 직전 상태 재확인

관련 계약은 [Care Log History Contract](./CARE-LOG-HISTORY-CONTRACT.md)와 [기존 Query Audit](./QUERY-OPTIMIZATION-AUDIT.md)에 이미 정리되어 있습니다.

---

## 3. 코드에서 확인한 우선 위험

아래는 **저장소 코드 기준**입니다. 운영 서버에 동일하게 적용되어 있는지는 별도 확인 대상입니다.

| 우선순위 | 확인 내용 | 영향과 권고 |
|---|---|---|
| P0 | 주간 AI 문장 캐시 키가 `기간 표시:언어`이며 계정·아기 ID가 없음 | 같은 기간·언어의 다른 아기에 기존 문장이 재사용될 수 있음. 계정·아기·전체 날짜·입력 fingerprint 포함 |
| P0 | 일기 저장에서 `clearDiaryDraft()`가 비동기 서버 저장 완료보다 먼저 실행됨 | 저장 실패 시 복구할 초안을 잃을 수 있음. 저장 결과를 기다린 뒤 초안 정리 |
| P0 | 음성 provider가 계정·아기 범위를 고정하지 않고, 취소 후 늦은 응답 차단도 부족 | 이전 녹음 결과의 재등장·다른 아기로 확정되는 경로를 차단해야 함 |
| P0 | 화면은 editor의 타인 기록 수정을 막지만, Care Logs RLS는 editor에게 더 넓은 권한 허용 | 제품 권한표를 결정하고 DB까지 일치시켜야 함 |
| P0 | 임시 미디어 권한이 업로더가 아닌 해당 아기의 editor 여부로 결정됨 | `only_me`·선택 공유 게시물에 연결된 사진도 임시 경로 예외가 더 넓게 허용할 수 있음 |
| P0 | 상담 프롬프트가 Darin을 childcare advisor로 지정하고 상황에 따른 진료 권유를 요구 | 사용자가 정한 제품 원칙과 직접 충돌. 공통 AI 정책과 서버 출력 검증 필요 |
| P0 | 일반 push의 가족 구성원 경로는 원본 이벤트·작성자·대상 게시물 권한 검증이 충분하지 않음 | 존재하지 않거나 권한 없는 리소스에 대한 알림 생성 가능성을 차단 |
| P1 | Memories signed URL 메모리 캐시가 경로·폭만 사용 | 세션 변경·권한 변경 시 재사용 범위를 안전하게 제한해야 함 |
| P1 | Growthbook 저장이 순서 변경·페이지 갱신을 여러 요청으로 수행 | 중간 실패·동시 편집 시 불완전 상태 가능. 변경분 저장과 트랜잭션 설계 필요 |

주요 근거:

- [리포트 캐시 사용부](../../src/screens/tabs/BabyReportScreen.tsx) — 리뷰 시점 138행 부근
- [일기 초안 정리 순서](../../src/screens/tabs/DiaryScreen.tsx) — 358행 부근
- [음성 처리 및 오디오 정리](../../src/context/VoiceRecordingContext.tsx) — 63행 부근
- [UI 기록 수정 권한](../../src/types/family.ts) — 60행 부근 / [DB 수정 정책](../../supabase/migrations/202608260004_creator_integrity_forward_fix.sql) — 57행 부근
- [임시 경로 권한](../../supabase/migrations/202608180001_eager_media_uploads.sql) — 53행 부근
- [상담 프롬프트](../../src/utils/babyLogAIContext.ts) — 141행 부근
- [push 수신자 계산](../../supabase/functions/send-push-notification/index.ts) — 199행 부근

추가로 음성의 `discardAudio()`는 현재 실제 파일 삭제를 하지 않습니다. 상태에서 URI를 지우는 것과 녹음 파일을 삭제하는 것은 구분해야 합니다.

---

## 4. Target / Product Architecture

### 권장 데이터 흐름

```text
수동 입력 ───────────────────┐
음성 → AI 구조화 → 확인·수정 ─┤
                            ▼
                  Care Logs 저장 확정
                            │
                 권한 필터 + 사실 계산
                            ▼
                      하루 요약
                  ┌─────────┴─────────┐
                  ▼                   ▼
               일기 초안           공유 요약 초안
                  │                   │
               사용자 승인         대상·기간 승인
                  ▼                   ▼
             Diary / Memory       가족·돌봄 인수인계
                  │                   │
                  ▼                   ▼
               Growthbook          대상별 번역
                                      │
                                저장 후 필요한 알림
```

수동 구조화 기록까지 매번 LLM을 거치게 할 필요는 없습니다. AI가 없어도 기록 저장은 작동해야 합니다.

### 각 계층의 책임

| 계층 | 담당 | 하지 않아야 할 일 |
|---|---|---|
| Client/UI | 입력·미리보기·확인·저장 상태·오류 복구 | 직접 수신자 계산, SQL 조율, 프롬프트 정책 결정 |
| Hooks/state | 화면 상태·조회 상태·낙관적 업데이트 | 여러 도메인의 저장 작업을 숨겨서 실행 |
| Repository | Supabase read/write, row mapping, Storage adapter | AI 호출·알림 발송·화면 이동 |
| Service/usecase | 기록 확정, 초안 생성, 공개, 인수인계 승인 | React 의존, 화면 문구 직접 조립 |
| Domain | 사실 계산·범위·출처·상태 전이·권한 계약 | 네트워크 호출 |
| AI | operation별 입력/출력 스키마·검증·fallback | 자유로운 DB 쓰기·수신자 결정·의료 판단 |
| Sharing | 리소스별 접근·수정·공유·기간 제한 | 관계 이름만 보고 권한 부여 |
| Notifications | 이벤트→허용 수신자→언어→채널→전달 | 클라이언트가 보낸 target를 검증 없이 신뢰 |
| i18n | UI catalog, locale 해결, 콘텐츠 번역 경계 | 원본을 번역문으로 덮어쓰기 |
| Server | 인증·재권한 확인·작업 실행·비용 제한·감사 | 서비스 키를 사용한다는 이유로 접근 검증 생략 |
| QA/Release | 데이터 계약·정책·기능별 공개 조건 검증 | 정적 검사 통과를 운영 보안 검증으로 간주 |

### AI 결과물은 “저장 가능한 콘텐츠”여야 합니다

기존 테이블을 대체하지 않고 다음 모델을 **추가 후보**로 제안합니다. 지금 생성할 migration은 아닙니다.

| 모델 후보 | 목적 |
|---|---|
| `ai_jobs` | 생성 요청 상태, 재시도, idempotency, 비용·시간 관리 |
| `ai_artifacts` | 요약·초안·추천 문장·패턴 설명의 버전 관리 |
| `artifact_sources` | 어떤 기록의 어느 버전에서 만들어졌는지 연결 |
| `content_translations` | 원본 버전·대상 언어별 번역 저장 |
| `share_summaries` + 접근 grant | 승인된 공유 요약, 수신자·유효 기간·허용 범위 |
| notification outbox / delivery | 업무 이벤트와 수신자·기기별 전달 작업 분리 |

공통 메타데이터는 다음 정도가 필요합니다.

- `baby_id`, 요청자, 작업 종류
- 원본 ID·버전, 대상 날짜 범위, timezone
- 사실 snapshot과 입력 fingerprint
- 원본 언어·출력 언어
- prompt/model/schema version
- `draft / approved / published / superseded / failed`
- 생성·승인·공유 시각 및 승인자
- 접근 범위와 파생 결과의 출처

**원본이 수정됐다고 과거 일기나 성장책 문장을 조용히 바꾸면 안 됩니다.** 기존 승인본은 유지하고 “기록이 변경되어 새 초안을 만들 수 있음”으로 처리하는 것이 적합합니다.

### AI 실행 계약

`/chat`에 임의 `systemPrompt`를 전달하는 구조 대신 장기적으로 다음처럼 허용된 작업을 명시합니다.

- `parse_voice_log`
- `summarize_day`
- `draft_diary`
- `draft_handoff`
- `suggest_growthbook_text`
- `translate_content`
- `explain_record_pattern`

서버가 작업별 정책을 선택하고, 인증된 사용자의 권한으로 필요한 원본만 읽어야 합니다. 숫자 계산은 코드가 하고 AI는 문장화합니다.

실패 시에는 기록 저장을 막지 않고, 규칙 기반 요약이나 편집 가능한 빈 초안으로 돌아갑니다.

현재 `/chat`·`/transcribe`가 가리키는 AI backend 구현은 이 저장소에서 확인하지 못했습니다. 따라서 서버의 실제 prompt 강제, 입력 검증, 데이터 보관, rate limit은 **미검증**입니다.

---

## 5. Recommended Folder Structure

물리적 이동보다 먼저 import 경계를 만드는 방식이 안전합니다.

```text
src/
  app/                         # provider 조립, navigation, 시작 흐름
  features/
    records/
    voice/
    diary/
    memories/
    growthbook/
    reports/
    sharing/
    notifications/
    settings/
  domain/                      # 순수 타입·계산·상태 전이
  services/                    # 여러 기능을 연결하는 usecase
  repositories/                # 기존 Supabase 접근 계층 유지
  ai/
    contracts/
    operations/
    validation/
    provenance/
  permissions/                 # 클라이언트 capability 계약
  i18n/
    catalogs/{locale}/
    localePolicy.ts
    contentTranslation.ts
  hooks/                       # 진짜 공용 hook만
  components/                  # 진짜 공용 UI만
  lib/                         # Supabase·스토리지 등 adapter
  config/                      # 환경·기능 공개 상태
supabase/
  functions/
    _shared/
    ...
  migrations/
scripts/
  qa/
    static/
    domain/
    integration/
    security/
  operations/
docs/
  architecture/
  decisions/
  operations/
  qa/
```

### 이동·추출 대상

| 현재 | 권장 변경 | 위험 |
|---|---|---|
| `App.tsx`, navigation 조립 | `app/`로 점진 이동. App은 composition root 유지 | 중 |
| `BabyLogContext` | 기록·일기·성장책 mutation usecase 추출 후 상태 provider 분리 | 높음 |
| `babyLogHydrationService` 등 | 기존 동작을 유지하며 `services/bootstrap/`로 이동 | 중 |
| `VoiceRecordingContext`, voice 변환 유틸 | `features/voice/` + `ai/operations/parseVoice` | 중 |
| `babyLogAIContext`, narrative·insight prompt/validator | `ai/`로 이동, 사실 계산은 `domain/reports/` | 중 |
| `types/family.ts`의 권한 함수 | `permissions/`에 중앙화, DB 정책 대응표 유지 | 높음 |
| repository 안의 알림 발송 | 해당 저장 usecase → 서버 업무 이벤트로 단계적 이관 | 높음 |
| `DataExportRepository`의 파일 생성·공유 | 조회 repository와 export usecase 분리 | 중 |
| 루트의 `i18n*Messages` | 도메인·locale catalog로 점진 이동 | 중 |
| 기능 전용 `components/babylog/*` | 해당 feature로 이동, 공통 디자인 컴포넌트만 남김 | 중 |

유지할 폴더는 `repositories`, `supabase/migrations`, `config`, 기존 운영 문서입니다. 과거 migration 경로와 내용은 변경하지 않습니다.

새 프레임워크·상태 라이브러리 도입은 필수 조건이 아닙니다. 기존 Context를 분해하기 전에 **하나의 기능에서 데이터 소유자가 누구인지**부터 확정해야 합니다.

---

## 6. AI Product Plan

아래 무료·유료 구분은 가격 확정이 아니라 상품 실험 후보입니다. 기록 접근·권한 보호·기존 콘텐츠 열람을 유료 장벽으로 삼지는 않는 편을 권합니다.

### 1) AI voice logging — 최우선

- **사용자 문제:** 손이 바쁜 상황에서 여러 기록을 빠르게 남기기 어려움.
- **해결:** 음성을 기록 후보로 분리하고 시간·양·종류를 구조화한 뒤 사용자에게 확인받음.
- **입력:** 음성, 입력 언어 힌트, 녹음 시작 시각·timezone, 고정된 계정·아기 범위.
- **출력:** 이벤트 후보, 명시되지 않은 필드, 확인이 필요한 항목, 원문.
- **저장:** 확정 이벤트는 `care_logs`. 원음은 명시적 보관 정책에 따라 임시 처리.
- **UI:** 현재 음성 입력 → 후보별 수정 → 저장 결과 확인.
- **무료/유료:** 기본 사용량 무료, 높은 사용량·긴 다중 이벤트 입력은 유료 후보.
- **의료 위험:** 증상 발화를 진단·권고로 변환하는 위험.
- **Guardrail:** 말하지 않은 수유 종류·양을 채우지 않기, 낮은 확실성은 확인, 중복 확정 방지.
- **QA:** 혼합 언어, 부정문, “어제 밤”, 자정·DST, 단위, 여러 아기 언급, 취소·전환·부분 저장 실패.

### 2) Daily summary

- **사용자 문제:** 기록은 쌓이지만 하루를 한눈에 이해하기 어려움.
- **해결:** 코드가 집계한 사실을 AI가 간결하게 정리.
- **입력:** 당일 확정 기록, 조회 완전성, timezone, 명시적 비교 구간.
- **출력:** 구조화된 수치와 출처가 있는 짧은 요약.
- **저장:** daily-summary artifact. 숫자는 문장과 별도 보관.
- **UI:** 홈 ‘오늘의 요약’, 기록 화면의 하루 마무리.
- **무료/유료:** 기본 수치·짧은 요약 무료, 추가 스타일·확장 생성은 유료 후보.
- **의료 위험:** 횟수·간격에서 부족·정상·욕구를 추정.
- **Guardrail:** “기록된 수유는 5회예요”처럼 관측 범위를 명시. 빈 기록을 0회로 단정하지 않음.
- **QA:** 누락·삭제·수정, 진행 중 타이머, 중복 기록, 불완전 조회, 날짜 변경.

### 3) Diary draft

- **사용자 문제:** 사실은 남겼지만 일기로 쓰기에는 부담.
- **해결:** 하루 요약과 사용자가 남긴 메모를 편집 가능한 일기 초안으로 연결.
- **입력:** 승인 가능한 요약, 선택한 사진·메모, 원하는 어조.
- **출력:** 제목·본문·사용된 사실 목록.
- **저장:** AI artifact → 사용자 승인 후 `diary_entries`.
- **UI:** 일기 작성의 ‘기록으로 초안 만들기’.
- **무료/유료:** 기본 초안 체험, 추가 스타일·생성량은 유료 후보.
- **의료 위험:** 기록에 없는 기분·발달 성취를 사실로 창작.
- **Guardrail:** 사실과 감성 표현 구분, 자동 공개 금지, 초안 보존, 승인본 자동 덮어쓰기 금지.
- **QA:** 근거 없는 사건·감정 삽입, 저장 실패, 기존 초안 병합, 수정 후 재생성, 사진 일부 실패.

### 4) Family/nanny/postpartum handoff

- **사용자 문제:** 교대할 때 필요한 정보만 정확히 전달하기 어려움.
- **해결:** 지정 기간의 기록과 사용자가 작성한 전달 사항을 수신자별로 정리.
- **입력:** 허용된 기록 범위, 받는 사람, 교대 기간, 전달 메모.
- **출력:** 최근 기록·남긴 메모·확인할 항목을 분리한 인수인계 초안.
- **저장:** 승인된 `share_summary`, 수신 grant, 번역 버전.
- **UI:** 공유 → ‘인수인계 만들기’, 기록 화면의 기간 선택.
- **무료/유료:** 수동 공유 기본 제공, 예약·자동 초안·복수 교대 관리는 유료 후보.
- **의료 위험:** 돌봄 지시나 처방을 AI가 새로 만드는 위험.
- **Guardrail:** 보호자가 적은 사항은 출처와 함께 전달하되 AI의 의료 권고처럼 바꾸지 않음. 대상·기간 승인 필수.
- **QA:** 근무 종료·권한 철회, 타 아기 데이터, 비공개 일기 혼입, 중복 발송, 번역의 양·시간 일치.

### 5) Growthbook text

- **사용자 문제:** 추억을 책의 흐름에 맞게 연결하는 문장이 어려움.
- **해결:** 선택한 일기·추억에서 페이지 제목과 연결 문장을 제안.
- **입력:** 사용자가 고른 콘텐츠, 책 언어·어조·페이지 맥락.
- **출력:** 제목·짧은 본문·사용한 콘텐츠 참조.
- **저장:** 제안 artifact → 승인된 page content와 연결.
- **UI:** 성장책 편집기의 ‘문장 추천’.
- **무료/유료:** 단일 추천 체험, 여러 페이지 편집 도우미는 유료 후보.
- **의료 위험:** 기록되지 않은 발달 단계나 정상 성장 선언.
- **Guardrail:** 미기록 성취를 만들지 않음. 공개 범위가 다른 원본을 책에 넣을 때 재확인.
- **QA:** 페이지 순서 변경, 원본 삭제, 긴 번역문, 인쇄 레이아웃, 사용자 편집 보존.

### 6) Multilingual translation

- **사용자 문제:** 가족이 서로 다른 언어로 기록·댓글·요약을 읽음.
- **해결:** 원문을 보존하면서 요청 언어의 번역본 제공.
- **입력:** 권한이 있는 콘텐츠의 확정 버전, 원문 언어, 대상 언어.
- **출력:** 번역문·번역 상태·원문 연결.
- **저장:** `content_translations`; 원본 버전·locale별 재사용.
- **UI:** ‘번역 보기 / 원문 보기’, 가족·인수인계 요약.
- **무료/유료:** 짧은 번역 기본량, 장문·책 전체·예약 번역은 유료 후보.
- **의료 위험:** 부정·양·시각·보호자 전달 사항의 의미 변형.
- **Guardrail:** 이름·숫자·단위·부정 보존, 원문 수정 시 이전 번역 표시, 번역 전에 접근 검증.
- **QA:** 5개 언어의 양방향 번역, 혼합 문장, 고유명사, 숫자, 단위, 삭제·권한 철회.

### 7) Lifestyle pattern explanation

- **사용자 문제:** 기록 사이의 변화를 이해하기 어려움.
- **해결:** 코드로 계산한 비교·관찰 후보를 AI가 설명.
- **입력:** 충분한 기록 범위, 계산된 지표, 표본 수·누락 정도.
- **출력:** 관측된 변화와 비교 기간을 명시한 설명.
- **저장:** 기간·입력 버전이 있는 report artifact.
- **UI:** 리포트의 ‘기록에서 발견한 변화’.
- **무료/유료:** 기본 변화 무료, 장기 비교·맞춤 기간은 유료 후보.
- **의료 위험:** 상관을 원인으로 설명하거나 정상·비정상 판정.
- **Guardrail:** 인과 단정·또래 정상성 평가 금지, 데이터 부족 시 설명을 생성하지 않음.
- **QA:** 소표본, 다중 비교, 잘못된 단위 연결, 인과 표현, 결측·편향된 기록.

### Medical-safety 공통 정책

금칙어 목록 하나로는 부족합니다.

1. 작업별 허용 범위를 서버에서 고정합니다.
2. AI가 사용할 수 있는 사실·metric ID를 제한합니다.
3. 숫자·단위를 해당 근거에 정확히 대조합니다.
4. 진단·정상성·병원 방문 판단·근거 없는 욕구 추정은 결과로 승인하지 않습니다.
5. 실패하면 안전한 템플릿이나 생성 불가 상태를 반환합니다.
6. 임상 판단을 요구하는 질문에는 판단을 생성하지 않고 제품 범위를 설명합니다.
7. 실제 위급 상황에 대한 일반 안전 안내가 필요하다면, 생성형 상담과 분리한 별도 정책으로 Human review를 받습니다.

현재 주간 narrative의 fallback·검증은 좋은 출발점입니다. 다만 “입력 어딘가에 같은 숫자가 있는가” 수준이 아니라 **그 문장의 수치가 정확히 그 지표에서 왔는가**를 확인해야 합니다.

상담 답변을 메모로 저장하는 기존 기능도 유지할 수 있지만, AI 결과를 `manual` 원본 기록처럼 취급해서 다음 AI 입력의 사실로 재사용하는 것은 막아야 합니다.

---

## 7. Query Optimization

성능 개선의 기준은 예상 배수가 아니라 **요청 수·반환 행 수·응답 크기·p95·권한 거부율**입니다. 운영 측정 없이 몇 배 빨라진다고 약속할 수는 없습니다.

여기서 Build는 작은 변경 묶음이며 EAS 빌드를 뜻하지 않습니다.

### Q1. Memories 피드 집계 — high impact

- **Location:** [MemoriesRepository](../../src/repositories/MemoriesRepository.ts) — 리뷰 시점 698행 부근
- **Current query:** 피드 20개에 대해 관련 테이블을 일괄 조회하지만 댓글·반응 행을 가져와 개수를 계산.
- **Problem:** 이미 게시물별 N+1은 줄였지만, 관련 행 수가 커지면 전송량과 API 반환 상한 때문에 비용·정확성 문제 발생 가능.
- **Recommended:** 권한이 확인된 게시물에 대해 `comment_count`, `reaction_count`, `my_reaction`, `saved`만 반환하는 집계 조회. 상세 댓글은 cursor pagination.
- **Index:** 기존 post ID 관련 index 활용. 추가 composite index는 실행 계획 확인 후.
- **Migration:** 집계 RPC 도입 시 필요.
- **Impact / risk:** 행 수를 크게 줄일 수 있음 / RPC의 RLS 우회가 가장 큰 위험.
- **Build:** 권한 테스트 확정 후 별도 Q1 단위로 도입.

### Q2. Signed URL 발급·캐시 — high impact

- **Location:** Memories의 `createSignedUrl`, Diary·Growthbook 미디어 조회.
- **Current:** Memories는 표지별 권한 조회와 URL 발급. Diary·Growthbook은 이미 batch 발급.
- **Problem:** Memories cold load의 이미지별 추가 요청, 경로·폭만 사용하는 캐시, 도메인별 다른 갱신 정책.
- **Recommended:** 공통 `MediaResolver`. 캐시 키에 계정·권한 epoch·bucket·path·transform 포함. 화면에 필요한 미디어만 batch 해결.
- **Index:** 우선 불필요.
- **Migration:** 클라이언트 개선만 하면 불필요. 공통 서버 endpoint 선택 시 별도 검토.
- **Impact / risk:** cold 요청 및 반복 발급 감소 / 권한 철회 후 URL·이미지 캐시 잔류.
- **Build:** 캐시 격리는 P0, batch 최적화는 Phase 1.

### Q3. Diary 시작 조회 — high impact

- **Location:** `DiaryRepository.hydrate`
- **Current:** 100개씩 페이지 처리하지만 모든 과거 일기와 해당 사진을 끝까지 hydrate.
- **Problem:** 장기 사용자의 첫 진입 비용은 계속 증가.
- **Recommended:** 최신 목록 우선, 과거 cursor 조회, 상세 진입 시 본문·사진 로드. Growthbook에 필요한 일기는 ID로 별도 조회.
- **Index:** 기존 baby/date index 우선. 정렬 tie-breaker 포함 후보는 측정 후.
- **Migration:** 처음에는 불필요.
- **Impact / risk:** 시작 응답량 감소 / 아직 조회하지 않은 일기를 삭제되었다고 오인하는 회귀 위험.
- **Build:** 목록 coverage 계약과 함께 Phase 1. 기존 이관·snapshot 유지.

### Q4. Growthbook 저장·조회 — high impact

- **Location:** [GrowthBookRepository.saveEdit](../../src/repositories/GrowthBookRepository.ts) — 345행 부근
- **Current:** 전체 페이지 순서를 임시로 바꾸고 페이지별 조회·갱신, 이후 다시 hydrate. 댓글·페이지 목록은 전체 조회.
- **Problem:** 페이지 수에 비례한 요청, 중간 실패, 동시 편집 충돌.
- **Recommended:** 변경 페이지 diff 저장, 책 revision 확인, 순서 변경은 원자적 RPC. 미디어 업로드는 별도 완료 후 참조 확정.
- **Index:** 기존 book/order·page·comment index 유지.
- **Migration:** revision/RPC에는 필요.
- **Impact / risk:** 작은 편집의 작업량 감소 / 기존 편집본 손실 가능성이 있어 위험 높음.
- **Build:** 저장 안정성 기반 후 Phase 4. 다른 폴더 이동과 묶지 않음.

### Q5. 알림 unread·중복 진입 조회 — medium impact, 정확성 개선

- **Location:** `NotificationBellButton`, `NotificationCenterScreen`, `FamilyRepository`.
- **Current:** 벨도 최신 50개 알림을 읽어 unread 여부 확인. 알림함과 초대 요청 조회가 일부 중복.
- **Problem:** 최신 50개 밖의 unread를 놓칠 수 있고 같은 데이터 반복 조회.
- **Recommended:** 점 표시만 필요하면 `recipient_id + read_at IS NULL`의 존재 조회. 숫자 badge면 별도 count. 계정 범위 공통 inbox state와 cursor 목록.
- **Index:** 기존 recipient/created index 확인 후 unread partial index 후보.
- **Migration:** 클라이언트만 변경하면 없음. index는 승인 후.
- **Impact / risk:** 요청·payload 감소 / 읽음 처리 실패 및 계정 전환 회귀.
- **Build:** Phase 1.

### Q6. Edge recipient 조회 — medium impact

- **Location:** `send-push-notification`, `process-care-reminders`.
- **Current:** 수신자별 설정·프로필·토큰 조회 반복.
- **Problem:** 가족 수×여러 요청. 일반 push는 전체 수신자 정책도 불완전.
- **Recommended:** 권한 검증 후 수신자 목록 확정, 설정·언어·토큰 batch 조회. reminder의 발송 직전 version 검사는 유지.
- **Index:** 기존 user/baby/token index부터 사용.
- **Migration:** batch 조회 자체는 불필요. outbox/delivery는 필요.
- **Impact / risk:** 지연 감소 / stale membership을 사용한 오발송.
- **Build:** P0 이벤트 검증 이후 Phase 3.

### Q7. `select *`·scope·반복 권한 실패 — medium impact

- **Location:** Growthbook, Memories 상세, 가족 요청 목록, 프로필 조회.
- **Current:** 일부 상세는 `select *`; 일부 ID 조회는 RLS를 전제로 ID만 필터.
- **Problem:** 상세·목록 projection 구분 부족, 앱 범위 실수를 타입으로 막기 어려움.
- **Recommended:** 목록 DTO와 상세 DTO 분리. 아기 종속 usecase는 `BabyScope` 필수. 친구 피드는 `FriendMemoryScope` 별도 사용.
- **Index:** 기존 FK index 확인.
- **Migration:** projection·타입 개선에는 없음. 프로필 민감 컬럼 분리는 별도 보안 migration.
- **Impact / risk:** payload·실패 로그 감소 / 친구 상세에 `activeBabyId`를 무조건 붙이면 정상 접근이 깨짐.
- **Build:** Phase 1, 프로필 권한은 Phase 0 보안 단위.

**필터가 없다는 사실만으로 정보 유출이라고 판단하지 않습니다.** RLS로 보호되는 ID 조회와 아기 범위가 필요한 일반 목록을 구분해야 합니다.

### Q8. Export·계정 삭제의 무제한 조회 — high correctness impact

- **Location:** `DataExportRepository`, `delete-account`.
- **Current:** 여러 테이블·미디어 경로를 pagination 없이 조회.
- **Problem:** 데이터가 많으면 누락된 export나 불완전 미디어 정리가 가능.
- **Recommended:** 안정적 정렬·cursor·완료 검증. 삭제는 재개 가능한 작업으로 분리.
- **Index:** 기존 baby ID index부터 사용.
- **Migration:** export 페이지 처리는 없음. 삭제 job 모델에는 필요.
- **Impact / risk:** 완전성 향상 / 삭제는 복구가 어려워 위험 높음.
- **Build:** export는 Phase 1, 삭제 운영 구조는 Phase 3. 경계값 QA는 먼저 추가.

### Index 후보 정리

지금 바로 추가하지 않습니다.

- Care Logs: 카테고리별 조회가 실제 병목이면 `(baby_id, category, recorded_at, id)` 후보.
- Diary/Memories: 실제 cursor 정렬과 soft-delete 조건에 맞는 후보.
- Notification: unread 존재·count용 partial index 후보.
- Sharing: 실제 recipient·active grant 조회 형태 확정 후 검토.
- 기존 membership, post child, diary media, growthbook order index는 재사용.

RLS 조건의 index와 반복 평가 비용도 함께 봐야 합니다. 사용자 ID처럼 문장 내에서 고정된 값의 평가 최적화는 후보지만, 행별로 달라지는 권한 함수를 기계적으로 같은 방식으로 바꾸면 안 됩니다. [Supabase RLS 지침](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 8. Server / Operations

### Supabase·RLS

권한의 기준은 관계 이름이 아니라 capability여야 합니다.

| 주체 | 권장 기본 범위 |
|---|---|
| 관리자 | 해당 아기의 구성원·공유 관리 및 허용된 콘텐츠 관리 |
| 가족 editor | 기록 작성, 본인 작성물 수정이 기본. 타인 수정 허용 여부는 명시적으로 결정 |
| 가족 viewer | 허용 콘텐츠 열람, 댓글 등 별도 capability |
| 친구 | 허용된 published Memories만. Care Logs·Diary·Growthbook 자동 접근 금지 |
| 내니·산후조리사 | 허용 기간·아기·업무 범위 또는 승인된 인수인계 요약만 |
| 탈퇴·철회 사용자 | 관계 기반 신규 조회·번역·URL 발급·알림 차단 |

중앙화는 TypeScript 함수 하나로 SQL 권한이 자동 보장된다는 뜻이 아닙니다. **권한 계약은 하나로 유지하고 UI·서비스·RLS 구현을 동일한 테스트 행렬로 검증**해야 합니다.

추가 개선 후보:

- 부모·자식 테이블의 `baby_id`와 리소스 ID 일치 검증
- 작성자·아기 ID의 부적절한 변경 방지
- Memories의 일반 독자는 `published`만 허용하고 작성자는 초안 조회 허용
- `selected_people`·태그 기반 grant의 관계 종료 후 유지 여부 명시
- 공개 범위와 수신자 목록 변경을 하나의 트랜잭션으로 처리
- 프로필의 가족 표시 정보와 생년월일·개인 설정 분리

현재 프로필은 공유 관계에 따라 행을 읽을 수 있고 테이블 단위 SELECT 권한도 있습니다. UI가 필요한 컬럼만 요청하는 것으로 민감 컬럼 접근이 차단되지는 않습니다.

### Storage

유지할 private bucket:

- `diary-media`
- `memories`
- `growth-book-media`
- `profile-media`
- `baby-stickers`

권장 업로드 lifecycle:

1. 업로드 세션에 계정·아기·소유자·만료 시각을 부여.
2. 임시 객체는 세션 소유자에게만 허용.
3. 부모 리소스에 연결하는 finalize 단계에서 권한 검증.
4. 연결된 객체는 부모 콘텐츠의 권한을 적용.
5. 미연결 만료 객체는 서버 정리 작업으로 처리.

현재 temp 경로는 게시물에 연결된 뒤에도 그대로 사용됩니다. 따라서 경로가 temp라는 이유만으로 넓은 editor 예외를 유지하면 안 됩니다.

또한 `cleanup_orphan_temp_media()`는 현재 SQL로 `storage.objects`를 직접 삭제합니다. Supabase Storage에서 이 테이블은 메타데이터이므로, 실제 파일 삭제는 Storage API로 수행해야 합니다. 지금 방식은 파일 bytes가 남는 문제를 만들 수 있습니다. 해당 함수의 authenticated 호출 권한과 범위도 함께 재검토해야 합니다. [현재 정리 함수](../../supabase/migrations/202608180001_eager_media_uploads.sql) — 237행 부근, [Supabase Storage 지침](https://supabase.com/docs/guides/storage/schema/design)

Signed URL의 짧은 만료만으로 즉시 권한 회수를 보장해서도 안 됩니다. CDN·기기 캐시와 이미 내려받은 파일은 별개입니다. 철회 시 신규 접근을 차단하고 앱 캐시를 비우되, 민감한 인수인계 자료는 필요하면 요청마다 인증하는 전달 경로를 검토해야 합니다. [Supabase CDN 설명](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

### Edge Functions

배포 함수를 무작정 늘리기보다 내부를 다음 책임으로 분리합니다.

- 인증·입력 검증
- 원본 이벤트 확인
- 수신자 권한 계산
- locale·알림 설정 해결
- inbox 저장
- delivery 작업 생성
- push provider adapter
- receipt·재시도 처리

`process-care-reminders`의 claim/version 검사와 늦은 기록 변경 방어는 유지합니다.

일반 push는 클라이언트가 원하는 이벤트 이름을 보내는 API보다 **서버에 저장된 업무 이벤트를 처리하는 API**로 이동해야 합니다.

### Push 상태

현재 Expo ticket 성공을 앱의 `sent`처럼 처리합니다. 장기적으로 다음을 구분해야 합니다.

- 작업 생성
- provider 접수
- provider 전달 결과 확인
- 실패·재시도 종료
- 사용자 읽음

Expo의 성공 ticket은 사용자 기기 수신 확인이 아닙니다. ticket ID를 저장하고 receipt를 확인해야 하며, receipt도 사용자가 읽었다는 증거는 아닙니다. [Expo 공식 문서](https://docs.expo.dev/push-notifications/sending-notifications/)

전달은 재시도 가능한 구조로 만들되, 외부 push까지 정확히 한 번만 도착한다고 보장하지 않습니다. 업무 이벤트와 앱 알림함은 고유 키로 중복을 막고 기기별 delivery를 추적합니다.

### Delete-account

현재 코드의 좋은 점은 혼자 속한 아기와 공동 관리 중인 아기를 구분하려는 것입니다.

보강할 부분:

- `profile-media`, `baby-stickers`, 미연결 temp까지 삭제 대상 inventory 포함
- 1회 조회 상한을 넘는 미디어 처리
- 공유 콘텐츠의 작성자 JSON 안 식별자까지 익명화 검토
- 마지막 관리자·구성원 변경과 삭제 작업의 경쟁 상태 방어
- 중간 실패 후 재개 가능한 단계별 job
- Auth 삭제 이후에도 작업을 완료할 수 있는 서버 소유 cleanup 상태
- 사용자에게 공유 데이터 보존·개인 데이터 삭제 범위 명확히 안내

삭제는 일반 CRUD 리팩토링과 묶지 않는 별도 고위험 작업입니다.

### Cron·Vault·QA/prod

- cron은 승인된 스케줄러 하나가 작업을 깨우도록 유지.
- cron secret과 앱 인증 토큰을 분리.
- 현재 custom cron header와 Vault–Edge secret 연결을 운영 계약에 기록.
- secret rotation은 발급→양쪽 갱신→검증→구값 폐기의 절차로 수행.
- 로그에는 토큰·음성 원문·일기 본문을 기본적으로 남기지 않음.
- QA는 별도 프로젝트·합성 데이터·테스트 수신자 사용.
- `EXPO_PUBLIC_*`와 클라이언트 feature flag는 비밀·서버 권한 제어에 사용하지 않음.
- AI·공유 자동 생성에는 서버 측 중지 스위치와 비용 제한 필요.

운영 manifest의 마지막 읽기 전용 확인은 **2026-08-28**입니다. 문서에는 로컬 shared runtime 변경이 당시 운영에 배포되지 않았다고 적혀 있습니다. 따라서 현재 코드 hash와 배포본 일치 여부는 다음 승인된 운영 점검에서 다시 확인해야 합니다. [Production Manifest](../operations/PRODUCTION-DEPLOYMENT-MANIFEST.md)

필수 runbook은 배포·롤백, secret rotation, cron 지연, push 오발송, 권한 철회, 미디어 정리, 계정 삭제 재개, AI 품질 사고·생성 중지입니다.

---

## 9. Notification / Sharing Design

### 공통 규칙

- **Locale:** 수신자 본인이 설정한 아기별 언어 override → 사용자 `preferred_language` → 제품 기본 언어.
- **권한:** 이벤트 생성 시뿐 아니라 발송·열람·번역 시에도 재확인.
- **Self exclusion:** 사용자 행동에 따른 알림은 actor 제외가 기본. 개인 reminder·본인이 요청한 결과 완료 알림은 예외.
- **Quiet hours:** inbox는 남기고 push만 보류 또는 만료. 긴급 의료 알림으로 취급하지 않음.
- **Deep link:** 타입이 정해진 리소스 참조만 저장. 현재 아기와 다르면 허용 여부 확인 후 전환.
- **Fallback:** 삭제·철회·기능 비공개 상태면 안전한 알림함 또는 접근 종료 화면으로 이동.
- **저장 title/body:** 이벤트 의미가 있는 locale snapshot과 template key·안전한 params.
- **Push title/body:** 미리보기 비허용이면 “Darin / 새 알림이 있어요”처럼 별도 일반 문구. 앱 내부 본문까지 덮어쓰지 않음.

현재 `show_preview=false`에서 연결 테스트 문구를 사용하는 부분은 수정 대상입니다.

### 이벤트별 계약

| Event type 후보 | Recipient / 본인 제외 | Deep link / fallback | Quiet hours·dedupe |
|---|---|---|---|
| `family_invite_requested`, `family_invite_resolved` | 지정 초대 대상·요청자 / actor 제외 | 초대 요청 ID / 처리됨·만료 화면 | 조용한 시간 뒤 유효할 때만 발송. 요청 ID+상태 버전+수신자 |
| `friend_invite_requested`, `friend_invite_resolved` | 지정 친구·요청자 / actor 제외 | 친구 요청 / 친구 목록 | 가족 초대와 동일, 가족 권한 부여 금지 |
| `memory_comment`, `memory_reaction`, growthbook 댓글 | 해당 콘텐츠를 볼 수 있는 작성자·구독자 / actor 제외 | 게시물·댓글·페이지 / 접근 불가 안내 | 댓글 ID 또는 반응 이벤트 ID+수신자. 반응 묶음 가능 |
| `diary_reminder` | opt-in 사용자 / 본인 제외 없음 | 대상 날짜의 작성 화면 / 일기 목록 | 사용자 시간 준수. 사용자+아기+현지 날짜+schedule version |
| `feeding_reminder`, `sleep_reminder` | 설정한 활성 돌봄 사용자 / actor 제외 없음 | 해당 아기의 기록·설정 / 홈 | quiet 종료 후 여전히 유효한지 재계산. 기존 state/version dedupe 유지 |
| `ai_summary_ready` | 요청자 또는 구독한 허용 사용자 / 요청자 포함 가능 | artifact ID / 리포트 | 성공·검증 완료 후만. artifact version+수신자 |
| `family_briefing_ready` | 공유 승인에 포함된 가족 / 발신자 제외 | share summary / 공유 종료 화면 | 만료 전 보류, summary version+수신자 |
| `handoff_ready` | 지정 내니·산후조리사·교대 보호자 / 발신자 제외 | 제한된 handoff / 접근 종료 화면 | 교대 시각·수신 설정 적용, handoff version+수신자 |

### 저장 문구·push·QA

| 유형 | 저장 title/body 예시 | Push 미리보기 허용 시 | 핵심 QA |
|---|---|---|---|
| 가족 초대 | “가족 초대 / 새로운 초대 요청이 있어요” | 동일한 최소 정보 | 다른 아기, 만료·취소·재응답, 자기 알림 |
| 친구 초대 | “친구 요청 / 추억을 함께 볼 친구 요청이 있어요” | 동일 | 승인 후 Care Logs 접근이 생기지 않는지 |
| 댓글·반응 | “새 댓글 / 공유한 추억에 댓글이 달렸어요” | 기본은 본문 미노출 | `only_me`·선택 공유, 삭제된 댓글, actor 위조 |
| 일기 reminder | “오늘의 일기 / 오늘 기록을 일기로 남겨보세요” | 동일 | 로컬·서버 중복, 언어 변경, 날짜·timezone |
| 수유·수면 reminder | “기록 알림 / 설정한 기록 알림 시간이 되었어요” | 동일 | 새 기록 직후 취소, quiet hours, interval 변경 |
| AI 요약 | “하루 요약 / 기록으로 만든 요약이 준비됐어요” | 원문 수치 미노출 기본 | 실패·불완전 생성에서는 알림 없음 |
| 가족 briefing | “가족 요약 / 공유된 기록 요약이 있어요” | 상세 내용 미노출 기본 | 비공개 일기 혼입, 수신자 변경 |
| Handoff | “인수인계 / 전달받은 기록 요약이 있어요” | 상세 내용 미노출 기본 | 근무 종료·철회·교대 중복·대상 언어 |

AI 요약 이벤트 이름이나 문구가 현재 코드에 있다는 것과, 실제 생성·예약 발송 흐름이 구현됐다는 것은 다릅니다. 후자는 별도 usecase로 설계해야 합니다.

---

## 10. Multilingual AI Design

### Language source of truth

- 사용자 기본 UI 언어: `profiles.preferred_language`.
- 기기 자동 언어: 앱에서 해석한 실제 지원 locale를 서버와 동기화.
- 아기별 콘텐츠 수신 언어: 필요하면 사용자 본인이 선택하는 override 추가.
- 가족 관리자나 발신자가 상대 언어를 추정해 덮어쓰지 않음.
- 내니라는 역할과 영어라는 언어를 연결하지 않음.
- 책 언어는 소유자의 UI 언어가 아니라 **책 단위 설정**으로 고정.

현재 preferred language 동기화는 실패 후 재시도 계약이 약하므로, 마지막 성공 상태와 재시도를 분리하는 것이 좋습니다.

### Stored content와 번역의 경계

| 대상 | 기준 원본 | 표시 |
|---|---|---|
| Care Logs | 구조화 수치·시간·사용자 원문 | label만 UI 번역, 원문 메모 번역은 별도 |
| AI 하루 요약 | 같은 사실 snapshot | locale별 생성·번역 버전 |
| Diary·Memories | 사용자 승인 원문 | 원문 보기와 번역 보기 |
| 댓글 | 작성자의 원문·언어 | 요청 시 번역, 원문 수정 시 stale 처리 |
| 공유 요약 | 승인된 범위·원본 버전 | 수신자 locale별 번역 |
| Growthbook | 책의 편집 언어와 승인 문장 | 다른 언어는 별도 책 버전·미리보기 |
| Notification | event/template/params + 발송 locale snapshot | inbox 표시와 push 미리보기 구분 |

현재 일기 summary 문자열을 언어별 정규식으로 다시 읽어 숫자를 복원하는 방식은 장기적으로 없애는 편이 좋습니다. **집계 JSON을 저장하고 표시 시 문장을 만드는 방식**으로 바꾸되, 기존 일기의 고정 snapshot은 보존합니다.

### 생성·번역 흐름

1. 사용자 권한으로 원본을 선택.
2. 사실·기간 snapshot 확정.
3. source version fingerprint 계산.
4. 같은 원본·대상 locale·정책 버전의 결과가 있으면 재사용.
5. 없으면 번역·문장화.
6. 숫자·단위·부정·이름 검증.
7. 원문과 번역을 함께 저장.
8. 열람 시 권한 재확인.

혼합 언어 기록은 전체를 한 언어라고 강제로 가정하지 않습니다. 원문을 보존하고 이름·제품명·수치·단위를 보호하며 필요한 부분만 번역합니다.

Fallback은 UI와 생성 콘텐츠를 구분합니다.

- UI: 현재 영어 fallback 등 기존 동작을 유지하면서 공통 정책으로 문서화.
- AI: 요청 언어 생성 실패 시 해당 언어의 규칙 문장 또는 “원문 보기”.
- 번역: 실패를 숨기고 다른 언어로 번역 성공처럼 표시하지 않음.
- 서버 알림: 기기 언어를 알 수 없으면 확정된 프로필 언어·제품 기본 언어 사용.

---

## 11. Refactor Plan / Build Roadmap

### Phase 0 — 지금 당장 위험 제거

- **Scope:** B0.1 AI 캐시 격리 → B0.2 저장 확인·초안 복구·음성 scope → B0.3 AI 제품 정책 → B0.4 권한·Storage·이벤트 검증.
- **Files:** `BabyReportScreen`, narrative/insight cache, `BabyLogContext`, `DiaryScreen`, `VoiceRecordingContext`, AI prompt/validator, 권한 타입, 관련 SQL·Edge.
- **QA:** 아기·계정 교체, 늦은 응답, 저장 실패, 본인/타인 수정, private/temp 사진, 위조 이벤트, 5개 언어 안전 문장.
- **User-visible:** 잘못된 문장·거짓 저장 성공·오발송 감소. 상담 표현 변경.
- **Migration:** B0.1~3은 원칙적으로 없음. B0.4 서버 정책 수정은 별도 승인 후 필요.
- **Risk:** 클라이언트 중간, 서버 높음.
- **Rollback:** 캐시 version 폐기·기능 중지·이전 안전 구현 복귀. 취약 정책을 그대로 복원하는 rollback은 금지.
- **담당:** Sol 구현, Astra 계약·정책 검토, Human 권한 결정·서버 변경 승인.

서버 보안 수정은 Phase 3까지 미루지 않습니다. Phase 3은 그 뒤 운영 구조를 정리하는 단계입니다.

### Phase 1 — 안전한 구조 정리

- **Scope:** 기록 확정·일기 저장 usecase 추출, 조회 DTO·공통 cache scope, unread·Diary 목록·export 최적화.
- **Files:** context 서비스, repositories, 관련 hooks, `services/`, `permissions/`.
- **QA:** 기존 history contract, 이관 데이터, 오프라인·부분 조회, export 상한, 친구 전용 화면.
- **User-visible:** 저장 상태 명확화, 초기 로딩 개선. 큰 UI 변화 없음.
- **Migration:** 대부분 없음. index·RPC는 필요성이 증명된 것만 별도.
- **Risk:** 중간.
- **Rollback:** 기존 provider 인터페이스를 adapter로 유지, 기능별 전환. 두 저장 경로를 동시에 권위자로 만들지 않음.
- **담당:** Sol 구현, Astra 경계 리뷰, Human 회귀 확인.

### Phase 2 — AI layer 분리

- **Scope:** operation 계약, 서버 policy, structured result, provenance, daily summary·diary draft부터 구현.
- **Files:** `src/ai/`, AI client adapter, daily/diary usecase, 확인된 AI backend.
- **QA:** 근거 없는 사실, 수치 연결, 5언어, 요청 중 권한 철회, 재생성·중복 job·비용 제한.
- **User-visible:** ‘AI 상담’에서 ‘기록으로 만들기’ 중심으로 전환.
- **Migration:** artifact/job/source 저장 모델에 필요.
- **Risk:** 높음.
- **Rollback:** 생성 중지 스위치, 규칙 기반 요약 유지, 이미 승인된 자산 읽기 보존.
- **담당:** Astra AI·데이터 계약, Sol 구현, Human 제품·언어·안전 검수.

### Phase 3 — 서버·알림·공유 구조 정리

- **Scope:** 업무 이벤트 outbox, 수신자 정책, delivery/receipt, 승인형 handoff, 번역, 삭제·미디어 정리 job.
- **Files:** Edge 공통 모듈, notification/sharing usecase, 관련 repositories, 운영 scripts·runbook.
- **QA:** 재시도·부분 실패, 다기기, membership 변경, quiet hours, 초대·공유 만료, 삭제 재개.
- **User-visible:** 신뢰할 수 있는 가족 알림·다국어 인수인계.
- **Migration:** 필요.
- **Risk:** 높음.
- **Rollback:** 구·신 발송 경로 중 하나만 활성화. 이전 전달을 중복 재생하지 않음. 스키마는 확장 후 단계적 전환.
- **담당:** Astra 정책·실패 모델, Sol 구현, Human 운영·개인정보·배포 승인.

### Phase 4 — 대형 리팩토링

- **Scope:** feature 폴더 정리, provider 분리, Growthbook diff/revision 저장, 대형 편집기 정리.
- **Files:** app 조립, screens/components, growthbook/context/repository, i18n catalogs.
- **QA:** 전체 기존 기능, 장기 기록, 대형 책, 동시 편집, PDF·실기기 메모리·레이아웃.
- **User-visible:** 응답성 개선 외 기존 경험 유지가 기본.
- **Migration:** Growthbook revision 등 필요한 부분만.
- **Risk:** 높음.
- **Rollback:** 기능별 adapter·구형 데이터 읽기 유지. 폴더 이동, SDK 업그레이드, 데이터 변경을 같은 Build에 묶지 않음.
- **담당:** Sol 실행, Astra 구조 리뷰, Human 최종 제품 확인.

### 우선순위 요약

**P0**

1. 계정·아기 격리와 저장 실패 복구.
2. RLS·Storage·알림의 실제 권한 일치.
3. 의료 판단 없는 AI 정책과 출력 검증.

**P1**

1. usecase·조회·미디어·알림 공통 계층.
2. 출처가 있는 하루 요약·일기 초안.
3. 예약·재시도 가능한 공유·알림·삭제 운영.

**P2**

1. Growthbook 대형 편집·변경분 저장.
2. 전체 feature 폴더·provider 재편.
3. 유료 생성량·장기 패턴·책 전체 번역 상품 실험.

---

## 12. QA Strategy

### Automated

- 기존 typecheck·history·repository·feature flag 검사를 유지.
- 문자열 패턴 검사에 더해 실제 함수 동작 테스트 추가.
- 동일 계정 아기 A/B, 같은 기기 계정 X/Y 캐시 격리.
- 저장 성공·실패·부분 성공·재시도 상태 전이.
- 숫자·시간·원본 ID·승인 상태 불변식.
- 오래된 응답의 화면 반영 및 캐시 저장 차단.
- 대량 데이터 경계값: 20개 피드에 많은 댓글, 100개 이상 일기, API 반환 상한 이상 export.

### RLS/security

QA 프로젝트에서 UI가 아닌 실제 사용자 JWT로 직접 검증합니다.

- admin/editor/viewer/friend/revoked/stranger
- 아기 A/B
- 본인·타인 작성물
- draft/published/deleted
- family/friend/only-me/selected
- DB row, Storage 원본 경로, signed URL 발급, AI 생성, 번역, notification event

모든 조합을 무작정 곱하기보다 대표 조합을 사용하되, **교차 아기·비공개·철회·작성자 위조 등 거부되어야 하는 경우는 필수 전수 항목**으로 둡니다.

### AI quality·i18n

- 근거 일치, 날짜 범위, 누락 설명, 숫자·단위 정확성
- 의료 판단·정상성·인과 단정 금지
- 원문에 포함된 명령을 시스템 지시로 따르지 않기
- 한국어·영어·일본어·스페인어·중국어 간체
- 혼합 언어·긴 이름·큰 글씨·번역 실패·원문 변경
- 모델·prompt version 변경 전 고정 평가셋 비교
- 코드 검사만이 아니라 원어민 또는 해당 언어 검수 가능한 Human review

### Manual·real device·notification

- iOS/Android 녹음 권한, 통화 중단, 백그라운드, 오프라인, 재시도
- 알림 허용·거부, 다기기·계정 교체, cold-start deep link
- quiet hours·DST·기기 timezone 변경
- push preview 비허용 시 사생활 보호
- 부모가 요약을 확인·수정·공유하는 실제 작업 흐름
- 성장책의 긴 번역문·사진·인쇄 결과

이번 리뷰에서는 live QA scripts를 실행하지 않았습니다. 이름이 QA여도 실제 테스트 데이터 작성·삭제가 포함될 수 있기 때문입니다.

---

## 13. Decisions Needed

1. **Editor 권한:** 기본적으로 본인 기록만 수정할지, 가족 기록 전체 수정을 허용할지. 권고는 현재 UI와 같은 본인 작성물 기준입니다.
2. **전문 돌봄 공유:** 전체 가족 membership을 줄지, 기간·자료가 제한된 handoff grant를 줄지. 권고는 후자입니다.
3. **AI 승인:** 일기·성장책·가족 공유는 항상 승인 후 공개할지. 초기 제품은 승인 필수를 권합니다.
4. **데이터 보관:** 음성 원음·전사 원문·AI 입력 snapshot·번역의 보관 기간과 삭제 정책.
5. **AI backend 소유권:** 현재 `/chat`·`/transcribe` 서버의 위치·운영 책임자·인증·보관 정책 확인. 확인 전 backend 이전을 결정하지 않습니다.
6. **언어 정책:** 기본 fallback, 아기별 수신 언어 override, 책 언어 변경 시 새 버전 여부.
7. **운영 상태 확인:** 승인된 읽기 전용 Supabase 점검으로 migration·함수 배포본·정책·cron의 실제 상태 확인.
8. **상품 정책:** 기본 생성량과 유료 사용량. 가격보다 먼저 승인률·수정률·재사용률·생성당 비용을 측정합니다.

---

## 14. Recommended Next Prompt for Sol

첫 작업은 범위를 작게 유지하는 것이 좋습니다. 아래는 후속 구현 요청용 프롬프트이며, 이 리뷰에서 실행된 작업이 아닙니다.

> Darin의 P0 리포트 AI 캐시 격리를 구현해 주세요.
>
> 이번 범위는 주간 narrative와 insight phrase 캐시뿐입니다. migration 생성, Supabase 변경, Edge 배포, EAS/TestFlight/App Store 작업, 대규모 폴더 이동은 하지 마세요.
>
> 먼저 다음 코드를 읽어 현재 호출·저장 흐름을 확인해 주세요.
>
> - `src/screens/tabs/BabyReportScreen.tsx`
> - `src/utils/weeklyNarrativeStore.ts`
> - `src/utils/insightPhrase.ts`
> - `src/utils/weeklyFeatureTable.ts`
> - 기존 계정·아기 scope 및 storage key 유틸
>
> 요구사항:
>
> 1. 캐시 식별자에 계정 ID, 아기 ID, 연도를 포함한 전체 날짜 범위, locale, 입력 사실 fingerprint, prompt/schema version을 포함합니다.
> 2. 이전 scope 없는 캐시는 다른 아기에 귀속시키지 않고 안전하게 무효화합니다.
> 3. 아기·계정 변경 후 늦게 도착한 응답이 현재 화면이나 잘못된 캐시에 반영되지 않게 합니다.
> 4. 로그 변경·삭제·동일 기간 재계산에 따라 AI 결과의 재사용 여부가 정확히 결정되게 합니다.
> 5. 렌더링 때마다 API를 호출하지 않도록 안정적인 fingerprint와 동일 요청 중복 방지를 사용합니다.
> 6. 기존 규칙 기반 fallback과 다국어 동작은 유지합니다.
> 7. 기존 무관한 변경은 보존합니다.
>
> 검증:
>
> - 같은 기간·언어의 아기 A→B 전환
> - 같은 기기의 계정 X→Y 전환
> - 같은 아기의 기록 수정·삭제
> - 언어 변경, 연도 변경
> - 요청 진행 중 전환, 실패 후 재시도
> - 동일 입력의 불필요한 재생성 방지
> - typecheck 및 기존 관련 정적 검사
>
> 결과 보고에는 변경 파일, 추가한 동작 테스트, 통과·미실행 항목, 남은 위험을 적어 주세요. 다른 P0 문제는 이번 작업에 섞지 말고 후속 목록으로 남겨 주세요.

---

전체 방향을 한 문장으로 정리하면, **“기록은 확실하게 저장하고, AI 결과는 근거와 승인 이력을 가진 자산으로 만들며, 공유는 원본보다 넓어지지 않게 관리한다”**입니다.
