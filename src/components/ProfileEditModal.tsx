import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { useLanguage } from "../LanguageContext";
import type { UserProfile } from "../types/profile";
import { colors, radius } from "../theme";

type ProfileEditModalProps = {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
};

export function ProfileEditModal({ open, profile, onClose, onSave }: ProfileEditModalProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    if (open) setDraft(profile);
  }, [open, profile]);

  const handleSave = () => {
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim(), location: draft.location.trim() });
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("profile.editTitle")}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t("profile.name")}</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>{t("profile.location")}</Text>
            <TextInput
              style={styles.input}
              value={draft.location}
              onChangeText={(location) => setDraft((d) => ({ ...d, location }))}
              placeholder={t("profile.locationPlaceholder")}
              placeholderTextColor={colors.muted}
            />

            {draft.role === "parent" && (
              <>
                <Text style={styles.label}>{t("profile.dueDate")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.dueDate ?? ""}
                  onChangeText={(dueDate) => setDraft((d) => ({ ...d, dueDate }))}
                  placeholder={t("profile.dueDatePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("profile.budget")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.budget ?? ""}
                  onChangeText={(budget) => setDraft((d) => ({ ...d, budget }))}
                  placeholder={t("profile.budgetPlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("profile.experience")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.experience ?? ""}
                  onChangeText={(experience) => setDraft((d) => ({ ...d, experience }))}
                  placeholder={t("profile.experiencePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>{t("profile.liveIn")}</Text>
                  <Switch
                    value={draft.liveIn ?? false}
                    onValueChange={(liveIn) => setDraft((d) => ({ ...d, liveIn }))}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>{t("profile.breastfeeding")}</Text>
                  <Switch
                    value={draft.breastfeeding ?? false}
                    onValueChange={(breastfeeding) => setDraft((d) => ({ ...d, breastfeeding }))}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor="#fff"
                  />
                </View>
                <Text style={styles.label}>{t("profile.notes")}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={draft.notes ?? ""}
                  onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
                  placeholder={t("profile.notesPlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </>
            )}

            {draft.role === "caregiver" && (
              <>
                <Text style={styles.label}>{t("profile.experience")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.experience ?? ""}
                  onChangeText={(experience) => setDraft((d) => ({ ...d, experience }))}
                  placeholder={t("profile.experiencePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("onboarding.specialty")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.specialty ?? ""}
                  onChangeText={(specialty) => setDraft((d) => ({ ...d, specialty }))}
                  placeholder={draft.role === "caregiver" ? "e.g. Newborn care, breastfeeding support" : ""}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("profile.weeklyRate")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.weeklyRate ?? ""}
                  onChangeText={(weeklyRate) => setDraft((d) => ({ ...d, weeklyRate }))}
                  placeholder={t("profile.weeklyRatePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("profile.availability")}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.availability ?? ""}
                  onChangeText={(availability) => setDraft((d) => ({ ...d, availability }))}
                  placeholder={t("profile.availabilityPlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>{t("profile.liveIn")}</Text>
                  <Switch
                    value={draft.liveIn ?? false}
                    onValueChange={(liveIn) => setDraft((d) => ({ ...d, liveIn }))}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>{t("profile.breastfeeding")}</Text>
                  <Switch
                    value={draft.breastfeeding ?? false}
                    onValueChange={(breastfeeding) => setDraft((d) => ({ ...d, breastfeeding }))}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor="#fff"
                  />
                </View>
              </>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t("profile.cancel")}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>{t("profile.save")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "85%",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 14,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontWeight: "600", color: colors.text },
});
