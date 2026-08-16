import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OnboardingShell } from "./OnboardingShell";
import { colors, radius } from "../../theme";

type Props = {
  onAccept: (marketingOptIn: boolean) => void;
};

export function TermsConsentScreen({ onAccept }: Props) {
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);

  const requiredOk = ageOk && termsOk && privacyOk;

  return (
    <OnboardingShell
      title="시작하기 전에"
      subtitle="서비스 이용을 위한 필수 동의만 확인해주세요."
      primaryLabel="동의하고 시작하기"
      primaryDisabled={!requiredOk}
      onPrimary={() => onAccept(marketingOk)}
    >
      <CheckRow
        required
        label="만 14세 이상입니다."
        checked={ageOk}
        onToggle={() => setAgeOk((v) => !v)}
      />
      <CheckRow
        required
        label="이용약관에 동의합니다."
        checked={termsOk}
        onToggle={() => setTermsOk((v) => !v)}
      />
      <CheckRow
        required
        label="개인정보 수집 및 이용에 동의합니다."
        checked={privacyOk}
        onToggle={() => setPrivacyOk((v) => !v)}
      />
      <CheckRow
        label="마케팅 알림 수신에 동의합니다. (선택)"
        checked={marketingOk}
        onToggle={() => setMarketingOk((v) => !v)}
      />
      <Text style={styles.note}>약관 전문은 메뉴 › 개인정보/약관에서 확인할 수 있어요.</Text>
    </OnboardingShell>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
  required,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  required?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.label}>
        {required ? <Text style={styles.req}>[필수] </Text> : <Text style={styles.opt}>[선택] </Text>}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.amber, borderColor: colors.amber },
  check: { color: "#fff", fontSize: 14, fontWeight: "900" },
  label: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: "600" },
  req: { color: colors.amberText, fontWeight: "800" },
  opt: { color: colors.faint, fontWeight: "700" },
  note: { marginTop: 16, fontSize: 12, color: colors.faint, lineHeight: 18 },
});
