import Svg, { Path } from "react-native-svg";
import type { LucideProps } from "lucide-react-native";

export function StoredMilkIcon({ size = 24, color = "currentColor", strokeWidth = 1.8 }: LucideProps) {
  const stroke = String(color);
  const width = Number(strokeWidth);
  return (
    <Svg width={Number(size)} height={Number(size)} viewBox="0 0 24 24">
      <Path d="M9 3h6M9.5 6h5M9 3v3m6-3v3" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Path d="M8 6h8l1 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l1-3Z" fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" />
      <Path d="M12 10.2c1.15 1.35 1.8 2.25 1.8 3.15a1.8 1.8 0 0 1-3.6 0c0-.9.65-1.8 1.8-3.15Z" fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" />
    </Svg>
  );
}
