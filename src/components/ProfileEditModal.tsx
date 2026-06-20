import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("profile.editTitle")}</Text>
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
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
});
