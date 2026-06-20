import { Baby, DollarSign, Home, MapPin, Search, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { PressSlide } from "../../components/PressSlide";
import { PARENT_LISTINGS, type ParentListing } from "../../demo/parents";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { colors, radius } from "../../theme";

export function CaregiverFindScreen() {
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("caregiver.find.title")}</Text>
          <Text style={styles.subtitle}>{t("caregiver.find.subtitle")}</Text>
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
          placeholder={ko ? "지역, 예산, 입주 여부 검색…" : "Search by location, budget, live-in…"}
          placeholderTextColor={colors.muted}
        />
      </View>

      {PARENT_LISTINGS.map((parent) => (
        <ParentCard
          key={parent.id}
          parent={parent}
          ko={ko}
          expanded={expanded === parent.id}
          onToggle={() => setExpanded(expanded === parent.id ? null : parent.id)}
          t={t}
        />
      ))}
    </ScrollView>
  );
}

function ParentCard({
  parent,
  ko,
  expanded,
  onToggle,
  t,
}: {
  parent: ParentListing;
  ko: boolean;
  expanded: boolean;
  onToggle: () => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <PressSlide style={styles.card} onPress={onToggle}>
      <View style={styles.cardTop}>
        <Avatar src={parent.avatar} size={52} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{ko ? parent.nameKo : parent.name}</Text>
            <View style={styles.matchBadge}>
              <Sparkles size={9} color={colors.gold} />
              <Text style={styles.matchScore}>{parent.matchScore}%</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={11} color={colors.muted} />
            <Text style={styles.meta}>{ko ? parent.locationKo : parent.location}</Text>
          </View>
          <View style={styles.pills}>
            <Pill icon={Baby} color="#ec4899" label={ko ? parent.dueDateKo : parent.dueDate} />
            <Pill icon={Home} color="#8b5cf6" label={parent.liveIn ? (ko ? t("caregiver.home.liveIn") : "Live-in") : (ko ? t("caregiver.home.liveOut") : "Live-out")} />
          </View>
        </View>
      </View>

      <View style={styles.budgetRow}>
        <DollarSign size={13} color={colors.sage} />
        <Text style={styles.budget}>{parent.budget}</Text>
        <View style={styles.langPills}>
          {parent.languages.map((l) => (
            <Text key={l} style={styles.langChip}>{l}</Text>
          ))}
        </View>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <Text style={styles.notesLabel}>{ko ? "특이사항" : "Special Notes"}</Text>
          <Text style={styles.notes}>{ko ? parent.notesKo : parent.notes}</Text>
          <PressSlide style={styles.requestBtn}>
            <Text style={styles.requestBtnText}>{t("caregiver.find.requestInterview")}</Text>
          </PressSlide>
        </View>
      )}
    </PressSlide>
  );
}

function Pill({ icon: Icon, color, label }: { icon: typeof Baby; color: string; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}14` }]}>
      <Icon size={10} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
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
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 10 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1, marginRight: 8 },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  matchScore: { fontSize: 11, fontWeight: "700", color: colors.gold },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  meta: { fontSize: 12, color: colors.muted },
  pills: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: "600" },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  budget: { fontSize: 14, fontWeight: "700", color: colors.sage, flex: 1 },
  langPills: { flexDirection: "row", gap: 4 },
  langChip: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6B7FA8",
    backgroundColor: "#F0F3FA",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  expanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  notesLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 },
  notes: { fontSize: 13, lineHeight: 20, color: colors.text, opacity: 0.85, marginBottom: 14 },
  requestBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  requestBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
});
