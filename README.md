# Darin — Childcare Management App

AI 돌봄 커뮤니케이션 앱 **React Native (Expo)** 프로토타입입니다.

## Running the app

```bash
pnpm install
pnpm start
```

- **iOS 시뮬레이터:** 터미널에서 `i` 키 또는 `pnpm ios`
- **Android 에뮬레이터:** `a` 키 또는 `pnpm run android`
- **실기기:** Expo Go 앱으로 QR 코드 스캔

```bash
pnpm run typecheck
pnpm server:dh          # dh FastAPI (별 터미널)
pnpm run verify:ai-events
pnpm run verify:ai-reports
```

## 문서

| 파일 | 설명 |
|------|------|
| [work.md](./work.md) | 기능·구조·API·데모 시나리오 (메인 작업 문서) |
| [docs/main-joon-diff.md](./docs/main-joon-diff.md) | main vs Joon 브랜치 비교 노트 |

## 프로젝트 구조 (요약)

```
src/           # RN 메인 앱
src/app/       # Web 레거시 프로토타입
scripts/       # AI 검증 스크립트
legacy/web/    # 미사용 web scaffold
docs/          # 브랜치 비교 등 참고 문서
```

자세한 내용은 [work.md](./work.md)를 참고하세요.
