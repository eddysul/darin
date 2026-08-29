import { useMemo, type ReactNode } from "react";
import { Animated, PanResponder, useWindowDimensions, View } from "react-native";
import { resolveGrowthBookSwipeDirection } from "../../../utils/growthBookPages";
import { styles } from "./styles";
import type { BookPageNavigationProps } from "./types";

export function SwipeableCanvasStage({
  navigation,
  children,
  enabled = true,
}: {
  navigation: BookPageNavigationProps;
  children: ReactNode;
  enabled?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const travelDistance = Math.max(320, windowWidth);
  const translateX = navigation.pageTurnProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      navigation.pageTurnDirection * -travelDistance,
      0,
      navigation.pageTurnDirection * travelDistance,
    ],
  });
  const swipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        enabled && resolveGrowthBookSwipeDirection(gesture.dx, gesture.dy, 18) !== null,
      onPanResponderRelease: (_, gesture) => {
        const direction = resolveGrowthBookSwipeDirection(gesture.dx, gesture.dy);
        if (direction === "next") navigation.onNext();
        if (direction === "previous") navigation.onPrevious();
      },
      onPanResponderTerminationRequest: () => true,
    }),
    [enabled, navigation.onNext, navigation.onPrevious],
  );

  if (!enabled) {
    return (
      <View style={styles.canvasStage}>
        <View style={styles.pageSlideSurface}>{children}</View>
      </View>
    );
  }

  return (
    <View {...swipeResponder.panHandlers} style={styles.canvasStage}>
      <Animated.View style={[styles.pageSlideSurface, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}
