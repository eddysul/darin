import { Fragment, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCategory } from "../../constants/babyLogCategories";
import {
  QUICK_RECORD_ACTIONS,
  type OneTouchAction,
} from "../../constants/quickRecordActions";
import { DEFAULT_CORE_ACTIONS } from "../../types/appSettings";
import type { CustomCategory } from "../../types/logCategory";
import { colors } from "../../theme";
import { BabyLogIcon, CATEGORY_ICONS } from "./BabyLogIcon";
import { CustomTemplateIcon } from "./CustomTemplateIcon";

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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const orderedVisible = visibleActions ?? QUICK_RECORD_ACTIONS.map((action) => action.id);
  const coreIds = coreActions ?? DEFAULT_CORE_ACTIONS;
  const core = QUICK_RECORD_ACTIONS.filter(
    (action) => orderedVisible.includes(action.id) && coreIds.includes(action.id),
  ).sort(
    (a, b) => orderedVisible.indexOf(a.id) - orderedVisible.indexOf(b.id),
  );
  const extra = QUICK_RECORD_ACTIONS.filter(
    (action) => orderedVisible.includes(action.id) && !coreIds.includes(action.id),
  ).sort((a, b) => orderedVisible.indexOf(a.id) - orderedVisible.indexOf(b.id));
  const visible = expanded ? [...core, ...extra] : core;
  const canExpand = extra.length > 0 || customCategories.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>빠르게 기록하기</Text>
          <Text style={styles.subtitle}>짧게 탭 기록 추가 · 길게 탭 기록 시작</Text>
        </View>
        {onAdd ? (
          <Pressable
            style={[styles.countBadge, disabled && styles.disabled]}
            disabled={disabled}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="새로 추가"
          >
            <Text style={styles.countBadgeText}>새로 추가</Text>
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
                onSelect={onSelect}
                onLongPress={onLongPress}
                onOpenActiveTimer={onOpenActiveTimer}
                onInteractionChange={onInteractionChange}
              />
              {action.id === "doctor" && onOpenGrowth ? (
                <GrowthTile disabled={disabled} onPress={onOpenGrowth} />
              ) : null}
            </Fragment>
          ))}
          {!visible.some((action) => action.id === "doctor") && onOpenGrowth ? (
            <GrowthTile disabled={disabled} onPress={onOpenGrowth} />
          ) : null}
          {customCategories.map((category) => (
            <CustomCategoryTile
              key={category.id}
              category={category}
              disabled={disabled}
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
              onSelect={onSelect}
              onLongPress={onLongPress}
              onOpenActiveTimer={onOpenActiveTimer}
              onInteractionChange={onInteractionChange}
            />
          ))}
          {canExpand ? (
            <Pressable
              style={({ pressed }) => [styles.expandTile, pressed && styles.pressed]}
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
  onPress,
  onInteractionChange,
}: {
  category: CustomCategory;
  disabled?: boolean;
  onPress: () => void;
  onInteractionChange?: (active: boolean) => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.buttonExpanded,
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

function GrowthTile({ disabled = false, onPress }: { disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [styles.button, styles.buttonExpanded, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
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
  onSelect: (action: OneTouchAction) => void;
  onLongPress?: (action: OneTouchAction) => void;
  onOpenActiveTimer?: (action: OneTouchAction) => void;
  onInteractionChange?: (active: boolean) => void;
}) {
  const category = getCategory(action.cat);
  const activeSleep = action.id === "sleep" && sleepActive;
  const inProgress = timerActive || activeSleep;
  const ActionIcon = CATEGORY_ICONS[action.cat];

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        expanded ? styles.buttonExpanded : styles.buttonCompact,
        inProgress && styles.activeButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPressIn={() => onInteractionChange?.(true)}
      onPressOut={() => onInteractionChange?.(false)}
      onPress={() => {
        // An in-progress timer must never open a second quick-record flow.
        // Open its sheet so the user can pause or finish the same timer.
        if (inProgress && onOpenActiveTimer) {
          onOpenActiveTimer(action.id);
          return;
        }
        onSelect(action.id);
      }}
      onLongPress={() => {
        if (inProgress && onOpenActiveTimer) {
          onOpenActiveTimer(action.id);
          return;
        }
        onLongPress?.(action.id);
      }}
      delayLongPress={380}
      accessibilityLabel={`${
        activeSleep ? "수면 종료" : inProgress ? `${action.label} 진행 중` : action.label
      } 즉시 기록`}
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
  section: { width: "100%", marginBottom: 18 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  headingCopy: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, flex: 1, paddingRight: 8 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 11.5, color: colors.faint, flexShrink: 1 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countBadgeText: { color: colors.text, fontSize: 10.5, fontWeight: "700" },
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
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  activeLabel: { color: colors.amber },
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
  expandTileLabel: { fontSize: 11, fontWeight: "800", color: colors.amber, textAlign: "center" },
  collapseButton: {
    marginTop: 10,
    minHeight: 36,
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
