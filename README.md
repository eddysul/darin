# Darin / K-Nanny — Childcare Management App

육아 기록(Care Log) · 일기 · 성장책 · 리포트 · AI 상담 MVP입니다.  
**Expo React Native** 단일 코드베이스 (`src/`)입니다. Care Log vertical slice는 Supabase에 연결 중이며, 일기·성장책·결제는 아직 로컬입니다.

- **GitHub:** https://github.com/whwan4570/Darin_Log-
- **작업 브랜치:** `joon-safe-port-main-features`

## 실행

```bash
pnpm install
pnpm start          # 또는 pnpm ios / pnpm android
pnpm typecheck
pnpm qa:mvp
```

환경 변수는 `.env.example`을 참고하세요. `.env` 변경 후 Metro를 재시작합니다.

Supabase 1차 스키마: `supabase/migrations/202607250001_care_logs_slice.sql`  
(대시보드 SQL Editor에 적용 + Auth > Anonymous sign-ins 활성화)

## 앱 구성 (탭)

| 탭 | 화면 | 역할 |
|----|------|------|
| 기록 | `RecordScreen` | 원터치·빠른 기록, 롱프레스 타이머/상세, 음성, 오늘 요약·타임라인 |
| 일기 | `DiaryScreen` | 육아일기, 알림, 성장책 담기 |
| 리포트 | `BabyReportScreen` | 오늘 요약·주간 트렌드 |
| 상담 | `ConsultScreen` | Care Log/일기 컨텍스트 기반 AI |
| 메뉴 | `MenuScreen` | 성장책·스티커·가족·설정 진입 |

## 문서

자세한 내용은 [docs/README.md](./docs/README.md)를 보세요.

| 문서 | 설명 |
|------|------|
| [발표 시나리오](./docs/demo/MVP-발표-시나리오.md) | 데모 고정 플로우 |
| [데이터 모델](./docs/product/MVP-데이터-모델.md) | 엔터티·저장 키 |
| [MVP 이후 범위](./docs/product/MVP-이후-범위.md) | 후속 기능 |
| [육아일기 확정안](./docs/product/decisions/육아일기-MVP-기능-확정안.md) | 일기·성장책 결정 |
| [전체 QA](./docs/qa/MVP-전체-QA.md) | 검증 체크리스트 |

레거시(마켓플레이스·브랜치 diff)는 [docs/archive/](./docs/archive/)에 보관합니다.

## 프로젝트 구조 (요약)

```text
App.tsx
src/
  screens/          # 스플래시·로그인·온보딩·MainTabs
  screens/tabs/     # 기록·일기·리포트·상담·메뉴
  components/babylog/
  context/          # BabyLog · App · Voice 등
  types/ · utils/   # 모델·AsyncStorage·집계·타이머
scripts/            # MVP QA 스모크
docs/               # 제품·데모·QA 문서
```
