import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../LanguageContext";
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
  const { t } = useLanguage();
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [policyPage, setPolicyPage] = useState<SettingsPage | null>(null);

  const requiredOk = ageOk && termsOk && privacyOk;

  return (
    <>
      <OnboardingShell
        title={t("terms.title")}
        subtitle={t("terms.subtitle")}
        primaryLabel={t("terms.accept")}
        primaryDisabled={!requiredOk}
        onPrimary={() => onAccept(marketingOk)}
      >
        <CheckRow
          required
          label={t("terms.age")}
          requiredLabel={t("terms.required")}
          optionalLabel={t("terms.optional")}
          viewText={t("terms.view")}
          checked={ageOk}
          onToggle={() => setAgeOk((v) => !v)}
        />
        <CheckRow
          required
          label={t("terms.service")}
          requiredLabel={t("terms.required")}
          optionalLabel={t("terms.optional")}
          viewText={t("terms.view")}
          checked={termsOk}
          onToggle={() => setTermsOk((v) => !v)}
          onView={() => setPolicyPage("terms")}
          viewLabel={t("terms.serviceView")}
        />
        <CheckRow
          required
          label={t("terms.privacy")}
          requiredLabel={t("terms.required")}
          optionalLabel={t("terms.optional")}
          viewText={t("terms.view")}
          checked={privacyOk}
          onToggle={() => setPrivacyOk((v) => !v)}
          onView={() => setPolicyPage("privacy")}
          viewLabel={t("terms.privacyView")}
        />
        <CheckRow
          label={t("terms.marketing")}
          requiredLabel={t("terms.required")}
          optionalLabel={t("terms.optional")}
          viewText={t("terms.view")}
          checked={marketingOk}
          onToggle={() => setMarketingOk((v) => !v)}
        />
        <Text style={styles.note}>
          {t("terms.note")}
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
  requiredLabel,
  optionalLabel,
  viewText,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  required?: boolean;
  onView?: () => void;
  viewLabel?: string;
  requiredLabel: string;
  optionalLabel: string;
  viewText: string;
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
          {required ? <Text style={styles.req}>{requiredLabel}</Text> : <Text style={styles.opt}>{optionalLabel}</Text>}
          {label}
        </Text>
      </Pressable>
      {onView ? (
        <Pressable
          style={styles.viewBtn}
          onPress={onView}
          accessibilityRole="link"
          accessibilityLabel={viewLabel ?? viewText}
        >
          <Text style={styles.viewText}>{viewText}</Text>
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
