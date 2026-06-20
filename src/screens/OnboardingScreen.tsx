import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Baby,
  Briefcase,
  Camera,
  ChevronLeft,
  FileText,
  Globe,
  HeartHandshake,
  IdCard,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  User,
} from "lucide-react-native";
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
import type { CaregiverCertificate, UserProfile, UserRole } from "../types/profile";
import { createId } from "../utils/id";
import { colors, radius } from "../theme";

type OnboardingScreenProps = {
  onComplete: (profile: UserProfile) => void;
  initialRole?: UserRole;
  initialStep?: "role" | "profile";
};

type CertificateDraft = { id: string; name: string; photo: string };

async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export function OnboardingScreen({
  onComplete,
  initialRole = "parent",
  initialStep = "role",
}: OnboardingScreenProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(initialStep);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [childName, setChildName] = useState("");
  const [languages, setLanguages] = useState("");
  const [experience, setExperience] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licensePhoto, setLicensePhoto] = useState("");
  const [certificates, setCertificates] = useState<CertificateDraft[]>([]);
  const [error, setError] = useState("");

  const handleFinish = () => {
    if (!name.trim()) return setError(t("onboarding.nameRequired"));
    if (!location.trim()) return setError(t("onboarding.locationRequired"));
    if (!languages.trim()) return setError(t("onboarding.languagesRequired"));
    if (role === "caregiver") {
      if (!licenseNumber.trim()) return setError(t("onboarding.licenseNumberRequired"));
      if (!licensePhoto) return setError(t("onboarding.licensePhotoRequired"));
    }

    const completedCertificates: CaregiverCertificate[] = certificates
      .filter((c) => c.name.trim() && c.photo)
      .map((c) => ({ id: c.id, name: c.name.trim(), photo: c.photo }));

    onComplete({
      name: name.trim(),
      location: location.trim(),
      avatar: role === "caregiver" ? "photo-1544005313-94ddf0286df2" : "photo-1438761681033-6461ffad8d80",
      role,
      dueDate: dueDate.trim() || undefined,
      childName: childName.trim() || undefined,
      languages: languages.trim(),
      experience: experience.trim() || undefined,
      specialty: specialty.trim() || undefined,
      licenseNumber: role === "caregiver" ? licenseNumber.trim() : undefined,
      licensePhoto: role === "caregiver" ? licensePhoto : undefined,
      certificates: role === "caregiver" && completedCertificates.length ? completedCertificates : undefined,
    });
  };

  return (
    <ScreenBackground style={styles.overlay}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === "profile" && (
            <Pressable onPress={() => setStep("role")} style={styles.back}>
              <ChevronLeft size={18} color={colors.muted} />
              <Text style={styles.backText}>{t("onboarding.back")}</Text>
            </Pressable>
          )}
          <Text style={styles.step}>{step === "role" ? t("onboarding.step1of2") : t("onboarding.step2of2")}</Text>
          <Text style={styles.title}>{step === "role" ? t("onboarding.stepRole") : t("onboarding.stepProfile")}</Text>
          <Text style={styles.subtitle}>
            {step === "role" ? t("onboarding.roleSubtitle") : t("onboarding.profileSubtitle")}
          </Text>

          {step === "role" ? (
            <>
              <RoleCard
                active={role === "parent"}
                icon={Baby}
                title={t("onboarding.roleParent")}
                desc={t("onboarding.roleParentDesc")}
                onPress={() => setRole("parent")}
              />
              <RoleCard
                active={role === "caregiver"}
                icon={HeartHandshake}
                title={t("onboarding.roleCaregiver")}
                desc={t("onboarding.roleCaregiverDesc")}
                onPress={() => setRole("caregiver")}
              />
              <Pressable style={styles.primaryBtn} onPress={() => { setError(""); setStep("profile"); }}>
                <Text style={styles.primaryBtnText}>{t("onboarding.continue")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Input label={`${t("profile.name")} *`} value={name} onChangeText={setName} placeholder={t("profile.namePlaceholder")} icon={User} />
              <Input label={`${t("profile.location")} *`} value={location} onChangeText={setLocation} placeholder={t("profile.locationPlaceholder")} icon={MapPin} />
              {role === "parent" ? (
                <>
                  <Input label={t("onboarding.dueDate")} value={dueDate} onChangeText={setDueDate} placeholder={t("onboarding.dueDatePlaceholder")} />
                  <Input label={t("onboarding.childName")} value={childName} onChangeText={setChildName} placeholder={t("onboarding.childNamePlaceholder")} icon={Baby} />
                </>
              ) : (
                <>
                  <Input label={t("onboarding.experience")} value={experience} onChangeText={setExperience} placeholder={t("onboarding.experiencePlaceholder")} icon={Briefcase} />
                  <Input label={t("onboarding.specialty")} value={specialty} onChangeText={setSpecialty} placeholder={t("onboarding.specialtyPlaceholder")} icon={Sparkles} />
                  <Input label={`${t("onboarding.licenseNumber")} *`} value={licenseNumber} onChangeText={setLicenseNumber} placeholder={t("onboarding.licenseNumberPlaceholder")} icon={IdCard} />
                  <PhotoField
                    label={`${t("onboarding.licensePhoto")} *`}
                    photo={licensePhoto}
                    onPick={async () => { const uri = await pickImage(); if (uri) setLicensePhoto(uri); }}
                    uploadLabel={t("onboarding.uploadPhoto")}
                  />
                  <View style={styles.certHeader}>
                    <Text style={styles.label}>{t("onboarding.otherCertificates")}</Text>
                    <Pressable onPress={() => setCertificates((p) => [...p, { id: createId(), name: "", photo: "" }])}>
                      <Text style={styles.addLink}><Plus size={12} color={colors.gold} /> {t("onboarding.addCertificate")}</Text>
                    </Pressable>
                  </View>
                  {certificates.map((cert, i) => (
                    <View key={cert.id} style={styles.certCard}>
                      <View style={styles.certTop}>
                        <Text style={styles.certIndex}>{i + 1}</Text>
                        <Pressable onPress={() => setCertificates((p) => p.filter((c) => c.id !== cert.id))}>
                          <Trash2 size={14} color="#C45C5C" />
                        </Pressable>
                      </View>
                      <Input label={t("onboarding.certificateName")} value={cert.name} onChangeText={(v) => setCertificates((p) => p.map((c) => c.id === cert.id ? { ...c, name: v } : c))} placeholder={t("onboarding.certificateNamePlaceholder")} icon={FileText} />
                      <PhotoField label={t("onboarding.certificatePhoto")} photo={cert.photo} onPick={async () => { const uri = await pickImage(); if (uri) setCertificates((p) => p.map((c) => c.id === cert.id ? { ...c, photo: uri } : c)); }} uploadLabel={t("onboarding.uploadPhoto")} />
                    </View>
                  ))}
                </>
              )}
              <Input label={`${t("onboarding.languages")} *`} value={languages} onChangeText={setLanguages} placeholder={t("onboarding.languagesPlaceholder")} icon={Globe} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.primaryBtn} onPress={handleFinish}>
                <Text style={styles.primaryBtnText}>{t("onboarding.finish")}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function RoleCard({ active, icon: Icon, title, desc, onPress }: { active: boolean; icon: typeof Baby; title: string; desc: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.roleCard, active && styles.roleCardActive]} onPress={onPress}>
      <View style={[styles.roleIcon, active && styles.roleIconActive]}>
        <Icon size={22} color={active ? colors.gold : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

function Input({ label, icon: Icon, ...props }: { label: string; icon?: typeof User; value: string; onChangeText: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {Icon && <Icon size={16} color={colors.muted} style={styles.inputIcon} />}
        <TextInput style={[styles.input, Icon && { paddingLeft: 40 }]} placeholderTextColor={colors.muted} {...props} />
      </View>
    </View>
  );
}

function PhotoField({ label, photo, onPick, uploadLabel }: { label: string; photo: string; onPick: () => void; uploadLabel: string }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.photoRow}>
        <Pressable style={styles.photoBox} onPress={onPick}>
          {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Camera size={22} color={colors.muted} />}
        </Pressable>
        <Pressable onPress={onPick}><Text style={styles.uploadLink}>{uploadLabel}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 55 },
  scroll: { padding: 28, paddingBottom: 48 },
  back: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  step: { fontSize: 12, fontWeight: "600", color: colors.muted, alignSelf: "flex-end" },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 20, marginTop: 4 },
  roleCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  roleCardActive: { borderColor: colors.gold, backgroundColor: "#FFFBF2" },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.champagne, alignItems: "center", justifyContent: "center" },
  roleIconActive: { backgroundColor: "#FFF4D8" },
  roleTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  roleDesc: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  inputWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 },
  inputRow: { position: "relative" },
  inputIcon: { position: "absolute", left: 14, top: 14, zIndex: 1 },
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
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoBox: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  uploadLink: { fontSize: 14, fontWeight: "600", color: colors.gold },
  certHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  addLink: { fontSize: 12, fontWeight: "600", color: colors.gold },
  certCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  certTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  certIndex: { fontSize: 12, fontWeight: "600", color: colors.muted },
  error: { fontSize: 12, color: "#C45C5C", marginBottom: 8 },
  primaryBtn: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
});
