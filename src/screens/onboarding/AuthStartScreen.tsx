import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "../../LanguageContext";
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
import { localizedErrorMessage } from "../../utils/familyDisplay";
import { colors, fontScaleCap } from "../../theme";
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
  const { t } = useLanguage();
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
      const message = error instanceof Error ? error.message : t("auth.social.failed", { provider: "Kakao" });
      setSocialError(
        /provider is not enabled|unsupported provider/i.test(message)
          ? t("auth.social.providerDisabled", { provider: "Kakao" })
          : /manual linking/i.test(message)
            ? t("auth.social.manualLinking")
            : t("auth.social.failed", { provider: "Kakao" }),
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
      const message = error instanceof Error ? error.message : t("auth.social.failed", { provider: "Apple" });
      setSocialError(
        /provider is not enabled|unsupported provider/i.test(message)
          ? t("auth.social.providerDisabled", { provider: "Apple" })
          : localizedErrorMessage(t, message),
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
      setSocialError(t("auth.social.failed", { provider: "Google" }));
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
        title={recoveryMode ? t("auth.email.title.forgot") : t("auth.start.title")}
        subtitle={
          recoveryMode
            ? t("auth.reset.subtitle")
            : t("auth.start.subtitle")
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
                  <Text style={styles.dividerText} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.social.or")}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialGroup}>
                  {authProviderFlags.apple.visible ? (
                    <SocialLoginButton
                      label={t("auth.social.apple")}
                      symbol={Platform.OS === "ios" ? "" : "A"}
                      enabled={authProviderFlags.apple.enabled && Platform.OS === "ios"}
                      busy={socialBusy === "apple"}
                      onPress={() => void continueWithApple()}
                    />
                  ) : null}
                  {authProviderFlags.google.visible ? (
                    <SocialLoginButton
                      label={t("auth.social.google")}
                      symbol="G"
                      enabled={authProviderFlags.google.enabled}
                      busy={socialBusy === "google"}
                      onPress={() => void continueWithGoogle()}
                    />
                  ) : null}
                  {authProviderFlags.kakao.visible ? (
                    <SocialLoginButton
                      label={t("auth.social.kakao")}
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
              <Text style={styles.legalText} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.legal.prefix")}</Text>
              <Pressable onPress={() => setPolicyPage("terms")} hitSlop={10}>
                <Text style={styles.legalLink} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.legal.terms")}</Text>
              </Pressable>
              <Text style={styles.legalText} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.legal.and")}</Text>
              <Pressable onPress={() => setPolicyPage("privacy")} hitSlop={10}>
                <Text style={styles.legalLink} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.legal.privacy")}</Text>
              </Pressable>
              <Text style={styles.legalText} maxFontSizeMultiplier={fontScaleCap.control}>{t("auth.legal.suffix")}</Text>
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
      <Text style={[styles.socialSymbol, tone === "kakao" && styles.kakaoText]} maxFontSizeMultiplier={fontScaleCap.control}>{symbol}</Text>
      <Text style={[styles.socialLabel, tone === "kakao" && styles.kakaoText]} maxFontSizeMultiplier={fontScaleCap.control}>{label}</Text>
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
  legalLink: { color: colors.amberText, fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
