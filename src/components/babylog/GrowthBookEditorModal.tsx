import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import type { DiaryEntry } from "../../types/babyLog";
import type { FamilyMember, FamilyRole } from "../../types/family";
import {
  canDeleteGrowthBookNote,
  canEditOwnGrowthBookNote,
  canWriteGrowthBookNote,
  memberRelationshipLabel,
} from "../../types/family";
import type {
  GrowthBookComment,
  GrowthBookCommentSticker,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookPageEdit,
  GrowthBookPageSticker,
} from "../../types/growthBook";
import { formatGrowthAuthorLabel, type PhotoLayout, type PhotoLayoutTuning } from "../../types/growthBook";
import {
  buildGrowthBookPageMeta,
  buildGrowthBookPaginationItems,
  buildGrowthBookPages,
  collectGrowthBookPhotoPool,
  resolvePageBody,
  resolvePageEdit,
  resolvePagePhotos,
  resolveGrowthBookSwipeDirection,
  type GrowthBookPage,
  type GrowthBookPageMeta,
} from "../../utils/growthBookPages";
import {
  PHOTO_LAYOUT_OPTIONS,
  PRIMARY_RATIO_LAYOUTS,
  SECONDARY_RATIO_LAYOUTS,
  getPhotoLayoutCount,
  getPhotoLayoutSlots,
  photoLayoutLabel,
  swapPhotoOrder,
} from "../../utils/growthBookPhotoLayouts";
import { diaryMilestoneLabel, sortGrowthBookEntries } from "../../utils/diaryModel";
import { colors, radius } from "../../theme";
import { BabyLogIcon, type MiscIconKey } from "./BabyLogIcon";
import { BabyStickerVaultModal } from "./BabyStickerVaultModal";
import { BabyStickerFromModel } from "./BabyStickerView";
import { useBabyLog } from "../../context/BabyLogContext";
import {
  GrowthBookPageCanvas,
  type GrowthBookCanvasMode,
} from "./GrowthBookPageCanvas";
import { GrowthBookReader } from "./GrowthBookReader";

type Props = {
  visible: boolean;
  babyName: string;
  babyId: string;
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  onChange: (next: GrowthBookEdit) => void;
  onClose: () => void;
  onDismiss?: () => void;
  initialDiaryId?: string | null;
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function pickImageUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export function GrowthBookEditorModal({
  visible,
  babyName,
  babyId,
  entries,
  edit,
  me,
  myRole,
  onChange,
  onClose,
  onDismiss,
  initialDiaryId,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { babyStickers } = useBabyLog();
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pageMode, setPageMode] = useState<GrowthBookCanvasMode>("edit");
  const [pageTurnDirection, setPageTurnDirection] = useState<-1 | 1>(-1);
  const pageTurnProgress = useRef(new Animated.Value(0)).current;
  const pageTurnAnimating = useRef(false);
  const wasVisible = useRef(false);

  const bookEntries = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );
  const bookPages = useMemo(
    () => buildGrowthBookPages({ babyName, entries: bookEntries, edit }),
    [babyName, bookEntries, edit],
  );
  const pageMeta = useMemo(() => buildGrowthBookPageMeta(bookPages), [bookPages]);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const targetIndex = initialDiaryId
        ? bookPages.findIndex((page) => page.diaryId === initialDiaryId)
        : 0;
      setActivePageIndex(targetIndex >= 0 ? targetIndex : 0);
    }
    if (!visible) {
      pageTurnProgress.stopAnimation();
      pageTurnProgress.setValue(0);
      pageTurnAnimating.current = false;
      setActivePageIndex(0);
      setPageMode("edit");
    }
    wasVisible.current = visible;
  }, [bookPages, initialDiaryId, pageTurnProgress, visible]);

  useEffect(() => {
    if (activePageIndex >= bookPages.length) setActivePageIndex(Math.max(0, bookPages.length - 1));
  }, [activePageIndex, bookPages.length]);

  const patch = useCallback(
    (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => {
      onChange({ ...updater(edit), babyId, updatedAt: new Date().toISOString() });
    },
    [babyId, edit, onChange],
  );

  const activePage = bookPages[activePageIndex] ?? bookPages[0];
  const activeEntry = activePage?.diaryId
    ? bookEntries.find((entry) => entry.id === activePage.diaryId) ?? null
    : null;
  const goToPage = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(bookPages.length - 1, next));
    if (clamped === activePageIndex || pageTurnAnimating.current) return;
    const direction = clamped > activePageIndex ? -1 : 1;
    pageTurnAnimating.current = true;
    setPageTurnDirection(direction);
    pageTurnProgress.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(pageTurnProgress, {
        toValue: 1,
        duration: reduceMotion ? 0 : 105,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          pageTurnAnimating.current = false;
          pageTurnProgress.setValue(0);
          return;
        }
        setActivePageIndex(clamped);
        pageTurnProgress.setValue(-1);
        requestAnimationFrame(() => {
          Animated.timing(pageTurnProgress, {
            toValue: 0,
            duration: reduceMotion ? 0 : 115,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            pageTurnAnimating.current = false;
          });
        });
      });
    });
  }, [activePageIndex, bookPages.length, pageTurnProgress, reduceMotion]);

  const navigation: BookPageNavigationProps = {
    pages: pageMeta,
    activeIndex: activePageIndex,
    onSelect: goToPage,
    onPrevious: () => goToPage(activePageIndex - 1),
    onNext: () => goToPage(activePageIndex + 1),
    pageTurnProgress,
    pageTurnDirection,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="목차로"
            style={styles.headerBtnHit}
          >
            <Text style={styles.headerBtn}>목차로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>성장책 편집</Text>
          <Pressable
            onPress={() => setPageMode((current) => current === "edit" ? "preview" : "edit")}
            hitSlop={10}
            style={styles.headerModeBtn}
            accessibilityRole="button"
            accessibilityLabel={pageMode === "edit" ? "미리보기" : "편집"}
          >
            <Text style={styles.headerBtn}>{pageMode === "edit" ? "미리보기" : "편집"}</Text>
          </Pressable>
        </View>

        {pageMode === "preview" ? (
          <View style={styles.editorReaderWrap}>
            <LinearGradient
              colors={["#3D342C", "#2A241F", "#1E1A16"]}
              style={StyleSheet.absoluteFill}
            />
            <GrowthBookReader
              pages={bookPages}
              stickers={babyStickers}
              currentPageIndex={activePageIndex}
              onPageIndexChange={setActivePageIndex}
              resetKey={`${visible}-${pageMode}-${bookPages.map((page) => page.id).join("|")}`}
              style={styles.editorReader}
            />
          </View>
        ) : null}

        {pageMode === "edit" && activePage.pageType === "cover" ? (
          <CoverBookPageEditor
            babyName={babyName}
            page={activePage}
            mode={pageMode}
            edit={edit}
            entries={bookEntries}
            bottomPad={insets.bottom}
            navigation={navigation}
            onPatch={patch}
          />
        ) : null}

        {pageMode === "edit" && activePage.pageType === "diary" && activeEntry ? (
          <PageEditor
            key={activeEntry.id}
            babyId={babyId}
            babyName={babyName}
            entry={activeEntry}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            mode={pageMode}
            navigation={navigation}
            onPatch={patch}
          />
        ) : null}

        {pageMode === "edit" && activePage.pageType === "final_letter" ? (
          <FinalLetterBookPageEditor
            babyName={babyName}
            page={activePage}
            mode={pageMode}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            navigation={navigation}
            onPatch={patch}
          />
        ) : null}
      </View>
    </Modal>
  );
}

type BookPageNavigationProps = {
  pages: GrowthBookPageMeta[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  pageTurnProgress: Animated.Value;
  pageTurnDirection: -1 | 1;
};

function BookPageNavigation({
  pages,
  activeIndex,
  onSelect,
  onPrevious,
  onNext,
}: BookPageNavigationProps) {
  const paginationItems = buildGrowthBookPaginationItems(pages.length, activeIndex);
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= pages.length - 1;
  return (
    <View style={styles.bookNavigation}>
      <View style={styles.pageNavigator}>
        <Pressable
          disabled={atStart}
          onPress={onPrevious}
          style={styles.pageArrow}
          accessibilityRole="button"
          accessibilityLabel="이전 페이지"
        >
          <View style={styles.pageArrowPrev}>
            <BabyLogIcon kind="chevron" size={18} color={atStart ? colors.faint : colors.text} />
          </View>
        </Pressable>
        <Text style={styles.pageCounter}>{activeIndex + 1} / {pages.length}</Text>
        <Pressable
          disabled={atEnd}
          onPress={onNext}
          style={styles.pageArrow}
          accessibilityRole="button"
          accessibilityLabel="다음 페이지"
        >
          <BabyLogIcon kind="chevron" size={18} color={atEnd ? colors.faint : colors.text} />
        </Pressable>
      </View>
      <View style={styles.pageChipRow}>
        {paginationItems.map((item) => {
          if (item.type === "ellipsis") return <Text key={item.key} style={styles.pageEllipsis}>…</Text>;
          const page = pages[item.index];
          if (!page) return null;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.index)}
              style={[styles.pageChip, activeIndex === item.index && styles.pageChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`${page.title} 페이지`}
              accessibilityState={{ selected: activeIndex === item.index }}
            >
              <Text style={[styles.pageChipText, activeIndex === item.index && styles.pageChipTextActive]}>
                {page.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SwipeableCanvasStage({
  navigation,
  children,
  enabled = true,
}: {
  navigation: BookPageNavigationProps;
  children: ReactNode;
  enabled?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const travelDistance = Math.max(320, windowWidth);
  const translateX = navigation.pageTurnProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      navigation.pageTurnDirection * -travelDistance,
      0,
      navigation.pageTurnDirection * travelDistance,
    ],
  });
  const swipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        enabled && resolveGrowthBookSwipeDirection(gesture.dx, gesture.dy, 18) !== null,
      onPanResponderRelease: (_, gesture) => {
        const direction = resolveGrowthBookSwipeDirection(gesture.dx, gesture.dy);
        if (direction === "next") navigation.onNext();
        if (direction === "previous") navigation.onPrevious();
      },
      onPanResponderTerminationRequest: () => true,
    }),
    [enabled, navigation.onNext, navigation.onPrevious],
  );

  if (!enabled) {
    return (
      <View style={styles.canvasStage}>
        <View style={styles.pageSlideSurface}>{children}</View>
      </View>
    );
  }

  return (
    <View {...swipeResponder.panHandlers} style={styles.canvasStage}>
      <Animated.View style={[styles.pageSlideSurface, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

function CoverBookPageEditor({
  babyName,
  page,
  mode,
  edit,
  entries,
  bottomPad,
  navigation,
  onPatch,
}: {
  babyName: string;
  page: GrowthBookPage;
  mode: GrowthBookCanvasMode;
  edit: GrowthBookEdit;
  entries: DiaryEntry[];
  bottomPad: number;
  navigation: BookPageNavigationProps;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { babyStickers } = useBabyLog();
  useEffect(() => {
    if (mode !== "edit") setSheetOpen(false);
  }, [mode]);
  return (
    <View style={[styles.pageWorkspace, { paddingBottom: mode === "edit" ? bottomPad : Math.max(bottomPad, 10) }]}>
      <SwipeableCanvasStage navigation={navigation}>
        <GrowthBookPageCanvas page={page} pageType="cover" mode={mode} stickers={babyStickers} style={styles.editorCanvas} />
      </SwipeableCanvasStage>
      <BookPageNavigation {...navigation} />
      {mode === "edit" ? (
        <View style={styles.editorToolbarCompact}>
          <EditorTool label="표지 편집" icon="edit" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}
      {sheetOpen ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={[styles.editorSheet, { paddingBottom: bottomPad + 14 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>표지 편집</Text>
              <Pressable onPress={() => setSheetOpen(false)}><Text style={styles.sheetClose}>닫기</Text></Pressable>
            </View>
            <CoverEditor babyName={babyName} edit={edit} entries={entries} bottomPad={0} onPatch={onPatch} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FinalLetterBookPageEditor({
  babyName,
  page,
  mode,
  edit,
  me,
  myRole,
  bottomPad,
  navigation,
  onPatch,
}: {
  babyName: string;
  page: GrowthBookPage;
  mode: GrowthBookCanvasMode;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  navigation: BookPageNavigationProps;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { babyStickers } = useBabyLog();
  useEffect(() => {
    if (mode !== "edit") setSheetOpen(false);
  }, [mode]);
  return (
    <View style={[styles.pageWorkspace, { paddingBottom: mode === "edit" ? bottomPad : Math.max(bottomPad, 10) }]}>
      <SwipeableCanvasStage navigation={navigation}>
        <GrowthBookPageCanvas page={page} pageType="final_letter" mode={mode} stickers={babyStickers} style={styles.editorCanvas} />
      </SwipeableCanvasStage>
      <BookPageNavigation {...navigation} />
      {mode === "edit" ? (
        <View style={styles.editorToolbarCompact}>
          <EditorTool label="가족 편지" icon="chat" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}
      {sheetOpen ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={[styles.editorSheet, { paddingBottom: bottomPad + 14 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>마지막 편지</Text>
              <Pressable onPress={() => setSheetOpen(false)}><Text style={styles.sheetClose}>닫기</Text></Pressable>
            </View>
            <LetterEditor babyName={babyName} edit={edit} me={me} myRole={myRole} bottomPad={0} onPatch={onPatch} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SectionCard({
  title,
  body,
  onPress,
  primary,
}: {
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable style={[styles.card, primary && styles.cardPrimary]} onPress={onPress}>
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, primary && styles.cardTitlePrimary]}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <BabyLogIcon kind="chevron" size={16} color={primary ? colors.amberDark : colors.faint} />
    </Pressable>
  );
}

function CoverEditor({
  babyName,
  edit,
  entries,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  edit: GrowthBookEdit;
  entries: DiaryEntry[];
  bottomPad: number;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const pool = useMemo(() => collectGrowthBookPhotoPool(entries, edit), [entries, edit]);
  const title = edit.coverTitle || `${babyName}의 성장책`;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>표지 제목</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverTitle: text }))}
        placeholder={`${babyName}의 성장책`}
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>표지 부제</Text>
      <TextInput
        style={styles.input}
        value={edit.coverSubtitle ?? ""}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverSubtitle: text }))}
        placeholder="성장책"
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>표지 기간</Text>
      <TextInput
        style={styles.input}
        value={edit.coverDateRange ?? ""}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverDateRange: text }))}
        placeholder="예: 2026.07 ~ 2026.12"
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>표지 사진</Text>
      {edit.coverPhotoUri ? (
        <Image source={{ uri: edit.coverPhotoUri }} style={styles.coverPreview} contentFit="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverPlaceholderText}>사진을 선택해 주세요</Text>
        </View>
      )}

      <Pressable
        style={styles.primaryBtn}
        onPress={async () => {
          const uri = await pickImageUri();
          if (uri) onPatch((prev) => ({ ...prev, coverPhotoUri: uri }));
        }}
      >
        <Text style={styles.primaryBtnText}>새 사진 업로드</Text>
      </Pressable>

      {pool.length > 0 ? (
        <>
          <Text style={[styles.label, { marginTop: 18 }]}>성장책 사진에서 고르기</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolRow}>
            {pool.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => onPatch((prev) => ({ ...prev, coverPhotoUri: uri }))}
                style={[
                  styles.poolThumbWrap,
                  edit.coverPhotoUri === uri && styles.poolThumbSelected,
                ]}
              >
                <Image source={{ uri }} style={styles.poolThumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

function PageList({
  entries,
  edit,
  bottomPad,
  onOpen,
}: {
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  bottomPad: number;
  onOpen: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <View style={[styles.content, { paddingBottom: bottomPad + 28 }]}>
        <Text style={styles.hint}>성장책에 담긴 일기가 없어요. 일기에서 담기를 눌러 주세요.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}>
      {entries.map((entry, index) => {
        const pageEdit = resolvePageEdit(entry.id, entry, edit);
        const photos = resolvePagePhotos(entry, pageEdit);
        const milestone = diaryMilestoneLabel(entry);
        return (
          <Pressable key={entry.id} style={styles.card} onPress={() => onOpen(entry.id)}>
            <Text style={styles.index}>{index + 1}</Text>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbFallback}>📔</Text>
              </View>
            )}
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {milestone ?? entry.date}
              </Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                사진 {photos.length}장 · {photoLayoutLabel(pageEdit.photoLayout)} · 롤링{" "}
                {pageEdit.rollingComments.length}
              </Text>
            </View>
            <BabyLogIcon kind="chevron" size={16} color={colors.faint} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PageEditor({
  babyId,
  babyName,
  entry,
  edit,
  me,
  myRole,
  bottomPad,
  mode,
  navigation,
  onPatch,
}: {
  babyId: string;
  babyName: string;
  entry: DiaryEntry;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  mode: GrowthBookCanvasMode;
  navigation: BookPageNavigationProps;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const pageEdit = resolvePageEdit(entry.id, entry, edit);
  const photos = resolvePagePhotos(entry, pageEdit);
  const page = useMemo(
    () => buildGrowthBookPages({ babyName, entries: [entry], edit }).find((item) => item.diaryId === entry.id),
    [babyName, edit, entry],
  );
  const [sheet, setSheet] = useState<"photo" | "layout" | "comment" | "rolling" | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoSwapSourceIndex, setPhotoSwapSourceIndex] = useState<number | null>(null);
  const photoLongPressAtRef = useRef(0);
  const [commentDraft, setCommentDraft] = useState(
    pageEdit.pageComment !== undefined ? pageEdit.pageComment : resolvePageBody(entry, pageEdit),
  );
  const [rollingDraft, setRollingDraft] = useState("");
  const [rollingStickerDraftIds, setRollingStickerDraftIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPickerTarget, setStickerPickerTarget] = useState<"page" | "comment" | "rolling">("page");
  const [selectedPageStickerId, setSelectedPageStickerId] = useState<string | null>(null);
  const [commentStickerDrafts, setCommentStickerDrafts] = useState<GrowthBookCommentSticker[]>(
    pageEdit.commentStickers ?? [],
  );
  const { babyStickers, addBabySticker, deleteBabySticker, logAuthor } = useBabyLog();
  const canWrite = canWriteGrowthBookNote(myRole);

  useEffect(() => {
    if (mode !== "edit") {
      setPhotoSwapSourceIndex(null);
      setSheet(null);
      setStickerPickerOpen(false);
      setSelectedPageStickerId(null);
    }
  }, [mode]);

  useEffect(() => {
    setPhotoSwapSourceIndex(null);
  }, [entry.id]);

  const upsertPage = (next: GrowthBookPageEdit) => {
    onPatch((prev) => ({
      ...prev,
      pages: { ...prev.pages, [entry.id]: next },
    }));
  };

  const setPhotos = (nextPhotos: string[]) => {
    upsertPage({
      ...pageEdit,
      photos: nextPhotos.slice(0, 4),
      photosOverridden: true,
    });
  };

  const setPageStickers = (pageStickers: GrowthBookPageSticker[]) => {
    upsertPage({ ...pageEdit, pageStickers, stickerIds: undefined });
  };

  const updatePageSticker = (next: GrowthBookPageSticker) => {
    setPageStickers((pageEdit.pageStickers ?? []).map((item) => item.id === next.id ? next : item));
  };

  const moveStickerLayer = (id: string, direction: "forward" | "backward") => {
    const ordered = (pageEdit.pageStickers ?? []).slice().sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((item) => item.id === id);
    const swapIndex = direction === "forward" ? index + 1 : index - 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    setPageStickers(ordered.map((item, itemIndex) => ({ ...item, zIndex: itemIndex + 1 })));
  };

  const openStickerPicker = (target: "page" | "comment" | "rolling") => {
    setStickerPickerTarget(target);
    if (target !== "page") setSheet(null);
    setStickerPickerOpen(true);
  };

  const pickForSlot = async (index: number) => {
    const uri = await pickImageUri();
    if (!uri) return;
    const next = [...photos];
    const target = Math.min(index, next.length);
    if (target < next.length) next[target] = uri;
    else next.push(uri);
    setPhotos(next);
  };

  const handlePhotoPress = (index: number) => {
    if (Date.now() - photoLongPressAtRef.current < 700) {
      return;
    }
    if (photoSwapSourceIndex !== null && photoSwapSourceIndex !== index && photos[index]) {
      setPhotos(swapPhotoOrder(photos, photoSwapSourceIndex, index));
      setPhotoSwapSourceIndex(null);
      return;
    }
    if (photoSwapSourceIndex === index) {
      setPhotoSwapSourceIndex(null);
      return;
    }
    setPhotoSwapSourceIndex(null);
    setSelectedPhotoIndex(index);
    setSheet("photo");
  };

  const handlePhotoLongPress = (index: number) => {
    if (!photos[index]) return;
    photoLongPressAtRef.current = Date.now();
    setPhotoSwapSourceIndex(index);
  };

  const saveRollingComment = () => {
    const text = rollingDraft.trim();
    if (!text || !me) return;
    if (editingCommentId) {
      upsertPage({
        ...pageEdit,
        rollingComments: pageEdit.rollingComments.map((comment) =>
          comment.id === editingCommentId
            ? { ...comment, text, stickerIds: rollingStickerDraftIds, updatedAt: new Date().toISOString() }
            : comment,
        ),
      });
    } else {
      const now = new Date().toISOString();
      const nextComment: GrowthBookComment = {
        id: newId("gbc"),
        pageId: entry.id,
        authorId: me.id,
        authorName: me.name,
        authorRelationshipLabel: memberRelationshipLabel(me),
        text,
        stickerIds: rollingStickerDraftIds,
        createdAt: now,
        updatedAt: now,
      };
      upsertPage({ ...pageEdit, rollingComments: [...pageEdit.rollingComments, nextComment] });
    }
    setRollingDraft("");
    setRollingStickerDraftIds([]);
    setEditingCommentId(null);
  };

  if (!page) return null;

  return (
    <View style={[styles.pageWorkspace, { paddingBottom: mode === "edit" ? bottomPad : Math.max(bottomPad, 10) }]}>
      <SwipeableCanvasStage navigation={navigation} enabled={mode !== "edit" && photoSwapSourceIndex === null}>
        <GrowthBookPageCanvas
          page={page}
          mode={mode}
          stickers={babyStickers}
          selectedPageStickerId={selectedPageStickerId}
          photoSwapSourceIndex={photoSwapSourceIndex}
          style={styles.editorCanvas}
          onPhotoPress={handlePhotoPress}
          onPhotoLongPress={handlePhotoLongPress}
          onCommentPress={() => setSheet("comment")}
          onRollingPress={() => setSheet("rolling")}
          onPageStickerPress={setSelectedPageStickerId}
          onPageStickerChange={updatePageSticker}
          onPageStickerDelete={(pageStickerId) => {
            setPageStickers((pageEdit.pageStickers ?? []).filter((item) => item.id !== pageStickerId));
            setSelectedPageStickerId(null);
          }}
          onPageStickerDuplicate={(pageStickerId) => {
            const source = (pageEdit.pageStickers ?? []).find((item) => item.id === pageStickerId);
            if (!source) return;
            const copy: GrowthBookPageSticker = {
              ...source,
              id: newId("gbps"),
              xRatio: Math.min(0.82, source.xRatio + 0.04),
              yRatio: Math.min(0.86, source.yRatio + 0.04),
              zIndex: Math.max(0, ...(pageEdit.pageStickers ?? []).map((item) => item.zIndex)) + 1,
              createdBy: logAuthor.userId,
              createdAt: new Date().toISOString(),
            };
            setPageStickers([...(pageEdit.pageStickers ?? []), copy]);
            setSelectedPageStickerId(copy.id);
          }}
          onPageStickerBringForward={(id) => moveStickerLayer(id, "forward")}
          onPageStickerSendBackward={(id) => moveStickerLayer(id, "backward")}
        />
      </SwipeableCanvasStage>

      <BookPageNavigation {...navigation} />

      {mode === "edit" ? (
        <View style={styles.editorToolbar}>
          <EditorTool label="사진" icon="image" onPress={() => { setSelectedPhotoIndex(Math.min(photos.length, getPhotoLayoutCount(pageEdit.photoLayout) - 1)); setSheet("photo"); }} />
          <EditorTool label="레이아웃" icon="layout" onPress={() => setSheet("layout")} />
          <EditorTool label="코멘트" icon="edit" onPress={() => setSheet("comment")} />
          <EditorTool label="스티커" icon="baby" onPress={() => openStickerPicker("page")} />
          <EditorTool label="롤링페이퍼" icon="chat" onPress={() => setSheet("rolling")} />
        </View>
      ) : null}

      {sheet ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={[styles.editorSheet, { paddingBottom: bottomPad + 14 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {sheet === "photo" ? "사진 편집" : sheet === "layout" ? "사진 레이아웃" : sheet === "comment" ? "페이지 코멘트" : "가족 롤링페이퍼"}
              </Text>
              <Pressable onPress={() => setSheet(null)} hitSlop={10}><Text style={styles.sheetClose}>닫기</Text></Pressable>
            </View>

            {sheet === "photo" ? (
              <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetHint}>캔버스의 사진 칸을 탭해도 같은 메뉴가 열려요.</Text>
                <Text style={styles.sheetHint}>사진을 길게 누른 뒤 다른 사진 슬롯을 탭하면 두 사진의 위치가 바뀝니다.</Text>
                {Array.from({ length: Math.max(getPhotoLayoutCount(pageEdit.photoLayout), photos.length) }, (_, index) => {
                  const uri = photos[index];
                  return (
                    <View key={index} style={[styles.photoSheetRow, selectedPhotoIndex === index && styles.photoSheetRowSelected]}>
                      {uri ? <Image source={{ uri }} style={styles.photoSheetThumb} contentFit="cover" /> : <View style={styles.photoSheetEmpty}><Text>＋</Text></View>}
                      <Text style={styles.photoSheetLabel}>사진 {index + 1}</Text>
                      <Pressable onPress={() => void pickForSlot(index)}><Text style={styles.sheetAction}>{uri ? "교체" : "추가"}</Text></Pressable>
                      {uri ? (
                        <Pressable onPress={() => setPhotos(photos.filter((_, photoIndex) => photoIndex !== index))}>
                          <Text style={[styles.sheetAction, styles.sheetDanger]}>삭제</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            {sheet === "layout" ? (
              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetOptionGrid}>
                {PHOTO_LAYOUT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      upsertPage({ ...pageEdit, photoLayout: option.value, photoLayoutTuning: undefined });
                      setPhotoSwapSourceIndex(null);
                    }}
                    style={[styles.sheetOption, pageEdit.photoLayout === option.value && styles.sheetOptionSelected]}
                  >
                    <PhotoLayoutThumbnail
                      layout={option.value}
                      selected={pageEdit.photoLayout === option.value}
                      tuning={pageEdit.photoLayout === option.value ? pageEdit.photoLayoutTuning : undefined}
                    />
                    <Text style={[styles.sheetOptionText, pageEdit.photoLayout === option.value && styles.sheetOptionTextSelected]}>{option.label}</Text>
                  </Pressable>
                ))}
                {PRIMARY_RATIO_LAYOUTS.has(pageEdit.photoLayout) ? (
                  <RatioOptionRow
                    title={pageEdit.photoLayout.includes("top_large") ? "큰 사진 높이" : "큰 사진 너비"}
                    values={[0.55, 0.6, 0.65, 0.7]}
                    value={pageEdit.photoLayoutTuning?.primaryRatio}
                    onChange={(primaryRatio) => upsertPage({
                      ...pageEdit,
                      photoLayoutTuning: {
                        ...pageEdit.photoLayoutTuning,
                        primaryRatio: primaryRatio as 0.55 | 0.6 | 0.65 | 0.7 | undefined,
                      },
                    })}
                  />
                ) : null}
                {SECONDARY_RATIO_LAYOUTS.has(pageEdit.photoLayout) ? (
                  <RatioOptionRow
                    title="오른쪽 위 사진 높이"
                    values={[0.55, 0.6, 0.65]}
                    value={pageEdit.photoLayoutTuning?.secondaryTopRatio}
                    onChange={(secondaryTopRatio) => upsertPage({
                      ...pageEdit,
                      photoLayoutTuning: {
                        ...pageEdit.photoLayoutTuning,
                        secondaryTopRatio: secondaryTopRatio as 0.55 | 0.6 | 0.65 | undefined,
                      },
                    })}
                  />
                ) : null}
              </ScrollView>
            ) : null}

            {sheet === "comment" ? (
              <>
                <Text style={styles.sheetHint}>원본 일기와 별개인 성장책 편집본에만 저장됩니다.</Text>
                <TextInput
                  style={[styles.input, styles.sheetTextArea]}
                  multiline
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="성장책에 남길 코멘트"
                  placeholderTextColor={colors.faint}
                />
                <View style={styles.commentStickerHeader}>
                  <Text style={styles.commentStickerTitle}>코멘트 스티커</Text>
                  <Pressable onPress={() => openStickerPicker("comment")} style={styles.commentStickerAdd}>
                    <Text style={styles.commentStickerAddText}>＋ 스티커 추가</Text>
                  </Pressable>
                </View>
                {commentStickerDrafts.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commentStickerList}>
                    {commentStickerDrafts.slice().sort((a, b) => a.order - b.order).map((item) => {
                      const sticker = babyStickers.find((candidate) => candidate.id === item.stickerId);
                      if (!sticker) return null;
                      return (
                        <View key={item.id} style={styles.commentStickerChip}>
                          <BabyStickerFromModel sticker={sticker} size={44} />
                          <Pressable
                            style={styles.commentStickerRemove}
                            onPress={() => setCommentStickerDrafts((prev) => prev.filter((candidate) => candidate.id !== item.id))}
                          >
                            <Text style={styles.commentStickerRemoveText}>×</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : <Text style={styles.commentStickerEmpty}>코멘트 아래에 카카오톡 임티처럼 표시됩니다.</Text>}
                <Pressable style={styles.sheetPrimary} onPress={() => { upsertPage({ ...pageEdit, pageComment: commentDraft, commentStickers: commentStickerDrafts }); setSheet(null); }}>
                  <Text style={styles.sheetPrimaryText}>적용</Text>
                </Pressable>
              </>
            ) : null}

            {sheet === "rolling" ? (
              <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
                {pageEdit.rollingComments.map((comment) => (
                  <View key={comment.id} style={styles.rollingSheetCard}>
                    <Text style={styles.commentAuthor}>{formatGrowthAuthorLabel(comment.authorRelationshipLabel, comment.authorName)}</Text>
                    <Text style={styles.commentText}>“{comment.text}”</Text>
                    {(comment.stickerIds ?? []).length > 0 ? (
                      <View style={styles.rollingStickerPreviewRow}>
                        {(comment.stickerIds ?? []).map((stickerId, index) => {
                          const sticker = babyStickers.find((item) => item.id === stickerId);
                          return sticker ? <BabyStickerFromModel key={`${stickerId}-${index}`} sticker={sticker} size={30} /> : null;
                        })}
                      </View>
                    ) : null}
                    <View style={styles.commentActions}>
                      {canEditOwnGrowthBookNote(myRole, comment.authorId, me) ? (
                        <Pressable onPress={() => { setEditingCommentId(comment.id); setRollingDraft(comment.text); setRollingStickerDraftIds(comment.stickerIds ?? []); }}><Text style={styles.commentAction}>수정</Text></Pressable>
                      ) : null}
                      {canDeleteGrowthBookNote(myRole, comment.authorId, me) ? (
                        <Pressable onPress={() => upsertPage({ ...pageEdit, rollingComments: pageEdit.rollingComments.filter((item) => item.id !== comment.id) })}><Text style={[styles.commentAction, styles.commentDanger]}>삭제</Text></Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
                {canWrite && me ? (
                  <>
                    <Text style={styles.autoAuthor}>{formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name)}으로 남기기</Text>
                    <TextInput style={[styles.input, styles.sheetTextArea]} multiline value={rollingDraft} onChangeText={setRollingDraft} placeholder="가족에게 남길 한마디" placeholderTextColor={colors.faint} />
                    <View style={styles.commentStickerHeader}>
                      <Text style={styles.commentStickerTitle}>가족 코멘트 스티커</Text>
                      <Pressable onPress={() => openStickerPicker("rolling")} style={styles.commentStickerAdd}>
                        <Text style={styles.commentStickerAddText}>＋ 스티커 추가</Text>
                      </Pressable>
                    </View>
                    {rollingStickerDraftIds.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commentStickerList}>
                        {rollingStickerDraftIds.map((stickerId, index) => {
                          const sticker = babyStickers.find((item) => item.id === stickerId);
                          if (!sticker) return null;
                          return (
                            <View key={`${stickerId}-${index}`} style={styles.commentStickerChip}>
                              <BabyStickerFromModel sticker={sticker} size={36} />
                              <Pressable
                                style={styles.commentStickerRemove}
                                onPress={() => setRollingStickerDraftIds((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                              >
                                <Text style={styles.commentStickerRemoveText}>×</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </ScrollView>
                    ) : <Text style={styles.commentStickerEmpty}>관계 라벨과 함께 작은 임티로 표시됩니다.</Text>}
                    <Pressable style={styles.sheetPrimary} onPress={saveRollingComment}><Text style={styles.sheetPrimaryText}>{editingCommentId ? "수정 적용" : "롤링페이퍼 추가"}</Text></Pressable>
                  </>
                ) : <Text style={styles.sheetHint}>보기만 가능 계정은 작성할 수 없어요.</Text>}
              </ScrollView>
            ) : null}
          </View>
        </View>
      ) : null}

      <BabyStickerVaultModal
        embedded
        visible={stickerPickerOpen}
        babyId={babyId}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        pickMode
        onClose={() => {
          setStickerPickerOpen(false);
          if (stickerPickerTarget === "comment") setSheet("comment");
          if (stickerPickerTarget === "rolling") setSheet("rolling");
        }}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
        onPickSticker={(sticker) => {
          const now = new Date().toISOString();
          if (stickerPickerTarget === "comment") {
            setCommentStickerDrafts((prev) => [
              ...prev,
              {
                id: newId("gbcs"),
                pageId: entry.id,
                stickerId: sticker.id,
                order: prev.length,
                createdBy: logAuthor.userId,
                createdAt: now,
              },
            ].slice(0, 6));
            setSheet("comment");
          } else if (stickerPickerTarget === "rolling") {
            setRollingStickerDraftIds((prev) => [...prev, sticker.id].slice(0, 6));
            setSheet("rolling");
          } else {
            const current = pageEdit.pageStickers ?? [];
            const instance: GrowthBookPageSticker = {
              id: newId("gbps"),
              pageId: entry.id,
              stickerId: sticker.id,
              xRatio: Math.min(0.7, 0.32 + current.length * 0.04),
              yRatio: Math.min(0.75, 0.52 + current.length * 0.04),
              widthRatio: 0.2,
              zIndex: Math.max(0, ...current.map((item) => item.zIndex)) + 1,
              createdBy: logAuthor.userId,
              createdAt: now,
            };
            setPageStickers([...current, instance]);
            setSelectedPageStickerId(instance.id);
          }
          setStickerPickerOpen(false);
        }}
      />
    </View>
  );
}

function EditorTool({ label, icon, onPress }: { label: string; icon: MiscIconKey; onPress: () => void }) {
  return (
    <Pressable style={styles.editorTool} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <BabyLogIcon kind={icon} size={18} color={colors.amberText} />
      <Text style={styles.editorToolLabel}>{label}</Text>
    </Pressable>
  );
}

function PhotoLayoutThumbnail({
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

function RatioOptionRow({
  title,
  values,
  value,
  onChange,
}: {
  title: string;
  values: number[];
  value?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <View style={styles.ratioOptionSection}>
      <View style={styles.ratioOptionHeader}>
        <Text style={styles.ratioOptionTitle}>{title}</Text>
        <Text style={styles.ratioOptionValue}>{value ? `${Math.round(value * 100)}%` : "기본"}</Text>
      </View>
      <View style={styles.ratioOptionRow}>
        <Pressable
          onPress={() => onChange(undefined)}
          style={[styles.ratioChip, value === undefined && styles.ratioChipSelected]}
        >
          <Text style={[styles.ratioChipText, value === undefined && styles.ratioChipTextSelected]}>기본</Text>
        </Pressable>
        {values.map((ratio) => (
          <Pressable
            key={ratio}
            onPress={() => onChange(ratio)}
            style={[styles.ratioChip, value === ratio && styles.ratioChipSelected]}
          >
            <Text style={[styles.ratioChipText, value === ratio && styles.ratioChipTextSelected]}>
              {Math.round(ratio * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratioOptionHint}>프리셋 안에서만 조절되며 사진 박스는 자유 이동하지 않아요.</Text>
    </View>
  );
}

function LetterEditor({
  babyName,
  edit,
  me,
  myRole,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const myLetter = edit.letters.find((letter) => letter.authorId === me?.id);
  const [draft, setDraft] = useState(myLetter?.text ?? "");
  const canWrite = canWriteGrowthBookNote(myRole);

  useEffect(() => {
    setDraft(myLetter?.text ?? "");
  }, [myLetter?.text]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.hint}>
        성장책 마지막 페이지에 실리는 편지예요. 작성자 이름과 관계는 자동으로 표시됩니다.
      </Text>

      {edit.letters.map((letter) => (
        <CommentRow
          key={letter.id}
          authorLabel={`${formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName)}가 ${babyName}에게`}
          text={letter.text}
          canEdit={canEditOwnGrowthBookNote(myRole, letter.authorId, me)}
          canDelete={canDeleteGrowthBookNote(myRole, letter.authorId, me)}
          onEdit={() => {
            if (letter.authorId === me?.id) setDraft(letter.text);
          }}
          onDelete={() =>
            onPatch((prev) => ({
              ...prev,
              letters: prev.letters.filter((item) => item.id !== letter.id),
            }))
          }
        />
      ))}

      {canWrite && me ? (
        <>
          <Text style={styles.autoAuthor}>
            {formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name)}가 {babyName}에게
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder="사랑하는 마음을 편지로 남겨 보세요"
            placeholderTextColor={colors.faint}
          />
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              const text = draft.trim();
              if (!text) return;
              const now = new Date().toISOString();
              onPatch((prev) => {
                const existing = prev.letters.find((letter) => letter.authorId === me.id);
                if (existing) {
                  return {
                    ...prev,
                    letters: prev.letters.map((letter) =>
                      letter.id === existing.id ? { ...letter, text, updatedAt: now } : letter,
                    ),
                  };
                }
                const next: GrowthBookLetter = {
                  id: newId("gbl"),
                  growthBookId: prev.id,
                  authorId: me.id,
                  authorName: me.name,
                  authorRelationshipLabel: memberRelationshipLabel(me),
                  text,
                  createdAt: now,
                  updatedAt: now,
                };
                return { ...prev, letters: [...prev.letters, next] };
              });
              Alert.alert("저장됨", "마지막 편지가 저장되었어요.");
            }}
          >
            <Text style={styles.primaryBtnText}>{myLetter ? "내 편지 수정" : "편지 작성"}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>보기만 가능 계정은 편지를 작성할 수 없어요.</Text>
      )}
    </ScrollView>
  );
}

function CommentRow({
  authorLabel,
  text,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  authorLabel: string;
  text: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.commentCard}>
      <Text style={styles.commentAuthor}>{authorLabel}</Text>
      <Text style={styles.commentText}>“{text}”</Text>
      <View style={styles.commentActions}>
        {canEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.commentAction}>수정</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={[styles.commentAction, styles.commentDanger]}>삭제</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted },
  headerBtnHit: { minHeight: 44, minWidth: 56, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  headerModeBtn: { minHeight: 44, minWidth: 64, alignItems: "flex-end", justifyContent: "center" },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  hintMuted: { fontSize: 12, color: colors.faint, marginTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardPrimary: { backgroundColor: colors.amber, borderColor: colors.amber },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  cardTitlePrimary: { color: colors.amberDark },
  cardBody: { fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { minHeight: 110, textAlignVertical: "top" },
  coverPreview: { width: "100%", height: 220, borderRadius: 16, marginBottom: 12 },
  coverPlaceholder: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: colors.cardHi,
  },
  coverPlaceholderText: { color: colors.faint, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  ghostBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  ghostBtnText: { color: colors.amberText, fontWeight: "700" },
  poolRow: { gap: 8, paddingRight: 8 },
  poolThumbWrap: { borderRadius: 12, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
  poolThumbSelected: { borderColor: colors.amber },
  poolThumb: { width: 72, height: 72, borderRadius: 10 },
  index: { width: 18, fontSize: 12, fontWeight: "800", color: colors.faint },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallback: { fontSize: 18 },
  photoEditWrap: { width: 84 },
  photoActions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  miniChip: {
    backgroundColor: colors.cardHi,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  miniChipDanger: { backgroundColor: colors.dangerSoft },
  miniChipText: { fontSize: 10, fontWeight: "700", color: colors.text },
  addPhotoTile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  addPhotoText: { color: colors.amberText, fontWeight: "800", fontSize: 12 },
  layoutRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  layoutChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  layoutChipSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  layoutChipDisabled: { opacity: 0.35 },
  layoutChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  layoutChipTextSelected: { color: colors.amberText },
  pageWorkspace: { flex: 1, backgroundColor: "#E9E2DA" },
  editorReaderWrap: { flex: 1, paddingTop: 12, paddingBottom: 8 },
  editorReader: { flex: 1 },
  canvasStage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingTop: 4, overflow: "hidden" },
  pageSlideSurface: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  editorCanvas: {
    width: "96%",
    maxWidth: 430,
    shadowColor: "#4A3428",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bookNavigation: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "rgba(255,249,242,0.96)", paddingBottom: 5 },
  pageNavigator: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pageArrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pageArrowPrev: { transform: [{ rotate: "180deg" }] },
  pageCounter: { minWidth: 56, textAlign: "center", fontSize: 12, fontWeight: "800", color: colors.muted },
  pageChipRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pageChip: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  pageChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  pageChipText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  pageChipTextActive: { color: colors.amberText },
  pageEllipsis: { width: 16, textAlign: "center", color: colors.faint, fontSize: 14, fontWeight: "800" },
  editorToolbar: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  editorToolbarCompact: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: "24%", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  editorTool: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 7 },
  editorToolLabel: { fontSize: 10.5, color: colors.text, fontWeight: "700" },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: "flex-end", backgroundColor: "rgba(42,36,31,0.42)" },
  editorSheet: { maxHeight: "72%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", backgroundColor: colors.border, marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  sheetClose: { fontSize: 13, fontWeight: "700", color: colors.muted },
  sheetHint: { fontSize: 12, lineHeight: 18, color: colors.muted, marginBottom: 10 },
  sheetScroll: { maxHeight: 390 },
  photoSheetRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 8, marginBottom: 8, backgroundColor: colors.card },
  photoSheetRowSelected: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  photoSheetThumb: { width: 50, height: 50, borderRadius: 9 },
  photoSheetEmpty: { width: 50, height: 50, borderRadius: 9, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  photoSheetLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  sheetAction: { fontSize: 12, color: colors.amberText, fontWeight: "800", paddingVertical: 8 },
  sheetDanger: { color: colors.dangerText },
  sheetOptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 8 },
  sheetOption: { width: "48%", minHeight: 118, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", gap: 8, padding: 10 },
  sheetOptionSelected: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  layoutThumbnail: { position: "relative", width: 72, height: 48 },
  layoutThumbnailSlot: { position: "absolute", borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: "#F3E8DA" },
  layoutThumbnailSlotSelected: { borderColor: colors.amber, backgroundColor: "rgba(232,145,138,0.28)" },
  sheetOptionText: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", color: colors.muted, textAlign: "center" },
  sheetOptionTextSelected: { color: colors.amberDark },
  ratioOptionSection: { width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, padding: 12, marginTop: 2 },
  ratioOptionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  ratioOptionTitle: { fontSize: 12.5, fontWeight: "800", color: colors.text },
  ratioOptionValue: { fontSize: 11, fontWeight: "800", color: colors.amberDark },
  ratioOptionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ratioChip: { minWidth: 46, height: 30, paddingHorizontal: 8, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  ratioChipSelected: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  ratioChipText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  ratioChipTextSelected: { color: colors.amberDark },
  ratioOptionHint: { marginTop: 7, fontSize: 10.5, lineHeight: 15, color: colors.faint },
  sheetTextArea: { minHeight: 112, textAlignVertical: "top" },
  commentStickerHeader: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentStickerTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
  commentStickerAdd: { borderWidth: 1, borderColor: colors.amber, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.amberSoft },
  commentStickerAddText: { fontSize: 11, fontWeight: "800", color: colors.amberDark },
  commentStickerList: { paddingTop: 8, paddingRight: 8, gap: 8 },
  commentStickerChip: { width: 74, minHeight: 70, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card },
  commentStickerRemove: { position: "absolute", top: 3, right: 3, zIndex: 5, elevation: 5, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerText },
  commentStickerRemoveText: { color: "#FFF", fontSize: 14, fontWeight: "900", lineHeight: 17 },
  commentStickerEmpty: { marginTop: 8, fontSize: 11, color: colors.faint },
  sheetPrimary: { backgroundColor: colors.amber, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 8 },
  sheetPrimaryText: { color: colors.amberDark, fontWeight: "800", fontSize: 14 },
  rollingSheetCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 8 },
  rollingStickerPreviewRow: { marginTop: 6, minHeight: 34, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  pdfCanvasWrap: { alignItems: "center", marginBottom: 12 },
  pdfCanvasPreview: { width: "76%", maxWidth: 320, shadowColor: "#4A3428", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  autoAuthor: { fontSize: 13, fontWeight: "800", color: colors.amberText, marginBottom: 8, marginTop: 8 },
  commentCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  commentAuthor: { fontSize: 12.5, fontWeight: "800", color: colors.amberText },
  commentText: { fontSize: 13.5, color: colors.text, marginTop: 6, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 14, marginTop: 10 },
  commentAction: { fontSize: 12, fontWeight: "700", color: colors.muted },
  commentDanger: { color: colors.dangerText },
});
