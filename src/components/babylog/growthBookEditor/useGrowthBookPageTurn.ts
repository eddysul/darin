import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export function useGrowthBookPageTurn(pageCount: number, reduceMotion: boolean) {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pageTurnDirection, setPageTurnDirection] = useState<-1 | 1>(-1);
  const pageTurnProgress = useRef(new Animated.Value(0)).current;
  const pageTurnAnimating = useRef(false);

  useEffect(() => {
    if (activePageIndex >= pageCount) setActivePageIndex(Math.max(0, pageCount - 1));
  }, [activePageIndex, pageCount]);

  const resetTurnAnimation = useCallback(() => {
    pageTurnProgress.stopAnimation();
    pageTurnProgress.setValue(0);
    pageTurnAnimating.current = false;
  }, [pageTurnProgress]);

  const goToPage = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped === activePageIndex || pageTurnAnimating.current) return;
    const direction = clamped > activePageIndex ? -1 : 1;
    pageTurnAnimating.current = true;
    setPageTurnDirection(direction);
    pageTurnProgress.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(pageTurnProgress, {
        toValue: 1,
        duration: reduceMotion ? 0 : 105,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          pageTurnAnimating.current = false;
          pageTurnProgress.setValue(0);
          return;
        }
        setActivePageIndex(clamped);
        pageTurnProgress.setValue(-1);
        requestAnimationFrame(() => {
          Animated.timing(pageTurnProgress, {
            toValue: 0,
            duration: reduceMotion ? 0 : 115,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            pageTurnAnimating.current = false;
          });
        });
      });
    });
  }, [activePageIndex, pageCount, pageTurnProgress, reduceMotion]);

  return {
    activePageIndex,
    setActivePageIndex,
    pageTurnDirection,
    pageTurnProgress,
    goToPage,
    resetTurnAnimation,
  };
}
