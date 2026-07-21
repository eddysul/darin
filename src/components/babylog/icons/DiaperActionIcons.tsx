import Svg, { Circle, Path } from "react-native-svg";
import type { LucideProps } from "lucide-react-native";

function DiaperBase({ color, strokeWidth = 1.8 }: Pick<LucideProps, "color" | "strokeWidth">) {
  return (
    <Path
      d="M4 5.5c1.7 1.25 4.25 1.9 8 1.9s6.3-.65 8-1.9v10.2c-1.6 1.75-4.25 2.8-8 2.8s-6.4-1.05-8-2.8V5.5Z"
      fill="none"
      stroke={String(color)}
      strokeWidth={Number(strokeWidth)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function DiaperUrineIcon({ size = 24, color = "currentColor", strokeWidth = 1.8 }: LucideProps) {
  return (
    <Svg width={Number(size)} height={Number(size)} viewBox="0 0 24 24">
      <DiaperBase color={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 9.3c1.15 1.45 2 2.55 2 3.7a2 2 0 0 1-4 0c0-1.15.85-2.25 2-3.7Z"
        fill="none"
        stroke={String(color)}
        strokeWidth={Number(strokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DiaperBowelIcon({ size = 24, color = "currentColor", strokeWidth = 1.8 }: LucideProps) {
  return (
    <Svg width={Number(size)} height={Number(size)} viewBox="0 0 24 24">
      <DiaperBase color={color} strokeWidth={strokeWidth} />
      <Circle cx="9.5" cy="12.6" r="1" fill={String(color)} />
      <Circle cx="12.4" cy="11.6" r="1.15" fill={String(color)} />
      <Circle cx="14.7" cy="13.2" r="0.9" fill={String(color)} />
    </Svg>
  );
}
