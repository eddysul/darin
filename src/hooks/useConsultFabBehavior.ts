import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

const SCROLL_REVEAL_MS = 500;

/** Shared AI FAB hide/reveal + prompt sheet state for Record / Diary / 한눈에. */
export function useConsultFabBehavior(extraHidden = false) {
  const [scrolling, setScrolling] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    };
  }, []);

  const scheduleScrollReveal = useCallback(() => {
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = setTimeout(() => setScrolling(false), SCROLL_REVEAL_MS);
  }, []);

  const onScrollBegin = useCallback(() => {
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    setScrolling(true);
  }, []);

  const onScrollEnd = useCallback(() => {
    scheduleScrollReveal();
  }, [scheduleScrollReveal]);

  const fabHidden = scrolling || keyboardOpen || promptOpen || extraHidden;

  const scrollProps = {
    onScrollBeginDrag: onScrollBegin,
    onScrollEndDrag: onScrollEnd as (e?: NativeSyntheticEvent<NativeScrollEvent>) => void,
    onMomentumScrollBegin: onScrollBegin,
    onMomentumScrollEnd: onScrollEnd as (e?: NativeSyntheticEvent<NativeScrollEvent>) => void,
    scrollEventThrottle: 16 as const,
  };

  return {
    fabHidden,
    promptOpen,
    setPromptOpen,
    scrollProps,
  };
}
