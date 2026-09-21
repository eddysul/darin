import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import type { ReportCriticalKey } from "../../i18nReportCriticalMessages";
import { OverviewSpriteSheet } from "./OverviewSprite";
import { overviewAssets } from "./overviewAssets";

type Band = {
  periodKey: ReportCriticalKey;
  copyKey: ReportCriticalKey;
  status: "done" | "progress" | null;
};

const BANDS: Band[] = [
  { periodKey: "report.critical.241", copyKey: "report.critical.242", status: "done" },
  { periodKey: "report.critical.243", copyKey: "report.critical.244", status: "progress" },
  { periodKey: "report.critical.245", copyKey: "report.critical.246", status: null },
  { periodKey: "report.critical.247", copyKey: "report.critical.248", status: null },
  { periodKey: "report.critical.249", copyKey: "report.critical.250", status: null },
];

type Props = {
  visible: boolean;
  babyName: string;
  onClose: () => void;
};

export function OverviewMilestoneSheet({ visible, babyName, onClose }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [play, setPlay] = useState(0);

  useEffect(() => {
    if (visible) setPlay((token) => token + 1);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel={t("report.critical.104")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />
          <View style={styles.visual} pointerEvents="box-none">
            <OverviewSpriteSheet
              key={play}
              source={overviewAssets.milestoneSheetDuck}
              width={72}
              height={108}
              columns={4}
              rows={2}
              durationMs={2600}
              playing={play > 0}
              onPress={() => setPlay((token) => token + 1)}
              accessibilityLabel={t("report.critical.254")}
            />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <Text style={styles.title}>{t("report.critical.238")}</Text>
            <Text style={styles.period}>{t("report.critical.239")}</Text>
            <Text style={styles.value}>{t("report.critical.240", { babyName })}</Text>
            <View style={styles.grid}>
              {BANDS.map((band) => (
                <View key={band.periodKey} style={styles.cell}>
                  <View style={[styles.card, band.status ? styles.stampCard : null]}>
                    <Text style={styles.bandPeriod}>{t(band.periodKey)}</Text>
                    <Text style={styles.bandCopy}>{t(band.copyKey)}</Text>
                    {band.status ? (
                      <View
                        style={[
                          styles.stamp,
                          band.status === "done" ? styles.stampDone : styles.stampProgress,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stampText,
                            band.status === "done" ? styles.stampDoneText : styles.stampProgressText,
                          ]}
                        >
                          {t(band.status === "done" ? "report.critical.251" : "report.critical.252")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.note}>{t("report.critical.253")}</Text>
          </ScrollView>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("report.critical.104")}
          >
            <Text style={styles.closeText}>{t("report.critical.104")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(35, 28, 24, 0.32)" },
  backdropFill: { flex: 1 },
  sheet: {
    position: "relative",
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "78%",
  },
  scroll: { flexShrink: 1 },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  visual: {
    position: "absolute",
    top: 18,
    right: 20,
    zIndex: 2,
    width: 104,
    height: 108,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  title: {
    paddingRight: 106,
    minHeight: 55,
    marginBottom: 6,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  period: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  value: {
    marginTop: 16,
    marginBottom: 9,
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  cell: { width: "50%", paddingHorizontal: 4, marginBottom: 8 },
  card: {
    minHeight: 70,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
  },
  stampCard: { paddingRight: 58 },
  bandPeriod: { color: colors.faint, fontSize: 10, fontWeight: "700" },
  bandCopy: { marginTop: 3, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  stamp: {
    position: "absolute",
    top: 9,
    right: 8,
    minWidth: 42,
    minHeight: 42,
    padding: 4,
    borderWidth: 2,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  stampText: { fontSize: 9, fontWeight: "900", lineHeight: 11, textAlign: "center" },
  stampDone: {
    borderColor: "#4e9d89",
    backgroundColor: "rgba(105,195,174,0.12)",
    transform: [{ rotate: "-8deg" }],
  },
  stampDoneText: { color: "#4e9d89" },
  stampProgress: {
    borderColor: colors.primaryCoral,
    backgroundColor: colors.amberSoft,
    transform: [{ rotate: "6deg" }],
  },
  stampProgressText: { color: colors.primaryCoral },
  note: { marginTop: 12, marginHorizontal: 2, color: colors.faint, fontSize: 10, lineHeight: 15 },
  closeBtn: {
    marginTop: 18,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.primaryCoral,
  },
  closeText: { fontSize: 14, fontWeight: "800", color: colors.primaryForeground },
});
