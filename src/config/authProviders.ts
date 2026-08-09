/**
 * 소셜 로그인 노출 규칙:
 * - 구현 guard와 ENABLE flag가 모두 준비된 provider만 활성화한다.
 * - Google은 SHOW/ENABLE이 모두 true일 때만 노출한다.
 */
const APPLE_LOGIN_IMPLEMENTED = true;
const GOOGLE_LOGIN_IMPLEMENTED = true;
const KAKAO_LOGIN_IMPLEMENTED = true;

function providerFlag(implemented: boolean, enableEnv?: string, showEnv?: string) {
  const enabled = implemented && enableEnv === "true";
  const visible = implemented && showEnv !== "false";
  return { enabled, visible } as const;
}

function strictProviderFlag(implemented: boolean, enableEnv?: string, showEnv?: string) {
  const enabled = implemented && enableEnv === "true";
  return { enabled, visible: enabled && showEnv === "true" } as const;
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
  google: strictProviderFlag(
    GOOGLE_LOGIN_IMPLEMENTED,
    process.env.EXPO_PUBLIC_ENABLE_GOOGLE_LOGIN,
    process.env.EXPO_PUBLIC_SHOW_GOOGLE_LOGIN,
  ),
} as const;
