/**
 * 소셜 로그인 노출 규칙:
 * - 버튼은 기본으로 노출한다 (순서: Kakao → Apple → Google).
 * - 실제 연동이 되기 전까지는 비활성(disabled)이며 "준비 중" 문구는 표시하지 않는다.
 * - EXPO_PUBLIC_SHOW_*_LOGIN=false 로만 숨길 수 있다.
 * - Flip the implementation guard only when the corresponding flow is wired.
 */
const APPLE_LOGIN_IMPLEMENTED = true;
const GOOGLE_LOGIN_IMPLEMENTED = true;
const KAKAO_LOGIN_IMPLEMENTED = true;

function providerFlag(implemented: boolean, enableEnv?: string, showEnv?: string) {
  const enabled = implemented && enableEnv === "true";
  const visible = showEnv !== "false";
  return { enabled, visible } as const;
}

export const authProviderFlags = {
  kakao: providerFlag(
    KAKAO_LOGIN_IMPLEMENTED,
    process.env.EXPO_PUBLIC_ENABLE_KAKAO_LOGIN,
    process.env.EXPO_PUBLIC_SHOW_KAKAO_LOGIN,
  ),
  apple: providerFlag(
    APPLE_LOGIN_IMPLEMENTED,
    process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN,
    process.env.EXPO_PUBLIC_SHOW_APPLE_LOGIN,
  ),
  google: providerFlag(
    GOOGLE_LOGIN_IMPLEMENTED,
    process.env.EXPO_PUBLIC_ENABLE_GOOGLE_LOGIN,
    process.env.EXPO_PUBLIC_SHOW_GOOGLE_LOGIN,
  ),
} as const;
