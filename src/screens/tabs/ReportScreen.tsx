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
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { DailyReportItemType } from "../../types/dailyReport";
import { colors, radius } from "../../theme";

const ITEM_META: Record<DailyReportItemType, { icon: typeof Utensils; color: string; bg: string }> = {
  meal: { icon: Utensils, color: "#B8860B", bg: "#FFF4D8" },
  nap: { icon: Moon, color: "#6B7FA8", bg: "#F0F3FA" },
  activity: { icon: Activity, color: "#6B9080", bg: "#EEF5F0" },
  health: { icon: Thermometer, color: "#A67C52", bg: "#FFF4D8" },
  reminder: { icon: Bell, color: "#D9A441", bg: "#FFF9EB" },
};

export function ReportScreen() {
  const { dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  const dates = ["June 20", "June 19", "June 18"];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("report.title")}</Text>
      <Text style={styles.subtitle}>{t("report.subtitle")}</Text>

      {dates.map((date, i) => {
        const isToday = i === 0;
        const report = isToday ? dailyReport : null;

        return (
          <View key={date} style={styles.dateBlock}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{date}</Text>
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
                    <Sparkles size={11} color={colors.gold} />
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
                        <View key={item.type} style={[styles.pill, { backgroundColor: meta.bg }]}>
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
                        <Globe size={14} color={colors.gold} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 16 },
  dateBlock: { marginBottom: 16 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dateLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  caregiver: { fontSize: 14, fontWeight: "600", color: colors.text },
  submitted: { fontSize: 12, color: colors.muted },
  fromLogBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  fromLogText: { fontSize: 10, fontWeight: "600", color: colors.gold },
  pillGrid: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, borderRadius: radius.lg, padding: 10, alignItems: "center", gap: 4 },
  pillText: { fontSize: 11, fontWeight: "600" },
  expanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  summary: { fontSize: 14, lineHeight: 22, color: colors.text, opacity: 0.85, marginBottom: 12 },
  detailRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  detailIcon: { borderRadius: 12, padding: 6 },
  detailLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  detailValue: { fontSize: 14, color: colors.text },
  translationBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFF9EB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 8,
  },
  translationTitle: { fontSize: 12, fontWeight: "600", color: colors.gold, marginBottom: 4 },
  translationBody: { fontSize: 12, lineHeight: 18, color: colors.muted },
  placeholder: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
