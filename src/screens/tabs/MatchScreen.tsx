import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CheckCircle, Clock, Globe, MapPin, Search, ShieldCheck, Sparkles, Star } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { CaregiverDetailSheet } from "../../components/CaregiverDetailSheet";
import { CarePlanModal } from "../../components/CarePlanModal";
import { CareProposalChatModal } from "../../components/CareProposalChatModal";
import { CareProposalsSheet } from "../../components/CareProposalsSheet";
import { CareRequestModal } from "../../components/CareRequestModal";
import { ContactMessageModal } from "../../components/ContactMessageModal";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useCareFlow } from "../../context/CareFlowContext";
import { CAREGIVER_MATCHES, type CaregiverMatch } from "../../demo/caregivers";
import { getCaregiverRole } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import type { MainTabParamList } from "../MainTabs";
import { getBackgroundCheckLabel, isBackgroundCheckComplete } from "../../utils/caregiverLabels";
import { colors, radius } from "../../theme";

export function MatchScreen() {
  const { locale, t } = useLanguage();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const {
    proposalsReceived,
    setProposalsReceived,
    shortlisted,
    toggleShortlist,
    selectProposal,
    acceptProposal,
    carePlan,
  } = useCareFlow();

  const [selected, setSelected] = useState<CaregiverMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [careRequestOpen, setCareRequestOpen] = useState(false);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [proposalChatOpen, setProposalChatOpen] = useState(false);
  const [proposalChatId, setProposalChatId] = useState(1);
  const [carePlanOpen, setCarePlanOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openProfile = (caregiver: CaregiverMatch) => {
    setSelected(caregiver);
    setDetailOpen(true);
  };

  const openCareRequest = (caregiver?: CaregiverMatch) => {
    if (caregiver) setSelected(caregiver);
    setDetailOpen(false);
    setCareRequestOpen(true);
  };

  const handleCareRequestSent = () => {
    setProposalsReceived(true);
    setCareRequestOpen(false);
    setProposalsOpen(true);
  };

  const openProfileById = (id: number) => {
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === id);
    if (caregiver) {
      setProposalsOpen(false);
      openProfile(caregiver);
    }
  };

  const openProposalChat = (id: number) => {
    selectProposal(id);
    setProposalChatId(id);
    setProposalsOpen(false);
    setDetailOpen(false);
    setProposalChatOpen(true);
  };

  const handleAcceptProposal = (id: number) => {
    acceptProposal(id);
    openProposalChat(id);
  };

  const backToProposals = () => {
    setProposalChatOpen(false);
    setProposalsOpen(true);
  };

  const goHome = () => {
    setProposalChatOpen(false);
    navigation.navigate("Home");
  };

  const handleSent = () => {
    setToast(t("match.requestSentToast"));
    setTimeout(() => setToast(null), 2600);
  };

  const filters = [
    t("match.filterAll"),
    t("match.filterBilingual"),
    t("match.filterWeekday"),
    t("match.filterInfant"),
    t("match.filterCertified"),
  ];

  return (
    <>
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("match.title")}</Text>
          <Text style={styles.subtitle}>{t("match.subtitle")}</Text>
        </View>
        <View style={styles.aiBadge}>
          <Sparkles size={11} color={colors.yellow} />
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

      {proposalsReceived && (
        <Pressable style={styles.proposalsBanner} onPress={() => setProposalsOpen(true)}>
          <View>
            <Text style={styles.proposalsBannerTitle}>{t("careRequest.proposalsReceived")}</Text>
            <Text style={styles.proposalsBannerSub}>{t("careRequest.proposalsHint")}</Text>
          </View>
          <Sparkles size={18} color={colors.yellow} />
        </Pressable>
      )}

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
                <Star size={11} color={colors.yellow} fill={colors.yellow} />
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
              <Sparkles size={11} color={colors.yellow} /> {t("match.whyRecommended")}
            </Text>
            <Text style={styles.explainBody}>{locale === "ko" ? c.aiExplanationKo : c.aiExplanationEn}</Text>
          </View>

          <Text style={styles.reasonsTitle}>{t("match.matchReasons")}</Text>
          <View style={styles.reasons}>
            {c.matchReasons
              .filter((r) => !/background/i.test(r))
              .map((r) => (
              <Text key={r} style={styles.reasonChip}>
                {r}
              </Text>
            ))}
          </View>

          <View style={styles.trustRow}>
            <ShieldCheck size={12} color={isBackgroundCheckComplete(c.backgroundCheckStatus) ? colors.yellow : colors.muted} />
            <Text style={[styles.trustLabel, isBackgroundCheckComplete(c.backgroundCheckStatus) && styles.trustLabelActive]}>
              {isBackgroundCheckComplete(c.backgroundCheckStatus)
                ? t("match.backgroundChecked")
                : getBackgroundCheckLabel(c.backgroundCheckStatus, t)}
            </Text>
          </View>

          <View style={styles.langs}>
            {c.languages.map((lang) => (
              <View key={lang} style={styles.langChip}>
                <Globe size={10} color={colors.muted} />
                <Text style={styles.langText}>{lang}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.price}>{c.price}</Text>
            <Pressable style={styles.viewBtn} onPress={() => openProfile(c)}>
              <Text style={styles.viewBtnText}>{t("match.viewProfile")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScreenScrollView>

    {toast && (
      <View style={styles.toast}>
        <CheckCircle size={16} color={colors.yellow} />
        <Text style={styles.toastText}>{toast}</Text>
      </View>
    )}

    <CaregiverDetailSheet
      open={detailOpen}
      caregiver={selected}
      onClose={() => setDetailOpen(false)}
      onContact={() => {
        setDetailOpen(false);
        setContactOpen(true);
      }}
      onRequestCare={() => openCareRequest(selected ?? undefined)}
    />

    <CareRequestModal
      open={careRequestOpen}
      onClose={() => setCareRequestOpen(false)}
      onSent={handleCareRequestSent}
    />

    <CareProposalsSheet
      open={proposalsOpen}
      onClose={() => setProposalsOpen(false)}
      onViewProfile={openProfileById}
      onChat={openProposalChat}
      onAccept={handleAcceptProposal}
      shortlisted={shortlisted}
      onToggleShortlist={toggleShortlist}
    />

    <ContactMessageModal
      open={contactOpen}
      caregiver={selected}
      mode="contact"
      onClose={() => setContactOpen(false)}
      onSent={handleSent}
    />

    <CareProposalChatModal
      visible={proposalChatOpen}
      caregiverId={proposalChatId}
      onBackToProposals={backToProposals}
      onViewCarePlan={() => setCarePlanOpen(true)}
      onGoHome={goHome}
    />

    <CarePlanModal open={carePlanOpen} plan={carePlan} onClose={() => setCarePlanOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  headerText: { flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 4 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, flexShrink: 1 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  aiBadgeText: { fontSize: 11, fontWeight: "600", color: colors.text },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.backgroundSecondary,
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
  filterChipActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
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
    backgroundColor: colors.black,
    borderRadius: 10,
    padding: 2,
  },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { flex: 1, flexShrink: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  matchScore: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  role: { fontSize: 12, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  meta: { fontSize: 11, color: colors.muted, marginRight: 4 },
  explainBox: {
    marginTop: 12,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  explainTitle: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 4 },
  explainBody: { fontSize: 12, lineHeight: 18, color: colors.muted },
  reasonsTitle: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 12, marginBottom: 6 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langText: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  trustLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  trustLabelActive: { color: colors.text },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  price: { fontSize: 14, fontWeight: "700", color: colors.text },
  proposalsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  proposalsBannerTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  proposalsBannerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  viewBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md },
  viewBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  toast: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.lg,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 100,
  },
  toastText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
});
