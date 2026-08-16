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
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors } from "../../theme";

export type EmailAuthMode = "login" | "signup" | "forgot" | "confirm" | "reset-password";

type Props = {
  onAuthenticated: (payload: { user: User; email: string; name?: string }) => void | Promise<void>;
  recoveryMode?: boolean;
  onModeChange?: (mode: EmailAuthMode) => void;
};

const PASSWORD_MIN = 8;

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (lower.includes("email not confirmed")) return "이메일 인증을 먼저 완료해주세요.";
  if (lower.includes("auth session missing")) {
    return "앱에서 인증 세션을 찾지 못했어요. 메일 인증을 마쳤다면 로그인으로 돌아가 비밀번호로 로그인해주세요.";
  }
  if (lower.includes("already confirmed") || lower.includes("email confirmed")) {
    return "이미 이메일 인증이 완료된 계정이에요. 로그인해주세요.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("email exists")) {
    return "이미 가입된 이메일이에요. 로그인해주세요.";
  }
  if (lower.includes("weak_password") || lower.includes("password should") || lower.includes("password is too weak")) {
    return "더 강한 비밀번호를 사용해주세요. 영문·숫자를 섞어 8자 이상을 권장해요.";
  }
  if (lower.includes("rate limit")) return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  return message;
}

export function EmailAuthForm({ onAuthenticated, recoveryMode = false, onModeChange }: Props) {
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
        if (!validEmail || !password) throw new Error("이메일과 비밀번호를 입력해주세요.");
        const session = await AuthRepository.signInWithPassword(email, password);
        await finish(session.user);
      } else if (mode === "signup") {
        if (!validEmail) throw new Error("올바른 이메일을 입력해주세요.");
        if (!validPassword) throw new Error(`비밀번호는 ${PASSWORD_MIN}자 이상 입력해주세요.`);
        if (!passwordsMatch) throw new Error("비밀번호 확인이 일치하지 않아요.");
        const result = await AuthRepository.signUpWithPassword({ email, password, displayName: name });
        if (result.status === "confirmation_required") {
          setPassword("");
          setPasswordConfirm("");
          setMode("confirm");
          setNotice(`${result.email}로 인증 메일을 보냈어요.`);
        } else if (result.user) {
          await finish(result.user, result.email);
        }
      } else if (mode === "forgot") {
        if (!validEmail) throw new Error("재설정 메일을 받을 이메일을 입력해주세요.");
        await AuthRepository.sendPasswordReset(email);
        setNotice("비밀번호 재설정 메일을 보냈어요. 메일의 링크를 열어주세요.");
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
            setNotice("메일 인증을 마쳤다면 가입한 이메일과 비밀번호로 로그인해주세요.");
            return;
          }
          throw confirmError;
        }
      } else {
        if (!validPassword) throw new Error(`비밀번호는 ${PASSWORD_MIN}자 이상 입력해주세요.`);
        if (!passwordsMatch) throw new Error("비밀번호 확인이 일치하지 않아요.");
        const user = await AuthRepository.updatePassword(password);
        setNotice("새 비밀번호를 저장했어요.");
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
        setNotice("이미 이메일 인증이 완료됐어요. 비밀번호로 로그인해주세요.");
      } else {
        setNotice(`${email}로 새 인증 메일을 보냈어요. 가장 최근 메일의 링크를 열어주세요.`);
      }
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const title = {
    login: "이메일 로그인",
    signup: "이메일 회원가입",
    forgot: "비밀번호 재설정",
    confirm: "이메일 인증",
    "reset-password": "새 비밀번호 설정",
  }[mode];

  const buttonLabel = {
    login: "로그인",
    signup: "계정 만들기",
    forgot: "재설정 메일 보내기",
    confirm: "로그인으로 계속하기",
    "reset-password": "새 비밀번호 저장",
  }[mode];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {mode === "signup" ? (
        <Field label="이름 (선택)">
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: 민지" placeholderTextColor={colors.faint} />
        </Field>
      ) : null}
      {mode !== "confirm" && mode !== "reset-password" ? (
        <Field label="이메일">
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
          {email}로 보낸 인증 링크를 열어주세요. 인증 후 앱으로 자동 복귀하지 않으면 로그인으로 계속해주세요.
        </Text>
      ) : null}
      {mode === "login" || mode === "signup" || mode === "reset-password" ? (
        <Field label={mode === "reset-password" ? "새 비밀번호" : "비밀번호"}>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              textContentType={mode === "login" ? "password" : "newPassword"}
              autoCapitalize="none"
              placeholder={`${PASSWORD_MIN}자 이상`}
              placeholderTextColor={colors.faint}
            />
            <Pressable onPress={() => setPasswordVisible((value) => !value)} hitSlop={12} style={styles.visibilityBtn}>
              <Text style={styles.visibility}>{passwordVisible ? "숨기기" : "보기"}</Text>
            </Pressable>
          </View>
        </Field>
      ) : null}
      {mode === "signup" || mode === "reset-password" ? (
        <Field label="비밀번호 확인">
          <TextInput
            style={styles.input}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            autoCapitalize="none"
            placeholder="비밀번호를 한 번 더 입력"
            placeholderTextColor={colors.faint}
          />
        </Field>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{buttonLabel}</Text>}
      </Pressable>

      {mode === "confirm" ? (
        <View style={styles.confirmActions}>
          <Pressable
            style={[styles.confirmAction, busy && styles.disabled]}
            onPress={() => void resendConfirmation()}
            disabled={busy}
          >
            <Text style={styles.confirmActionText}>인증 메일 다시 보내기</Text>
          </Pressable>
          <Pressable
            style={styles.confirmAction}
            onPress={() => selectMode("login")}
            disabled={busy}
          >
            <Text style={styles.confirmBackText}>로그인으로 돌아가기</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === "login" ? (
        <>
          <Pressable style={styles.linkButton} onPress={() => selectMode("forgot")}>
            <Text style={styles.linkText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
          {/* 회원가입은 로그인 버튼과 경쟁하지 않도록 텍스트 링크로 유지 */}
          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>아직 계정이 없나요? </Text>
            <Pressable onPress={() => selectMode("signup")} hitSlop={8}>
              <Text style={styles.signupLink}>이메일 계정 만들기</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {mode === "signup" || mode === "forgot" ? (
        <Pressable style={styles.secondary} onPress={() => selectMode("login")}>
          <Text style={styles.secondaryText}>로그인으로 돌아가기</Text>
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
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
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
