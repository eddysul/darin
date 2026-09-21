import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { useLanguage } from "../../LanguageContext";
import { colors } from "../../theme";
import type { CustomCategory } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import { customCategoryDisplayLabel, recordCategoryLabel } from "../../utils/recordDisplay";
import {
  OVERVIEW_RHYTHM_COLORS,
  formatOverviewAmount,
  formatOverviewDelta,
} from "../../utils/overviewRhythm";
import { mixHexWithWhite } from "../../utils/overviewCardTint";
import {
  overviewCategoryHint,
  type OverviewCategoryCard,
} from "../../utils/overviewCategoryCards";
import { resolveLogCategory } from "../../utils/resolveLogCategory";
import { LogCategoryIcon } from "./LogCategoryIcon";

const GAP = 10;
const CARD_RATIO = 0.72;
const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const CARD_MIN_WIDTH = 168;

type Props = {
  cards: OverviewCategoryCard[];
  customCategories: CustomCategory[];
};

function hintKey(card: OverviewCategoryCard) {
  const hint = overviewCategoryHint(card);
  if (hint === "empty") return "report.critical.258" as const;
  if (hint === "insufficient") return "report.critical.257" as const;
  if (hint === "up") return "report.critical.255" as const;
  if (hint === "down") return "report.critical.136" as const;
  return "report.critical.256" as const;
}

function isFixedCard(id: OverviewCategoryCard["id"]): boolean {
  return id === "feed" || id === "sleep" || id === "diaper";
}

function cardPalette(card: OverviewCategoryCard, customCategories: CustomCategory[]) {
  if (card.id === "feed") {
    return { tint: OVERVIEW_RHYTHM_COLORS.statFeed, accent: OVERVIEW_RHYTHM_COLORS.feed };
  }
  if (card.id === "sleep") {
    return { tint: OVERVIEW_RHYTHM_COLORS.statSleep, accent: OVERVIEW_RHYTHM_COLORS.sleep };
  }
  if (card.id === "diaper") {
    return { tint: OVERVIEW_RHYTHM_COLORS.statDiaper, accent: OVERVIEW_RHYTHM_COLORS.diaper };
  }
  const accent = resolveLogCategory(card.recordCategory, customCategories).color;
  return { tint: mixHexWithWhite(accent), accent };
}

export function OverviewCategoryCarousel({ cards, customCategories }: Props) {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const cardWidth = Math.max(CARD_MIN_WIDTH, Math.round(width * CARD_RATIO));
  const interval = cardWidth + GAP;

  useEffect(() => {
    if (active >= cards.length) {
      activeRef.current = 0;
      setActive(0);
    }
  }, [active, cards.length]);

  const labelFor = useCallback((card: OverviewCategoryCard) => {
    if (card.id === "feed") return t("report.critical.007");
    if (card.id === "sleep") return t("report.critical.008");
    if (card.id === "diaper") return t("report.critical.009");
    if (isCustomCategoryKey(String(card.id))) {
      const custom = customCategories.find((item) => `custom:${item.id}` === card.id);
      return custom ? customCategoryDisplayLabel(t, custom) : t("chrome.critical.007");
    }
    return recordCategoryLabel(t, card.id as BabyLogCategoryId);
  }, [customCategories, t]);

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index === "number" && index !== activeRef.current) {
      activeRef.current = index;
      setActive(index);
    }
  }).current;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!interval) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / interval);
    const next = Math.max(0, Math.min(cards.length - 1, index));
    activeRef.current = next;
    setActive(next);
  };

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="list"
    >
      {width > 0 ? (
        <FlatList
          horizontal
          data={cards}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          nestedScrollEnabled
          directionalLockEnabled
          bounces
          getItemLayout={(_, index) => ({ length: interval, offset: interval * index, index })}
          contentContainerStyle={{ paddingRight: Math.max(0, width - cardWidth) }}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => {
            const label = labelFor(item);
            const value = formatOverviewAmount(item.numeric, item.unit, t);
            const hint = t(hintKey(item));
            const comparable = overviewCategoryHint(item) === "up"
              || overviewCategoryHint(item) === "down"
              || overviewCategoryHint(item) === "same";
            const delta = comparable ? formatOverviewDelta(item.delta, item.unit, t) : null;
            const selected = index === active;
            const palette = cardPalette(item, customCategories);
            const extra = !isFixedCard(item.id);
            return (
              <View
                style={[
                  styles.card,
                  { width: cardWidth, marginRight: GAP, backgroundColor: palette.tint },
                  selected ? null : styles.cardIdle,
                ]}
                accessible
                accessibilityState={{ selected }}
                accessibilityLabel={t("report.critical.259", { label, value, change: hint })}
              >
                <View style={styles.head}>
                  <View style={[styles.icon, extra ? { backgroundColor: `${palette.accent}18` } : null]} accessible={false}>
                    <LogCategoryIcon
                      categoryKey={item.recordCategory}
                      customCategories={customCategories}
                      size={16}
                      color={palette.accent}
                    />
                  </View>
                  <Text style={styles.label} accessible={false}>{label}</Text>
                </View>
                <Text style={styles.value} accessible={false}>{value}</Text>
                {delta ? (
                  <Text
                    accessible={false}
                    style={[
                      styles.diff,
                      delta.tone === "same" && styles.diffSame,
                      delta.tone === "up" && styles.diffUp,
                      item.id === "sleep" && delta.tone === "down" && styles.diffSleepDown,
                      extra && delta.tone !== "same"
                        ? { color: palette.accent, backgroundColor: `${palette.accent}28` }
                        : null,
                    ]}
                  >
                    {delta.chip}
                  </Text>
                ) : null}
                <Text style={styles.hint} accessible={false}>{hint}</Text>
              </View>
            );
          }}
        />
      ) : (
        <View style={{ height: 72 }} />
      )}
      {cards.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {cards.map((card, index) => (
            <View key={String(card.id)} style={[styles.dot, index === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  card: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 16,
    justifyContent: "center",
  },
  cardIdle: { opacity: 0.86 },
  head: { flexDirection: "row", alignItems: "center", gap: 5 },
  icon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  value: { marginTop: 4, color: colors.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.4 },
  diff: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    color: OVERVIEW_RHYTHM_COLORS.feed,
    backgroundColor: OVERVIEW_RHYTHM_COLORS.statFeed,
    fontSize: 10.5,
    fontWeight: "800",
  },
  diffUp: { color: OVERVIEW_RHYTHM_COLORS.feed, backgroundColor: OVERVIEW_RHYTHM_COLORS.statFeed },
  diffSame: { color: colors.muted, backgroundColor: colors.chip },
  diffSleepDown: { color: OVERVIEW_RHYTHM_COLORS.sleep, backgroundColor: OVERVIEW_RHYTHM_COLORS.statSleep },
  hint: { marginTop: 4, color: colors.faint, fontSize: 10, fontWeight: "600" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10, minHeight: 8 },
  dot: { width: 6, height: 6, borderRadius: 99, backgroundColor: colors.chip },
  dotActive: { backgroundColor: colors.text, width: 14 },
});
