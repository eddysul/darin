import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { BabyLogIcon, type MiscIconKey } from "../../components/babylog/BabyLogIcon";
import { BabyStickerVaultModal } from "../../components/babylog/BabyStickerVaultModal";
import { DiaryReminderSettingsModal } from "../../components/babylog/DiaryReminderSettingsModal";
import { QuickRecordEditorSheet } from "../../components/babylog/QuickRecordEditorSheet";
import { ErrorState } from "../../components/states/FeedbackStates";
import { QaDebugPanel } from "../../components/qa/QaDebugPanel";
import { LanguagePicker } from "../../components/LanguagePicker";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { isPregnancyStage } from "../../utils/childDisplay";
import { useLogout } from "../../context/LogoutContext";
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors, radius, type } from "../../theme";
import type { DiaryReminderSettings } from "../../types/diaryReminder";
import type { SettingsDetailPage } from "../../navigation/types";
import { DEFAULT_DIARY_REMINDER } from "../../types/diaryReminder";
import {
  clearLocalAppData,
  deleteServerAccount,
  hasAccountDeletionApi,
} from "../../utils/accountDeletion";
import {
  getDiaryReminder,
  hydrateDiaryReminder,
  saveDiaryReminder,
} from "../../utils/diaryReminderStore";
import { sendDiaryNotificationPreview } from "../../utils/diaryReminderNotifications";
import { localizedErrorMessage } from "../../utils/familyDisplay";
import { useLanguage } from "../../LanguageContext";
import { canShowLanguagePicker } from "../../config/featureFlags";
import type { MessageKey } from "../../i18n";

type Props = {
  onOpenProfile: () => void;
  onOpenMyProfile?: () => void;
  onOpenFamilyShare: () => void;
  onOpenSettings: (page: SettingsDetailPage) => void;
  onOpenGrowthRecords: () => void;
  onOpenGrowthBookStorage?: () => void;
  onOpenConsult?: () => void;
  embedded?: boolean;
};

const ACCOUNT_DELETION_CONFIRMATION = "\uC0AD\uC81C";

export function MenuScreen({ onOpenProfile, onOpenMyProfile, onOpenFamilyShare, onOpenSettings, onOpenGrowthRecords, onOpenGrowthBookStorage, onOpenConsult, embedded = false }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const logout = useLogout();
  const { settings, setSettings, resetSettings } = useAppSettings();
  const {
    babyName,
    babyStickers,
    addBabySticker,
    deleteBabySticker,
    logAuthor,
    quickRecords,
    setQuickRecords,
    clearAllUserData,
    rehydrateFromServer,
    localDataScope,
    careSetup,
    myFamilyRole,
  } = useBabyLog();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [quickRecordsOpen, setQuickRecordsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLocal, setDeleteLocal] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [reminder, setReminder] = useState<DiaryReminderSettings>({
    ...DEFAULT_DIARY_REMINDER,
  });
  const hasServerDeletion = hasAccountDeletionApi();

  useEffect(() => {
    void hydrateDiaryReminder(localDataScope).then(() => setReminder(getDiaryReminder()));
    void AuthRepository.getUser().then(setAuthUser).catch(() => setAuthUser(null));
  }, [localDataScope]);

  useEffect(() => {
    if (hasServerDeletion) setDeleteError("");
  }, [hasServerDeletion]);

  const confirmLogout = () => {
    Alert.alert(t("settings.critical.030"), t("settings.critical.031"), [
      { text: t("settings.critical.032"), style: "cancel" },
      {
        text: t("settings.critical.030"),
        style: "destructive",
        onPress: () => {
          setLoggingOut(true);
          void Promise.resolve(logout())
            .catch(() => Alert.alert(t("settings.critical.033"), t("settings.critical.034")))
            .finally(() => setLoggingOut(false));
        },
      },
    ]);
  };

  const performDelete = async () => {
    if (deleting) return;
    if (authUser && !hasServerDeletion) {
      setDeleteError(t("settings.critical.035"));
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteConfirmation.trim() !== t("settings.critical.036")) {
        setDeleteError(t("settings.critical.037"));
        return;
      }
      const result = await deleteServerAccount(ACCOUNT_DELETION_CONFIRMATION);
      if (result.localOnly && !deleteLocal) {
        setDeleteOpen(false);
        Alert.alert(
          t("settings.critical.038"),
          t("settings.critical.039"),
        );
        return;
      }
      if (deleteLocal) {
        await clearAllUserData();
        await clearLocalAppData();
        await resetSettings();
      }
      setDeleteOpen(false);
      await logout();
      if (result.localOnly) {
        Alert.alert(
          t("settings.critical.040"),
          t("settings.critical.041"),
        );
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? localizedErrorMessage(t, error.message) : t("settings.critical.042"),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: embedded ? 20 : Math.max(insets.top + 10, 24),
            paddingBottom: insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!embedded ? <Text style={styles.eyebrow}>K-NANNY</Text> : null}
        {!embedded ? <Text style={styles.title}>{t("settings.critical.043")}</Text> : null}
        <Text style={styles.subtitle}>{t("settings.critical.044")}</Text>

        <MenuSection title={t("settings.critical.045")}>
          <MenuRow
            icon="profile"
            title={t("settings.critical.046")}
            subtitle={t("settings.critical.047")}
            onPress={() => (onOpenMyProfile ? onOpenMyProfile() : onOpenSettings("account"))}
          />
          <MenuRow icon="baby" title={t("settings.critical.048")} subtitle={t("settings.critical.049")} onPress={onOpenProfile} />
          <MenuRow icon="family" title={t("settings.critical.050")} subtitle={t("settings.critical.051")} onPress={onOpenFamilyShare} />
          {onOpenConsult ? (
            <MenuRow
              icon="bot"
              title={t("settings.critical.052")}
              subtitle={t("settings.critical.053")}
              onPress={onOpenConsult}
            />
          ) : null}
        </MenuSection>

        <MenuSection title={t("settings.critical.054")}>
          <MenuRow
            icon="bell"
            title={t("settings.critical.055")}
            subtitle={t("settings.critical.056")}
            onPress={() => setReminderOpen(true)}
          />
        </MenuSection>

        <MenuSection title={t("settings.critical.057")}>
          <MenuRow icon="edit" title={t("settings.critical.058")} subtitle={t("settings.critical.059")} onPress={() => onOpenSettings("categories")} />
          <MenuRow icon="sparkles" title={t("settings.critical.060")} subtitle={t("settings.critical.061")} onPress={() => setQuickRecordsOpen(true)} />
          <MenuRow icon="clock" title={t("settings.critical.062")} subtitle={t("settings.critical.063")} onPress={() => onOpenSettings("timers")} />
          <MenuRow icon="interval" title={t("settings.critical.064")} subtitle="ml/oz·kg/lb·°C/°F·cm/inch" onPress={() => onOpenSettings("units")} />
          <MenuRow icon="clock" title={t("settings.critical.065")} subtitle={t("settings.critical.066")} onPress={() => onOpenSettings("time")} />
          {canShowLanguagePicker() ? (
            <MenuRow
              icon="globe"
              title={t("settings.critical.324")}
              subtitle={t(`profileSetup.language.${settings.account.language}` as MessageKey)}
              onPress={() => setLanguageOpen(true)}
            />
          ) : null}
          <MenuRow icon="interval" title={t("settings.critical.067")} subtitle={t("settings.critical.068")} onPress={onOpenGrowthRecords} />
        </MenuSection>

        <MenuSection title={t("settings.critical.069")}>
          <MenuRow icon="baby" title={t("settings.critical.070")} subtitle={t("settings.critical.071")} onPress={() => setStickerOpen(true)} />
          {onOpenGrowthBookStorage ? (
            <MenuRow icon="folder" title={t("settings.critical.072")} subtitle={t("settings.critical.073")} onPress={onOpenGrowthBookStorage} />
          ) : null}
          <MenuRow icon="folder" title={t("settings.critical.074")} subtitle={t("settings.critical.075")} onPress={() => onOpenSettings("growthBook")} />
        </MenuSection>

        <MenuSection title={t("settings.critical.076")}>
          <MenuRow
            icon="check"
            title={t("settings.critical.077")}
            subtitle={t("settings.critical.078")}
            onPress={() => Alert.alert(t("settings.critical.077"), t("settings.critical.079"))}
          />
        </MenuSection>

        <MenuSection title={t("settings.critical.080")}>
          <MenuRow
            icon="folder"
            title={t("settings.critical.081")}
            subtitle={t("settings.critical.082")}
            onPress={() => onOpenSettings("legal")}
          />
          <MenuRow icon="edit" title={t("settings.critical.083")} subtitle={t("settings.critical.084")} onPress={() => onOpenSettings("contact")} />
        </MenuSection>

        {__DEV__ ? <QaDebugPanel trigger="menu" /> : null}

        <MenuSection title={t("settings.critical.085")}>
          <MenuRow icon="profile" title={t("settings.critical.086")} subtitle={t("settings.critical.087")} onPress={() => onOpenSettings("account")} />
          <MenuRow icon="logout" title={t("settings.critical.030")} subtitle={t("settings.critical.088")} onPress={confirmLogout} disabled={loggingOut} />
          <MenuRow
            icon="trash"
            title={t("settings.critical.089")}
            subtitle={t("settings.critical.090")}
            onPress={() => {
              Alert.alert(
                t("settings.critical.091"),
                t("settings.critical.092"),
                [
                  { text: t("settings.critical.032"), style: "cancel" },
                  { text: t("settings.critical.093"), style: "destructive", onPress: () => {
                    setDeleteError("");
                    setDeleteConfirmation("");
                    setDeleteOpen(true);
                  } },
                ],
              );
            }}
            danger
          />
        </MenuSection>
      </ScrollView>

      <LanguagePicker open={languageOpen} onClose={() => setLanguageOpen(false)} />

      <DiaryReminderSettingsModal
        visible={reminderOpen}
        value={reminder}
        babyName={babyName}
        babyId={localDataScope?.babyId ?? null}
        myRole={myFamilyRole}
        onClose={() => setReminderOpen(false)}
        onSave={(next) => {
          setReminder(next);
          void saveDiaryReminder(next, localDataScope);
        }}
        onTestNotification={() => void sendDiaryNotificationPreview({
          title: t("diary.reminder.previewTitle"),
          body: t("diary.reminder.previewBody", { babyName }),
        })}
      />

      <QuickRecordEditorSheet
        visible={quickRecordsOpen}
        records={quickRecords}
        editing={null}
        pregnancy={isPregnancyStage(careSetup.child)}
        onClose={() => setQuickRecordsOpen(false)}
        onSave={setQuickRecords}
      />

      <BabyStickerVaultModal
        visible={stickerOpen}
        babyId={localDataScope?.babyId}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        onClose={() => setStickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
      />

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteOpen(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            contentContainerStyle={styles.deleteScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>{t("settings.critical.094")}</Text>
            <Text style={styles.deleteBody}>
              {hasServerDeletion
                ? t("settings.critical.095")
                : authUser
                  ? t("settings.critical.096")
                  : t("settings.critical.097")}
            </Text>
            <View style={styles.deleteOption}>
              <View style={styles.deleteOptionCopy}>
                <Text style={styles.deleteOptionTitle}>{t("settings.critical.098")}</Text>
                <Text style={styles.deleteOptionMeta}>{t("settings.critical.099")}</Text>
              </View>
              <Switch value={deleteLocal} onValueChange={setDeleteLocal} disabled={deleting} />
            </View>
            <Text style={styles.deleteWarning}>
              {hasServerDeletion
                ? t("settings.critical.100")
                : t("settings.critical.101")}
            </Text>
            <View style={styles.confirmationField}>
              <Text style={styles.deleteOptionTitle}>{t("settings.critical.102")}</Text>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder={t("settings.critical.036")}
                placeholderTextColor={colors.faint}
                editable={!deleting}
                autoCapitalize="none"
                accessibilityLabel={t("settings.critical.102")}
                style={styles.confirmationInput}
              />
            </View>
            {deleteError ? (
              <ErrorState
                title={t("settings.critical.103")}
                body={deleteError}
                onRetry={performDelete}
                busy={deleting}
              />
            ) : null}
            <View style={styles.deleteActions}>
              <Pressable style={styles.cancelButton} onPress={() => setDeleteOpen(false)} disabled={deleting} accessibilityRole="button" accessibilityState={{ disabled: deleting }}>
                <Text style={styles.cancelText}>{t("settings.critical.032")}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmDeleteButton, deleteConfirmation.trim() !== t("settings.critical.036") && styles.disabled]}
                onPress={performDelete}
                disabled={deleting || deleteConfirmation.trim() !== t("settings.critical.036")}
                accessibilityRole="button"
                accessibilityState={{ disabled: deleting || deleteConfirmation.trim() !== t("settings.critical.036"), busy: deleting }}
              >
                {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteText}>{t("settings.critical.104")}</Text>}
              </Pressable>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.section}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  danger,
}: {
  icon: MiscIconKey;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, danger && styles.dangerIconWrap]}>
        <BabyLogIcon kind={icon} size={19} color={danger ? colors.dangerText : colors.amberText} strokeWidth={1.9} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, danger && styles.dangerTitle]}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <BabyLogIcon kind="chevron" size={17} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 15 },
  eyebrow: { color: colors.amberText, fontSize: type.xs, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: type.xl, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: type.sm, marginTop: -8, marginBottom: 4 },
  sectionTitle: { color: colors.muted, fontSize: type.xs, fontWeight: "800", marginBottom: 7, marginLeft: 3 },
  section: { borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.cardHi },
  disabled: { opacity: 0.55 },
  iconWrap: { width: 39, height: 39, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  dangerIconWrap: { backgroundColor: colors.dangerSoft },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: type.sm, fontWeight: "800" },
  dangerTitle: { color: colors.dangerText },
  rowSubtitle: { color: colors.faint, fontSize: type.xs, marginTop: 3 },
  overlay: { flex: 1, backgroundColor: "rgba(30,26,23,0.48)" },
  deleteScroll: { flexGrow: 1, justifyContent: "center", padding: 22 },
  notificationCard: { borderRadius: radius.xl, backgroundColor: colors.card, padding: 20, gap: 8, maxHeight: "88%" },
  notificationTitle: { fontSize: 20, fontWeight: "900", color: colors.text },
  notificationBody: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  notificationScroller: { maxHeight: 420 },
  notificationList: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  notificationClose: { minHeight: 46, marginTop: 8, borderRadius: radius.full, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  notificationCloseText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  deleteCard: { borderRadius: radius.xl, backgroundColor: colors.card, padding: 20 },
  deleteTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  deleteBody: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20 },
  deleteOption: { marginTop: 16, borderRadius: 15, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  deleteOptionCopy: { flex: 1 },
  deleteOptionTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  deleteOptionMeta: { color: colors.faint, fontSize: 11, marginTop: 3 },
  deleteWarning: { marginTop: 13, color: colors.dangerText, fontSize: 11.5, lineHeight: 17 },
  confirmationField: { marginTop: 14, gap: 8 },
  confirmationInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  deleteActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  confirmDeleteButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerText },
  confirmDeleteText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
