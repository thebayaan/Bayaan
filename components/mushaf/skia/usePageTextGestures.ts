// @ai-generated
/**
 * The touch handling of a DigitalKhatt page, shared by SkiaPage (the paged
 * view) and MushafPageContent (a page of the vertical view):
 *  - the paragraph of each drawn line, for the hit test. SkiaLine registers
 *    it (handleParagraphReady) and takes it out before it disposes it
 *    (handleParagraphDisposed); a new page starts empty;
 *  - the hit test: the line and the character under a touch point;
 *  - the long-press (Android) or the pan after a long press (iOS) that
 *    selects verse units (useVerseUnitDragSelect), exclusive with the tap;
 *  - the tap: a word marked while reciting opens it, and any other tap is
 *    the page's own (onTap).
 * A page gives only where its text canvas sits in it and where its lines
 * are (PageTextLayout); it keeps its own drawing.
 */
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Platform} from 'react-native';
import type {SkParagraph} from '@shopify/react-native-skia';
import {Gesture} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import {SheetManager} from 'react-native-actions-sheet';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {markAtChar} from './recitationTap';
import {useVerseUnitDragSelect, type LineCharHit} from './verseUnitDragSelect';

/** Where a page's text canvas sits in the page, and where its lines are. */
export interface PageTextLayout {
  /** The canvas's left and top in the page view (the touch frame). */
  originX: number;
  originY: number;
  /** The canvas size: a touch outside it is not on the text. */
  width: number;
  height: number;
  /** The line at a canvas y, or -1 when there is none. */
  lineAt: (canvasY: number) => number;
  /** The top of a line in the canvas. */
  lineTop: (lineIndex: number) => number;
}

interface ParagraphInfo {
  paragraph: SkParagraph;
  xPos: number;
}

/** The line and the character under a touch point, or null off the text. */
function charAtPoint(
  eventX: number,
  eventY: number,
  layout: PageTextLayout,
  pageLines: readonly DKLine[],
  paragraphs: ReadonlyMap<number, ParagraphInfo>,
): LineCharHit | null {
  const canvasX = eventX - layout.originX;
  const canvasY = eventY - layout.originY;

  if (
    canvasX < 0 ||
    canvasX > layout.width ||
    canvasY < 0 ||
    canvasY > layout.height
  ) {
    return null;
  }

  const lineIndex = layout.lineAt(canvasY);
  if (lineIndex < 0 || lineIndex >= pageLines.length) return null;

  const line = pageLines[lineIndex];
  if (!line || line.line_type === 'surah_name') return null;

  const paragraphInfo = paragraphs.get(lineIndex);
  if (!paragraphInfo) return null;

  const paragraphX = canvasX - paragraphInfo.xPos;
  const paragraphY = canvasY - layout.lineTop(lineIndex);

  const charIndex = paragraphInfo.paragraph.getGlyphPositionAtCoordinate(
    paragraphX,
    paragraphY,
  );

  return {lineIndex, charIndex};
}

export interface PageTextGestures {
  /** The page's gesture: the long-press / drag-select, else the tap. */
  gesture: ReturnType<typeof Gesture.Exclusive>;
  /** SkiaLine's onParagraphReady. */
  handleParagraphReady: (
    lineIndex: number,
    paragraph: SkParagraph,
    xPos: number,
  ) => void;
  /** SkiaLine's onParagraphDisposed. */
  handleParagraphDisposed: (lineIndex: number) => void;
  /** How many lines have a paragraph in the hit test now. */
  paragraphCount: () => number;
}

export function usePageTextGestures(
  pageNumber: number,
  pageLines: readonly DKLine[],
  layout: PageTextLayout,
  onTap?: () => void,
): PageTextGestures {
  // ── The paragraphs of the drawn lines ───────────────────
  const paragraphMapRef = useRef<Map<number, ParagraphInfo>>(new Map());

  useEffect(() => {
    paragraphMapRef.current.clear();
  }, [pageNumber]);

  const handleParagraphReady = useCallback(
    (lineIndex: number, paragraph: SkParagraph, xPos: number) => {
      paragraphMapRef.current.set(lineIndex, {paragraph, xPos});
    },
    [],
  );

  // A line takes its paragraph out right before it disposes it, so a line
  // that stops drawing while the page stays mounted (it recomputes to no
  // paragraph, or unmounts) leaves no freed paragraph here. A line that
  // recomputes to a new paragraph registers it again in the same commit.
  const handleParagraphDisposed = useCallback((lineIndex: number) => {
    paragraphMapRef.current.delete(lineIndex);
  }, []);

  const paragraphCount = useCallback(() => paragraphMapRef.current.size, []);

  // ── Hit testing ─────────────────────────────────────────
  // The line and character under a touch point (this page's paragraph
  // metrics); which verse unit that is: useVerseUnitDragSelect.
  const charAt = useCallback(
    (eventX: number, eventY: number) =>
      charAtPoint(eventX, eventY, layout, pageLines, paragraphMapRef.current),
    [layout, pageLines],
  );

  // ── Gestures ────────────────────────────────────────────
  // Long-press / iOS drag-select in verse units of the shown text, and the
  // verse actions on release.
  const {
    onDragStart: handleDragStart,
    onDragUpdate: handleDragUpdate,
    onDragEnd: handleDragEnd,
  } = useVerseUnitDragSelect(pageNumber, charAt);

  const longPressDragGesture = useMemo(
    () =>
      Platform.OS === 'android'
        ? // Android: a true LongPress (the finger stays still)
          Gesture.LongPress()
            .minDuration(400)
            .maxDistance(20)
            .onStart(event => {
              'worklet';
              runOnJS(handleDragStart)(event.x, event.y);
            })
            .onEnd(() => {
              'worklet';
              runOnJS(handleDragEnd)();
            })
        : // iOS: a Pan after a long press, so a drag extends the selection
          Gesture.Pan()
            .activateAfterLongPress(400)
            .minDistance(0)
            .onStart(event => {
              'worklet';
              runOnJS(handleDragStart)(event.x, event.y);
            })
            .onUpdate(event => {
              'worklet';
              runOnJS(handleDragUpdate)(event.x, event.y);
            })
            .onEnd(() => {
              'worklet';
              runOnJS(handleDragEnd)();
            }),
    [handleDragStart, handleDragUpdate, handleDragEnd],
  );

  // A tap on a word marked while reciting opens it; any other tap is the
  // page's own.
  const handleTap = useCallback(
    (x: number, y: number) => {
      const {marks} = useRecitationTrackingStore.getState();
      if (marks.length > 0) {
        const hit = charAt(x, y);
        const line = hit ? pageLines[hit.lineIndex] : undefined;
        const mark =
          hit && line ? markAtChar(line, hit.charIndex, marks) : null;
        if (mark) {
          void SheetManager.show('recitation-mistake', {payload: {mark}});
          return;
        }
      }
      onTap?.();
    },
    [charAt, pageLines, onTap],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(event => {
        'worklet';
        runOnJS(handleTap)(event.x, event.y);
      }),
    [handleTap],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(longPressDragGesture, tapGesture),
    [longPressDragGesture, tapGesture],
  );

  return {
    gesture,
    handleParagraphReady,
    handleParagraphDisposed,
    paragraphCount,
  };
}
