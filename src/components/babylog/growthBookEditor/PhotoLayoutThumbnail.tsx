import { View } from "react-native";
import type { PhotoLayout, PhotoLayoutTuning } from "../../../types/growthBook";
import { getPhotoLayoutSlots } from "../../../utils/growthBookPhotoLayouts";
import { styles } from "./styles";

export function PhotoLayoutThumbnail({
  layout,
  selected,
  tuning,
}: {
  layout: PhotoLayout;
  selected: boolean;
  tuning?: PhotoLayoutTuning;
}) {
  return (
    <View style={styles.layoutThumbnail}>
      {getPhotoLayoutSlots(layout, tuning).map((slot) => (
        <View
          key={slot.slotId}
          style={[
            styles.layoutThumbnailSlot,
            selected && styles.layoutThumbnailSlotSelected,
            {
              left: `${slot.xRatio * 100}%`,
              top: `${slot.yRatio * 100}%`,
              width: `${slot.widthRatio * 100}%`,
              height: `${slot.heightRatio * 100}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}
