import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { colors } from "../../../theme";
import { buildGrowthBookPaginationItems } from "../../../utils/growthBookPages";
import { BabyLogIcon } from "../BabyLogIcon";
import { styles } from "./styles";
import type { BookPageNavigationProps } from "./types";

export function BookPageNavigation({
  pages,
  activeIndex,
  onSelect,
  onPrevious,
  onNext,
}: BookPageNavigationProps) {
  const { t } = useLanguage();
  const paginationItems = buildGrowthBookPaginationItems(pages.length, activeIndex);
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= pages.length - 1;
  return (
    <View style={styles.bookNavigation}>
      <View style={styles.pageNavigator}>
        <Pressable
          disabled={atStart}
          onPress={onPrevious}
          style={styles.pageArrow}
          accessibilityRole="button"
          accessibilityLabel={t("growth.critical.005")}
        >
          <View style={styles.pageArrowPrev}>
            <BabyLogIcon kind="chevron" size={18} color={atStart ? colors.faint : colors.text} />
          </View>
        </Pressable>
        <Text style={styles.pageCounter}>{activeIndex + 1} / {pages.length}</Text>
        <Pressable
          disabled={atEnd}
          onPress={onNext}
          style={styles.pageArrow}
          accessibilityRole="button"
          accessibilityLabel={t("growth.critical.006")}
        >
          <BabyLogIcon kind="chevron" size={18} color={atEnd ? colors.faint : colors.text} />
        </Pressable>
      </View>
      <View style={styles.pageChipRow}>
        {paginationItems.map((item) => {
          if (item.type === "ellipsis") return <Text key={item.key} style={styles.pageEllipsis}>…</Text>;
          const page = pages[item.index];
          if (!page) return null;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.index)}
              style={[styles.pageChip, activeIndex === item.index && styles.pageChipActive]}
              accessibilityRole="button"
              accessibilityLabel={t("growth.critical.141", { title: page.title })}
              accessibilityState={{ selected: activeIndex === item.index }}
            >
              <Text style={[styles.pageChipText, activeIndex === item.index && styles.pageChipTextActive]}>
                {page.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
