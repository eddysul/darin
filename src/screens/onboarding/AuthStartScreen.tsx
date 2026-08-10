import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import {
  EmailAuthForm,
  type EmailAuthMode,
} from "../../components/auth/EmailAuthForm";
import {
  AppSettingsModal,
  type SettingsPage,
} from "../../components/settings/AppSettingsModal";
import { authProviderFlags } from "../../config/authProviders";
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors } from "../../theme";
import { OnboardingShell } from "./OnboardingShell";

type Props = {
  recoveryMode?: boolean;
  onAuthenticated: (payload: {
    name?: string;
    email?: string;
    provider: "email" | "google" | "apple" | "kakao";
    user?: User;
  }) => void | Promise<void>;
};

export function AuthStartScreen({ onAuthenticated, recoveryMode = false }: Props) {
  const [policyPage, setPolicyPage] = useState<SettingsPage | null>(null);
  const [authMode, setAuthMode] = useState<EmailAuthMode>(
    recoveryMode ? "reset-password" : "login",
  );
  const [socialBusy, setSocialBusy] = useState<"apple" | "google" | "kakao" | null>(null);
  const [socialError, setSocialError] = useState("");
  const hasSocialLogin =
    authProviderFlags.kakao.visible ||
    authProviderFlags.apple.visible ||
    authProviderFlags.google.visible;

  const continueWithKakao = async () => {
    if (socialBusy) return;
    setSocialError("");
    setSocialBusy("kakao");
    try {
      const result = await AuthRepository.signInWithKakao();
      if (!result) return;
      await onAuthenticated({
        provider: "kakao",
        user: result.user,
        email: result.email,
        name: result.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "카카오 로그인에 실패했어요.";
      setSocialError(
        /provider is not enabled|unsupported provider/i.test(message)
          ? "Supabase에서 카카오 로그인을 먼저 활성화해주세요."
          : /manual linking/i.test(message)
            ? "Supabase의 Allow manual linking 설정을 활성화해주세요."
            : "카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSocialBusy(null);
    }
  };

  const continueWithApple = async () => {
    if (socialBusy) return;
    setSocialError("");
    setSocialBusy("apple");
    try {
      const result = await AuthRepository.signInWithApple();
      if (!result) return;
      await onAuthenticated({
        provider: "apple",
        user: result.user,
        email: result.email,
        name: result.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apple 로그인에 실패했어요.";
      setSocialError(
        /provider is not enabled|unsupported provider/i.test(message)
          ? "Supabase에서 Apple 로그인을 먼저 활성화해주세요."
          : message,
      );
    } finally {
      setSocialBusy(null);
    }
  };

  const continueWithGoogle = async () => {
    if (socialBusy) return;
    setSocialError("");
    setSocialBusy("google");
    try {
      const result = await AuthRepository.signInWithGoogle();
      if (!result) return;
      await onAuthenticated({
        provider: "google",
        user: result.user,
        email: result.email,
        name: result.name,
      });
    } catch {
      setSocialError("Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <>
      <OnboardingShell
        compact
        scrollEnabled
        centerContent={authMode === "login"}
        title={recoveryMode ? "비밀번호 재설정" : "우리 아기의 기록을 시작해요"}
        subtitle={
          recoveryMode
            ? "새 비밀번호를 입력해주세요."
            : "수유, 수면, 성장 기록과 일기를\n가족과 함께 소중히 남겨보세요."
        }
      >
        <EmailAuthForm
          recoveryMode={recoveryMode}
          onModeChange={setAuthMode}
          onAuthenticated={({ user, email, name }) =>
            onAuthenticated({ provider: "email", user, email, name })
          }
        />

        {!recoveryMode ? (
          <>
            {hasSocialLogin ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>또는</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialGroup}>
                  {authProviderFlags.apple.visible ? (
                    <SocialLoginButton
                      label="Apple로 계속하기"
                      symbol=""
                      enabled={authProviderFlags.apple.enabled && Platform.OS === "ios"}
                      busy={socialBusy === "apple"}
                      onPress={() => void continueWithApple()}
                    />
                  ) : null}
                  {authProviderFlags.google.visible ? (
                    <SocialLoginButton
                      label="Google로 계속하기"
                      symbol="G"
                      enabled={authProviderFlags.google.enabled}
                      busy={socialBusy === "google"}
                      onPress={() => void continueWithGoogle()}
                    />
                  ) : null}
                  {authProviderFlags.kakao.visible ? (
                    <SocialLoginButton
                      label="카카오로 계속하기"
                      symbol="K"
                      tone="kakao"
                      enabled={authProviderFlags.kakao.enabled}
                      busy={socialBusy === "kakao"}
                      onPress={() => void continueWithKakao()}
                    />
                  ) : null}
                </View>
                {socialError ? <Text style={styles.socialError}>{socialError}</Text> : null}
              </>
            ) : null}

            <View style={styles.legalRow}>
              <Text style={styles.legalText}>계속하면 </Text>
              <Pressable onPress={() => setPolicyPage("terms")} hitSlop={6}>
                <Text style={styles.legalLink}>이용약관</Text>
              </Pressable>
              <Text style={styles.legalText}> 및 </Text>
              <Pressable onPress={() => setPolicyPage("privacy")} hitSlop={6}>
                <Text style={styles.legalLink}>개인정보처리방침</Text>
              </Pressable>
              <Text style={styles.legalText}>에 동의하게 됩니다.</Text>
            </View>
          </>
        ) : null}
      </OnboardingShell>

      <AppSettingsModal page={policyPage} onClose={() => setPolicyPage(null)} />
    </>
  );
}

function SocialLoginButton({
  label,
  symbol,
  enabled,
  busy = false,
  tone = "default",
  onPress,
}: {
  label: string;
  symbol: string;
  enabled: boolean;
  busy?: boolean;
  tone?: "default" | "kakao";
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.socialButton,
        tone === "kakao" && styles.kakaoButton,
        !enabled && styles.socialButtonDisabled,
      ]}
      disabled={!enabled || busy}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled || busy, busy }}
    >
      <Text style={[styles.socialSymbol, tone === "kakao" && styles.kakaoText]}>{symbol}</Text>
      <Text style={[styles.socialLabel, tone === "kakao" && styles.kakaoText]}>{label}</Text>
      <View style={styles.trailingSpacer}>
        {busy ? <ActivityIndicator size="small" color={tone === "kakao" ? "#191919" : colors.primary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: 12 },
  socialGroup: { gap: 10, width: "100%" },
  socialButton: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  socialButtonDisabled: { opacity: 0.58 },
  kakaoButton: { backgroundColor: "#FEE500", borderColor: "#FEE500" },
  kakaoText: { color: "#191919" },
  socialSymbol: { width: 28, color: colors.text, fontSize: 18, fontWeight: "800" },
  socialLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  trailingSpacer: { width: 28, alignItems: "center", justifyContent: "center" },
  socialError: { color: colors.dangerText, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8 },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 4,
  },
  legalText: { color: colors.faint, fontSize: 11, lineHeight: 16 },
  legalLink: { color: colors.primary, fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
