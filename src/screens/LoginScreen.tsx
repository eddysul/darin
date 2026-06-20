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

export function LoginScreen({ onLogin, onSignUp }: LoginScreenProps) {
  const { t } = useLanguage();
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

          <Pressable
            style={[styles.primaryBtn, isSignup && !phoneVerified && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isSignup && !phoneVerified}
          >
            <Text style={styles.primaryBtnText}>{isSignup ? t("signup.submit") : t("login.submit")}</Text>
          </Pressable>

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
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 55 },
  scroll: { padding: 28, paddingBottom: 48 },
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
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineBtnText: { fontSize: 13, fontWeight: "600", color: colors.gold },
  demoCode: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  success: { fontSize: 12, color: colors.sage, marginBottom: 8, fontWeight: "600" },
  error: { fontSize: 12, color: "#C45C5C", marginBottom: 8, fontWeight: "500" },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  switchMode: { marginTop: 20, alignItems: "center" },
  switchText: { fontSize: 14, color: colors.muted },
  switchLink: { fontWeight: "700", color: colors.text },
});
