import React, {useMemo, useEffect} from 'react';
import {
  Paragraph,
  Group,
  RoundedRect,
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
  clampRectToBand,
  fitWordSize,
  getLineFit,
  isNaturalWidthLine,
  justifiedLineStrut,
  justifiedSpaceFontSize,
  lineFitKey,
  mergeTouchingRects,
  naturalJustification,
  setLineFit,
  rectsBand,
  shortestRectBand,
  spaceFitExtra,
  type LineBand,
} from './justifiedSpace';
// @ai-end
import {tajweedColors} from '@/constants/tajweedColors';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';

const lineParStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

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
  onParagraphReady?: (
    lineIndex: number,
    paragraph: SkParagraph,
    xPos: number,
  ) => void;
  onParagraphDisposed?: (lineIndex: number) => void;
  backgroundHighlights?: Array<{start: number; end: number; color: string}>;
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
    // fit is kept per line for the session (justifiedSpace.ts getLineFit), so
    // a later build of the same line (colours, highlights, a revisit) builds
    // once.
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
      if (spaceExtra !== 0 || wordSize !== effectiveFontSize) {
        paragraph.dispose();
        paragraph = buildParagraph(false, wordSize, spaceExtra);
      }
      setLineFit(fitKey, {wordSize, spaceExtra});
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
  ]);

  const paragraph = paragraphs?.paragraph;
  const strokeParagraph = paragraphs?.strokeParagraph;

  // SkParagraph holds native memory that JS GC does not reclaim. Dispose the
  // previous paragraphs when the memo recomputes (and on unmount). The cleanup
  // runs with the prior `paragraphs` value, so the set being rendered this
  // frame is never disposed early.
  //
  // Evict the parent's hit-test map entry in the SAME synchronous cleanup,
  // BEFORE disposing, so the map never points at freed native memory. The
  // recompute-to-new-paragraph path re-registers via `onParagraphReady`
  // immediately after this cleanup; the recompute-to-null and unmount paths
  // leave the entry evicted (the cases the parent's pageNumber-only clear
  // misses).
  useEffect(() => {
    return () => {
      if (paragraphs) {
        onParagraphDisposed?.(lineIndex);
      }
      paragraphs?.paragraph?.dispose();
      paragraphs?.strokeParagraph?.dispose();
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
        const hlBand = band ?? shortestRectBand(skRects);
        const clamped = skRects.map(rect =>
          clampRectToBand(
            {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
            hlBand,
          ),
        );
        for (const rect of mergeTouchingRects(clamped)) {
          rects.push({...rect, color: hl.color});
        }
        // @ai-end
      } catch {
        // Ignore rect computation failures
      }
    }

    return rects.length > 0 ? rects : null;
  }, [paragraph, backgroundHighlights, pageNumber, lineIndex]); // @ai

  if (!paragraph) return null;

  if (bgRects) {
    return (
      <Group>
        {bgRects.map((rect, i) => (
          <RoundedRect
            key={i}
            x={xPos + rect.x}
            y={adjustedYPos + rect.y}
            width={rect.width}
            height={rect.height}
            r={4}
            color={rect.color}
          />
        ))}
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
