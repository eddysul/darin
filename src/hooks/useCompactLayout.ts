import { useWindowDimensions } from "react-native";

/** iPhone SE (1–3) and similarly short or narrow windows. */
export function useCompactLayout() {
  const { width, height } = useWindowDimensions();
  return height < 700 || width < 360;
}
