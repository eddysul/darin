import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon, type MiscIconKey } from "../../components/babylog/BabyLogIcon";
import { DiaryReminderSettingsModal } from "../../components/babylog/DiaryReminderSettingsModal";
import { QaDebugPanel } from "../../components/qa/QaDebugPanel";
import { useBabyLog } from "../../context/BabyLogContext";
import { BabyStickerVaultModal } from "../../components/babylog/BabyStickerVaultModal";
import type { DiaryReminderSettings } from "../../types/diaryReminder";
import { DEFAULT_DIARY_REMINDER } from "../../types/diaryReminder";
import {
  getDiaryReminder,
  hydrateDiaryReminder,
  saveDiaryReminder,
} from "../../utils/diaryReminderStore";
import { colors, radius } from "../../theme";

type Props = { onOpenProfile: () => void };
type InfoKind = "billing" | "privacy" | null;

export function MenuScreen({ onOpenProfile }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, babyStickers, addBabySticker, deleteBabySticker, logAuthor } = useBabyLog();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<InfoKind>(null);
  const [reminder, setReminder] = useState<DiaryReminderSettings>({ ...DEFAULT_DIARY_REMINDER });

  useEffect(() => {
    void hydrateDiaryReminder().then(() => setReminder(getDiaryReminder()));
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>K-NANNY</Text>
        <Text style={styles.title}>메뉴</Text>
        <Text style={styles.subtitle}>프로필과 가족 공유, 앱 설정을 관리해요.</Text>

        <View style={styles.section}>
          <MenuRow icon="profile" title="아기 프로필" subtitle="아기 정보와 기본 설정" onPress={onOpenProfile} />
          <MenuRow icon="family" title="가족 공유" subtitle="초대·역할·활성 상태 관리" onPress={onOpenProfile} />
          <MenuRow
            icon="baby"
            title="내 아기 스티커"
            subtitle="누끼 스티커 만들고 일기·성장책에 쓰기"
            onPress={() => setStickerOpen(true)}
          />
          <MenuRow icon="bell" title="알림 설정" subtitle="오늘 일기 리마인더" onPress={() => setReminderOpen(true)} />
        </View>

        <View style={styles.section}>
          <MenuRow icon="folder" title="결제/구독" subtitle="현재 MVP는 무료 플랜" onPress={() => setInfoOpen("billing")} />
          <MenuRow icon="check" title="개인정보/약관" subtitle="데이터 보관과 이용 안내" onPress={() => setInfoOpen("privacy")} />
        </View>

        {__DEV__ ? <QaDebugPanel trigger="menu" /> : null}
      </ScrollView>

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

      <BabyStickerVaultModal
        visible={stickerOpen}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        onClose={() => setStickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
      />

      <Modal visible={infoOpen !== null} transparent animationType="fade" onRequestClose={() => setInfoOpen(null)}>
        <Pressable style={styles.overlay} onPress={() => setInfoOpen(null)}>
          <Pressable style={styles.infoCard} onPress={() => {}}>
            <Text style={styles.infoTitle}>{infoOpen === "billing" ? "결제/구독" : "개인정보/약관"}</Text>
            <Text style={styles.infoText}>
              {infoOpen === "billing"
                ? "현재 MVP는 무료 플랜으로 운영됩니다. 유료 구독이 도입되기 전 별도로 안내할게요."
                : "육아 기록·사진·음성 데이터의 보관 및 처리 정책은 App Store 제출 전 최종 약관과 개인정보처리방침으로 연결됩니다."}
            </Text>
            <Pressable style={styles.closeButton} onPress={() => setInfoOpen(null)}>
              <Text style={styles.closeText}>확인</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: MiscIconKey;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.iconWrap}>
        <BabyLogIcon kind={icon} size={19} color={colors.amber} strokeWidth={1.9} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <BabyLogIcon kind="chevron" size={17} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 14 },
  eyebrow: { color: colors.amber, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: -8, marginBottom: 4 },
  section: {
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.cardHi },
  iconWrap: { width: 39, height: 39, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14.5, fontWeight: "800" },
  rowSubtitle: { color: colors.faint, fontSize: 11.5, marginTop: 3 },
  overlay: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(30,26,23,0.48)" },
  infoCard: { borderRadius: radius.xl, backgroundColor: colors.card, padding: 20 },
  infoTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  infoText: { marginTop: 10, fontSize: 13, lineHeight: 20, color: colors.muted },
  closeButton: { marginTop: 18, borderRadius: 14, backgroundColor: colors.amber, paddingVertical: 12, alignItems: "center" },
  closeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
