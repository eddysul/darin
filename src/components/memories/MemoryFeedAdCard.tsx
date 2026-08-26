import { memo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { colors, radius } from "../../theme";
import type { MemoryFeedAd } from "./memoryFeedAds";
import { useLanguage } from "../../LanguageContext";

type Props = {
  ad: MemoryFeedAd;
  onHide: () => void;
};

export const MemoryFeedAdCard = memo(function MemoryFeedAdCard({ ad, onHide }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <BabyLogIcon kind={ad.icon} size={16} color={colors.amberText} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.advertiser}>{ad.advertiser}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.160")}
            hitSlop={6}
          >
            <Text style={styles.sponsored}>{t("memory.critical.161")}</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.162", { advertiser: ad.advertiser })}
        >
          <Text style={styles.hideText}>{t("memory.critical.163")}</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.creative}
        onPress={() => setInfoOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("memory.critical.164", { advertiser: ad.advertiser, headline: ad.headline })}
      >
        <View style={styles.creativeBadge}>
          <Text style={styles.creativeBadgeText}>{ad.categoryLabel}</Text>
        </View>
        <BabyLogIcon kind={ad.icon} size={42} color={colors.amberText} />
        <Text style={styles.creativeHint}>{t("memory.critical.165")}</Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.headline}>{ad.headline}</Text>
        <Text style={styles.copy}>{ad.body}</Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={() => setInfoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={ad.ctaLabel}
        >
          <Text style={styles.ctaText}>{ad.ctaLabel}</Text>
          <BabyLogIcon kind="chevron" size={15} color={colors.amberDark} />
        </Pressable>
      </View>

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setInfoOpen(false)} accessibilityRole="button" accessibilityLabel={t("memory.critical.067")} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.sheetTitle}>{t("memory.critical.166")}</Text>
            <Text style={styles.sheetBody}>
              {t("memory.critical.167")}
            </Text>
            <View style={styles.sheetActions}>
              <Pressable
                style={({ pressed }) => [styles.sheetSecondary, pressed && styles.pressed]}
                onPress={() => {
                  setInfoOpen(false);
                  onHide();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("memory.critical.168")}
              >
                <Text style={styles.sheetSecondaryText}>{t("memory.critical.163")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sheetPrimary, pressed && styles.pressed]}
                onPress={() => setInfoOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t("memory.critical.169")}
              >
                <Text style={styles.sheetPrimaryText}>{t("memory.critical.169")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  advertiser: { color: colors.text, fontSize: 13, fontWeight: "800" },
  sponsored: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  hideButton: { minHeight: Platform.OS === "android" ? 48 : 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  hideText: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  creative: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  creativeBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  creativeBadgeText: { color: colors.muted, fontSize: 10.5, fontWeight: "800" },
  creativeHint: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  body: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 14 },
  headline: { color: colors.text, fontSize: 15, fontWeight: "800", lineHeight: 22 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  cta: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.amber,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ctaText: { color: colors.amberDark, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,42,38,0.32)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  sheetBody: { color: colors.muted, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 18 },
  sheetSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSecondaryText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  sheetPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: { color: colors.amberDark, fontSize: 14, fontWeight: "800" },
});
