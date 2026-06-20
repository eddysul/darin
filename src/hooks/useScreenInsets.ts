import { useSafeAreaInsets } from "react-native-safe-area-context";

const TOP_EXTRA = 12;
const TAB_BAR_EXTRA = 88;

/** Safe-area top inset plus a small buffer so titles clear the status bar. */
export function useScreenTopInset(extra = TOP_EXTRA) {
  const { top } = useSafeAreaInsets();
  return top + extra;
}

/** Insets for tab screens — clears status bar and bottom tab bar. */
export function useTabContentInsets() {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + TOP_EXTRA,
    paddingBottom: insets.bottom + TAB_BAR_EXTRA,
  };
}
