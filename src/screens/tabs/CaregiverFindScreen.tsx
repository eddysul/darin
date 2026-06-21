import { Baby, DollarSign, Globe, Home, MapPin, Milk, Search, Sparkles, User, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [profileParent, setProfileParent] = useState<ParentListing | null>(null);

  return (
    <>
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
            onViewProfile={() => setProfileParent(parent)}
            t={t}
          />
        ))}
      </ScrollView>

      <ParentProfileSheet
        parent={profileParent}
        ko={ko}
        onClose={() => setProfileParent(null)}
        t={t}
      />
    </>
  );
}

function ParentCard({
  parent,
  ko,
  expanded,
  onToggle,
  onViewProfile,
  t,
}: {
  parent: ParentListing;
  ko: boolean;
  expanded: boolean;
  onToggle: () => void;
  onViewProfile: () => void;
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
          <View style={styles.expandedActions}>
            <PressSlide style={styles.profileBtn} onPress={onViewProfile}>
              <User size={14} color={colors.navy} />
              <Text style={styles.profileBtnText}>{ko ? "프로필 보기" : "View Profile"}</Text>
            </PressSlide>
            <PressSlide style={styles.requestBtn}>
              <Text style={styles.requestBtnText}>{t("caregiver.find.requestInterview")}</Text>
            </PressSlide>
          </View>
        </View>
      )}
    </PressSlide>
  );
}

function ParentProfileSheet({
  parent,
  ko,
  onClose,
  t,
}: {
  parent: ParentListing | null;
  ko: boolean;
  onClose: () => void;
  t: (key: MessageKey) => string;
}) {
  if (!parent) return null;

  const rows = [
    { icon: MapPin, color: "#6B7FA8", label: ko ? "위치" : "Location", value: ko ? parent.locationKo : parent.location },
    { icon: Baby, color: "#ec4899", label: ko ? "출산 예정일" : "Due Date", value: ko ? parent.dueDateKo : parent.dueDate },
    { icon: DollarSign, color: "#22c55e", label: ko ? "예산" : "Budget", value: parent.budget },
    { icon: Home, color: "#8b5cf6", label: ko ? "입주 여부" : "Live-in", value: parent.liveIn ? (ko ? "입주 선호" : "Live-in preferred") : (ko ? "출퇴근 선호" : "Live-out preferred") },
    { icon: Milk, color: "#243036", label: ko ? "모유수유" : "Breastfeeding", value: parent.breastfeeding ? (ko ? "모유수유 예정" : "Breastfeeding") : (ko ? "분유 수유" : "Formula feeding") },
    { icon: Globe, color: "#6B7FA8", label: ko ? "언어" : "Languages", value: parent.languages.join(", ") },
  ];

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetProfile}>
              <Avatar src={parent.avatar} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>{ko ? parent.nameKo : parent.name}</Text>
                <View style={styles.sheetMatchRow}>
                  <Sparkles size={10} color={colors.gold} />
                  <Text style={styles.sheetMatch}>{parent.matchScore}% {ko ? "매칭" : "match"}</Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
            {/* Details */}
            <View style={styles.sheetCard}>
              {rows.map(({ icon: Icon, color, label, value }, i) => (
                <View key={label} style={[styles.profileRow, i > 0 && styles.profileRowBorder]}>
                  <View style={[styles.profileIcon, { backgroundColor: `${color}18` }]}>
                    <Icon size={14} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileLabel}>{label}</Text>
                    <Text style={styles.profileValue}>{value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Notes */}
            <View style={styles.sheetCard}>
              <Text style={styles.notesLabel}>{ko ? "특이사항" : "Special Notes"}</Text>
              <Text style={styles.sheetNotes}>{ko ? parent.notesKo : parent.notes}</Text>
            </View>
          </ScrollView>

          {/* Action */}
          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{ko ? "닫기" : "Close"}</Text>
            </Pressable>
            <Pressable style={styles.sheetRequestBtn}>
              <Text style={styles.sheetRequestBtnText}>{t("caregiver.find.requestInterview")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  expandedActions: { flexDirection: "row", gap: 10 },
  profileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: `${colors.navy}12`,
    borderRadius: radius.md,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: `${colors.navy}20`,
  },
  profileBtnText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  requestBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  requestBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },

  // Profile sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 32,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  sheetProfile: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  sheetName: { fontSize: 18, fontWeight: "700", color: colors.text },
  sheetMatchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  sheetMatch: { fontSize: 12, fontWeight: "600", color: colors.gold },
  closeBtn: { padding: 4 },
  sheetScroll: { maxHeight: "65%" as unknown as number },
  sheetCard: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  profileRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  profileIcon: { borderRadius: 10, padding: 8 },
  profileLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  profileValue: { fontSize: 14, color: colors.text, fontWeight: "500", marginTop: 1 },
  sheetNotes: { fontSize: 13, lineHeight: 20, color: colors.text, opacity: 0.85 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: "#8E8E93",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  sheetRequestBtn: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRequestBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
