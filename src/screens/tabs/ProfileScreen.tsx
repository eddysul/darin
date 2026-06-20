import { Image } from "expo-image";
import {
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  Globe,
  Heart,
  Plus,
  Settings as SettingsIcon,
  UserCog,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";

export function ProfileScreen() {
  const { profile, setLangPickerOpen, setProfileEditOpen } = useApp();
  const { locale, t } = useLanguage();
  const children = [{ name: "Emma", age: locale === "ko" ? "2세 4개월" : "2 yrs 4 mo", img: "photo-1594608661623-aa0bd3a69d98" }];

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Pressable style={styles.editBtn} onPress={() => setProfileEditOpen(true)}>
          <UserCog size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.heroRow}>
          <Avatar src={profile.avatar} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.role}>
              {profile.role === "caregiver" ? t("profile.roleCaregiver") : t("profile.roleParent")} · {profile.location}
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

      {profile.role === "parent" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("profile.children")}</Text>
            <Pressable style={styles.addBtn}>
              <Plus size={14} color={colors.gold} />
              <Text style={styles.addText}>{t("profile.add")}</Text>
            </Pressable>
          </View>
          {children.map((child) => (
            <View key={child.name} style={styles.childCard}>
              <Avatar src={child.img} size={44} />
              <View>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childAge}>{child.age}</Text>
              </View>
              <ChevronRight size={16} color={colors.muted} style={{ marginLeft: "auto" }} />
            </View>
          ))}
        </View>
      )}

      {profile.role === "caregiver" && (profile.licenseNumber || profile.licensePhoto || profile.certificates?.length) && (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  editBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  heroRow: { flexDirection: "row", gap: 16, paddingRight: 40 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  role: { fontSize: 14, color: colors.muted, marginTop: 4 },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  langChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.gold,
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { fontSize: 14, fontWeight: "600", color: colors.gold },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  childName: { fontSize: 14, fontWeight: "600", color: colors.text },
  childAge: { fontSize: 12, color: colors.muted },
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
  settingIcon: { backgroundColor: colors.champagne, borderRadius: 12, padding: 8 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  settingValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
