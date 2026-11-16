import React, {useMemo, useEffect} from 'react';
import type {LineHighlight} from './verseHighlightLayers';
import {
  DashPathEffect,
  Line,
  Paragraph,
  Group,
  RoundedRect,
  vec,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTextStyle,
  type SkTypefaceFontProvider,
  type SkParagraph,
  type SkColor,
} from '@shopify/react-native-skia';
// @ai-start
import {
  quranTextService,
  SPACEWIDTH,
  SpaceType,
} from '@/services/mushaf/QuranTextService';
// @ai-end
import type {JustResultByLine} from '@/services/mushaf/JustificationService';
// @ai-start
import {
  clampBandToSlot,
  clampRectToBand,
  fitWordSize,
  isNaturalWidthLine,
  justifiedLineStrut,
  justifiedSpaceFontSize,
  mergeTouchingRects,
  naturalJustification,
  rectsBand,
  shortestRectBand,
  spaceFitExtra,
  type LineBand,
} from './justifiedSpace';
import {
  getLineFit,
  lineFitKey,
  setLineFit,
} from '@/services/mushaf/lineFitCache';
// @ai-end
import {tajweedColors} from '@/constants/tajweedColors';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {disposeAfterPendingDraws} from '@/utils/skiaDeferredDispose';

const lineParStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// The caret of an added mark, as shares of the font size.
const CARET_HALF_WIDTH = 0.1;
const CARET_HEIGHT = 0.28;

interface SkiaLineProps {
  pageNumber: number;
  lineIndex: number;
  fontMgr: SkTypefaceFontProvider;
  justResult: JustResultByLine;
  pageWidth: number;
  fontSize: number;
  margin: number;
  yPos: number;
  lineHeight?: number;
  textColor: string;
  charToRule?: Map<number, string>;
  charToColor?: Map<number, string>;
  fontFamily?: string;
  arabicTextWeight?: MushafArabicTextWeight;
  // @ai-start
  /** Identity of the text this line shows (getPageTextIdentity); a change
   *  rebuilds the paragraph from the current line text. */
  textIdentity?: string | null;
  // @ai-end
  onParagraphReady?: (
    lineIndex: number,
    paragraph: SkParagraph,
    xPos: number,
  ) => void;
  onParagraphDisposed?: (lineIndex: number) => void;
  backgroundHighlights?: readonly LineHighlight[];
}

const SkiaLine: React.FC<SkiaLineProps> = ({
  pageNumber,
  lineIndex,
  fontMgr,
  justResult,
  pageWidth,
  fontSize,
  margin,
  yPos,
  lineHeight,
  textColor,
  charToRule,
  charToColor,
  fontFamily = 'DigitalKhatt',
  arabicTextWeight = 'normal',
  textIdentity, // @ai
  onParagraphReady,
  onParagraphDisposed,
  backgroundHighlights,
}) => {
  const paragraphs = useMemo(() => {
    const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
    const lineText = quranTextService.getLineText(pageNumber, lineIndex);
    const lineTextInfo = quranTextService.analyzeText(pageNumber, lineIndex);

    if (!lineText) return null;

    // @ai-start
    // A line the layout centres without a width of its own (the last line of
    // a surah, e.g. 586:1) is drawn at its natural width, never stretched.
    const lineJust = isNaturalWidthLine(lineInfo)
      ? naturalJustification(justResult)
      : justResult;
    // @ai-end

    const color = Skia.Color(textColor);
    const effectiveFontSize = lineJust.fontSizeRatio * fontSize; // @ai

    const textStyle: SkTextStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize: effectiveFontSize,
    };

    // Basmallah lines (not on pages 1-2) get the basm feature
    if (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2) {
      textStyle.fontFeatures = [{name: 'basm', value: 1}];
    }

    // @ai-start
    // `wordSize`: the words' font size; `spaceExtra`: px added to every space
    // (both set by the fit pass below). The strut pins the line box and
    // baseline to the words' size: justified spaces are set at larger sizes
    // (justifiedSpace.ts).
    const buildParagraph = (
      withStroke: boolean,
      wordSize: number,
      spaceExtra: number,
    ) => {
      const lineStyle: SkTextStyle = {...textStyle, fontSize: wordSize};
      const lineStroke = getArabicTextWeightStrokeWidth(
        arabicTextWeight,
        wordSize,
      );
      const paragraphBuilder = Skia.ParagraphBuilder.Make(
        {...lineParStyle, strutStyle: justifiedLineStrut(fontFamily, wordSize)},
        fontMgr,
      );
      // @ai-end

      const pushStyle = (style: SkTextStyle, styleColor: SkColor) => {
        const strokePaint = withStroke
          ? createTextStrokePaint(styleColor, lineStroke) // @ai
          : undefined;
        if (strokePaint) {
          paragraphBuilder.pushStyle(style, strokePaint);
        } else {
          paragraphBuilder.pushStyle(style);
        }
      };

      pushStyle(lineStyle, color); // @ai

      for (
        let wordIndex = 0;
        wordIndex < lineTextInfo.wordInfos.length;
        wordIndex++
      ) {
        const wordInfo = lineTextInfo.wordInfos[wordIndex];

        // Render each character with optional font features and tajweed colors
        for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
          const char = lineText.charAt(i);
          const justInfo = lineJust.fontFeatures.get(i);
          const tajweedRule = charToRule?.get(i);
          const customColor = charToColor?.get(i);

          const needsCustomStyle = justInfo || tajweedRule || customColor;

          if (needsCustomStyle) {
            const charStyle: SkTextStyle = {
              ...lineStyle, // @ai
            };
            let charColor = color;
            if (justInfo) {
              charStyle.fontFeatures = justInfo;
            }
            if (customColor) {
              charColor = Skia.Color(customColor);
              charStyle.color = charColor;
            } else if (tajweedRule && tajweedColors[tajweedRule]) {
              charColor = Skia.Color(tajweedColors[tajweedRule]);
              charStyle.color = charColor;
            }
            pushStyle(charStyle, charColor);
            paragraphBuilder.addText(char);
            paragraphBuilder.pop();
          } else {
            paragraphBuilder.addText(char);
          }
        }

        // @ai-start
        // Add the space between words at its justified width. SkParagraph
        // ignores letterSpacing on Arabic, so the width comes from the space's
        // font size (justifiedSpace.ts).
        const spaceType = lineTextInfo.spaces.get(wordInfo.endIndex + 1);
        if (spaceType !== undefined) {
          const spacing =
            spaceType === SpaceType.Aya
              ? lineJust.ayaSpacing
              : lineJust.simpleSpacing;
          const newtextStyle: SkTextStyle = {
            ...lineStyle,
            fontSize: justifiedSpaceFontSize(wordSize, spacing, spaceExtra),
          };
          // @ai-end

          pushStyle(newtextStyle, color);
          paragraphBuilder.addText(' ');
          paragraphBuilder.pop();
        }
      }

      const maxWidth = pageWidth * 2;
      paragraphBuilder.pop();
      const p = paragraphBuilder.build();
      p.layout(maxWidth);
      return p;
    };

    // @ai-start
    // Fit pass. The drawn width of a justified line can miss the width
    // JustService fitted: a widened line's spaces are shaped apart from their
    // words (justifiedSpace.ts), and a shrunk line's size can round. Measure
    // it, then spread a widened line's residue over its spaces, or scale a
    // line at the words' spacing (its spaces stay in the words' runs), so the
    // line ends exactly on the margin. Centered lines are left as built. The
    // fit is kept per line, for the session and across launches
    // (services/mushaf/lineFitCache.ts), so a later build of the same line
    // (colours, highlights, a revisit, the next launch) builds once. Change
    // LINE_FIT_FORMAT there when this pass changes a drawn width.
    const isJustifiedLine = !(
      lineInfo.lineType === 1 ||
      (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2) ||
      isNaturalWidthLine(lineInfo)
    );
    const isWidened =
      lineJust.simpleSpacing > SPACEWIDTH || lineJust.ayaSpacing > SPACEWIDTH;
    const targetWidth = pageWidth - 2 * margin;
    const fitKey = isJustifiedLine
      ? lineFitKey(lineText, fontFamily, fontSize, targetWidth, lineJust)
      : null;
    const knownFit = fitKey ? getLineFit(fitKey) : undefined;
    let wordSize = knownFit?.wordSize ?? effectiveFontSize;
    let spaceExtra = knownFit?.spaceExtra ?? 0;
    let paragraph = buildParagraph(false, wordSize, spaceExtra);
    if (fitKey && !knownFit) {
      const drawnWidth = paragraph.getLongestLine();
      if (isWidened) {
        spaceExtra = spaceFitExtra(
          targetWidth,
          drawnWidth,
          lineTextInfo.spaces.size,
        );
      } else {
        wordSize = fitWordSize(effectiveFontSize, targetWidth, drawnWidth);
      }
      const changedLine = spaceExtra !== 0 || wordSize !== effectiveFontSize;
      if (changedLine) {
        paragraph.dispose();
        paragraph = buildParagraph(false, wordSize, spaceExtra);
      }
      setLineFit(fitKey, {wordSize, spaceExtra}, changedLine);
    }

    const strokeWidth = getArabicTextWeightStrokeWidth(
      arabicTextWeight,
      wordSize,
    );
    return {
      paragraph,
      strokeParagraph:
        strokeWidth > 0 ? buildParagraph(true, wordSize, spaceExtra) : null,
    };
    // @ai-end
    // textIdentity: the line text (read from quranTextService) follows the
    // words cache; char indices of charToRule/charToColor index into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageNumber,
    lineIndex,
    fontMgr,
    justResult,
    pageWidth,
    fontSize,
    margin,
    textColor,
    charToRule,
    charToColor,
    fontFamily,
    arabicTextWeight,
    textIdentity, // @ai
  ]);

  const paragraph = paragraphs?.paragraph;
  const strokeParagraph = paragraphs?.strokeParagraph;

  // SkParagraph holds native memory that JS GC does not reclaim. Dispose the
  // previous paragraphs when the memo recomputes (and on unmount). The cleanup
  // runs with the prior `paragraphs` value, so the set being rendered this
  // frame is never disposed early.
  //
  // The dispose is DEFERRED behind a worklets UI-queue barrier. A direct
  // dispose frees a paragraph that a queued Skia draw still holds, and the UI
  // thread then aborts the app. See `utils/skiaDeferredDispose.ts`.
  //
  // Evict the parent's hit-test map entry in the SAME synchronous cleanup,
  // BEFORE the dispose is scheduled, so the map never points at freed native
  // memory. The recompute-to-new-paragraph path re-registers via
  // `onParagraphReady` immediately after this cleanup; the recompute-to-null
  // and unmount paths leave the entry evicted (the cases the parent's
  // pageNumber-only clear misses).
  useEffect(() => {
    return () => {
      if (paragraphs) {
        onParagraphDisposed?.(lineIndex);
      }
      // @ai-start
      disposeAfterPendingDraws([
        paragraphs?.paragraph,
        paragraphs?.strokeParagraph,
      ]);
      // @ai-end
    };
  }, [paragraphs, lineIndex, onParagraphDisposed]);

  const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
  const maxWidth = pageWidth * 2;
  const currLineWidth = paragraph?.getLongestLine() ?? 0;

  let xPos: number;
  if (
    lineInfo.lineType === 1 ||
    (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2) ||
    isNaturalWidthLine(lineInfo) // @ai
  ) {
    // Centered lines: surah names, basmallah (except pages 1-2) and lines
    // the layout centres at their natural width
    const centeredMargin = (pageWidth - currLineWidth) / 2;
    xPos = -(maxWidth - pageWidth + centeredMargin);
  } else {
    // Justified lines
    xPos = -(maxWidth - pageWidth + margin);
  }

  useEffect(() => {
    if (paragraph && onParagraphReady) {
      onParagraphReady(lineIndex, paragraph, xPos);
    }
  }, [paragraph, lineIndex, xPos, onParagraphReady]);

  // Vertically center basmallah within its slot (top-aligned for all other lines)
  let adjustedYPos = yPos;
  if (
    lineHeight &&
    lineInfo.lineType === 2 &&
    pageNumber !== 1 &&
    pageNumber !== 2
  ) {
    const pHeight = paragraph?.getHeight() ?? 0;
    adjustedYPos = yPos + Math.max(0, (lineHeight - pHeight) / 2);
  }

  // Compute background highlight rects (for mushaf playback ayah tracking)
  const bgRects = useMemo(() => {
    if (
      !paragraph ||
      !backgroundHighlights ||
      backgroundHighlights.length === 0
    ) {
      return null;
    }

    const rects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      style: LineHighlight['style'];
    }> = [];

    // @ai-start
    // The words' band, from the line's first word. Its whole range is asked
    // for: SkParagraph returns no rect for part of a grapheme cluster, so a
    // first letter carrying a mark gives nothing on its own. A justified
    // space's rect spans its larger size's ascent and descent, so every rect
    // is clamped to this band; without one, a highlight is clamped to its own
    // shortest rect (a word's, never taller than a space's).
    const firstWord = quranTextService.analyzeText(pageNumber, lineIndex)
      .wordInfos[0];
    let band: LineBand | null = null;
    if (firstWord) {
      try {
        band = rectsBand(
          paragraph.getRectsForRange(
            firstWord.startIndex,
            firstWord.endIndex + 1,
          ),
        );
      } catch {
        band = null;
      }
    }
    // @ai-end

    for (const hl of backgroundHighlights) {
      try {
        const skRects = paragraph.getRectsForRange(hl.start, hl.end + 1);
        // @ai-start
        // Clamp each rect to the band, then merge the ones that touch so the
        // highlight draws as one band per run of words, not one rounded rect
        // per word and space.
        // Within the line's own slot: rects are relative to adjustedYPos.
        const hlBand = clampBandToSlot(
          band ?? shortestRectBand(skRects),
          yPos - adjustedYPos,
          lineHeight,
        );
        const clamped = skRects.map(rect =>
          clampRectToBand(
            {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
            hlBand,
          ),
        );
        if (hl.style === 'caret') {
          if (clamped.length === 0) continue;
          // The middle of the space before the word. A word that starts its line
          // has none: just past its start. The line reads right to left, so a
          // word starts at its right edge.
          const start = Math.max(...clamped.map(r => r.x + r.width));
          const [space] =
            hl.start > 0
              ? paragraph.getRectsForRange(hl.start - 1, hl.start)
              : [];
          rects.push({
            x: space
              ? space.x + space.width / 2
              : start + fontSize * CARET_HALF_WIDTH * 1.5,
            y: clamped[0].y,
            width: 0,
            height: clamped[0].height,
            color: hl.color,
            style: 'caret',
          });
          continue;
        }
        for (const rect of mergeTouchingRects(clamped)) {
          rects.push({...rect, color: hl.color, style: hl.style});
        }
        // @ai-end
      } catch {
        // Ignore rect computation failures
      }
    }

    return rects.length > 0 ? rects : null;
  }, [
    paragraph,
    backgroundHighlights,
    pageNumber,
    lineIndex,
    yPos,
    adjustedYPos,
    lineHeight,
    fontSize,
  ]); // @ai

  if (!paragraph) return null;

  if (bgRects) {
    const dotWidth = Math.max(1.5, fontSize * 0.07);
    return (
      <Group>
        {bgRects.map((rect, i) =>
          rect.style === 'underline' || rect.style === 'caret' ? null : (
            <RoundedRect
              key={i}
              x={xPos + rect.x}
              y={adjustedYPos + rect.y}
              width={rect.width}
              height={rect.height}
              r={4}
              color={rect.color}
            />
          ),
        )}
        {strokeParagraph && (
          <Paragraph
            paragraph={strokeParagraph}
            x={xPos}
            y={adjustedYPos}
            width={maxWidth}
          />
        )}
        <Paragraph
          paragraph={paragraph}
          x={xPos}
          y={adjustedYPos}
          width={maxWidth}
        />
        {bgRects.map((rect, i) => {
          if (rect.style === 'caret') {
            // A small caret on the bottom of the words' band, in the gap.
            const half = fontSize * CARET_HALF_WIDTH;
            const x = Math.min(xPos + rect.x, pageWidth - half);
            const bottom = adjustedYPos + rect.y + rect.height;
            const top = vec(x, bottom - fontSize * CARET_HEIGHT);
            return [-half, half].map(side => (
              <Line
                key={`c${i}${side}`}
                p1={top}
                p2={vec(x + side, bottom)}
                color={rect.color}
                style="stroke"
                strokeWidth={dotWidth}
                strokeCap="round"
              />
            ));
          }
          if (rect.style !== 'underline') return null;
          // A dotted line along the bottom of the words' band.
          const y = adjustedYPos + rect.y + rect.height - dotWidth / 2;
          return (
            <Line
              key={`u${i}`}
              p1={vec(xPos + rect.x + dotWidth, y)}
              p2={vec(xPos + rect.x + rect.width - dotWidth, y)}
              color={rect.color}
              style="stroke"
              strokeWidth={dotWidth}
              strokeCap="round">
              <DashPathEffect intervals={[0.01, dotWidth * 2.2]} />
            </Line>
          );
        })}
      </Group>
    );
  }

  return (
    <Group>
      {strokeParagraph && (
        <Paragraph
          paragraph={strokeParagraph}
          x={xPos}
          y={adjustedYPos}
          width={maxWidth}
        />
      )}
      <Paragraph
        paragraph={paragraph}
        x={xPos}
        y={adjustedYPos}
        width={maxWidth}
      />
    </Group>
  );
};

export default React.memo(SkiaLine);
