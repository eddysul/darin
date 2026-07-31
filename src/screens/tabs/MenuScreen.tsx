import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { EmailAuthModal } from "../../components/auth/EmailAuthModal";
import { BabyLogIcon, type MiscIconKey } from "../../components/babylog/BabyLogIcon";
import { BabyStickerVaultModal } from "../../components/babylog/BabyStickerVaultModal";
import { DiaryReminderSettingsModal } from "../../components/babylog/DiaryReminderSettingsModal";
import { QuickRecordEditorSheet } from "../../components/babylog/QuickRecordEditorSheet";
import { ErrorState } from "../../components/states/FeedbackStates";
import { QaDebugPanel } from "../../components/qa/QaDebugPanel";
import {
  AppSettingsModal,
} from "../../components/settings/AppSettingsModal";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLogout } from "../../context/LogoutContext";
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors, radius } from "../../theme";
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

type Props = {
  onOpenProfile: () => void;
  onOpenSettings: (page: SettingsDetailPage) => void;
  onOpenGrowthRecords: () => void;
  onOpenGrowthBookStorage?: () => void;
  embedded?: boolean;
};

export function MenuScreen({ onOpenProfile, onOpenSettings, onOpenGrowthRecords, onOpenGrowthBookStorage, embedded = false }: Props) {
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
  } = useBabyLog();
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [quickRecordsOpen, setQuickRecordsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLocal, setDeleteLocal] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [emailAuthOpen, setEmailAuthOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [reminder, setReminder] = useState<DiaryReminderSettings>({
    ...DEFAULT_DIARY_REMINDER,
  });
  const hasServerDeletion = hasAccountDeletionApi();

  useEffect(() => {
    void hydrateDiaryReminder().then(() => setReminder(getDiaryReminder()));
    void AuthRepository.getUser().then(setAuthUser).catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    if (hasServerDeletion) setDeleteError("");
  }, [hasServerDeletion]);

  const confirmLogout = () => {
    const anonymous = AuthRepository.isAnonymousUser(authUser);
    Alert.alert("로그아웃", anonymous
      ? "익명 계정은 로그아웃 후 다시 찾을 수 없어요. 먼저 이메일 계정에 연결해주세요."
      : "로그인 화면으로 돌아갈까요? 서버 기록은 다시 로그인하면 복원돼요.", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          setLoggingOut(true);
          void Promise.resolve(logout()).finally(() => setLoggingOut(false));
        },
      },
    ]);
  };

  const performDelete = async () => {
    if (deleting) return;
    if (authUser && !AuthRepository.isAnonymousUser(authUser) && !hasServerDeletion) {
      setDeleteError("이메일 계정 삭제용 서버 API가 아직 배포되지 않았어요. 데이터 보호를 위해 로컬 삭제만 진행하지 않습니다.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteServerAccount();
      if (result.localOnly && !deleteLocal) {
        setDeleteOpen(false);
        Alert.alert(
          "삭제된 데이터가 없어요",
          "현재 빌드는 서버 계정이 없는 데모 모드이며, 로컬 데이터 삭제가 꺼져 있어 기기 데이터는 유지했습니다.",
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
          "로컬 계정 삭제 완료",
          "현재 빌드는 서버 계정이 없는 데모 모드여서 선택한 기기 데이터만 삭제했습니다.",
        );
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
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
        {!embedded ? <Text style={styles.title}>메뉴</Text> : null}
        <Text style={styles.subtitle}>계정과 기록 방식을 한 곳에서 관리해요.</Text>

        <MenuSection title="아기/가족">
          <MenuRow icon="baby" title="아기 프로필" subtitle="아기 정보와 기본 설정" onPress={onOpenProfile} />
          <MenuRow icon="family" title="가족 공유" subtitle="구성원 역할과 활성 상태 관리" onPress={onOpenProfile} />
          <MenuRow icon="folder" title="초대코드 관리" subtitle="초대 코드·링크 생성 및 수락" onPress={onOpenProfile} />
        </MenuSection>

        <MenuSection title="알림">
          <MenuRow icon="bell" title="일기 알림 설정" subtitle="오늘 일기 리마인더" onPress={() => setReminderOpen(true)} />
          <MenuRow icon="clock" title="수유/수면 알림 설정" subtitle="돌봄 간격 알림" onPress={() => onOpenSettings("careAlerts")} />
        </MenuSection>

        <MenuSection title="기록 설정">
          <MenuRow icon="interval" title="성장 기록 관리" subtitle="키·몸무게·머리둘레 기록" onPress={onOpenGrowthRecords} />
          <MenuRow icon="edit" title="기록 카테고리 설정" subtitle="표시·순서·기본 6개 관리" onPress={() => onOpenSettings("categories")} />
          <MenuRow icon="sparkles" title="자주 쓰는 기록" subtitle="기본값 빠른 기록 관리" onPress={() => setQuickRecordsOpen(true)} />
          <MenuRow icon="clock" title="스탑워치 설정" subtitle="타이머 종류와 복원 방식" onPress={() => onOpenSettings("timers")} />
          <MenuRow icon="interval" title="단위 설정" subtitle="ml/oz·kg/lb·°C/°F·cm/inch" onPress={() => onOpenSettings("units")} />
          <MenuRow icon="clock" title="시간 설정" subtitle="시간 표시·하루/주 시작·아기 나이" onPress={() => onOpenSettings("time")} />
        </MenuSection>

        <MenuSection title="꾸미기/성장책">
          <MenuRow icon="baby" title="내 아기 스티커" subtitle="스티커 만들기와 보관함" onPress={() => setStickerOpen(true)} />
          {onOpenGrowthBookStorage ? <MenuRow icon="folder" title="성장책 보관함" subtitle="담긴 기록·미리보기·PDF 관리" onPress={onOpenGrowthBookStorage} /> : null}
          <MenuRow icon="folder" title="성장책 설정" subtitle="날짜·작성자·기본 레이아웃" onPress={() => onOpenSettings("growthBook")} />
        </MenuSection>

        <MenuSection title="구독/정책">
          <MenuRow icon="check" title="결제/구독" subtitle="플랜과 구매 복원" onPress={() => onOpenSettings("billing")} />
          <MenuRow icon="folder" title="개인정보처리방침" subtitle="수집·보관·삭제 안내" onPress={() => onOpenSettings("privacy")} />
          <MenuRow icon="folder" title="이용약관" subtitle="서비스 이용과 AI 안내" onPress={() => onOpenSettings("terms")} />
          <MenuRow icon="edit" title="문의하기" subtitle="고객지원 및 문의 안내" onPress={() => onOpenSettings("privacy")} />
        </MenuSection>

        {__DEV__ ? <QaDebugPanel trigger="menu" /> : null}

        <MenuSection title="계정">
          {AuthRepository.isAnonymousUser(authUser) ? (
            <MenuRow icon="profile" title="이메일 계정 연결" subtitle="현재 아기와 기록을 그대로 보호" onPress={() => setEmailAuthOpen(true)} />
          ) : null}
          <MenuRow icon="profile" title="계정 설정" subtitle="이름·이메일·언어·관계" onPress={() => setAccountSettingsOpen(true)} />
          <MenuRow icon="logout" title="로그아웃" subtitle="로그인 화면으로 이동" onPress={confirmLogout} disabled={loggingOut} />
          <MenuRow
            icon="trash"
            title="계정 삭제"
            subtitle="서버 계정과 로컬 데이터 삭제"
            onPress={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
            danger
          />
        </MenuSection>
      </ScrollView>

      <AppSettingsModal page={accountSettingsOpen ? "account" : null} onClose={() => setAccountSettingsOpen(false)} />

      <EmailAuthModal
        visible={emailAuthOpen}
        onClose={() => setEmailAuthOpen(false)}
        onAuthenticated={async ({ user, email }) => {
          setAuthUser(user);
          setSettings((current) => ({
            ...current,
            account: { ...current.account, email, loginMethod: "email" },
          }));
          await rehydrateFromServer();
          setEmailAuthOpen(false);
          Alert.alert("계정 연결 완료", "기존 아기와 기록을 유지한 채 이메일 계정으로 연결했어요.");
        }}
      />

      <DiaryReminderSettingsModal
        visible={reminderOpen}
        value={reminder}
        babyName={babyName}
        onClose={() => setReminderOpen(false)}
        onSave={(next) => {
          setReminder(next);
          void saveDiaryReminder(next);
        }}
      />

      <QuickRecordEditorSheet
        visible={quickRecordsOpen}
        records={quickRecords}
        editing={null}
        onClose={() => setQuickRecordsOpen(false)}
        onSave={setQuickRecords}
      />

      <BabyStickerVaultModal
        visible={stickerOpen}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        onClose={() => setStickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
      />

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>계정을 삭제할까요?</Text>
            <Text style={styles.deleteBody}>
              {hasServerDeletion
                ? "서버 계정과 가족 공유 연결에서 제거됩니다. 삭제한 서버 데이터는 복구할 수 없어요."
                : authUser && !AuthRepository.isAnonymousUser(authUser)
                  ? "이메일 계정의 안전한 서버 삭제 API가 아직 필요합니다. 현재는 계정을 삭제하지 않습니다."
                  : "익명 계정은 선택한 경우에만 이 기기의 로컬 데이터를 삭제합니다."}
            </Text>
            <View style={styles.deleteOption}>
              <View style={styles.deleteOptionCopy}>
                <Text style={styles.deleteOptionTitle}>이 기기의 로컬 데이터도 삭제</Text>
                <Text style={styles.deleteOptionMeta}>기록·일기·성장책·상담·스티커 포함</Text>
              </View>
              <Switch value={deleteLocal} onValueChange={setDeleteLocal} disabled={deleting} />
            </View>
            <Text style={styles.deleteWarning}>
              {hasServerDeletion
                ? "계속하면 가족 공유에서 나가고 계정 삭제 요청을 전송합니다."
                : "로컬 데이터 삭제가 꺼져 있으면 어떤 데이터도 삭제하지 않습니다."}
            </Text>
            {deleteError ? (
              <ErrorState
                title="계정을 삭제하지 못했어요"
                body={deleteError}
                onRetry={performDelete}
                busy={deleting}
              />
            ) : null}
            <View style={styles.deleteActions}>
              <Pressable style={styles.cancelButton} onPress={() => setDeleteOpen(false)} disabled={deleting}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={performDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteText}>최종 삭제</Text>}
              </Pressable>
            </View>
          </View>
        </View>
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
        <BabyLogIcon kind={icon} size={19} color={danger ? colors.dangerText : colors.amber} strokeWidth={1.9} />
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
  eyebrow: { color: colors.amber, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: -8, marginBottom: 4 },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 7, marginLeft: 3 },
  section: { borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.cardHi },
  disabled: { opacity: 0.55 },
  iconWrap: { width: 39, height: 39, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  dangerIconWrap: { backgroundColor: colors.dangerSoft },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14.5, fontWeight: "800" },
  dangerTitle: { color: colors.dangerText },
  rowSubtitle: { color: colors.faint, fontSize: 11.5, marginTop: 3 },
  overlay: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(30,26,23,0.48)" },
  deleteCard: { borderRadius: radius.xl, backgroundColor: colors.card, padding: 20 },
  deleteTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  deleteBody: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20 },
  deleteOption: { marginTop: 16, borderRadius: 15, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  deleteOptionCopy: { flex: 1 },
  deleteOptionTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  deleteOptionMeta: { color: colors.faint, fontSize: 11, marginTop: 3 },
  deleteWarning: { marginTop: 13, color: colors.dangerText, fontSize: 11.5, lineHeight: 17 },
  deleteActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  confirmDeleteButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerText },
  confirmDeleteText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
