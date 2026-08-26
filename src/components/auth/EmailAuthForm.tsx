import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "../../LanguageContext";
import { AuthRepository } from "../../repositories/AuthRepository";
import { localizedErrorMessage } from "../../utils/familyDisplay";
import { colors } from "../../theme";

export type EmailAuthMode = "login" | "signup" | "forgot" | "confirm" | "reset-password";

type Props = {
  onAuthenticated: (payload: { user: User; email: string; name?: string }) => void | Promise<void>;
  recoveryMode?: boolean;
  onModeChange?: (mode: EmailAuthMode) => void;
};

const PASSWORD_MIN = 8;

export function EmailAuthForm({ onAuthenticated, recoveryMode = false, onModeChange }: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<EmailAuthMode>(recoveryMode ? "reset-password" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (recoveryMode) {
      setMode("reset-password");
      return;
    }
    void AuthRepository.getPendingEmailAuth().then((pending) => {
      if (!pending) return;
      setEmail(pending.email);
      setMode("confirm");
    });
  }, [recoveryMode]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const selectMode = (next: EmailAuthMode) => {
    setError("");
    setNotice("");
    setPassword("");
    setPasswordConfirm("");
    setMode(next);
  };

  const validEmail = email.trim().includes("@");
  const validPassword = password.length >= PASSWORD_MIN;
  const passwordsMatch = password === passwordConfirm;

  const friendlyAuthError = (caught: unknown): string => {
    const message = caught instanceof Error ? caught.message : String(caught);
    const lower = message.toLowerCase();
    if (lower.includes("invalid login credentials")) return t("auth.email.error.credentials");
    if (lower.includes("email not confirmed")) return t("auth.email.error.notConfirmed");
    if (lower.includes("auth session missing")) return t("auth.email.error.sessionMissing");
    if (lower.includes("already confirmed") || lower.includes("email confirmed")) return t("auth.email.error.alreadyConfirmed");
    if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("email exists")) return t("auth.email.error.alreadyRegistered");
    if (lower.includes("weak_password") || lower.includes("password should") || lower.includes("password is too weak")) return t("auth.email.error.weakPassword");
    if (lower.includes("rate limit")) return t("auth.email.error.rateLimit");
    return localizedErrorMessage(t, message);
  };

  const finish = async (user: User, fallbackEmail = email) => {
    await onAuthenticated({
      user,
      email: user.email ?? fallbackEmail.trim().toLowerCase(),
      name: name.trim() || (user.user_metadata?.display_name as string | undefined),
    });
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "login") {
        if (!validEmail || !password) throw new Error(t("auth.email.error.required"));
        const session = await AuthRepository.signInWithPassword(email, password);
        await finish(session.user);
      } else if (mode === "signup") {
        if (!validEmail) throw new Error(t("auth.email.error.invalid"));
        if (!validPassword) throw new Error(t("auth.email.error.passwordMin", { count: PASSWORD_MIN }));
        if (!passwordsMatch) throw new Error(t("auth.email.error.passwordMismatch"));
        const result = await AuthRepository.signUpWithPassword({ email, password, displayName: name });
        if (result.status === "confirmation_required") {
          setPassword("");
          setPasswordConfirm("");
          setMode("confirm");
          setNotice(t("auth.email.notice.sent", { email: result.email }));
        } else if (result.user) {
          await finish(result.user, result.email);
        }
      } else if (mode === "forgot") {
        if (!validEmail) throw new Error(t("auth.email.error.invalid"));
        await AuthRepository.sendPasswordReset(email);
        setNotice(t("auth.email.notice.resetSent"));
      } else if (mode === "confirm") {
        try {
          const user = await AuthRepository.completePendingEmailAuth();
          await finish(user);
        } catch (confirmError) {
          // A signup link opened in a different browser/device confirms the
          // server account but cannot restore this app's local PKCE session.
          // In that normal case, password login is the safe completion step.
          if (/auth session missing/i.test(String(confirmError))) {
            selectMode("login");
            setNotice(t("auth.email.notice.confirmThenLogin"));
            return;
          }
          throw confirmError;
        }
      } else {
        if (!validPassword) throw new Error(t("auth.email.error.passwordMin", { count: PASSWORD_MIN }));
        if (!passwordsMatch) throw new Error(t("auth.email.error.passwordMismatch"));
        const user = await AuthRepository.updatePassword(password);
        setNotice(t("auth.email.notice.passwordSaved"));
        await finish(user);
      }
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await AuthRepository.resendPendingEmailAuth();
      if (result === "already_confirmed") {
        selectMode("login");
        setNotice(t("auth.email.notice.alreadyConfirmed"));
      } else {
        setNotice(t("auth.email.notice.resent", { email }));
      }
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const title = {
    login: t("auth.email.title.login"),
    signup: t("auth.email.title.signup"),
    forgot: t("auth.email.title.forgot"),
    confirm: t("auth.email.title.confirm"),
    "reset-password": t("auth.email.title.reset"),
  }[mode];

  const buttonLabel = {
    login: t("auth.email.action.login"),
    signup: t("auth.email.action.signup"),
    forgot: t("auth.email.action.forgot"),
    confirm: t("auth.email.action.confirm"),
    "reset-password": t("auth.email.action.reset"),
  }[mode];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {mode === "signup" ? (
        <Field label={t("auth.email.nameOptional")}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("auth.email.nameExample")} placeholderTextColor={colors.faint} />
        </Field>
      ) : null}
      {mode !== "confirm" && mode !== "reset-password" ? (
        <Field label={t("auth.email.email")}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.faint}
          />
        </Field>
      ) : null}
      {mode === "confirm" ? (
        <Text style={styles.body}>
          {t("auth.email.confirmHint", { email })}
        </Text>
      ) : null}
      {mode === "login" || mode === "signup" || mode === "reset-password" ? (
        <Field label={mode === "reset-password" ? t("auth.email.newPassword") : t("auth.email.password")}>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              textContentType={mode === "login" ? "password" : "newPassword"}
              autoCapitalize="none"
              placeholder={t("auth.email.passwordMin", { count: PASSWORD_MIN })}
              placeholderTextColor={colors.faint}
            />
            <Pressable onPress={() => setPasswordVisible((value) => !value)} hitSlop={12} style={styles.visibilityBtn}>
              <Text style={styles.visibility}>{passwordVisible ? t("auth.email.hide") : t("auth.email.show")}</Text>
            </Pressable>
          </View>
        </Field>
      ) : null}
      {mode === "signup" || mode === "reset-password" ? (
        <Field label={t("auth.email.passwordConfirm")}>
          <TextInput
            style={styles.input}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            autoCapitalize="none"
            placeholder={t("auth.email.passwordAgain")}
            placeholderTextColor={colors.faint}
          />
        </Field>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.amberDark} /> : <Text style={styles.primaryText}>{buttonLabel}</Text>}
      </Pressable>

      {mode === "confirm" ? (
        <View style={styles.confirmActions}>
          <Pressable
            style={[styles.confirmAction, busy && styles.disabled]}
            onPress={() => void resendConfirmation()}
            disabled={busy}
          >
            <Text style={styles.confirmActionText}>{t("auth.email.resend")}</Text>
          </Pressable>
          <Pressable
            style={styles.confirmAction}
            onPress={() => selectMode("login")}
            disabled={busy}
          >
            <Text style={styles.confirmBackText}>{t("auth.email.backToLogin")}</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === "login" ? (
        <>
          <Pressable style={styles.linkButton} onPress={() => selectMode("forgot")}>
            <Text style={styles.linkText}>{t("auth.email.forgotLink")}</Text>
          </Pressable>
          {/* 회원가입은 로그인 버튼과 경쟁하지 않도록 텍스트 링크로 유지 */}
          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>{t("auth.email.noAccount")}</Text>
            <Pressable onPress={() => selectMode("signup")} hitSlop={8}>
              <Text style={styles.signupLink}>{t("auth.email.create")}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {mode === "signup" || mode === "forgot" ? (
        <Pressable style={styles.secondary} onPress={() => selectMode("login")}>
          <Text style={styles.secondaryText}>{t("auth.email.backToLogin")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, width: "100%" },
  title: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 2, textAlign: "left" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    width: "100%",
  },
  passwordRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.card,
    paddingRight: 14,
    width: "100%",
  },
  passwordInput: { flex: 1, minHeight: 54, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  visibilityBtn: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  visibility: { color: colors.amberText, fontSize: 12, fontWeight: "800" },
  primary: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    width: "100%",
  },
  primaryText: { color: colors.amberDark, fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  linkButton: { alignSelf: "center", paddingVertical: 4, paddingHorizontal: 4, marginTop: 2 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  signupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 2 },
  signupHint: { color: colors.muted, fontSize: 13 },
  signupLink: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  confirmActions: { flexDirection: "row", gap: 8, width: "100%" },
  confirmAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  confirmActionText: { color: colors.primary, fontSize: 12.5, fontWeight: "800", textAlign: "center" },
  confirmBackText: { color: colors.text, fontSize: 12.5, fontWeight: "800", textAlign: "center" },
  secondary: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 10, fontSize: 12.5, lineHeight: 18 },
  notice: { color: colors.text, backgroundColor: colors.amberSoft, borderRadius: 12, padding: 10, fontSize: 12.5, lineHeight: 18 },
});
