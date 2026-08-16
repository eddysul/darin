import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const apply = (enabled: boolean) => setReduceMotion(enabled);
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", apply);
    return () => sub.remove();
  }, []);

  return reduceMotion;
}
