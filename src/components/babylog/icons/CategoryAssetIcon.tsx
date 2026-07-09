import { useId } from "react";
import Svg, { Defs, Image as SvgImage, Mask, Rect } from "react-native-svg";
import type { ImageSource } from "expo-image";
import type { LucideProps } from "lucide-react-native";

export function createCategoryAssetIcon(source: ImageSource) {
  return function CategoryAssetIcon({ size = 24, color = "currentColor" }: LucideProps) {
    const s = Number(size);
    const maskId = useId().replace(/:/g, "");

    return (
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Defs>
          <Mask id={maskId} x="0" y="0" width={s} height={s}>
            <SvgImage
              href={source}
              width={s}
              height={s}
              preserveAspectRatio="xMidYMid meet"
            />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={s} height={s} fill={String(color)} mask={`url(#${maskId})`} />
      </Svg>
    );
  };
}
