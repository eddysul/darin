import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import {
  buildGrowthBookPages,
  type GrowthBookPage,
} from "../../utils/growthBookPages";
import { colors } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { DiaryStampPair } from "./DiaryStamp";

type Props = {
  visible: boolean;
  babyName: string;
  entries: DiaryEntry[];
  onClose: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export function GrowthBookPreviewModal({ visible, babyName, entries, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<GrowthBookPage>>(null);
  const [index, setIndex] = useState(0);
  const turnAnim = useRef(new Animated.Value(0)).current;

  const pages = useMemo(
    () => buildGrowthBookPages({ babyName, entries }),
    [babyName, entries],
  );

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    turnAnim.setValue(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [visible, turnAnim]);

  const playTurn = useCallback(() => {
    turnAnim.setValue(0);
    Animated.sequence([
      Animated.timing(turnAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(turnAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [turnAnim]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, next));
      if (clamped === index) return;
      playTurn();
      setIndex(clamped);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
    },
    [index, pages.length, playTurn],
  );

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== index) {
      playTurn();
      setIndex(next);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const pageRotate = turnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-6deg"],
  });
  const pageLift = turnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const renderItem = ({ item }: ListRenderItemInfo<GrowthBookPage>) => (
    <View style={[styles.pageSlide, { width: SCREEN_W }]}>
      <Animated.View
        style={[
          styles.paperWrap,
          {
            transform: [{ perspective: 900 }, { rotateY: pageRotate }, { translateY: pageLift }],
          },
        ]}
      >
        <PaperPage page={item} />
      </Animated.View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <LinearGradient colors={["#3D342C", "#2A241F", "#1E1A16"]} style={StyleSheet.absoluteFill} />

        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.topBtn}>
            <Text style={styles.topBtnText}>닫기</Text>
          </Pressable>
          <Text style={styles.topTitle}>성장책 미리보기</Text>
          <View style={styles.topBtn} />
        </View>

        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          onMomentumScrollEnd={onMomentumEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          decelerationRate="fast"
        />

        <View style={styles.navRow}>
          <Pressable
            style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>

          <Text style={styles.pageNum}>
            {index + 1} / {pages.length}
          </Text>

          <Pressable
            style={[styles.arrowBtn, index >= pages.length - 1 && styles.arrowDisabled]}
            onPress={() => goTo(index + 1)}
            disabled={index >= pages.length - 1}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <Pressable style={styles.pdfBtn} disabled>
          <Text style={styles.pdfBtnText}>PDF 만들기</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

function PaperPage({ page }: { page: GrowthBookPage }) {
  return (
    <View style={styles.paper}>
      <LinearGradient colors={["#FFF9F2", "#F7EFE4", "#F3E8DA"]} style={StyleSheet.absoluteFill} />
      {/* Paper grain / margin line */}
      <View style={styles.marginLine} />
      <View style={styles.dogEar} />

      {page.kind === "cover" ? <CoverContent page={page} /> : null}
      {page.kind === "moment" || page.kind === "photo" ? <MomentContent page={page} /> : null}
      {page.kind === "letter" ? <LetterContent page={page} /> : null}
    </View>
  );
}

function CoverContent({ page }: { page: GrowthBookPage }) {
  return (
    <View style={styles.coverInner}>
      <Text style={styles.coverEyebrow}>{page.subtitle}</Text>
      <Text style={styles.coverTitle}>{page.title}</Text>
      {page.photoUri ? (
        <View style={styles.coverPhotoFrame}>
          <Image source={{ uri: page.photoUri }} style={styles.coverPhoto} contentFit="cover" />
        </View>
      ) : (
        <View style={styles.coverPhotoPlaceholder}>
          <Text style={styles.coverPhotoEmoji}>🌿</Text>
          <Text style={styles.coverPhotoHint}>소중한 순간들이 여기에 담겨요</Text>
        </View>
      )}
      {page.dateLabel ? <Text style={styles.coverRange}>{page.dateLabel}</Text> : null}
    </View>
  );
}

function MomentContent({ page }: { page: GrowthBookPage }) {
  const photoHeavy = page.kind === "photo" || !!page.photoUri;
  return (
    <View style={styles.momentInner}>
      <View style={styles.momentHeader}>
        <Text style={styles.momentEyebrow}>{page.subtitle}</Text>
        <DiaryStampPair skyId={page.weatherStamp} moodId={page.moodStamp} size="sm" />
      </View>
      <Text style={styles.momentTitle}>{page.title}</Text>
      {page.dateLabel ? <Text style={styles.momentDate}>{page.dateLabel}</Text> : null}

      {page.photoUri ? (
        <View style={[styles.momentPhotoFrame, photoHeavy && styles.momentPhotoLarge]}>
          <Image source={{ uri: page.photoUri }} style={styles.momentPhoto} contentFit="cover" />
        </View>
      ) : null}

      {page.body ? (
        <Text style={styles.momentBody} numberOfLines={photoHeavy ? 5 : 10}>
          {page.body}
        </Text>
      ) : null}
    </View>
  );
}

function LetterContent({ page }: { page: GrowthBookPage }) {
  return (
    <View style={styles.letterInner}>
      <BabyLogIcon kind="sparkles" size={18} color={colors.amber} />
      <Text style={styles.letterEyebrow}>{page.subtitle}</Text>
      <Text style={styles.letterTitle}>{page.title}</Text>
      <Text style={styles.letterBody}>{page.body}</Text>
      <View style={styles.letterSeal}>
        <Text style={styles.letterSealText}>♥</Text>
      </View>
    </View>
  );
}

const PAPER_H = Math.min(SCREEN_H * 0.62, 560);

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBtn: { minWidth: 48 },
  topBtnText: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 15 },
  topTitle: { color: "#FFF8F0", fontWeight: "800", fontSize: 16 },
  pageSlide: {
    height: PAPER_H + 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  paperWrap: {
    width: "100%",
    maxWidth: 420,
    height: PAPER_H,
  },
  paper: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,115,90,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  marginLine: {
    position: "absolute",
    left: 22,
    top: 16,
    bottom: 16,
    width: 1,
    backgroundColor: "rgba(232,145,138,0.28)",
  },
  dogEar: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderTopWidth: 22,
    borderLeftWidth: 22,
    borderTopColor: "rgba(196,170,140,0.55)",
    borderLeftColor: "transparent",
  },
  coverInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.amber,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  coverTitle: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: "800",
    color: "#3D342C",
    textAlign: "center",
    lineHeight: 34,
  },
  coverPhotoFrame: {
    marginTop: 22,
    width: "86%",
    aspectRatio: 1,
    maxHeight: 240,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 6,
    borderColor: "#FFF",
    shadowColor: "#8B735A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  coverPhoto: { width: "100%", height: "100%" },
  coverPhotoPlaceholder: {
    marginTop: 22,
    width: "86%",
    aspectRatio: 1,
    maxHeight: 220,
    borderRadius: 14,
    backgroundColor: "rgba(232,145,138,0.12)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },
  coverPhotoEmoji: { fontSize: 42 },
  coverPhotoHint: { fontSize: 12.5, color: "#8A735A", textAlign: "center", fontWeight: "600" },
  coverRange: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "700",
    color: "#8A735A",
    letterSpacing: 1,
  },
  momentInner: { flex: 1, paddingHorizontal: 28, paddingVertical: 24 },
  momentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  momentEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.amber,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  momentTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#3D342C",
    lineHeight: 30,
  },
  momentDate: { marginTop: 4, fontSize: 12.5, fontWeight: "600", color: "#8A735A" },
  momentPhotoFrame: {
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
    height: 160,
    borderWidth: 4,
    borderColor: "#FFF",
  },
  momentPhotoLarge: { height: 220 },
  momentPhoto: { width: "100%", height: "100%" },
  momentBody: {
    marginTop: 14,
    fontSize: 14.5,
    lineHeight: 23,
    color: "#4A4038",
    fontWeight: "500",
  },
  letterInner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 36,
    justifyContent: "center",
  },
  letterEyebrow: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    color: colors.amber,
    letterSpacing: 1,
  },
  letterTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
    color: "#3D342C",
  },
  letterBody: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 26,
    color: "#4A4038",
    fontWeight: "500",
  },
  letterSeal: {
    marginTop: 28,
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(232,145,138,0.25)",
    borderWidth: 1.5,
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  letterSealText: { color: colors.amber, fontSize: 18, fontWeight: "800" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 4,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,248,240,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { color: "#FFF8F0", fontSize: 28, fontWeight: "300", marginTop: -2 },
  pageNum: { color: "rgba(255,248,240,0.8)", fontWeight: "700", fontSize: 14, minWidth: 64, textAlign: "center" },
  pdfBtn: {
    marginTop: 14,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,248,240,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,248,240,0.12)",
    opacity: 0.7,
  },
  pdfBtnText: { color: "rgba(255,248,240,0.65)", fontWeight: "700", fontSize: 13.5 },
  comingSoon: {
    backgroundColor: "rgba(232,145,138,0.25)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: { fontSize: 10.5, fontWeight: "800", color: colors.amber },
});
