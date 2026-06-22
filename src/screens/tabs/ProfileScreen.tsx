import { Image } from "expo-image";
import {
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  Globe,
  Heart,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { ParentProfileView } from "../../components/ParentProfileView";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";

export function ProfileScreen() {
  const { profile, setLangPickerOpen, setProfileEditOpen } = useApp();
  const { locale, t } = useLanguage();

  const settings = [
    {
      icon: Globe,
      label: t("profile.langPref"),
      value: locale === "ko" ? t("profile.langValueKo") : t("profile.langValueEn"),
      onPress: () => setLangPickerOpen(true),
    },
    { icon: Bell, label: t("profile.notifications"), value: t("profile.notifValue") },
    { icon: Calendar, label: t("profile.schedule"), value: t("profile.scheduleValue") },
    { icon: Heart, label: t("profile.carePref"), value: t("profile.careValue") },
    { icon: SettingsIcon, label: t("profile.appSettings"), value: t("profile.appSettingsValue") },
    { icon: CreditCard, label: t("profile.billing"), value: t("profile.billingValue") },
  ];

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      {profile.role === "parent" ? (
        <ParentProfileView avatarSrc={profile.avatar} onEditProfile={() => setProfileEditOpen(true)} />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <Avatar src={profile.avatar} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{profile.name}</Text>
                <Text style={styles.role}>
                  {t("profile.roleCaregiver")} · {profile.location}
                </Text>
                {profile.languages && (
                  <View style={styles.langs}>
                    {profile.languages.split(",").map((lang) => (
                      <Text key={lang.trim()} style={styles.langChip}>
                        {lang.trim()}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {(profile.licenseNumber || profile.licensePhoto || profile.certificates?.length) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("onboarding.caregiverInfo")}</Text>
              <View style={styles.infoCard}>
                {profile.experience && (
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoBold}>{t("onboarding.experience")}: </Text>
                    {profile.experience}
                  </Text>
                )}
                {profile.licenseNumber && (
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoBold}>{t("onboarding.licenseNumber")}: </Text>
                    {profile.licenseNumber}
                  </Text>
                )}
                {profile.licensePhoto && (
                  <Image source={{ uri: profile.licensePhoto }} style={styles.licenseImg} contentFit="cover" />
                )}
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.settings")}</Text>
        <View style={styles.settingsCard}>
          {settings.map(({ icon: Icon, label, value, onPress }, i) => (
            <Pressable
              key={label}
              style={[styles.settingRow, i > 0 && styles.settingBorder]}
              onPress={onPress}
            >
              <View style={styles.settingIcon}>
                <Icon size={16} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{value}</Text>
              </View>
              <ChevronRight size={14} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: { flexDirection: "row", gap: 16 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  role: { fontSize: 14, color: colors.muted, marginTop: 4 },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  langChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoLine: { fontSize: 14, color: colors.text },
  infoBold: { fontWeight: "600" },
  licenseImg: { width: 160, height: 100, borderRadius: radius.md, marginTop: 8 },
  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  settingBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  settingIcon: { backgroundColor: colors.yellowSoft, borderRadius: 12, padding: 8 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  settingValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
