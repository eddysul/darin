# Darin (Childcare Management App) — 작업 문서

**다린(Darin)** AI 돌봄 커뮤니케이션 앱 UI입니다.  
모바일 폰 목업 형태의 React 프로토타입이며, 실제 백엔드·SMS·OAuth 연동은 없습니다.

- **GitHub:** https://github.com/eddysul/darin
- **작업 브랜치:** `Joon` (main 직접 푸시 지양)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | **React Native** + Expo 52 + TypeScript |
| 네비게이션 | React Navigation (Bottom Tabs) |
| UI | React Native StyleSheet, expo-linear-gradient |
| 이미지 | expo-image, expo-image-picker |
| 아이콘 | lucide-react-native |
| 상태 | React Context (Language, App) |
| 패키지 매니저 | pnpm |

> 이전 Vite + React Web 버전 코드는 `src/app/`에 남아 있을 수 있으며, 실행에는 사용되지 않습니다.

---

## 프로젝트 구조

```
Childcare Management App/
├── public/
│   └── darin-logo.png          # 스플래시·로그인·파비콘 (투명 PNG)
├── src/
│   ├── main.tsx                # 앱 진입점
│   ├── app/
│   │   ├── App.tsx             # 메인 앱 (탭, 폰 프레임, phase 관리)
│   │   ├── i18n.ts             # 한/영 번역 및 콘텐츠 데이터
│   │   ├── LanguageContext.tsx # 전역 언어 상태 (Context)
│   │   ├── types/
│   │   │   └── profile.ts      # UserProfile, UserRole, CaregiverCertificate
│   │   └── components/
│   │       ├── SplashScreen.tsx      # 시작 화면
│   │       ├── LoginScreen.tsx       # 로그인 / 회원가입
│   │       ├── OnboardingScreen.tsx  # 회원가입 후 프로필 설정
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
splash  →  login  →  onboarding  →  main
(스플래시)   (로그인)   (프로필 설정)   (메인 앱)
                ↑
         회원가입 시에만 onboarding 경유
         로그인·소셜(로그인 모드)은 main으로 바로 진입
```

| Phase | 컴포넌트 | 설명 |
|-------|----------|------|
| `splash` | `SplashScreen` | Darin 로고 표시, 약 2.6초 후 자동 전환 |
| `login` | `LoginScreen` | 로그인 / 회원가입, 소셜 로그인 UI |
| `onboarding` | `OnboardingScreen` | 역할 선택 + 역할별 프로필 설정 (회원가입 후) |
| `main` | `App.tsx` 내부 탭 | 홈·리포트·기록·찾기·프로필 |

### 개발 미리보기 URL (DEV 전용)

쿼리 파라미터로 온보딩 화면을 바로 띄울 수 있습니다.

| URL | 설명 |
|-----|------|
| `?screen=onboarding` | 역할 선택(1단계)부터 시작 |
| `?screen=parent-onboarding` | 부모 프로필 설정(2단계) 바로 표시 |
| `?screen=caregiver-onboarding` | 케어기버 프로필 설정(2단계) 바로 표시 |

예: `http://localhost:5173/?screen=caregiver-onboarding`

---

## 시작 화면 (SplashScreen)

- 흰 배경 + 중앙 `darin-logo.png`
- 로고: 달·엄마·아기 일러스트 + **DARIN** + *Your first motherhood companion*
- 투명 PNG (체크무늬 없음, 흰 배경 위에 표시)
- 페이드인 애니메이션
- 타이머 종료 후 로그인 화면으로 이동

---

## 로그인 / 회원가입 (LoginScreen)

### 로그인 모드
- 이메일 · 비밀번호 입력
- **Log in** 버튼 → 메인 앱 진입
- **Forgot password?** (UI만, 동작 없음)
- **Continue with Google / Apple** → 메인 앱 진입
- 하단 **Sign up** 링크 → 회원가입 모드 전환

### 회원가입 모드
| 필드 | 설명 |
|------|------|
| 이름 | Full name (필수) |
| 전화번호 | 국가 코드 선택 + 번호 입력 (필수) |
| 이메일 | 필수 |
| 비밀번호 / 확인 | 필수, 불일치 시 오류 |
| 인증번호 | SMS 시뮬레이션 (프로토타입) |

- **Sign up** 버튼 → 전화 인증 완료 후 **온보딩** 화면으로 이동
- 회원가입 모드에서는 Google / Apple 버튼 미표시

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

## 온보딩 (OnboardingScreen)

회원가입 완료 후 2단계 프로필 설정입니다.

### 1단계 — 역할 선택
| 역할 | 설명 |
|------|------|
| **부모 / 예비 부모** | 케어기버 찾기, 성장 기록, 가족 돌봄 관리 |
| **케어기버** | 가족 연결, 업데이트 공유, 일정 관리 |

### 2단계 — 공통 필드 (필수)
| 필드 | 설명 |
|------|------|
| 이름 | 필수 |
| 위치 | 필수 |
| 사용 언어 | 필수 |

### 2단계 — 부모 전용 (선택)
| 필드 | 설명 |
|------|------|
| 출산 예정일 | 선택 |
| 아이 이름 | 선택 |

### 2단계 — 케어기버 전용
| 필드 | 필수 | 설명 |
|------|------|------|
| 경력 | — | 선택 |
| 전문 분야 | — | 선택 |
| 면허 번호 | ✅ | 텍스트 입력 |
| 면허증 사진 | ✅ | 이미지 업로드 (미리보기) |
| 기타 증명서 | — | **추가** 버튼으로 항목 추가 (이름 + 사진), **삭제** 가능 |

- 기타 증명서: 이름·사진 중 하나만 입력된 항목이 있으면 완료 불가
- 완료 시 `UserProfile` 저장 후 메인 앱 진입

---

## UserProfile (`types/profile.ts`)

```typescript
type UserRole = "parent" | "caregiver";

type CaregiverCertificate = {
  id: string;
  name: string;
  photo: string;  // base64 data URL (프로토타입)
};

type UserProfile = {
  name: string;
  location: string;
  avatar: string;
  role: UserRole;
  dueDate?: string;
  childName?: string;
  languages?: string;
  experience?: string;
  specialty?: string;
  licenseNumber?: string;
  licensePhoto?: string;
  certificates?: CaregiverCertificate[];
};
```

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
- **프로필 카드** — 이름, 역할(부모/케어기버), 위치, 언어 배지
  - 우측 상단 **UserCog** 아이콘 → 프로필 수정 모달
- **Children** — 부모 역할일 때만 표시 (Emma 정보)
- **전문 정보** — 케어기버일 때 경력·전문 분야·면허·기타 증명서 표시
- **Settings**
  - Language Preference → 언어 선택 모달 (한/영)
  - Notifications, Schedule, Care Preferences
  - Settings (세팅), Billing (빌링) — UI만

---

## 다국어 (i18n)

- `LanguageContext` + `i18n.ts`로 앱 전체 UI 한/영 전환
- **Profile → Language Preference**에서 English / 한국어 선택
- 탭 라벨, 화면 문구, 온보딩·리포트·기록 콘텐츠까지 locale에 맞게 표시
- `createT(locale)` 함수로 번역 키 조회

---

## 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `SplashScreen.tsx` | 앱 시작 로고 화면 |
| `LoginScreen.tsx` | 로그인·회원가입·전화 인증 |
| `OnboardingScreen.tsx` | 역할 선택 + 역할별 프로필·면허·증명서 설정 |
| `LanguagePicker.tsx` | 언어 선택 팝업 (폰 프레임 중앙) |
| `ProfileEditModal.tsx` | 이름·위치 수정 팝업 |
| `types/profile.ts` | 프로필·역할·증명서 타입 정의 |
| `LanguageContext.tsx` | `locale`, `setLocale`, `t()` 제공 |

---

## 상태 관리 (App.tsx)

| 상태 | 설명 |
|------|------|
| `phase` | splash / login / onboarding / main |
| `activeTab` | home / report / log / match / profile |
| `profile` | `UserProfile` — 홈·프로필 공유 (역할·면허·증명서 포함) |
| `langPickerOpen` | 언어 선택 모달 |
| `profileEditOpen` | 프로필 수정 모달 |

---

## 디자인 토큰 (theme.css)

앱 기본 팔레트 (코랄/오렌지 계열):

- `--primary`: `#F4845F`
- `--background`: `#FFF8F3`
- `--accent`: `#7CB987`
- `--chart-3`: `#F4B860` (골드 계열)

로그인·온보딩은 Darin 브랜드 네이비 (`#1A2333`)를 컴포넌트内 인라인으로 사용.  
로고 A 안 스타는 골드 액센트.

---

## 로컬 실행

```bash
pnpm install
pnpm start
```

Expo Dev Tools에서 iOS/Android/실기기로 실행합니다.

```bash
pnpm run ios
pnpm run android
pnpm run typecheck
```

---

## 프로토타입 한계 (미구현)

- 실제 Google / Apple OAuth
- 실제 SMS 인증 (데모 코드로 대체)
- 백엔드 API / DB
- 업로드 이미지는 base64로만 저장 (서버 업로드 없음)
- Settings, Billing, Forgot password 등 일부 버튼은 UI만 존재
- 로그인 성공 시 별도 검증 없이 메인 앱 진입
- 프로필 수정 모달은 이름·위치만 변경 (면허·증명서 수정 UI 없음)

---

## 작업 이력 요약

1. 모바일 앱 UI 로컬 실행 환경 구성
2. GitHub (`eddysul/darin`) 푸시 — 작업 브랜치 `Joon`
3. Language Preference + 앱 전체 한/영 i18n
4. Profile Settings / Billing 메뉴 추가
5. 프로필 카드 수정 (UserCog → ProfileEditModal)
6. Darin 스플래시 화면
7. 로그인 화면 + Sign up 전환
8. Google / Apple 소셜 로그인 UI (로그인 모드)
9. 회원가입 전화번호 필수 + 인증번호 UI
10. 국가 코드 선택 + US 번호 placeholder
11. 회원가입 → 온보딩 → 메인 플로우
12. 역할 선택 (부모/예비 부모 · 케어기버) + 역할별 프로필 설정
13. 케어기버 면허 번호·면허증 사진 (필수) + 기타 증명서 추가/삭제
14. Darin 브랜드 로고 교체 (투명 PNG, *Your first motherhood companion*)
15. DEV 온보딩 미리보기 URL (`?screen=caregiver-onboarding` 등)
