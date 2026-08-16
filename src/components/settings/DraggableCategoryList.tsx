import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors } from "../../theme";

const DEFAULT_ROW_H = 66;
const ARM_MS = 380;

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Props<T extends string> = {
  items: T[];
  onReorder: (next: T[]) => void;
  onDragActiveChange?: (active: boolean) => void;
  renderRow: (item: T, index: number) => ReactNode;
};

export function DraggableCategoryList<T extends string>({
  items,
  onReorder,
  onDragActiveChange,
  renderRow,
}: Props<T>) {
  const reduceMotion = useReduceMotion();
  const [draggingId, setDraggingId] = useState<T | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  return (
    <View>
      {items.map((item, index) => (
        <DraggableCategoryRow
          key={item}
          id={item}
          index={index}
          dragging={draggingId === item}
          reduceMotion={reduceMotion}
          onDragActiveChange={onDragActiveChange}
          setDraggingId={setDraggingId}
          itemsRef={itemsRef}
          onReorder={onReorder}
        >
          {renderRow(item, index)}
        </DraggableCategoryRow>
      ))}
    </View>
  );
}

function DraggableCategoryRow<T extends string>({
  id,
  index,
  dragging,
  reduceMotion,
  onDragActiveChange,
  setDraggingId,
  itemsRef,
  onReorder,
  children,
}: {
  id: T;
  index: number;
  dragging: boolean;
  reduceMotion: boolean;
  onDragActiveChange?: (active: boolean) => void;
  setDraggingId: (id: T | null) => void;
  itemsRef: { current: T[] };
  onReorder: (next: T[]) => void;
  children: ReactNode;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const startIndexRef = useRef(index);
  const grantOrderRef = useRef<T[]>([]);
  const armedRef = useRef(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowHeightRef = useRef(DEFAULT_ROW_H);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onDragActiveChangeRef = useRef(onDragActiveChange);
  onDragActiveChangeRef.current = onDragActiveChange;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const clearArmTimer = () => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  };

  const endDrag = () => {
    clearArmTimer();
    armedRef.current = false;
    translateY.setValue(0);
    setDraggingId(null);
    onDragActiveChangeRef.current?.(false);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => !armedRef.current,
        onPanResponderGrant: () => {
          startIndexRef.current = itemsRef.current.indexOf(id);
          grantOrderRef.current = [...itemsRef.current];
          armedRef.current = false;
          clearArmTimer();
          armTimerRef.current = setTimeout(() => {
            armedRef.current = true;
            setDraggingId(id);
            onDragActiveChangeRef.current?.(true);
            if (!reduceMotionRef.current) Vibration.vibrate(8);
          }, ARM_MS);
        },
        onPanResponderMove: (_, gesture) => {
          if (!armedRef.current) {
            if (Math.abs(gesture.dy) > 10 || Math.abs(gesture.dx) > 10) clearArmTimer();
            return;
          }
          const height = rowHeightRef.current || DEFAULT_ROW_H;
          const start = startIndexRef.current;
          const last = grantOrderRef.current.length - 1;
          const target = Math.max(0, Math.min(last, start + Math.round(gesture.dy / height)));
          const current = itemsRef.current.indexOf(id);
          if (target !== current) {
            onReorderRef.current(moveItem(grantOrderRef.current, start, target));
          }
          const shifted = (itemsRef.current.indexOf(id) - start) * height;
          translateY.setValue(reduceMotionRef.current ? 0 : gesture.dy - shifted);
        },
        onPanResponderRelease: endDrag,
        onPanResponderTerminate: endDrag,
      }),
    [id, itemsRef, setDraggingId, translateY],
  );

  return (
    <Animated.View
      onLayout={(event) => {
        rowHeightRef.current = event.nativeEvent.layout.height;
      }}
      style={[
        styles.row,
        dragging && styles.rowDragging,
        { transform: [{ translateY }], zIndex: dragging ? 4 : 0, elevation: dragging ? 6 : 0 },
      ]}
    >
      <View
        style={styles.handle}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="순서 변경"
        accessibilityHint="길게 누른 뒤 위아래로 끌어 순서를 바꿔요"
        accessibilityActions={[
          { name: "increment", label: "아래로 이동" },
          { name: "decrement", label: "위로 이동" },
        ]}
        onAccessibilityAction={(event) => {
          const current = itemsRef.current;
          const from = current.indexOf(id);
          if (event.nativeEvent.actionName === "increment") onReorder(moveItem(current, from, from + 1));
          if (event.nativeEvent.actionName === "decrement") onReorder(moveItem(current, from, from - 1));
        }}
      >
        <View style={styles.gripCol}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
        <View style={styles.gripCol}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: DEFAULT_ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingRight: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  rowDragging: {
    backgroundColor: colors.cardHi,
    borderBottomColor: colors.amber,
  },
  handle: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 3,
  },
  gripCol: { gap: 3 },
  gripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.faint,
  },
});
