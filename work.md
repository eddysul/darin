# Darin (Childcare Management App) — 작업 문서

**다린(Darin)** AI 돌봄 커뮤니케이션 앱 UI입니다.  
모바일 폰 목업 형태의 React 프로토타입이며, 실제 백엔드·SMS·OAuth 연동은 없습니다.

- **GitHub:** https://github.com/eddysul/darin

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 | Vite 6 |
| 스타일 | Tailwind CSS 4, CSS Variables (`theme.css`) |
| UI 컴포넌트 | shadcn/ui (Radix UI 기반) |
| 아이콘 | lucide-react |
| 애니메이션 | motion (Framer Motion) |
| 패키지 매니저 | pnpm |

---

## 프로젝트 구조

```
Childcare Management App/
├── public/
│   └── darin-logo.png          # 스플래시·로그인용 Darin 로고
├── src/
│   ├── main.tsx                # 앱 진입점
│   ├── app/
│   │   ├── App.tsx             # 메인 앱 (탭, 폰 프레임, phase 관리)
│   │   ├── i18n.ts             # 한/영 번역 및 콘텐츠 데이터
│   │   ├── LanguageContext.tsx # 전역 언어 상태 (Context)
│   │   └── components/
│   │       ├── SplashScreen.tsx      # 시작 화면
│   │       ├── LoginScreen.tsx       # 로그인 / 회원가입
│   │       ├── LanguagePicker.tsx    # 언어 선택 모달
│   │       ├── ProfileEditModal.tsx  # 프로필 수정 모달
│   │       ├── figma/                # 이미지 fallback 유틸
│   │       └── ui/                   # shadcn UI 컴포넌트 모음
│   └── styles/
│       ├── index.css
│       ├── theme.css           # 컬러·디자인 토큰
│       ├── tailwind.css
│       └── fonts.css
├── index.html
├── package.json
├── vite.config.ts
├── pnpm-workspace.yaml
└── work.md                     # 이 문서
```

---

## 앱 실행 흐름 (App Phase)

`App.tsx`에서 `phase` 상태로 화면을 전환합니다.

```
splash  →  login  →  main
(스플래시)   (로그인)   (메인 앱)
```

| Phase | 컴포넌트 | 설명 |
|-------|----------|------|
| `splash` | `SplashScreen` | Darin 로고 표시, 약 2.6초 후 자동 전환 |
| `login` | `LoginScreen` | 로그인 / 회원가입, 소셜 로그인 UI |
| `main` | `App.tsx` 내부 탭 | 홈·리포트·기록·찾기·프로필 |

---

## 시작 화면 (SplashScreen)

- 흰 배경 + 중앙 `darin-logo.png`
- 페이드인 애니메이션
- 타이머 종료 후 로그인 화면으로 이동

---

## 로그인 / 회원가입 (LoginScreen)

### 로그인 모드
- 이메일 · 비밀번호 입력
- **Log in** 버튼
- **Forgot password?** (UI만, 동작 없음)
- **Continue with Google / Apple** (프로토타입: 클릭 시 메인 앱 진입)
- 하단 **Sign up** 링크 → 회원가입 모드 전환

### 회원가입 모드
| 필드 | 설명 |
|------|------|
| 이름 | Full name (필수) |
| 전화번호 | 국가 코드 선택 + 번호 입력 (필수) |
| 이메일 | 필수 |
| 비밀번호 / 확인 | 필수, 불일치 시 오류 |
| 인증번호 | SMS 시뮬레이션 (프로토타입) |

### 전화번호 인증 흐름
1. 국가 코드 선택 (기본: 🇺🇸 **+1**)
2. 번호 입력 (US 예시: `(555) 123-4567`)
3. **인증번호 받기** → 6자리 코드 생성 (Demo code 화면 표시)
4. **인증하기** → 성공 시 "전화번호 인증 완료"
5. 인증 완료 후에만 **회원가입** 버튼 활성화
6. 재전송 60초 쿨다운

### 지원 국가 코드
- +1 US, +82 KR, +81 JP, +44 UK, +86 CN

---

## 메인 앱 (5탭)

폰 프레임(390×844) 안에서 하단 탭으로 전환합니다.

### 1. Home (홈)
- 사용자 인사 (`Jisoo 👋` — 프로필 이름 연동)
- 오늘 돌보미 상태 (Emma · Ji-yeon Park)
- **Today's Report** — AI 번역된 일일 리포트
- **Quick Actions** — 메시지, 픽업, 번역, 기록
- **AI Draft Reply** — 부모→돌보미 추천 답장 초안

### 2. Reports (리포트)
- Emma 돌봄 기록 타임라인
- 날짜별 리포트 카드 (식사·수면·활동 등)
- 펼치면 상세 요약 + 건강 노트

### 3. Log (기록)
- **Voice Note** — 녹음 UI (시뮬레이션)
- **Quick Notes** — 텍스트 메모 → AI 리포트 생성
- **Today's Log** — 시간별 활동 기록

### 4. Find (돌봄 찾기)
- 돌보미 검색·필터
- Ji-yeon Park, Sarah Kim, Min-jun Lee 등 카드 목록
- 평점, 거리, 언어, 태그, 요금 표시

### 5. Profile (프로필)
- **프로필 카드** — 이름, 역할, 위치, 언어 배지
  - 우측 상단 **UserCog** 아이콘 → 프로필 수정 모달
- **Children** — Emma 정보
- **Settings**
  - Language Preference → 언어 선택 모달 (한/영)
  - Notifications, Schedule, Care Preferences
  - Settings (세팅), Billing (빌링) — UI만

---

## 다국어 (i18n)

- `LanguageContext` + `i18n.ts`로 앱 전체 UI 한/영 전환
- **Profile → Language Preference**에서 English / 한국어 선택
- 탭 라벨, 화면 문구, 리포트·기록 콘텐츠까지 locale에 맞게 표시
- `createT(locale)` 함수로 번역 키 조회

---

## 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `SplashScreen.tsx` | 앱 시작 로고 화면 |
| `LoginScreen.tsx` | 로그인·회원가입·소셜·전화 인증 |
| `LanguagePicker.tsx` | 언어 선택 팝업 (폰 프레임 중앙) |
| `ProfileEditModal.tsx` | 이름·위치 수정 팝업 |
| `LanguageContext.tsx` | `locale`, `setLocale`, `t()` 제공 |

---

## 상태 관리 (App.tsx)

| 상태 | 설명 |
|------|------|
| `phase` | splash / login / main |
| `activeTab` | home / report / log / match / profile |
| `profile` | 사용자 프로필 (이름, 위치, 아바타) — 홈·프로필 공유 |
| `langPickerOpen` | 언어 선택 모달 |
| `profileEditOpen` | 프로필 수정 모odal |

---

## 디자인 토큰 (theme.css)

앱 기본 팔레트 (코랄/오렌지 계열):

- `--primary`: `#F4845F`
- `--background`: `#FFF8F3`
- `--accent`: `#7CB987`

로그인·스플래시는 Darin 브랜드 네이비/골드 (`#1A2333`, `#C4A574`)를 컴포넌트内 인라인으로 사용.

---

## 로컬 실행

```bash
pnpm install
pnpm run dev
```

브라우저: http://localhost:5173/

macOS에서 `pnpm install` 실패 시 `pnpm-workspace.yaml`의 `allowBuilds` 설정 확인 (esbuild, tailwind oxide).

---

## 프로토타입 한계 (미구현)

- 실제 Google / Apple OAuth
- 실제 SMS 인증 (데모 코드로 대체)
- 백엔드 API / DB
- Settings, Billing, Sign up 링크 등 일부 버튼은 UI만 존재
- 회원가입·로그인 성공 시 별도 검증 없이 메인 앱 진입

---

## 작업 이력 요약

1. 모바일 앱 UI 로컬 실행 환경 구성
2. GitHub (`eddysul/darin`) 푸시
3. Language Preference + 앱 전체 한/영 i18n
4. Profile Settings / Billing 메뉴 추가
5. 프로필 카드 수정 (UserCog → ProfileEditModal)
6. Darin 스플래시 화면
7. 로그인 화면 + Sign up 전환
8. Google / Apple 소셜 로그인 UI
9. 회원가입 전화번호 필수 + 인증번호 UI
10. 국가 코드 선택 + US 번호 placeholder
