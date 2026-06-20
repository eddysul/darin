import { useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { ScreenBackground } from "../components/ScreenBackground";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type LoginScreenProps = {
  onLogin: () => void;
  onSignUp: () => void;
};

type AuthMode = "login" | "signup";

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c3.398-3.127 5.684-7.735 5.684-13.216z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#FFFFFF"
        d="M14.94 9.54c-.02-2.17 1.77-3.21 1.85-3.27-1.01-1.47-2.58-1.67-3.13-1.7-1.33-.14-2.6.78-3.27.78-.68 0-1.72-.76-2.83-.74-1.46.02-2.8.85-3.55 2.15-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.32 0 1.69.7 2.84.68 1.17-.02 1.92-1.06 2.63-2.1.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.87-2.3-3.47zM12.52 2.89c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.5 2.56-1.25z"
      />
    </Svg>
  );
}

export function LoginScreen({ onLogin, onSignUp }: LoginScreenProps) {
  const { t } = useLanguage();
  const topInset = useScreenTopInset(24);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = () => {
    if (!phone.trim()) {
      setFormError(t("signup.phoneRequired"));
      return;
    }
    setSentCode(generateVerificationCode());
    setPhoneVerified(false);
    setVerificationCode("");
    setCountdown(60);
    setFormError("");
  };

  const handleVerify = () => {
    if (verificationCode === sentCode) {
      setPhoneVerified(true);
      setFormError("");
    } else {
      setFormError(t("signup.invalidCode"));
    }
  };

  const handleSubmit = () => {
    setFormError("");
    if (isSignup) {
      if (!name.trim() || !email.trim() || !password || password !== confirmPassword) {
        setFormError(t("signup.passwordMismatch"));
        return;
      }
      if (!phoneVerified) {
        setFormError(t("signup.codeRequired"));
        return;
      }
      onSignUp();
    } else {
      onLogin();
    }
  };

  return (
    <ScreenBackground style={styles.overlay}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, { paddingTop: topInset }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <Image source={require("../../assets/darin-logo.png")} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>{isSignup ? t("signup.title") : t("login.title")}</Text>
          <Text style={styles.subtitle}>{isSignup ? t("signup.subtitle") : t("login.subtitle")}</Text>

          {isSignup && (
            <Field icon={User} value={name} onChangeText={setName} placeholder={t("signup.namePlaceholder")} />
          )}
          {isSignup && (
            <Field
              value={phone}
              onChangeText={setPhone}
              placeholder={t("signup.phonePlaceholder")}
              keyboardType="phone-pad"
            />
          )}
          {isSignup && (
            <View style={styles.row}>
              <Pressable style={styles.outlineBtn} onPress={handleSendCode} disabled={countdown > 0}>
                <Text style={styles.outlineBtnText}>
                  {countdown > 0 ? t("signup.resendIn").replace("{seconds}", String(countdown)) : t("signup.sendCode")}
                </Text>
              </Pressable>
            </View>
          )}
          {isSignup && sentCode && (
            <>
              <Text style={styles.demoCode}>Demo code: {sentCode}</Text>
              <Field
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder={t("signup.verificationCodePlaceholder")}
                keyboardType="number-pad"
              />
              <Pressable style={styles.outlineBtn} onPress={handleVerify}>
                <Text style={styles.outlineBtnText}>{t("signup.verifyCode")}</Text>
              </Pressable>
              {phoneVerified && <Text style={styles.success}>{t("signup.phoneVerified")}</Text>}
            </>
          )}

          <Field icon={Mail} value={email} onChangeText={setEmail} placeholder={t("login.emailPlaceholder")} keyboardType="email-address" />
          <Field
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            placeholder={t("login.passwordPlaceholder")}
            secure={!showPassword}
            trailing={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} color={colors.muted} /> : <Eye size={16} color={colors.muted} />}
              </Pressable>
            }
          />
          {isSignup && (
            <Field
              icon={Lock}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t("signup.confirmPasswordPlaceholder")}
              secure
            />
          )}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {!isSignup && (
            <Pressable style={styles.forgotBtn}>
              <Text style={styles.forgotText}>{t("login.forgotPassword")}</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.primaryBtn, isSignup && !phoneVerified && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isSignup && !phoneVerified}
          >
            <Text style={styles.primaryBtnText}>{isSignup ? t("signup.submit") : t("login.submit")}</Text>
          </Pressable>

          {!isSignup && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("login.or")}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.socialBtn} onPress={onLogin}>
                <GoogleIcon />
                <Text style={styles.socialBtnText}>{t("login.continueGoogle")}</Text>
              </Pressable>

              <Pressable style={styles.appleBtn} onPress={onLogin}>
                <AppleIcon />
                <Text style={styles.appleBtnText}>{t("login.continueApple")}</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={() => setMode(isSignup ? "login" : "signup")} style={styles.switchMode}>
            <Text style={styles.switchText}>
              {isSignup ? t("signup.hasAccount") : t("login.noAccount")}{" "}
              <Text style={styles.switchLink}>{isSignup ? t("signup.logIn") : t("login.signUp")}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function Field({
  icon: Icon,
  trailing,
  secure,
  ...props
}: {
  icon?: typeof Mail;
  trailing?: ReactNode;
  secure?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      {Icon && <Icon size={16} color={colors.muted} style={styles.fieldIcon} />}
      <TextInput
        style={[styles.input, Icon && { paddingLeft: 40 }]}
        placeholderTextColor={colors.muted}
        secureTextEntry={secure}
        {...props}
      />
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, zIndex: 55 },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 28, paddingBottom: 48 },
  logo: { width: 200, height: 120, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 20 },
  field: { marginBottom: 12, position: "relative" },
  fieldIcon: { position: "absolute", left: 14, top: 14, zIndex: 1 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
  },
  trailing: { position: "absolute", right: 14, top: 14 },
  row: { marginBottom: 12 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  demoCode: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  success: { fontSize: 12, color: colors.text, marginBottom: 8, fontWeight: "600" },
  error: { fontSize: 12, color: "#C45C5C", marginBottom: 8, fontWeight: "500" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 4 },
  forgotText: { fontSize: 12, fontWeight: "600", color: colors.yellow },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.muted },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: 10,
  },
  socialBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: 4,
  },
  appleBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  switchMode: { marginTop: 20, alignItems: "center" },
  switchText: { fontSize: 14, color: colors.muted },
  switchLink: { fontWeight: "700", color: colors.text },
});
