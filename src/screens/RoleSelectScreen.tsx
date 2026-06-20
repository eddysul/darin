import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenBackground } from "../components/ScreenBackground";
import { useLanguage } from "../LanguageContext";
import type { UserRole } from "../types/profile";
import { colors, radius } from "../theme";

type Props = {
  onSelect: (role: UserRole) => void;
};

export function RoleSelectScreen({ onSelect }: Props) {
  const { locale } = useLanguage();
  const ko = locale === "ko";

  return (
    <ScreenBackground style={styles.container}>
      <Image source={require("../../assets/darin-logo.png")} style={styles.logo} contentFit="contain" />
      <Text style={styles.title}>{ko ? "어떤 역할로 시작할까요?" : "Who are you?"}</Text>
      <Text style={styles.subtitle}>{ko ? "역할을 선택하면 맞춤 화면으로 이동합니다." : "Select your role to get started."}</Text>

      <View style={styles.cards}>
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => onSelect("parent")}>
          <Text style={styles.emoji}>👶</Text>
          <Text style={styles.cardTitle}>{ko ? "부모 / 예비 부모" : "Parent"}</Text>
          <Text style={styles.cardDesc}>{ko ? "케어기버 찾기, 돌봄 기록 확인" : "Find caregivers & track baby care"}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => onSelect("caregiver")}>
          <Text style={styles.emoji}>👩‍⚕️</Text>
          <Text style={styles.cardTitle}>{ko ? "산후조리사 / 케어기버" : "Caregiver"}</Text>
          <Text style={styles.cardDesc}>{ko ? "가족 찾기, 입찰, 돌봄 기록 작성" : "Find families, place bids & log care"}</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  logo: { width: 160, height: 96, marginBottom: 32 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 36, lineHeight: 20 },
  cards: { width: "100%", gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  cardPressed: { borderColor: colors.gold, backgroundColor: colors.champagne },
  emoji: { fontSize: 40, marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardDesc: { fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 18 },
});
