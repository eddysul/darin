import { Fragment, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCategory } from "../../constants/babyLogCategories";
import {
  QUICK_RECORD_ACTIONS,
  type OneTouchAction,
} from "../../constants/quickRecordActions";
import type { CustomCategory } from "../../types/logCategory";
import { colors, radius, type } from "../../theme";
import { BabyLogIcon, CATEGORY_ICONS } from "./BabyLogIcon";
import { CustomTemplateIcon } from "./CustomTemplateIcon";
import type { BabyLogEntry } from "../../types/babyLog";
import { rankQuickActions } from "../../utils/quickCategoryRanking";
import { useCompactLayout } from "../../hooks/useCompactLayout";

export type { OneTouchAction } from "../../constants/quickRecordActions";

type Props = {
  sleepActive: boolean;
  /** Actions with an in-progress timer (shows 진행 중) */
  activeTimerActions?: OneTouchAction[];
  disabled?: boolean;
  onSelect: (action: OneTouchAction) => void;
  onLongPress?: (action: OneTouchAction) => void;
  onOpenActiveTimer?: (action: OneTouchAction) => void;
  /** Fired while a category tile is pressed (for FAB auto-hide). */
  onInteractionChange?: (active: boolean) => void;
  visibleActions?: OneTouchAction[];
  coreActions?: OneTouchAction[];
  customCategories?: CustomCategory[];
  onOpenGrowth?: () => void;
  /** Opens create flow for a new custom category (header "새로 추가"). */
  onAdd?: () => void;
  onSelectCustom?: (category: CustomCategory) => void;
  logs?: BabyLogEntry[];
  babyScopeKey?: string;
};

export function OneTouchRecordGrid({
  sleepActive,
  activeTimerActions = [],
  disabled,
  onSelect,
  onLongPress,
  onOpenActiveTimer,
  onInteractionChange,
  visibleActions,
  coreActions,
  customCategories = [],
  onOpenGrowth,
  onAdd,
  onSelectCustom,
  logs = [],
  babyScopeKey,
}: Props) {
  const compact = useCompactLayout();
  const [expanded, setExpanded] = useState(false);
  const orderedVisible = visibleActions ?? QUICK_RECORD_ACTIONS.map((action) => action.id);
  void coreActions;
  const allVisible = QUICK_RECORD_ACTIONS.filter((action) => orderedVisible.includes(action.id));
  const topIds = useMemo(() => rankQuickActions(logs, orderedVisible), [babyScopeKey, logs, orderedVisible.join("|")]);
  const collapsedVisible = QUICK_RECORD_ACTIONS
    .filter((action) => topIds.includes(action.id))
    .sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id));
  const visible = expanded ? allVisible : collapsedVisible;
  const canExpand = allVisible.length > collapsedVisible.length || customCategories.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>기록하기</Text>
          <Text style={styles.subtitle}>탭해서 자세히 기록 · 길게 눌러 타이머 시작</Text>
        </View>
        {onAdd ? (
          <Pressable
            style={[styles.countBadge, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="카테고리 추가"
          >
            <Text style={styles.countBadgeText}>카테고리 추가</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.gridExpanded}>
          {visible.map((action) => (
            <Fragment key={action.id}>
              <ActionTile
                action={action}
                sleepActive={sleepActive}
                timerActive={activeTimerActions.includes(action.id)}
                disabled={disabled}
                expanded
                dense={compact}
                onSelect={onSelect}
                onLongPress={onLongPress}
                onOpenActiveTimer={onOpenActiveTimer}
                onInteractionChange={onInteractionChange}
              />
              {action.id === "vaccination" && onOpenGrowth ? (
                <GrowthTile dense={compact} disabled={disabled} onPress={onOpenGrowth} />
              ) : null}
            </Fragment>
          ))}
          {!visible.some((action) => action.id === "vaccination") && onOpenGrowth ? (
            <GrowthTile dense={compact} disabled={disabled} onPress={onOpenGrowth} />
          ) : null}
          {customCategories.map((category) => (
            <CustomCategoryTile
              key={category.id}
              category={category}
              disabled={disabled}
              dense={compact}
              onPress={() => onSelectCustom?.(category)}
              onInteractionChange={onInteractionChange}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {visible.map((action) => (
            <ActionTile
              key={action.id}
              action={action}
              sleepActive={sleepActive}
              timerActive={activeTimerActions.includes(action.id)}
              disabled={disabled}
              dense={compact}
              onSelect={onSelect}
              onLongPress={onLongPress}
              onOpenActiveTimer={onOpenActiveTimer}
              onInteractionChange={onInteractionChange}
            />
          ))}
          {onOpenGrowth ? (
            <GrowthTile compact dense={compact} disabled={disabled} onPress={onOpenGrowth} />
          ) : null}
          {canExpand ? (
            <Pressable
              style={({ pressed }) => [styles.expandTile, compact && styles.expandTileDense, pressed && styles.pressed]}
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="더 보기"
            >
              <Text style={styles.expandTileLabel}>더 보기</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {expanded && canExpand ? (
        <Pressable
          style={({ pressed }) => [styles.collapseButton, pressed && styles.expandPressed]}
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel="접기"
        >
          <Text style={styles.expandText}>접기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CustomCategoryTile({
  category,
  disabled,
  dense,
  onPress,
  onInteractionChange,
}: {
  category: CustomCategory;
  disabled?: boolean;
  dense?: boolean;
  onPress: () => void;
  onInteractionChange?: (active: boolean) => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.buttonExpanded,
        dense && styles.buttonExpandedDense,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPressIn={() => onInteractionChange?.(true)}
      onPressOut={() => onInteractionChange?.(false)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.label} 기록`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${category.color}18` }]}>
        <CustomTemplateIcon
          iconKey={category.iconKey ?? category.templateId}
          size={24}
          color={category.color}
          strokeWidth={1.8}
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>{category.label}</Text>
    </Pressable>
  );
}

function GrowthTile({
  disabled = false,
  compact = false,
  dense = false,
  onPress,
}: {
  disabled?: boolean;
  compact?: boolean;
  dense?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : styles.buttonExpanded,
        dense && (compact ? styles.buttonCompactDense : styles.buttonExpandedDense),
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="성장 기록 추가"
    >
      <View style={[styles.iconWrap, styles.growthIconWrap]}>
        <BabyLogIcon kind="tab" tab="report" size={24} color="#69AFA0" strokeWidth={1.8} />
      </View>
      <Text style={styles.label}>성장</Text>
    </Pressable>
  );
}

function ActionTile({
  action,
  sleepActive,
  timerActive,
  disabled,
  expanded,
  dense,
  onSelect,
  onLongPress,
  onOpenActiveTimer,
  onInteractionChange,
}: {
  action: (typeof QUICK_RECORD_ACTIONS)[number];
  sleepActive: boolean;
  timerActive: boolean;
  disabled?: boolean;
  expanded?: boolean;
  dense?: boolean;
  onSelect: (action: OneTouchAction) => void;
  onLongPress?: (action: OneTouchAction) => void;
  onOpenActiveTimer?: (action: OneTouchAction) => void;
  onInteractionChange?: (active: boolean) => void;
}) {
  const category = getCategory(action.cat);
  const activeSleep = action.id === "sleep" && sleepActive;
  const inProgress = timerActive || activeSleep;
  const ActionIcon = CATEGORY_ICONS[action.cat];
  const longPressedRef = useRef(false);

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        expanded ? styles.buttonExpanded : styles.buttonCompact,
        dense && (expanded ? styles.buttonExpandedDense : styles.buttonCompactDense),
        inProgress && styles.activeButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPressIn={() => {
        longPressedRef.current = false;
        onInteractionChange?.(true);
      }}
      onPressOut={() => onInteractionChange?.(false)}
      onPress={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        // An in-progress timer must never open a second quick-record flow.
        // Open its sheet so the user can pause or finish the same timer.
        if (inProgress && onOpenActiveTimer) {
          onOpenActiveTimer(action.id);
          return;
        }
        onSelect(action.id);
      }}
      onLongPress={() => {
        longPressedRef.current = true;
        if (inProgress && onOpenActiveTimer) {
          onOpenActiveTimer(action.id);
          return;
        }
        onLongPress?.(action.id);
      }}
      delayLongPress={380}
      accessibilityLabel={`${
        activeSleep ? "수면 종료" : inProgress ? `${action.label} 진행 중` : action.label
      } 기록 작성`}
    >
      {inProgress ? (
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>진행 중</Text>
        </View>
      ) : null}
      <View style={[styles.iconWrap, { backgroundColor: `${category.color}18` }]}>
        <ActionIcon size={24} color={category.color} strokeWidth={1.8} />
      </View>
      <Text style={[styles.label, inProgress && styles.activeLabel]} numberOfLines={2}>
        {activeSleep ? "수면 종료" : action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 10 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headingCopy: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, flex: 1, paddingRight: 8 },
  title: { fontSize: type.md, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: type.xs, color: colors.faint, flexShrink: 1 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countBadgeText: { color: colors.text, fontSize: type.xs, fontWeight: "700" },
  row: { gap: 8, paddingRight: 4 },
  gridExpanded: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
    shadowColor: "#4A3428",
    shadowOpacity: 0.035,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: "hidden",
  },
  buttonCompact: { width: 72, minHeight: 86 },
  buttonExpanded: { width: "31.5%", minHeight: 90 },
  buttonCompactDense: { width: 64, minHeight: 72 },
  buttonExpandedDense: { minHeight: 76 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.82 },
  disabled: { opacity: 0.45 },
  activeButton: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  growthIconWrap: { backgroundColor: "#E7F5F0" },
  label: {
    fontSize: type.xs,
    lineHeight: 15,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  activeLabel: { color: colors.amberText },
  progressBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 1,
  },
  progressBadgeText: { color: colors.amberDark, fontSize: 8, fontWeight: "800" },
  expandTile: {
    width: 72,
    minHeight: 86,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  expandTileDense: { width: 64, minHeight: 72 },
  expandTileLabel: { fontSize: type.xs, fontWeight: "800", color: colors.amberText, textAlign: "center" },
  collapseButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandPressed: { opacity: 0.75 },
  expandText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
});
