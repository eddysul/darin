import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FamilyMember, FamilyRole } from "../../types/family";
import { FAMILY_ROLE_LABELS } from "../../types/family";
import { colors, radius } from "../../theme";

const INVITE_ROLES: FamilyRole[] = ["admin", "editor", "caregiver", "viewer"];

type Props = {
  visible: boolean;
  onClose: () => void;
  onInvite: (draft: { name: string; role: FamilyRole; contact: string }) => FamilyMember;
};

export function InviteFamilyModal({ visible, onClose, onInvite }: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<FamilyRole>("editor");
  const [created, setCreated] = useState<FamilyMember | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => name.trim().length > 0 && contact.trim().length > 0, [name, contact]);

  const reset = () => {
    setName("");
    setContact("");
    setRole("editor");
    setCreated(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInvite = () => {
    if (!canSubmit) return;
    const member = onInvite({ name: name.trim(), role, contact: contact.trim() });
    setCreated(member);
  };

  const copyInvite = async () => {
    if (!created) return;
    const payload = `초대 코드: ${created.inviteCode ?? ""}\n링크: ${created.inviteLink ?? ""}`;
    try {
      await Share.share({ message: payload });
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>가족 · 시터 초대</Text>
          <Text style={styles.hint}>
            실제 전송은 아직 없어요. 초대 코드·링크를 만들고 pending 상태로 로컬에 저장합니다.
          </Text>

          {created ? (
            <>
              <Text style={styles.success}>초대가 준비됐어요 (목업)</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkLabel}>초대 코드</Text>
                <Text style={styles.linkText}>{created.inviteCode}</Text>
                <Text style={[styles.linkLabel, { marginTop: 10 }]}>초대 링크</Text>
                <Text style={styles.linkText}>{created.inviteLink}</Text>
              </View>
              <Text style={styles.hint}>
                상태: 초대 대기 · 권한: {FAMILY_ROLE_LABELS[created.role]}
                {copied ? " · 공유됨" : ""}
              </Text>
              <Pressable style={styles.primaryBtn} onPress={copyInvite}>
                <Text style={styles.primaryText}>초대 코드 · 링크 공유</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={handleClose}>
                <Text style={styles.ghostText}>완료</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="예: 박시터"
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
              <Text style={styles.label}>역할</Text>
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
              <Text style={styles.policy}>
                관리자: 초대/삭제/수정 · 편집 가능: 기록 작성/수정 · 보기만 가능: 조회만
              </Text>
              <Pressable
                style={[styles.primaryBtn, !canSubmit && styles.disabled]}
                onPress={handleInvite}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryText}>초대 코드 생성</Text>
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
  policy: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginBottom: 12 },
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
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
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
  ghostBtn: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  ghostText: { color: colors.muted, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  success: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 10 },
  linkBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  linkLabel: { fontSize: 11, fontWeight: "700", color: colors.faint, marginBottom: 4 },
  linkText: { fontSize: 13, color: colors.muted },
});
