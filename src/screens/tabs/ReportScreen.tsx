import {
  Baby,
  ChevronDown,
  ChevronUp,
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
import { Avatar } from "../../components/Avatar";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { createT, type Locale } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import type { DailyReport, ReportDetailCategory, ReportMainCategory } from "../../types/dailyReport";
import { getReportPresentation } from "../../utils/reportPresentation";
import { colors, radius } from "../../theme";

type CardLanguageMode = Locale;

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

function DailyReportCard({ report }: { report: DailyReport }) {
  const { t: appT } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [languageMode, setLanguageMode] = useState<CardLanguageMode>("en");

  const cardT = useMemo(() => createT(languageMode), [languageMode]);
  const view = useMemo(
    () => getReportPresentation(report, languageMode),
    [report, languageMode],
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
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

      {isExpanded && (
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

      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => setIsExpanded((prev) => !prev)}
        >
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
    </View>
  );
}

export function ReportScreen() {
  const { dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const dates = ["June 20", "June 19", "June 18"];

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("report.title")}</Text>
      <Text style={styles.subtitle}>{t("report.subtitle")}</Text>

      {dates.map((date, i) => {
        const isToday = i === 0;
        const report = isToday ? dailyReport : null;

        return (
          <View key={date} style={styles.dateBlock}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{date.toUpperCase()}</Text>
              <View style={styles.dateLine} />
            </View>

            {report ? (
              <DailyReportCard report={report} />
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
        );
      })}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20 },
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
});
