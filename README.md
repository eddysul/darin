# Darin

Darin은 가족이 아기의 돌봄 기록, 일기, 성장 기록, 추억과 알림을 공유하는 Expo React Native 앱입니다. 앱 데이터는 Supabase Auth, PostgreSQL, Storage, Edge Functions를 사용합니다.

## 로컬 실행

```bash
pnpm install
pnpm start
pnpm typecheck
pnpm qa:mvp
```

`.env.example`을 복사해 로컬 앱 환경을 구성합니다. 일반 `.env`에는 client에서 사용하는 `EXPO_PUBLIC_*` 값만 둡니다. `SUPABASE_SECRET_KEY`, service-role key, DB password, Supabase access token, cron secret은 앱 환경에 넣지 않습니다.

QA와 production은 서로 다른 Supabase 프로젝트를 사용합니다. EAS 빌드는 `scripts/verify-build-environment.mjs`에서 build profile, feature profile, Supabase project ref, server secret 유입 여부를 검사하고 불일치하면 중단합니다.

## 주요 구조

```text
App.tsx                         # 앱 provider와 최상위 navigation 조립
src/components/                 # 재사용 UI
src/context/                    # 앱/아기/기록 상태 orchestration
src/repositories/               # Supabase 및 로컬 데이터 접근
src/screens/                    # 화면과 navigation entry
src/config/featureFlags.ts      # 기능 상태와 dependency의 단일 원장
supabase/migrations/            # 순서가 보존되는 DB 변경 이력
supabase/functions/             # Edge Functions
scripts/                        # 정적/통합 QA와 배포 guard
docs/                           # 제품, QA, 운영 문서
```

## 릴리스 검증

```bash
pnpm typecheck
pnpm qa:build-version
pnpm qa:build-environment
pnpm qa:feature-flags
pnpm qa:i18n:release
pnpm qa:mvp
pnpm qa:secrets
```

Supabase 연동 QA는 반드시 `.env.qa`와 QA guard를 통과한 명령만 사용합니다. production 배포 상태는 [production deployment manifest](./docs/operations/PRODUCTION-DEPLOYMENT-MANIFEST.md), 전체 문서 인덱스는 [docs/README.md](./docs/README.md)를 확인하세요.
