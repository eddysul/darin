# Darin / K-Nanny — 문서

Expo React Native 육아 기록 MVP 문서입니다.  
제품 기준선은 `product/` · 발표는 `demo/` · 검증은 `qa/`에 둡니다.

## 문서 맵

| 경로 | 용도 |
|------|------|
| [demo/MVP-발표-시나리오.md](./demo/MVP-발표-시나리오.md) | 데모·발표 고정 플로우 |
| [product/MVP-데이터-모델.md](./product/MVP-데이터-모델.md) | CareLog / Diary / 성장책 / 가족 등 엔터티 |
| [product/MVP-이후-범위.md](./product/MVP-이후-범위.md) | 데모에서 약속하지 않을 후속 범위 |
| [product/decisions/육아일기-MVP-기능-확정안.md](./product/decisions/육아일기-MVP-기능-확정안.md) | 육아일기·성장책 기능 확정 |
| [qa/MVP-전체-QA.md](./qa/MVP-전체-QA.md) | QA 판정·스모크·회귀 체크리스트 |
| [operations/ENVIRONMENT-SAFETY.md](./operations/ENVIRONMENT-SAFETY.md) | QA/production 환경과 credential 경계 |
| [operations/PRODUCTION-DEPLOYMENT-MANIFEST.md](./operations/PRODUCTION-DEPLOYMENT-MANIFEST.md) | production migration/Function/cron 상태 |
| [architecture/REFACTORING-ROADMAP.md](./architecture/REFACTORING-ROADMAP.md) | 아키텍처 정리 단계와 release gate |
| [architecture/CARE-LOG-HISTORY-CONTRACT.md](./architecture/CARE-LOG-HISTORY-CONTRACT.md) | CareLog full/window/cache 권위 계약 |
| [architecture/QUERY-OPTIMIZATION-AUDIT.md](./architecture/QUERY-OPTIMIZATION-AUDIT.md) | query 축소·pagination·index 보류 근거 |
| [archive/](./archive/) | 레거시·브랜치 비교 등 참고용 (현재 제품 기준 아님) |

## 코드 인덱스

- 저장 키: `src/utils/storageKeys.ts`
- QA 스모크: `pnpm qa:mvp`
