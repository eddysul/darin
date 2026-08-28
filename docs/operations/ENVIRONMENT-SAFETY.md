# Environment safety

## 역할 분리

| 위치 | 허용 값 | 금지 값 |
|---|---|---|
| `.env`, EAS app environment | `EXPO_PUBLIC_SUPABASE_URL`, publishable key, client feature/auth flags | secret/service-role key, DB password, access token, cron secret |
| `.env.qa` (local-only) | QA public 값과 QA 자동화에 필요한 server 값 | production project 값 |
| `.env.production-backend` (local-only) | 승인된 production 배포/감사용 server 값 | `EXPO_PUBLIC_*` 앱 설정 |
| Edge Function secrets | service-role key, function 전용 secret | client bundle에 필요한 값 |
| Supabase Vault | scheduler가 읽는 `project_url`, `care_reminder_cron_secret` | client credential |

`.env*`는 `.env.example`을 제외하고 Git과 EAS archive에서 모두 제외한다. 일반 `.env`는 개발 앱 전용이며 production backend credential 보관소로 사용하지 않는다.

`pnpm start`, `pnpm ios`, `pnpm android`, `pnpm web`은 `.env`를 자동 로드하지 않는다. wrapper가 `.env.qa`에서 `EXPO_PUBLIC_*`만 골라 QA project ref를 확인한 뒤 Expo를 실행하며 server-only 변수는 child process에서 제거한다.

## Build guard

`scripts/verify-build-environment.mjs`는 EAS pre-install에서 다음을 강제한다.

- `production` profile은 production Supabase ref와 production feature profile만 허용
- `qa` profile은 QA Supabase ref와 internal feature profile만 허용
- production에서는 internal feature allowlist 금지
- 모든 app build에서 server-only secret 유입 금지
- secret처럼 보이는 `EXPO_PUBLIC_*` 변수 금지

로컬 smoke test는 `pnpm qa:build-environment`로 실행한다.

## Supabase CLI

`supabase/.temp` 링크는 로컬 상태일 뿐 배포 기준이 아니다. 변경 명령은 항상 `--project-ref`를 명시하고, QA/production 전용 wrapper가 예상 ref를 재검증해야 한다. production-linked CLI 상태에서 일반 `supabase db push` 또는 project-ref 없는 Function 배포를 실행하지 않는다.
