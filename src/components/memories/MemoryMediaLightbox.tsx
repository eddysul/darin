import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../LanguageContext";
import type { MemoryMedia } from "../../types/memory";
import { MemoryMediaViewer } from "./MemoryMediaViewer";

type Props = {
  visible: boolean;
  media: MemoryMedia[];
  imageUrls: string[];
  posterUrls?: string[];
  initialIndex?: number;
  onClose: () => void;
  onDoubleTapLike?: () => void;
};

export function MemoryMediaLightbox({
  visible,
  media,
  imageUrls,
  posterUrls,
  initialIndex = 0,
  onClose,
  onDoubleTapLike,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.close, { top: Math.max(insets.top, 12) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={media.some((item) => item.mediaType === "video") ? t("memory.critical.205") : t("memory.critical.187")}
        >
          <Text style={styles.closeText}>{t("memory.critical.067")}</Text>
        </Pressable>
        <MemoryMediaViewer
          media={media}
          imageUrls={imageUrls}
          posterUrls={posterUrls}
          initialIndex={initialIndex}
          variant="fullscreen"
          showIndexBadge
          onDoubleTap={onDoubleTapLike}
        />
        <View style={{ height: Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8) }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    right: 8,
    zIndex: 2,
    minWidth: Platform.OS === "android" ? 48 : 44,
    minHeight: Platform.OS === "android" ? 48 : 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
