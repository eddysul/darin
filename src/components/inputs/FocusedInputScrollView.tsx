import { useCallback, useEffect, useRef } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";

type Props = ScrollViewProps & {
  /** Breathing room between the focused field and the keyboard. */
  keyboardExtraOffset?: number;
};

/**
 * Keeps the active input visible without moving the entire sheet.
 * iOS owns the keyboard inset; both platforms only scroll the minimum amount
 * needed for the currently focused native input.
 */
export function FocusedInputScrollView({
  keyboardExtraOffset = 16,
  keyboardShouldPersistTaps = "handled",
  keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
  automaticallyAdjustKeyboardInsets = Platform.OS === "ios",
  onScroll,
  onTouchEnd,
  ...props
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const reduceMotion = useReduceMotion();

  const revealFocusedInput = useCallback((delay = 0) => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      const focused = TextInput.State.currentlyFocusedInput();
      const top = keyboardTop.current;
      if (!focused || top == null) return;
      const measurable = focused as unknown as {
        measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
      };
      measurable.measureInWindow?.((_x, y, _width, height) => {
        const overlap = y + height + keyboardExtraOffset - top;
        if (overlap <= 0) return;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + overlap),
          animated: !reduceMotion,
        });
      });
    }, delay);
  }, [keyboardExtraOffset, reduceMotion]);

  useEffect(() => {
    const updateKeyboardFrame = (event: KeyboardEvent) => {
      keyboardTop.current = Number.isFinite(event.endCoordinates.screenY)
        ? event.endCoordinates.screenY
        : Dimensions.get("window").height - event.endCoordinates.height;
      revealFocusedInput(64);
    };
    const shown = Keyboard.addListener("keyboardDidShow", updateKeyboardFrame);
    const frame = Platform.OS === "ios"
      ? Keyboard.addListener("keyboardDidChangeFrame", updateKeyboardFrame)
      : null;
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = null;
    });
    return () => {
      shown.remove();
      frame?.remove();
      hidden.remove();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [revealFocusedInput]);

  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollsToTop={false}
      scrollEventThrottle={16}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      onTouchEnd={(event) => {
        onTouchEnd?.(event);
        // Focus settles after the native touch. Debouncing prevents a second
        // jump when the keyboard frame event arrives at nearly the same time.
        revealFocusedInput(32);
      }}
    />
  );
}
