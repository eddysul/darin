import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import Svg, { Path } from "react-native-svg";
import { OnboardingField, OnboardingShell, onboardingInputStyle } from "./OnboardingShell";
import { colors, radius } from "../../theme";

type Props = {
  onAuthenticated: (payload: { name?: string; provider: "apple" | "google" | "email" }) => void;
};

export function AuthStartScreen({ onAuthenticated }: Props) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (showEmail) {
    const canSubmit = email.trim().includes("@") && password.trim().length >= 4;
    return (
      <OnboardingShell
        title="이메일로 시작"
        subtitle="MVP에서는 실제 인증 없이 바로 이어집니다."
        primaryLabel="계속하기"
        primaryDisabled={!canSubmit}
        onPrimary={() =>
          onAuthenticated({
            provider: "email",
            name: name.trim() || email.split("@")[0],
          })
        }
        secondaryLabel="소셜 로그인으로 돌아가기"
        onSecondary={() => setShowEmail(false)}
      >
        <OnboardingField label="이름" optional>
          <TextInput
            style={onboardingInputStyle}
            value={name}
            onChangeText={setName}
            placeholder="예: 민지"
            placeholderTextColor={colors.faint}
          />
        </OnboardingField>
        <OnboardingField label="이메일" required>
          <TextInput
            style={onboardingInputStyle}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.faint}
          />
        </OnboardingField>
        <OnboardingField label="비밀번호" required>
          <TextInput
            style={onboardingInputStyle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="4자 이상"
            placeholderTextColor={colors.faint}
          />
        </OnboardingField>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      title="로그인"
      subtitle="가장 편한 방법으로 빠르게 시작하세요."
      secondaryLabel="이메일로 시작"
      onSecondary={() => setShowEmail(true)}
      footerHint="계정은 기기 로컬 MVP 세션으로 이어집니다."
    >
      <Pressable
        style={styles.appleBtn}
        onPress={() => onAuthenticated({ provider: "apple", name: "사용자" })}
      >
        <Text style={styles.appleText}>Apple로 계속하기</Text>
      </Pressable>
      <Pressable
        style={styles.googleBtn}
        onPress={() => onAuthenticated({ provider: "google", name: "사용자" })}
      >
        <GoogleIcon />
        <Text style={styles.googleText}>Google로 계속하기</Text>
      </Pressable>
      <Text style={styles.hint}>실제 OAuth는 후속 연동. MVP에서는 바로 프로필 설정으로 이어집니다.</Text>
    </OnboardingShell>
  );
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

const styles = StyleSheet.create({
  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#111111",
    borderRadius: radius.md,
    paddingVertical: 15,
    marginBottom: 10,
  },
  appleText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    marginBottom: 14,
  },
  googleText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  hint: { textAlign: "center", fontSize: 12.5, color: colors.faint, lineHeight: 18 },
});
