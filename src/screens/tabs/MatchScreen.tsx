import { CheckCircle, Clock, Globe, MapPin, Search, Sparkles, Star } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { CAREGIVER_MATCHES, type CaregiverMatch } from "../../demo/caregivers";
import { CaregiverFindScreen } from "./CaregiverFindScreen";
import { getCaregiverRole } from "../../i18n";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";

type Props = {
  onViewProfile: (caregiver: CaregiverMatch) => void;
};

export function MatchScreen({ onViewProfile }: Props) {
  const { profile } = useApp();
  const { locale, t } = useLanguage();

  if (profile.role === "caregiver") return <CaregiverFindScreen />;
  const ko = locale === "ko";
  const filters = [
    t("match.filterAll"),
    t("match.filterBilingual"),
    t("match.filterWeekday"),
    t("match.filterInfant"),
    t("match.filterCertified"),
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("match.title")}</Text>
          <Text style={styles.subtitle}>{t("match.subtitle")}</Text>
        </View>
        <View style={styles.aiBadge}>
          <Sparkles size={11} color={colors.gold} />
          <Text style={styles.aiBadgeText}>{t("match.aiRecommended")}</Text>
        </View>
      </View>

      <View style={styles.search}>
        <Search size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("match.placeholder")}
          placeholderTextColor={colors.muted}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {filters.map((f, idx) => (
          <Pressable key={f} style={[styles.filterChip, idx === 0 && styles.filterChipActive]}>
            <Text style={[styles.filterText, idx === 0 && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {CAREGIVER_MATCHES.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View>
              <Avatar src={c.img} size={52} />
              {c.verified && (
                <View style={styles.verified}>
                  <CheckCircle size={12} color="#fff" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.matchScore}>
                  {c.matchScore}% {t("match.matchScore")}
                </Text>
              </View>
              <Text style={styles.role}>{getCaregiverRole(locale, c.role)}</Text>
              <View style={styles.metaRow}>
                <Star size={11} color={colors.gold} fill={colors.gold} />
                <Text style={styles.meta}>{c.rating}</Text>
                <MapPin size={11} color={colors.muted} />
                <Text style={styles.meta}>{c.distance}</Text>
                <Clock size={11} color={colors.muted} />
                <Text style={styles.meta}>{c.available.split(" ").slice(0, 2).join(" ")}</Text>
              </View>
            </View>
          </View>

          <View style={styles.explainBox}>
            <Text style={styles.explainTitle}>
              <Sparkles size={11} color={colors.gold} /> {t("match.whyRecommended")}
            </Text>
            <Text style={styles.explainBody}>{locale === "ko" ? c.aiExplanationKo : c.aiExplanationEn}</Text>
          </View>

          <Text style={styles.reasonsTitle}>{t("match.matchReasons")}</Text>
          <View style={styles.reasons}>
            {(ko ? c.matchReasonsKo : c.matchReasons).map((r) => (
              <Text key={r} style={styles.reasonChip}>
                {r}
              </Text>
            ))}
          </View>

          <View style={styles.langs}>
            {c.languages.map((lang) => (
              <View key={lang} style={styles.langChip}>
                <Globe size={10} color="#6B7FA8" />
                <Text style={styles.langText}>{lang}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.price}>{c.weeklyPay}</Text>
            <Pressable style={styles.viewBtn} onPress={() => onViewProfile(c)}>
              <Text style={styles.viewBtnText}>{t("match.viewProfile")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.champagne,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  aiBadgeText: { fontSize: 11, fontWeight: "600", color: colors.gold },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  filters: { marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  filterTextActive: { color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  verified: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: colors.sage,
    borderRadius: 10,
    padding: 2,
  },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  matchScore: { fontSize: 11, fontWeight: "700", color: colors.gold, backgroundColor: colors.champagne, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  role: { fontSize: 12, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  meta: { fontSize: 11, color: colors.muted, marginRight: 4 },
  explainBox: {
    marginTop: 12,
    backgroundColor: "#FFF9EB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  explainTitle: { fontSize: 12, fontWeight: "600", color: colors.gold, marginBottom: 4 },
  explainBody: { fontSize: 12, lineHeight: 18, color: colors.text, opacity: 0.85 },
  reasonsTitle: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 12, marginBottom: 6 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    backgroundColor: colors.champagne,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F3FA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  langText: { fontSize: 11, color: "#6B7FA8", fontWeight: "500" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  price: { fontSize: 14, fontWeight: "700", color: colors.gold },
  viewBtn: { backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md },
  viewBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
});
