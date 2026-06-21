import {
  Baby,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Cookie,
  Globe,
  Moon,
  Pill,
  PillBottle,
  Sparkles,
  Stethoscope,
  Thermometer,
  TrendingUp,
  Utensils,
  Waves,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/Avatar";
import { DarinCareChatModal } from "../../components/DarinCareChatModal";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { useCareFlow } from "../../context/CareFlowContext";
import { buildReportTimeline, getSelectableReports } from "../../demo/reportHistory";
import { createT, type Locale } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import type { DailyReport, ReportDetailCategory, ReportMainCategory } from "../../types/dailyReport";
import { getReportPresentation } from "../../utils/reportPresentation";
import { colors, radius } from "../../theme";

type CardLanguageMode = Locale;

const TAB_BAR_OFFSET = 88;
const STICKY_BAR_HEIGHT = 64;

const ACTIVE_PILL = {
  backgroundColor: "#FFF8E7",
  borderColor: "#E0B23F",
  color: "#111111",
};

const INACTIVE_PILL = {
  backgroundColor: "#FFFFFF",
  borderColor: "#EAEAEA",
  color: "#666666",
};

const SELECTED_CARD = {
  backgroundColor: "#FFF8E7",
  borderColor: "#E0B23F",
};

const MAIN_META: Record<
  ReportMainCategory,
  { icon: typeof Utensils; labelKey: `report.cat.${ReportMainCategory}` }
> = {
  bowel: { icon: CircleDot, labelKey: "report.cat.bowel" },
  sleep: { icon: Moon, labelKey: "report.cat.sleep" },
  meal: { icon: Utensils, labelKey: "report.cat.meal" },
  growth: { icon: TrendingUp, labelKey: "report.cat.growth" },
  clinic: { icon: Stethoscope, labelKey: "report.cat.clinic" },
};

const DETAIL_META: Record<
  ReportDetailCategory,
  { icon: typeof Utensils; labelKey: `report.detail.${ReportDetailCategory}` }
> = {
  bowel: { icon: CircleDot, labelKey: "report.detail.bowel" },
  meal: { icon: Utensils, labelKey: "report.detail.meal" },
  sleep: { icon: Moon, labelKey: "report.detail.sleep" },
  growth: { icon: TrendingUp, labelKey: "report.detail.growth" },
  bath: { icon: Waves, labelKey: "report.detail.bath" },
  clinic: { icon: Stethoscope, labelKey: "report.detail.clinic" },
  environment: { icon: Thermometer, labelKey: "report.detail.environment" },
  supplement: { icon: Pill, labelKey: "report.detail.supplement" },
  tummy_time: { icon: Baby, labelKey: "report.detail.tummy_time" },
  snack: { icon: Cookie, labelKey: "report.detail.snack" },
  medication: { icon: PillBottle, labelKey: "report.detail.medication" },
};

function MainCategoryPill({
  type,
  active,
  label,
}: {
  type: ReportMainCategory;
  active: boolean;
  label: string;
}) {
  const { icon: Icon } = MAIN_META[type];
  const palette = active ? ACTIVE_PILL : INACTIVE_PILL;

  return (
    <View
      style={[
        styles.mainPill,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
      ]}
    >
      <Icon size={14} color={palette.color} />
      <Text style={[styles.mainPillText, { color: palette.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function DetailRowCard({
  type,
  value,
  recorded,
  label,
}: {
  type: ReportDetailCategory;
  value: string;
  recorded: boolean;
  label: string;
}) {
  const { icon: Icon } = DETAIL_META[type];

  return (
    <View style={[styles.detailCard, recorded && styles.detailCardActive]}>
      <View style={[styles.detailIconWrap, recorded && styles.detailIconWrapActive]}>
        <Icon size={14} color={recorded ? colors.text : colors.muted} />
      </View>
      <View style={styles.detailBody}>
        <Text style={[styles.detailTitle, !recorded && styles.detailTitleMuted]}>{label}</Text>
        <Text style={[styles.detailValue, !recorded && styles.detailValueMuted]}>{value}</Text>
      </View>
    </View>
  );
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectCircle, selected && styles.selectCircleActive]}>
      {selected ? <Check size={12} color={colors.text} strokeWidth={3} /> : <Circle size={12} color={colors.muted} />}
    </View>
  );
}

function DailyReportCard({
  report,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  report: DailyReport;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t: appT } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [languageMode, setLanguageMode] = useState<CardLanguageMode>("en");

  const cardT = useMemo(() => createT(languageMode), [languageMode]);
  const view = useMemo(
    () => getReportPresentation(report, languageMode),
    [report, languageMode],
  );

  const cardBody = (
    <>
      <View style={styles.cardHeader}>
        {selectionMode && <SelectionIndicator selected={selected} />}
        <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.caregiver}>{report.caregiver}</Text>
          <Text style={styles.submitted}>
            {appT("report.submitted")} · {report.savedAt}
          </Text>
        </View>
        <View style={styles.fromLogBadge}>
          <Sparkles size={11} color={colors.yellow} />
          <Text style={styles.fromLogText}>{appT("report.fromLog")}</Text>
        </View>
      </View>

      <View style={styles.mainPillGrid}>
        {view.mainCategories.map((type) => (
          <MainCategoryPill
            key={type}
            type={type}
            active={view.activeMain.has(type)}
            label={cardT(MAIN_META[type].labelKey)}
          />
        ))}
      </View>

      <View style={styles.summaryBlock}>
        <Text style={styles.summaryHeading}>{cardT("report.todaysCareSummary")}</Text>
        <Text style={styles.careSummary}>{view.careSummary}</Text>
      </View>

      {!selectionMode && isExpanded && (
        <>
          <View style={styles.fullReportBlock}>
            <Text style={styles.summaryHeading}>{cardT("report.fullReport")}</Text>
            <Text style={styles.fullReport}>{view.fullReport}</Text>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailsHeading}>{cardT("report.careDetails")}</Text>
            {view.details.map((row) => (
              <DetailRowCard
                key={row.type}
                type={row.type}
                value={row.value}
                recorded={row.recorded}
                label={cardT(DETAIL_META[row.type].labelKey)}
              />
            ))}
          </View>
        </>
      )}

      {!selectionMode && (
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => setIsExpanded((prev) => !prev)}>
            <Text style={styles.actionBtnText}>
              {isExpanded ? cardT("report.hideDetails") : cardT("report.viewDetails")}
            </Text>
            {isExpanded ? (
              <ChevronUp size={14} color={colors.text} />
            ) : (
              <ChevronDown size={14} color={colors.text} />
            )}
          </Pressable>

          <Pressable
            style={[styles.actionBtn, languageMode === "ko" && styles.actionBtnActive]}
            onPress={() => setLanguageMode((prev) => (prev === "en" ? "ko" : "en"))}
          >
            <Globe size={13} color={languageMode === "ko" ? colors.yellow : colors.muted} />
            <Text style={[styles.actionBtnText, languageMode === "ko" && styles.actionBtnTextActive]}>
              {languageMode === "en" ? cardT("report.viewInKorean") : cardT("report.viewInEnglish")}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );

  if (selectionMode) {
    return (
      <Pressable
        onPress={onToggleSelect}
        style={[
          styles.card,
          selected && {
            backgroundColor: SELECTED_CARD.backgroundColor,
            borderColor: SELECTED_CARD.borderColor,
          },
        ]}
      >
        {cardBody}
      </Pressable>
    );
  }

  return <View style={styles.card}>{cardBody}</View>;
}

export function ReportScreen() {
  const { dailyReport } = useApp();
  const { carePlan } = useCareFlow();
  const { locale, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [isSelectingReports, setIsSelectingReports] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatReports, setChatReports] = useState<DailyReport[]>([]);

  const timeline = useMemo(() => buildReportTimeline(dailyReport), [dailyReport]);
  const selectableReports = useMemo(() => getSelectableReports(timeline), [timeline]);
  const allSelected =
    selectableReports.length > 0 &&
    selectableReports.every((report) => selectedReportIds.includes(report.id));

  const exitSelectionMode = () => {
    setIsSelectingReports(false);
    setSelectedReportIds([]);
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId],
    );
  };

  const handleSelectAll = () => {
    setSelectedReportIds(selectableReports.map((report) => report.id));
  };

  const handleClearAll = () => {
    setSelectedReportIds([]);
  };

  const handleOpenChat = () => {
    const selected = selectableReports.filter((report) => selectedReportIds.includes(report.id));
    if (selected.length === 0) return;
    setChatReports(selected);
    setChatOpen(true);
    exitSelectionMode();
  };

  const stickyBottom = insets.bottom + TAB_BAR_OFFSET;

  return (
    <View style={styles.screen}>
      <ScreenScrollView
        contentContainerStyle={[
          styles.content,
          isSelectingReports && { paddingBottom: stickyBottom + STICKY_BAR_HEIGHT + 16 },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {isSelectingReports ? t("report.selectReports") : t("report.title")}
            </Text>
            <Text style={styles.subtitle}>
              {isSelectingReports ? t("report.selectSubtitle") : t("report.subtitle")}
            </Text>
          </View>
          <Pressable
            style={[styles.headerBtn, !isSelectingReports && styles.headerBtnPrimary]}
            onPress={() => {
              if (isSelectingReports) {
                exitSelectionMode();
              } else {
                setIsSelectingReports(true);
              }
            }}
          >
            <Text style={[styles.headerBtnText, !isSelectingReports && styles.headerBtnTextPrimary]}>
              {isSelectingReports ? t("report.cancel") : t("report.askDarin")}
            </Text>
          </Pressable>
        </View>

        {isSelectingReports && (
          <View style={styles.bulkRow}>
            <Pressable
              style={[styles.bulkBtn, allSelected && styles.bulkBtnMuted]}
              onPress={handleSelectAll}
              disabled={allSelected}
            >
              <Text style={styles.bulkBtnText}>
                {allSelected ? t("report.allSelected") : t("report.selectAll")}
              </Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={handleClearAll}>
              <Text style={styles.bulkBtnText}>{t("report.clearAll")}</Text>
            </Pressable>
          </View>
        )}

        {timeline.map(({ dateLabel, report }) => (
          <View key={dateLabel} style={styles.dateBlock}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{dateLabel.toUpperCase()}</Text>
              <View style={styles.dateLine} />
            </View>

            {report ? (
              <DailyReportCard
                report={report}
                selectionMode={isSelectingReports}
                selected={selectedReportIds.includes(report.id)}
                onToggleSelect={() => toggleReportSelection(report.id)}
              />
            ) : (
              <View style={styles.card}>
                <Text style={styles.placeholder}>
                  {locale === "ko"
                    ? "Log 탭에서 오늘 리포트를 생성할 수 있습니다."
                    : "Generate today's report from the Log tab."}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScreenScrollView>

      {isSelectingReports && (
        <View style={[styles.stickyBar, { bottom: stickyBottom }]}>
          <Text style={styles.stickyCount}>
            {t("report.reportsSelected").replace("{count}", String(selectedReportIds.length))}
          </Text>
          <Pressable
            style={[styles.stickyAskBtn, selectedReportIds.length === 0 && styles.stickyAskBtnDisabled]}
            onPress={handleOpenChat}
            disabled={selectedReportIds.length === 0}
          >
            <Sparkles size={14} color={colors.primaryForeground} />
            <Text style={styles.stickyAskText}>{t("report.askDarin")}</Text>
          </Pressable>
        </View>
      )}

      <DarinCareChatModal
        visible={chatOpen}
        selectedReports={chatReports}
        activeCarePlan={carePlan}
        onClose={() => setChatOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginTop: 4,
  },
  headerBtnPrimary: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellow,
  },
  headerBtnText: { fontSize: 12, fontWeight: "700", color: colors.text },
  headerBtnTextPrimary: { color: colors.text },
  bulkRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  bulkBtnMuted: { opacity: 0.55 },
  bulkBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  dateBlock: { marginBottom: 20 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  dateLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  selectCircleActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellow,
  },
  caregiver: { fontSize: 15, fontWeight: "600", color: colors.text },
  submitted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  fromLogBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  fromLogText: { fontSize: 10, fontWeight: "600", color: colors.text },
  mainPillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  mainPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: "30%",
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "48%",
  },
  mainPillText: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  summaryBlock: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  summaryHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  careSummary: { fontSize: 14, lineHeight: 22, color: colors.text, fontWeight: "500" },
  fullReportBlock: { marginBottom: 14 },
  fullReport: { fontSize: 14, lineHeight: 24, color: colors.muted },
  detailsSection: { gap: 8, marginBottom: 14 },
  detailsHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  detailCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  detailCardActive: {
    backgroundColor: colors.backgroundSecondary,
  },
  detailIconWrap: {
    borderRadius: 10,
    padding: 6,
    backgroundColor: colors.backgroundSecondary,
    alignSelf: "flex-start",
  },
  detailIconWrapActive: {
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  detailBody: { flex: 1 },
  detailTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  detailTitleMuted: { color: colors.muted },
  detailValue: { fontSize: 13, lineHeight: 20, color: colors.text, marginTop: 2 },
  detailValueMuted: { color: colors.muted },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionBtnActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellow,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  actionBtnTextActive: { color: colors.text },
  placeholder: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  stickyBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stickyCount: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  stickyAskBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stickyAskBtnDisabled: { opacity: 0.4 },
  stickyAskText: { fontSize: 13, fontWeight: "700", color: colors.primaryForeground },
});
