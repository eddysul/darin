import { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { OnboardingShell } from "./OnboardingShell";
import { colors, radius } from "../../theme";
import { createId } from "../../utils/id";

type Props = {
  babyName: string;
  onDone: () => void;
  onSkip: () => void;
};

export function InviteShareScreen({ babyName, onDone, onSkip }: Props) {
  const invite = useMemo(() => {
    const code = createId().replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase().padEnd(6, "1");
    return {
      code,
      link: `https://darin.app/invite/${code}`,
    };
  }, []);
  const [shared, setShared] = useState(false);

  return (
    <OnboardingShell
      title="가족 초대코드"
      subtitle={`${babyName} 기록에 가족을 초대할 수 있어요.`}
      primaryLabel={shared ? "시작하기" : "초대하고 시작하기"}
      onPrimary={onDone}
      secondaryLabel="나중에 하기"
      onSecondary={onSkip}
    >
      <View style={styles.card}>
        <Text style={styles.label}>초대코드</Text>
        <Text style={styles.code}>{invite.code}</Text>
        <Text style={styles.link}>{invite.link}</Text>
      </View>
      <Pressable
        style={styles.shareBtn}
        onPress={() => {
          void Share.share({
            message: `${babyName} 육아 기록에 초대해요.\n코드: ${invite.code}\n${invite.link}`,
          }).then(() => setShared(true));
        }}
      >
        <Text style={styles.shareText}>공유하기</Text>
      </Pressable>
      <Text style={styles.note}>실제 전송 없는 MVP 목업입니다. 코드는 기기에 저장돼요.</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: "700", color: colors.faint, marginBottom: 8 },
  code: { fontSize: 32, fontWeight: "900", letterSpacing: 4, color: colors.text },
  link: { marginTop: 10, fontSize: 12, color: colors.muted },
  shareBtn: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareText: { fontSize: 15, fontWeight: "800", color: colors.text },
  note: { marginTop: 14, fontSize: 12, color: colors.faint, textAlign: "center", lineHeight: 18 },
});
