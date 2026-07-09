import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/babylog/AppHeader";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { DiaryComposeModal } from "../../components/babylog/DiaryComposeModal";
import { PushToast } from "../../components/babylog/PushToast";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, radius } from "../../theme";

type Props = {
  onOpenProfile: () => void;
  onSimPush?: () => void;
};

export function DiaryScreen({ onOpenProfile }: Props) {
  const { diaryEntries, addDiary } = useBabyLog();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFromPush, setComposeFromPush] = useState(false);
  const [pushVisible, setPushVisible] = useState(false);

  const openCompose = (fromPush = false) => {
    setComposeFromPush(fromPush);
    setComposeOpen(true);
  };

  return (
    <View style={styles.root}>
      <PushToast
        visible={pushVisible}
        onDismiss={() => setPushVisible(false)}
        onPress={() => {
          setPushVisible(false);
          openCompose(true);
        }}
      />
      <AppHeader onOpenProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => openCompose(false)}>
            <View style={styles.btnInner}>
              <BabyLogIcon kind="edit" size={14} color={colors.amberDark} strokeWidth={2.2} />
              <Text style={styles.btnPrimaryText}>새 일기 쓰기</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setPushVisible(true)}>
            <View style={styles.btnInner}>
              <BabyLogIcon kind="bell" size={14} color={colors.muted} />
              <Text style={styles.btnGhostText}>알림 눌러보기</Text>
            </View>
          </Pressable>
        </View>

        {diaryEntries.length === 0 ? (
          <Text style={styles.empty}>아직 작성한 일기가 없어요.</Text>
        ) : (
          diaryEntries.map((d) => (
            <View key={d.id} style={styles.card}>
              {d.photoUri ? (
                <Image source={{ uri: d.photoUri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <BabyLogIcon catId="memo" size={24} />
                </View>
              )}
              <View style={styles.body}>
                <Text style={styles.date}>{d.date}</Text>
                <Text style={styles.comment} numberOfLines={2}>
                  {d.comment}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DiaryComposeModal
        visible={composeOpen}
        fromPush={composeFromPush}
        onClose={() => setComposeOpen(false)}
        onSave={(comment, photoUri) => {
          const now = new Date();
          addDiary({
            date: `${now.getMonth() + 1}월 ${now.getDate()}일 (오늘)`,
            emoji: "📝",
            comment,
            photoUri,
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  topRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.amber },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 13 },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", color: colors.faint, fontSize: 12.5, paddingVertical: 24 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  date: { fontSize: 11, color: colors.faint, fontWeight: "600" },
  comment: { fontSize: 13, color: colors.text, marginTop: 3, lineHeight: 20 },
});
