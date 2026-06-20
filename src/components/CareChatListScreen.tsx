import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useChat } from "../context/ChatContext";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import { useScreenTopInset } from "../hooks/useScreenInsets";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { colors, radius } from "../theme";

type CareChatListScreenProps = {
  visible: boolean;
  onClose: () => void;
  onOpenThread: (caregiverId: number) => void;
};

export function CareChatListScreen({ visible, onClose, onOpenThread }: CareChatListScreenProps) {
  const { locale, t } = useLanguage();
  const { threads, getPreview } = useChat();
  const topInset = useScreenTopInset(8);

  const sorted = threads;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("chat.inboxTitle")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {sorted.map((thread) => {
            const caregiver = CAREGIVER_MATCHES.find((c) => c.id === thread.caregiverId);
            if (!caregiver) return null;
            const preview = getPreview(thread.caregiverId, locale);
            const time = locale === "ko" ? thread.updatedAtKo : thread.updatedAtEn;

            return (
              <Pressable
                key={thread.caregiverId}
                style={styles.row}
                onPress={() => onOpenThread(thread.caregiverId)}
              >
                <Avatar src={caregiver.img} size={52} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName}>{caregiver.name}</Text>
                    <Text style={styles.rowTime}>{time}</Text>
                  </View>
                  <Text style={styles.rowPreview} numberOfLines={2}>
                    {preview}
                  </Text>
                  {thread.savedChat && (
                    <Text style={styles.rowBadge}>{t("chat.savedChat")}</Text>
                  )}
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </Pressable>
            );
          })}

          {sorted.length === 0 && (
            <View style={styles.empty}>
              <MessageCircle size={32} color={colors.muted} />
              <Text style={styles.emptyText}>{t("chat.emptyInbox")}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.text },
  headerSpacer: { width: 40 },
  list: { flex: 1 },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  rowTime: { fontSize: 12, color: colors.muted, flexShrink: 0 },
  rowPreview: { fontSize: 14, color: colors.muted, marginTop: 4, lineHeight: 20 },
  rowBadge: { fontSize: 10, fontWeight: "600", color: colors.text, marginTop: 6, alignSelf: "flex-start", backgroundColor: colors.yellowSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: colors.muted },
});
