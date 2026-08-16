import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { BabySticker } from "../../types/babySticker";
import type { GrowthBookPage } from "../../utils/growthBookPages";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors } from "../../theme";
import { GrowthBookPageCanvas } from "./GrowthBookPageCanvas";

// Peel.js 데모와 동일: new TweenLite(p, 1.5, { t: 1, ease: Power2.easeOut })
const TURN_MS = 1500;
const TURN_EASING = Easing.out(Easing.quad);
const COMMIT_THRESHOLD = 0.25;
const COMMIT_VELOCITY = 0.45;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export const GROWTH_BOOK_PAPER_W = Math.min(SCREEN_W - 36, Math.min(SCREEN_H * 0.62, 560) * (210 / 297));
export const GROWTH_BOOK_PAPER_H = GROWTH_BOOK_PAPER_W * (297 / 210);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

type TurnDirection = "next" | "prev";

type TransitionState = {
  direction: TurnDirection;
  fromIndex: number;
  toIndex: number;
};

type Props = {
  pages: GrowthBookPage[];
  stickers?: BabySticker[];
  currentPageIndex: number;
  onPageIndexChange: (index: number) => void;
  /** Reset reader when book opens / pages identity changes. */
  resetKey?: string | number | boolean;
  style?: StyleProp<ViewStyle>;
  onPdfCreate?: () => void;
};

/**
 * Peel-style book reader (Peel.js 개념 이식):
 *  - peel-bottom: 드러나는 페이지 (아래 레이어, 고정)
 *  - peel-top:    넘어가는 페이지 — 접히는 선(fold)까지만 보이도록 클리핑
 *  - peel-back:   접혀 넘어간 종이의 뒷면 — 거울상(mirror) + 종이 음영
 * progress(0→1)에 따라 fold 위치가 오른쪽 → 왼쪽으로 이동하며 종이가 실제로 접혀 넘어간다.
 * 조작: 페이지 탭(재생/역재생 토글, Peel.handlePress) · 화살표 탭 · 드래그(peel position).
 */
export function GrowthBookReader({
  pages,
  stickers = [],
  currentPageIndex,
  onPageIndexChange,
  resetKey,
  style,
  onPdfCreate,
}: Props) {
  const [viewportW, setViewportW] = useState(GROWTH_BOOK_PAPER_W);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const reduceMotion = useReduceMotion();

  // progress: 0 = 종이가 전혀 안 접힘(fold가 오른쪽 끝), 1 = 완전히 넘어감(fold가 왼쪽 끝)
  const progress = useRef(new Animated.Value(0)).current;

  const transitionRef = useRef<TransitionState | null>(null);
  const animatingRef = useRef(false);
  const currentIndexRef = useRef(currentPageIndex);
  const pagesLenRef = useRef(pages.length);
  const viewportWRef = useRef(viewportW);
  const dragDirRef = useRef<TurnDirection | null>(null);
  // 현재 t 값 (Peel의 p.t) — 진행 중 탭 토글 판단에 사용
  const progressValRef = useRef(0);
  // 트윈 교체(재생↔역재생) 시 이전 트윈의 중단 콜백을 무시하기 위한 토큰
  const settleTokenRef = useRef(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  currentIndexRef.current = currentPageIndex;
  pagesLenRef.current = pages.length;
  viewportWRef.current = viewportW;

  useEffect(() => {
    settleTokenRef.current += 1;
    progress.stopAnimation();
    animatingRef.current = false;
    dragDirRef.current = null;
    transitionRef.current = null;
    setTransition(null);
    progress.setValue(0);
  }, [resetKey, progress, pages.length]);

  const onSectionLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - viewportW) > 1) setViewportW(w);
  };

  const clearTransition = useCallback(() => {
    transitionRef.current = null;
    setTransition(null);
    progress.setValue(0);
    animatingRef.current = false;
    dragDirRef.current = null;
  }, [progress]);

  const finishTurn = useCallback(
    (landedIndex: number) => {
      onPageIndexChange(landedIndex);
      clearTransition();
    },
    [clearTransition, onPageIndexChange],
  );

  const beginTransition = useCallback(
    (direction: TurnDirection): TransitionState | null => {
      const from = currentIndexRef.current;
      const to = direction === "next" ? from + 1 : from - 1;
      if (to < 0 || to > pagesLenRef.current - 1) return null;
      const t: TransitionState = { direction, fromIndex: from, toIndex: to };
      transitionRef.current = t;
      // prev는 progress 1(완전히 접힌 상태)에서 0으로 풀리며 이전 페이지가 되돌아온다.
      progress.setValue(direction === "next" ? 0 : 1);
      setTransition(t);
      return t;
    },
    [progress],
  );

  /**
   * 현재 t에서 목표 t까지 트윈(tween.play / tween.reverse에 해당).
   * 진행 중 재호출하면 이전 트윈을 대체하며 방향이 바뀐다.
   */
  const settle = useCallback(
    (toValue: 0 | 1, landedIndex: number, fromFraction: number) => {
      animatingRef.current = true;
      const token = ++settleTokenRef.current;
      const remaining = Math.abs(toValue - fromFraction);
      Animated.timing(progress, {
        toValue,
        duration: reduceMotion ? 0 : Math.max(150, TURN_MS * remaining),
        easing: TURN_EASING,
        useNativeDriver: false,
      }).start(({ finished }) => {
        // 새 트윈으로 대체된(재생↔역재생 토글) 경우 이전 콜백은 무시
        if (settleTokenRef.current !== token) return;
        if (finished) finishTurn(landedIndex);
        else clearTransition();
      });
    },
    [clearTransition, finishTurn, progress, reduceMotion],
  );

  const turnTo = useCallback(
    (direction: TurnDirection) => {
      if (animatingRef.current || transitionRef.current) return;
      const t = beginTransition(direction);
      if (!t) return;
      if (direction === "next") settle(1, t.toIndex, 0);
      else settle(0, t.toIndex, 1);
    },
    [beginTransition, settle],
  );

  /**
   * Peel.js의 p.handlePress와 동일한 토글:
   *   if (p.t > .5) tween.reverse(); else tween.play();
   * - 대기 상태에서 페이지를 탭 → 다음 장 peel 재생
   * - 진행 중 탭 → 절반 이상 넘어갔으면 역재생(원래 페이지로 복귀), 아니면 계속 재생
   */
  const handlePress = useCallback(() => {
    const t = transitionRef.current;
    if (t) {
      const v = progressValRef.current;
      // 방향과 무관하게 "얼마나 넘어갔는지"를 t로 환산 (next: v, prev: 1 - v)
      const peeled = t.direction === "next" ? v : 1 - v;
      if (t.direction === "next") {
        if (peeled > 0.5) settle(0, t.fromIndex, v); // reverse
        else settle(1, t.toIndex, v); // play
      } else {
        if (peeled > 0.5) settle(1, t.fromIndex, v); // reverse
        else settle(0, t.toIndex, v); // play
      }
      return;
    }
    if (animatingRef.current) return;
    const nt = beginTransition("next");
    if (nt) settle(1, nt.toIndex, 0);
  }, [beginTransition, settle]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) => {
          if (animatingRef.current || transitionRef.current) return false;
          if (Math.abs(g.dx) < 10 || Math.abs(g.dx) < Math.abs(g.dy) * 1.2) return false;
          const wantNext = g.dx < 0;
          const from = currentIndexRef.current;
          return wantNext ? from < pagesLenRef.current - 1 : from > 0;
        },
        onPanResponderMove: (_evt, g) => {
          const w = viewportWRef.current || GROWTH_BOOK_PAPER_W;
          if (!transitionRef.current) {
            const direction: TurnDirection = g.dx < 0 ? "next" : "prev";
            const t = beginTransition(direction);
            if (!t) return;
            dragDirRef.current = direction;
          }
          const dir = dragDirRef.current;
          if (!dir) return;
          if (dir === "next") progress.setValue(clamp01(-g.dx / w));
          else progress.setValue(clamp01(1 - g.dx / w));
        },
        onPanResponderRelease: (_evt, g) => {
          const dir = dragDirRef.current;
          const t = transitionRef.current;
          if (!dir || !t) return;
          const w = viewportWRef.current || GROWTH_BOOK_PAPER_W;
          if (dir === "next") {
            const fraction = clamp01(-g.dx / w);
            const commit = fraction > COMMIT_THRESHOLD || g.vx < -COMMIT_VELOCITY;
            if (commit) settle(1, t.toIndex, fraction);
            else settle(0, t.fromIndex, fraction);
          } else {
            const unrolled = clamp01(g.dx / w);
            const commit = unrolled > COMMIT_THRESHOLD || g.vx > COMMIT_VELOCITY;
            if (commit) settle(0, t.toIndex, 1 - unrolled);
            else settle(1, t.fromIndex, 1 - unrolled);
          }
        },
        onPanResponderTerminate: () => {
          // 드래그가 시스템에 의해 중단되면 현재 t 위치에서 원래 페이지로 복귀
          const t = transitionRef.current;
          if (!t) return;
          const v = progressValRef.current;
          if (t.direction === "next") settle(0, t.fromIndex, v);
          else settle(1, t.fromIndex, v);
        },
      }),
    [beginTransition, progress, settle],
  );

  const W = viewportW || GROWTH_BOOK_PAPER_W;

  // Peel 기하: fold(접히는 선) x = W * (1 - progress)
  // peel-top   : [0, fold] 만 보이도록 클리핑 → width = W(1-p)
  // peel-back  : fold에서 끝나는 뒷면 스트립. 폭 = min(W - fold, fold) → [0,½,1] = [0, W/2, 0]
  // 스트립 안의 거울상 페이지 offset → [0,½,1] = [0, 0, -W]
  const peel = useMemo(() => {
    return {
      topClipW: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [W, 0],
      }),
      stripLeft: progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [W, 0, 0],
      }),
      stripW: progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, W / 2, 0],
      }),
      mirrorLeft: progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, -W],
      }),
      foldShadowLeft: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [W, 0],
      }),
      foldShadowOpacity: progress.interpolate({
        inputRange: [0, 0.08, 0.92, 1],
        outputRange: [0, 0.5, 0.5, 0],
      }),
      // setPeelPath 곡선 근사 — 모서리가 위로 들렸다가(t≈0.35 부근) 내려앉는 아치
      backLiftY: progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, -16, 0],
      }),
      backTilt: progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: ["0deg", "-3.5deg", "0deg"],
      }),
    };
  }, [W, progress]);

  const canPrev = currentPageIndex > 0 && !transition;
  const canNext = currentPageIndex < pages.length - 1 && !transition;
  const steadyPage = pages[currentPageIndex];

  const active =
    transition && pages[transition.fromIndex] && pages[transition.toIndex] ? transition : null;
  // next: 위에서 넘어가는 종이 = 현재 페이지 / prev: 되돌아오며 펼쳐지는 종이 = 이전 페이지
  const topPage = active
    ? active.direction === "next"
      ? pages[active.fromIndex]
      : pages[active.toIndex]
    : null;
  const bottomPage = active
    ? active.direction === "next"
      ? pages[active.toIndex]
      : pages[active.fromIndex]
    : null;

  return (
    <View style={[styles.bookFrame, style]} accessibilityLabel="성장책">
      {/* PageSection — 고정 뷰포트(overflow hidden). 드래그로 peel position 제어 */}
      <View style={styles.pageSection} onLayout={onSectionLayout} {...panResponder.panHandlers}>
        {!active || !topPage || !bottomPage ? (
          <View style={[styles.pageLayer, { zIndex: 1 }]} pointerEvents="box-none">
            {steadyPage ? (
              <GrowthBookPageCanvas
                page={steadyPage}
                mode="preview"
                stickers={stickers}
                style={styles.pageCanvas}
              />
            ) : null}
          </View>
        ) : (
          <>
            {/* peel-bottom — 드러나는 페이지 */}
            <View style={[styles.pageLayer, { zIndex: 1 }]} pointerEvents="none">
              <GrowthBookPageCanvas
                page={bottomPage}
                mode="preview"
                stickers={stickers}
                style={styles.pageCanvas}
              />
            </View>

            {/* fold 그림자 — 들린 종이가 아래 페이지에 드리우는 그늘 */}
            <Animated.View
              style={[
                styles.foldShadow,
                {
                  zIndex: 2,
                  left: peel.foldShadowLeft,
                  opacity: peel.foldShadowOpacity,
                },
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.34)", "rgba(0,0,0,0)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* peel-top — 넘어가는 페이지, fold까지만 보이게 클리핑 */}
            <Animated.View
              style={[styles.topClip, { zIndex: 3, width: peel.topClipW }]}
              pointerEvents="none"
            >
              <View style={[styles.fullPage, { width: W }]}>
                <GrowthBookPageCanvas
                  page={topPage}
                  mode="preview"
                  stickers={stickers}
                  style={styles.pageCanvas}
                />
              </View>
              {/* fold 쪽으로 갈수록 어두워지는 곡면 음영 */}
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.22)"]}
                start={{ x: 0.72, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* peel-back — 접혀 넘어온 종이의 뒷면 (거울상 + 종이 질감 음영).
                peel path를 따라 중간 지점에서 들리며 기울었다가 안착 */}
            <Animated.View
              style={[
                styles.backStrip,
                {
                  zIndex: 4,
                  left: peel.stripLeft,
                  width: peel.stripW,
                  transform: [{ translateY: peel.backLiftY }, { rotate: peel.backTilt }],
                },
              ]}
              pointerEvents="none"
            >
              <Animated.View style={[styles.fullPage, { width: W, left: peel.mirrorLeft }]}>
                <View style={[styles.mirror, { width: W }]}>
                  <GrowthBookPageCanvas
                    page={topPage}
                    mode="preview"
                    stickers={stickers}
                    style={styles.pageCanvas}
                  />
                </View>
              </Animated.View>
              {/* 얇은 종이 뒷면 느낌 — 내용이 살짝 비쳐 보이는 정도로 덮기 */}
              <View style={styles.backPaper} />
              <LinearGradient
                colors={["rgba(0,0,0,0.16)", "rgba(255,255,255,0.28)", "rgba(0,0,0,0.30)"]}
                locations={[0, 0.82, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </>
        )}

        {/* handlePress — 페이지 탭으로 peel 재생/역재생 토글 (드래그 시작 시 부모 pan이 가로챔) */}
        <Pressable
          style={styles.pressOverlay}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="페이지 넘기기"
        />
      </View>

      {/* PageNavigation */}
      <View style={styles.navRow}>
        <Pressable
          style={[styles.arrowBtn, !canPrev && styles.arrowDisabled]}
          onPress={() => turnTo("prev")}
          disabled={!canPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 페이지"
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>

        <Text style={styles.pageNum}>
          {pages.length === 0 ? "0 / 0" : `${currentPageIndex + 1} / ${pages.length}`}
        </Text>

        <Pressable
          style={[styles.arrowBtn, !canNext && styles.arrowDisabled]}
          onPress={() => turnTo("next")}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="다음 페이지"
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {/* BottomToolbar */}
      {onPdfCreate ? (
        <Pressable style={styles.pdfBtn} onPress={onPdfCreate} disabled={Boolean(transition)}>
          <Text style={styles.pdfBtnText}>PDF 만들기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bookFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  pageSection: {
    width: GROWTH_BOOK_PAPER_W,
    height: GROWTH_BOOK_PAPER_H,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  pageLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  topClip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  foldShadow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 28,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  backStrip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    overflow: "hidden",
    // 들려 넘어가는 종이의 입체감
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: -4, height: 0 },
    elevation: 8,
  },
  fullPage: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  mirror: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scaleX: -1 }],
  },
  backPaper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,251,244,0.88)",
  },
  pageCanvas: {
    width: "100%",
    height: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 16,
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
  pageNum: {
    color: "rgba(255,248,240,0.8)",
    fontWeight: "700",
    fontSize: 14,
    minWidth: 64,
    textAlign: "center",
  },
  pdfBtn: {
    marginTop: 12,
    marginHorizontal: 24,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.amber,
  },
  pdfBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 },
});
