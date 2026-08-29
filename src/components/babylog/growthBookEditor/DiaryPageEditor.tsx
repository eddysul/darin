import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { useBabyLog } from "../../../context/BabyLogContext";
import type { DiaryEntry } from "../../../types/babyLog";
import type { FamilyMember, FamilyRole } from "../../../types/family";
import { canWriteGrowthBookNote, memberRelationshipLabel } from "../../../types/family";
import type {
  GrowthBookComment,
  GrowthBookCommentSticker,
  GrowthBookEdit,
  GrowthBookPageEdit,
  GrowthBookPageSticker,
} from "../../../types/growthBook";
import { diaryDisplayDate } from "../../../utils/diaryModel";
import { buildGrowthBookPages, resolvePageBody, resolvePageEdit, resolvePagePhotos } from "../../../utils/growthBookPages";
import { getPhotoLayoutCount, swapPhotoOrder } from "../../../utils/growthBookPhotoLayouts";
import { BabyStickerVaultModal } from "../BabyStickerVaultModal";
import { DiaryPageStylePicker } from "../DiaryPageStylePicker";
import type { GrowthBookCanvasMode } from "../GrowthBookPageCanvas";
import { GrowthBookPageCanvas } from "../GrowthBookPageCanvas";
import { BookPageNavigation } from "./BookPageNavigation";
import { EditorSheet } from "./EditorSheet";
import { EditorTool } from "./EditorTool";
import { SwipeableCanvasStage } from "./SwipeableCanvasStage";
import { newId } from "./ids";
import { pickImageUri } from "./pickImage";
import { DiaryCommentSheet } from "./sheets/DiaryCommentSheet";
import { DiaryLayoutSheet } from "./sheets/DiaryLayoutSheet";
import { DiaryPhotoSheet } from "./sheets/DiaryPhotoSheet";
import { DiaryRollingSheet } from "./sheets/DiaryRollingSheet";
import { styles } from "./styles";
import type { BookPageNavigationProps, GrowthBookEditorPatch } from "./types";

export function PageEditor({
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
  onStickerPickerOpenChange,
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
  onPatch: GrowthBookEditorPatch;
  onStickerPickerOpenChange?: (open: boolean) => void;
}) {
  const { t, locale } = useLanguage();
  const pageEdit = resolvePageEdit(entry.id, entry, edit);
  const photos = resolvePagePhotos(entry, pageEdit);
  const page = useMemo(
    () => buildGrowthBookPages({ babyName, entries: [entry], edit, t, locale }).find((item) => item.diaryId === entry.id),
    [babyName, edit, entry, t, locale],
  );
  const [sheet, setSheet] = useState<"photo" | "layout" | "comment" | "rolling" | "template" | null>(null);
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
    onStickerPickerOpenChange?.(stickerPickerOpen);
    return () => onStickerPickerOpenChange?.(false);
  }, [onStickerPickerOpenChange, stickerPickerOpen]);

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
            Alert.alert(t("sticker.critical.030"), t("chrome.critical.033"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("sticker.critical.032"),
                style: "destructive",
                onPress: () => {
                  setPageStickers((pageEdit.pageStickers ?? []).filter((item) => item.id !== pageStickerId));
                  setSelectedPageStickerId(null);
                },
              },
            ]);
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
          <EditorTool label={t("growth.critical.159")} icon="bookmark" onPress={() => setSheet("template")} />
          <EditorTool label={t("growth.critical.021")} icon="image" onPress={() => { setSelectedPhotoIndex(Math.min(photos.length, getPhotoLayoutCount(pageEdit.photoLayout) - 1)); setSheet("photo"); }} />
          <EditorTool label={t("growth.critical.024")} icon="layout" onPress={() => setSheet("layout")} />
          <EditorTool label={t("growth.critical.025")} icon="edit" onPress={() => setSheet("comment")} />
          <EditorTool label={t("growth.critical.026")} icon="baby" onPress={() => openStickerPicker("page")} />
          <EditorTool label={t("growth.critical.027")} icon="chat" onPress={() => setSheet("rolling")} />
        </View>
      ) : null}

      {sheet ? (
        <EditorSheet
          bottomPad={bottomPad}
          title={
            sheet === "photo"
              ? t("growth.critical.028")
              : sheet === "layout"
                ? t("growth.critical.029")
                : sheet === "comment"
                  ? t("growth.critical.030")
                  : sheet === "template"
                    ? t("growth.critical.157")
                    : t("growth.critical.031")
          }
          onClose={() => setSheet(null)}
          closeHitSlop={10}
        >
          {sheet === "template" ? (
            <View>
              <Text style={styles.sheetHint}>{t("growth.critical.158")}</Text>
              <DiaryPageStylePicker
                value={pageEdit.pageTemplateId ?? "basic_line"}
                dateLabel={diaryDisplayDate(entry, locale)}
                weatherStamp={entry.weatherStamp}
                title={page?.title}
                body={pageEdit.pageComment ?? page?.body}
                onChange={(id) => {
                  upsertPage({ ...pageEdit, pageTemplateId: id });
                  onPatch((prev) => ({ ...prev, pageTemplateId: id }));
                }}
              />
            </View>
          ) : null}

          {sheet === "photo" ? (
            <DiaryPhotoSheet
              pageEdit={pageEdit}
              photos={photos}
              selectedPhotoIndex={selectedPhotoIndex}
              pickForSlot={pickForSlot}
              setPhotos={setPhotos}
            />
          ) : null}

          {sheet === "layout" ? (
            <DiaryLayoutSheet
              pageEdit={pageEdit}
              upsertPage={upsertPage}
              setPhotoSwapSourceIndex={setPhotoSwapSourceIndex}
            />
          ) : null}

          {sheet === "comment" ? (
            <DiaryCommentSheet
              pageEdit={pageEdit}
              commentDraft={commentDraft}
              setCommentDraft={setCommentDraft}
              commentStickerDrafts={commentStickerDrafts}
              setCommentStickerDrafts={setCommentStickerDrafts}
              babyStickers={babyStickers}
              openStickerPicker={openStickerPicker}
              upsertPage={upsertPage}
              setSheet={setSheet}
            />
          ) : null}

          {sheet === "rolling" ? (
            <DiaryRollingSheet
              pageEdit={pageEdit}
              me={me}
              myRole={myRole}
              canWrite={canWrite}
              rollingDraft={rollingDraft}
              setRollingDraft={setRollingDraft}
              rollingStickerDraftIds={rollingStickerDraftIds}
              setRollingStickerDraftIds={setRollingStickerDraftIds}
              editingCommentId={editingCommentId}
              setEditingCommentId={setEditingCommentId}
              babyStickers={babyStickers}
              openStickerPicker={openStickerPicker}
              upsertPage={upsertPage}
              saveRollingComment={saveRollingComment}
            />
          ) : null}
        </EditorSheet>
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
              rotation: 0,
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
