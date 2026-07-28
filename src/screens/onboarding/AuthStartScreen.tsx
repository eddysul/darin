import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { colors } from "../../theme";
import { OnboardingShell } from "./OnboardingShell";

type Props = {
  recoveryMode?: boolean;
  onAuthenticated: (payload: {
    name?: string;
    email?: string;
    provider: "email";
    user?: User;
  }) => void | Promise<void>;
};

export function AuthStartScreen({ onAuthenticated, recoveryMode = false }: Props) {
  const [policyPage, setPolicyPage] = useState<SettingsPage | null>(null);
  const [authMode, setAuthMode] = useState<EmailAuthMode>(
    recoveryMode ? "reset-password" : "login",
  );
  const hasSocialLogin = authProviderFlags.apple.visible || authProviderFlags.google.visible;

  return (
    <>
      <OnboardingShell
        compact
        scrollEnabled={authMode !== "login"}
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
                      enabled={authProviderFlags.apple.enabled}
                    />
                  ) : null}
                  {authProviderFlags.google.visible ? (
                    <SocialLoginButton
                      label="Google로 계속하기"
                      symbol="G"
                      enabled={authProviderFlags.google.enabled}
                    />
                  ) : null}
                </View>
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
}: {
  label: string;
  symbol: string;
  enabled: boolean;
}) {
  return (
    <Pressable
      style={[styles.socialButton, !enabled && styles.socialButtonDisabled]}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.socialSymbol}>{symbol}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
      <View style={styles.trailingSpacer} />
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
  socialSymbol: { width: 28, color: colors.text, fontSize: 18, fontWeight: "800" },
  socialLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  trailingSpacer: { width: 28 },
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
