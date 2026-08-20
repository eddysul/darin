import { useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { diaryCoverTemplate, type DiaryCoverTemplateId } from "../../constants/diaryCoverTemplates";
import type { DiaryCoverPhotoTransform } from "../../types/babyLog";
import { frameRadius } from "./DiaryCoverTemplate";
import { useLanguage } from "../../LanguageContext";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DiaryCoverPhotoAdjustModal({ visible, photoUri, styleId, value, onCancel, onSave }: { visible: boolean; photoUri: string | null; styleId: DiaryCoverTemplateId; value: DiaryCoverPhotoTransform; onCancel: () => void; onSave: (value: DiaryCoverPhotoTransform) => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const template = diaryCoverTemplate(styleId);
  const [draft, setDraft] = useState(value);
  const latest = useRef(value);
  const start = useRef(value);

  const update = (next: DiaryCoverPhotoTransform) => {
    latest.current = next;
    setDraft(next);
  };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => { start.current = latest.current; },
    onPanResponderMove: (_, gesture) => update({ ...latest.current, translateX: clamp(start.current.translateX + gesture.dx / 150, -1, 1), translateY: clamp(start.current.translateY + gesture.dy / 180, -1, 1) }),
  }), []);

  const openValue = () => {
    latest.current = value;
    setDraft(value);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={openValue} onRequestClose={onCancel}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerButton}><Text style={styles.cancel}>{t("common.cancel")}</Text></Pressable>
          <Text style={styles.headerTitle}>{t("diary.coverAdjust.title")}</Text>
          <Pressable onPress={() => onSave(draft)} style={styles.headerButton}><Text style={styles.save}>{t("common.done")}</Text></Pressable>
        </View>
        <Text style={styles.hint}>{t("diary.coverAdjust.hint")}</Text>
        <View style={styles.previewWrap}>
          <View {...panResponder.panHandlers} style={[styles.cropFrame, { borderColor: template.photoFrame.borderColor, borderRadius: frameRadius(template.photoFrame.shape, template.photoFrame.radius, 280) }]}>
            {photoUri ? <Image source={{ uri: photoUri }} contentFit="cover" style={[StyleSheet.absoluteFillObject, { transform: [{ scale: draft.scale }, { translateX: draft.translateX * 118 }, { translateY: draft.translateY * 145 }] }]} /> : null}
          </View>
        </View>
        <View style={styles.controls}>
          <Pressable style={styles.control} onPress={() => update({ ...draft, scale: clamp(draft.scale - 0.15, 1, 3) })}><Text style={styles.controlText}>{t("common.zoomOut")}</Text></Pressable>
          <Pressable style={styles.control} onPress={() => update({ scale: 1, translateX: 0, translateY: 0 })}><Text style={styles.controlText}>{t("common.reset")}</Text></Pressable>
          <Pressable style={styles.control} onPress={() => update({ ...draft, scale: clamp(draft.scale + 0.15, 1, 3) })}><Text style={styles.controlText}>{t("common.zoomIn")}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF9F3", paddingHorizontal: 18 },
  header: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerButton: { minWidth: 52, minHeight: 44, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#342F2A" },
  cancel: { fontSize: 15, color: "#746D65" },
  save: { fontSize: 15, color: "#C6534D", fontWeight: "800", textAlign: "right" },
  hint: { textAlign: "center", marginVertical: 18, color: "#746D65", fontSize: 14 },
  previewWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  cropFrame: { width: 280, height: 350, overflow: "hidden", borderWidth: 3, backgroundColor: "#EEEAE4" },
  controls: { flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 16 },
  control: { minWidth: 84, minHeight: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4D9CE", alignItems: "center", justifyContent: "center" },
  controlText: { fontSize: 14, fontWeight: "700", color: "#5F574F" },
});
