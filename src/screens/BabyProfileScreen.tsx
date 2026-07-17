import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { InviteFamilyModal } from "../components/babylog/InviteFamilyModal";
import { EmptyState } from "../components/states/FeedbackStates";
import { useBabyLog } from "../context/BabyLogContext";
import {
  canInvite,
  canManageMembers,
  FAMILY_ROLE_LABELS,
  FAMILY_STATUS_LABELS,
  type FamilyRole,
} from "../types/family";
import { colors, radius } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MEMBER_COLORS = [colors.amber, "#7c83fd", "#5CB87A", "#c98a54"];

export function BabyProfileScreen({ visible, onClose }: Props) {
  const {
    babyName,
    babyBirthMeta,
    familyMembers,
    myFamilyRole,
    inviteFamilyMember,
    updateFamilyMemberRole,
    acceptFamilyInvite,
    setFamilyMemberStatus,
    removeFamilyMember,
  } = useBabyLog();
  const [inviteOpen, setInviteOpen] = useState(false);
  const allowInvite = canInvite(myFamilyRole);
  const allowManage = canManageMembers(myFamilyRole);

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
          {familyMembers.length === 0 ? (
            <EmptyState title="아직 공유 멤버가 없어요." body="가족이나 시터를 초대해 보세요." />
          ) : (
            familyMembers.map((m, i) => (
              <View key={m.id} style={[styles.memberRow, m.status === "inactive" && styles.inactiveRow]}>
                <View style={styles.avatar}>
                  <BabyLogIcon kind="profile" size={18} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {m.name}
                    {m.isMe ? " (나)" : ""}
                  </Text>
                  <Text style={styles.memberRole}>
                    {FAMILY_ROLE_LABELS[m.role]}
                    {m.contact ? ` · ${m.contact}` : ""}
                  </Text>
                  {!m.isMe && allowManage && m.status !== "inactive" && (
                    <View style={styles.miniRoles}>
                      {(["admin", "editor", "caregiver", "viewer"] as FamilyRole[]).map((r) => (
                        <Pressable
                          key={r}
                          style={[styles.miniChip, m.role === r && styles.miniChipActive]}
                          onPress={() => updateFamilyMemberRole(m.id, r)}
                        >
                          <Text style={[styles.miniChipText, m.role === r && styles.miniChipTextActive]}>
                            {FAMILY_ROLE_LABELS[r]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {!m.isMe && allowManage && (
                    <View style={styles.actions}>
                      {m.status === "pending" ? (
                        <Pressable style={styles.actionBtn} onPress={() => acceptFamilyInvite(m.id)}>
                          <Text style={styles.actionText}>수락 시뮬레이션</Text>
                        </Pressable>
                      ) : null}
                      {m.status !== "inactive" ? (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => setFamilyMemberStatus(m.id, "inactive")}
                        >
                          <Text style={styles.actionText}>비활성화</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => setFamilyMemberStatus(m.id, "active")}
                        >
                          <Text style={styles.actionText}>다시 활성화</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.actionBtn} onPress={() => removeFamilyMember(m.id)}>
                        <Text style={[styles.actionText, styles.danger]}>삭제</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text style={styles.memberStatus}>
                  {m.isMe ? "나" : FAMILY_STATUS_LABELS[m.status]}
                </Text>
              </View>
            ))
          )}

          {allowInvite ? (
            <Pressable style={styles.inviteBtn} onPress={() => setInviteOpen(true)}>
              <View style={styles.inviteInner}>
                <BabyLogIcon kind="new" size={14} color={colors.amber} strokeWidth={2.2} />
                <Text style={styles.inviteText}>보호자 초대하기</Text>
              </View>
            </Pressable>
          ) : (
            <Text style={styles.viewerHint}>초대 권한이 없어요. 관리자에게 요청해 주세요.</Text>
          )}
        </ScrollView>
      </View>

      <InviteFamilyModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={inviteFamilyMember}
      />
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
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  inactiveRow: { opacity: 0.55 },
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
  memberStatus: { fontSize: 11, color: colors.amber, fontWeight: "600", marginTop: 4 },
  miniRoles: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  miniChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  miniChipActive: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  miniChipText: { fontSize: 10, color: colors.faint, fontWeight: "600" },
  miniChipTextActive: { color: colors.text },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.card,
  },
  actionText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  danger: { color: "#B45309" },
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
  viewerHint: { marginTop: 12, textAlign: "center", color: colors.faint, fontSize: 12.5 },
});
