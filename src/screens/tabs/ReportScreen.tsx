import {
  Activity,
  Bell,
  Globe,
  Moon,
  Sparkles,
  Thermometer,
  Utensils,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { DailyReportItemType } from "../../types/dailyReport";
import { colors, radius } from "../../theme";

const ITEM_META: Record<DailyReportItemType, { icon: typeof Utensils; color: string; bg: string; accent?: boolean }> = {
  meal: { icon: Utensils, color: colors.text, bg: colors.yellowSoft, accent: true },
  nap: { icon: Moon, color: colors.muted, bg: colors.backgroundSecondary },
  activity: { icon: Activity, color: colors.text, bg: colors.backgroundSecondary },
  health: { icon: Thermometer, color: colors.text, bg: colors.backgroundSecondary },
  reminder: { icon: Bell, color: colors.yellow, bg: colors.yellowSoft, accent: true },
};

export function ReportScreen() {
  const { dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
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
            <Pressable style={styles.card} onPress={() => isToday && setExpanded(!expanded)}>
              <View style={styles.cardHeader}>
                <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.caregiver}>Ji-yeon Park</Text>
                  <Text style={styles.submitted}>
                    {report ? `${t("report.submitted")} · ${report.savedAt}` : t("report.submitted")}
                  </Text>
                </View>
                {isToday && report && (
                  <View style={styles.fromLogBadge}>
                    <Sparkles size={11} color={colors.yellow} />
                    <Text style={styles.fromLogText}>{t("report.fromLog")}</Text>
                  </View>
                )}
              </View>

              {report ? (
                <>
                  <View style={styles.pillGrid}>
                    {report.items.slice(0, 3).map((item) => {
                      const meta = ITEM_META[item.type];
                      const Icon = meta.icon;
                      return (
                        <View
                          key={item.type}
                          style={[
                            styles.pill,
                            { backgroundColor: meta.bg },
                            meta.accent && styles.pillAccent,
                          ]}
                        >
                          <Icon size={16} color={meta.color} />
                          <Text style={[styles.pillText, { color: meta.color }]}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {expanded && (
                    <View style={styles.expanded}>
                      <Text style={styles.summary}>
                        {locale === "ko" ? report.reportKo : report.reportEn}
                      </Text>
                      {report.items.map((item) => {
                        const meta = ITEM_META[item.type];
                        const Icon = meta.icon;
                        return (
                          <View key={item.type} style={styles.detailRow}>
                            <View style={[styles.detailIcon, { backgroundColor: meta.bg }]}>
                              <Icon size={14} color={meta.color} />
                            </View>
                            <View>
                              <Text style={styles.detailLabel}>{item.label}</Text>
                              <Text style={styles.detailValue}>{item.value}</Text>
                            </View>
                          </View>
                        );
                      })}
                      <View style={styles.translationBox}>
                        <Globe size={14} color={colors.yellow} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.translationTitle}>{t("report.aiTranslated")}</Text>
                          <Text style={styles.translationBody}>{report.reportKo}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.placeholder}>
                  {locale === "ko"
                    ? "Log 탭에서 오늘 리포트를 생성할 수 있습니다."
                    : "Generate today's report from the Log tab."}
                </Text>
              )}
            </Pressable>
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
  pillGrid: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, borderRadius: radius.lg, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border },
  pillAccent: { borderColor: colors.yellow },
  pillText: { fontSize: 11, fontWeight: "600" },
  expanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  summary: { fontSize: 14, lineHeight: 24, color: colors.text, marginBottom: 14 },
  detailRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  detailIcon: { borderRadius: 12, padding: 6 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: colors.text, marginTop: 2 },
  translationBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 8,
  },
  translationTitle: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 4 },
  translationBody: { fontSize: 12, lineHeight: 18, color: colors.muted },
  placeholder: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
