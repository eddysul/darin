import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  fromPush?: boolean;
  onClose: () => void;
  onSave: (comment: string, photoUri: string | null) => void;
};

export function DiaryComposeModal({ visible, fromPush, onClose, onSave }: Props) {
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    onSave(notes.trim() || "(코멘트 없음)", photoUri);
    setNotes("");
    setPhotoUri(null);
    onClose();
  };

  const handleClose = () => {
    setNotes("");
    setPhotoUri(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.stage} onPress={() => {}}>
          <View style={styles.stateRow}>
            {fromPush && <BabyLogIcon kind="bell" size={16} color={colors.amber} />}
            <Text style={styles.state}>{fromPush ? "알림에서 바로 쓰는 일기" : "오늘 일기 쓰기"}</Text>
          </View>

          <Pressable style={styles.photoBox} onPress={() => void pickPhoto()}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <Text style={styles.photoHint}>📷 사진 추가하기</Text>
            )}
          </Pressable>

          <Text style={styles.fieldLabel}>코멘트</Text>
          <TextInput
            style={styles.notes}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="오늘 콩이와 있었던 일을 적어보세요"
            placeholderTextColor={colors.faint}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={handleClose}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
              <Text style={styles.btnPrimaryText}>일기 저장</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(12,13,17,0.97)",
    justifyContent: "center",
    padding: 30,
  },
  stage: { width: "100%" },
  stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 22 },
  state: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  photoBox: {
    height: 150,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  photo: { width: "100%", height: "100%" },
  photoHint: { color: colors.faint, fontSize: 13, fontWeight: "600" },
  fieldLabel: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  notes: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    padding: 14,
    height: 90,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
});
