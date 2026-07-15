import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FamilyRole } from "../../types/family";
import { FAMILY_ROLE_LABELS } from "../../types/family";
import { colors, radius } from "../../theme";

const INVITE_ROLES: FamilyRole[] = ["admin", "editor", "viewer", "caregiver"];

type Props = {
  visible: boolean;
  onClose: () => void;
  onInvite: (draft: { name: string; role: FamilyRole; contact: string }) => { inviteLink?: string };
};

export function InviteFamilyModal({ visible, onClose, onInvite }: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<FamilyRole>("caregiver");
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && contact.trim().length > 0, [name, contact]);

  const reset = () => {
    setName("");
    setContact("");
    setRole("caregiver");
    setCreatedLink(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInvite = () => {
    if (!canSubmit) return;
    const member = onInvite({ name: name.trim(), role, contact: contact.trim() });
    setCreatedLink(member.inviteLink ?? "초대 링크가 생성됐어요");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>보호자 초대하기</Text>
          <Text style={styles.hint}>실제 문자/메일은 보내지 않아요. 로컬에 멤버와 초대 링크만 만들어요. (mock)</Text>

          {createdLink ? (
            <>
              <Text style={styles.success}>초대 링크가 생성됐어요 (mock)</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkText}>{createdLink}</Text>
              </View>
              <Text style={styles.hint}>상대에게 실제로 전송되지 않았어요. 데모용 상태입니다.</Text>
              <Pressable style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryText}>완료</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="예: 지연 시터"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.label}>전화번호 / 이메일</Text>
              <TextInput
                style={styles.input}
                value={contact}
                onChangeText={setContact}
                placeholder="010-… 또는 email@"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
              />
              <Text style={styles.label}>권한</Text>
              <View style={styles.roleRow}>
                {INVITE_ROLES.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                      {FAMILY_ROLE_LABELS[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.primaryBtn, !canSubmit && styles.disabled]}
                onPress={handleInvite}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryText}>초대 링크 생성</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.faint, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  roleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  roleChipActive: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  roleChipText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  roleChipTextActive: { color: colors.text },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: colors.amberDark, fontSize: 14.5 },
  disabled: { opacity: 0.45 },
  success: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 10 },
  linkBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  linkText: { fontSize: 13, color: colors.muted },
});
