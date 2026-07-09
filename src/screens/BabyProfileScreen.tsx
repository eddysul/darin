import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { useBabyLog } from "../context/BabyLogContext";
import { colors, radius } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MEMBER_COLORS = [colors.amber, "#7c83fd", "#5CB87A"];

export function BabyProfileScreen({ visible, onClose }: Props) {
  const { babyName, babyBirthMeta, caregivers } = useBabyLog();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>프로필</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.babyCard}>
            <View style={styles.babyAvatar}>
              <BabyLogIcon kind="baby" size={32} color={colors.amber} />
            </View>
            <View>
              <Text style={styles.babyName}>{babyName}</Text>
              <Text style={styles.babyAge}>{babyBirthMeta}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>함께 보는 가족</Text>
          {caregivers.map((m, i) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.avatar}>
                <BabyLogIcon kind="profile" size={18} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.role}</Text>
              </View>
              <Text style={styles.memberStatus}>{m.badge}</Text>
            </View>
          ))}

          <Pressable style={styles.inviteBtn}>
            <View style={styles.inviteInner}>
              <BabyLogIcon kind="new" size={14} color={colors.amber} strokeWidth={2.2} />
              <Text style={styles.inviteText}>보호자 초대하기</Text>
            </View>
          </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  close: { fontSize: 20, color: colors.muted },
  content: { padding: 20 },
  babyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 24,
  },
  babyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  babyName: { fontSize: 18, fontWeight: "700", color: colors.text },
  babyAge: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.faint, marginBottom: 10 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardHi,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.text },
  memberRole: { fontSize: 11.5, color: colors.faint, marginTop: 1 },
  memberStatus: { fontSize: 11, color: colors.amber, fontWeight: "600" },
  inviteBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.amber,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  inviteInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  inviteText: { fontSize: 13, fontWeight: "700", color: colors.amber },
});
