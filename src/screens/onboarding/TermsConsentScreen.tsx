import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppSettingsModal,
  type SettingsPage,
} from "../../components/settings/AppSettingsModal";
import { colors, radius } from "../../theme";
import { OnboardingShell } from "./OnboardingShell";

type Props = {
  onAccept: (marketingOptIn: boolean) => void;
};

export function TermsConsentScreen({ onAccept }: Props) {
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [policyPage, setPolicyPage] = useState<SettingsPage | null>(null);

  const requiredOk = ageOk && termsOk && privacyOk;

  return (
    <>
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
          onView={() => setPolicyPage("terms")}
          viewLabel="이용약관 전문 보기"
        />
        <CheckRow
          required
          label="개인정보 수집 및 이용에 동의합니다."
          checked={privacyOk}
          onToggle={() => setPrivacyOk((v) => !v)}
          onView={() => setPolicyPage("privacy")}
          viewLabel="개인정보처리방침 전문 보기"
        />
        <CheckRow
          label="마케팅 알림 수신에 동의합니다. (선택)"
          checked={marketingOk}
          onToggle={() => setMarketingOk((v) => !v)}
        />
        <Text style={styles.note}>
          약관과 개인정보 안내는 각 항목의 ‘보기’에서 바로 확인할 수 있어요. 로그인 후에도 메뉴 › 이용약관 및 개인정보 안내에서 다시 볼 수 있어요.
        </Text>
      </OnboardingShell>

      <AppSettingsModal page={policyPage} onClose={() => setPolicyPage(null)} />
    </>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
  required,
  onView,
  viewLabel,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  required?: boolean;
  onView?: () => void;
  viewLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.label}>
          {required ? <Text style={styles.req}>[필수] </Text> : <Text style={styles.opt}>[선택] </Text>}
          {label}
        </Text>
      </Pressable>
      {onView ? (
        <Pressable
          style={styles.viewBtn}
          onPress={onView}
          accessibilityRole="link"
          accessibilityLabel={viewLabel ?? "전문 보기"}
        >
          <Text style={styles.viewText}>보기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
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
  check: { color: colors.amberDark, fontSize: 14, fontWeight: "900" },
  label: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: "600" },
  req: { color: colors.amberText, fontWeight: "800" },
  opt: { color: colors.faint, fontWeight: "700" },
  viewBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  viewText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  note: { marginTop: 16, fontSize: 12, color: colors.faint, lineHeight: 18 },
});
