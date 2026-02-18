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
} from '@shopify/react-native-skia';
import {
  quranTextService,
  FONTSIZE,
  SPACEWIDTH,
  SpaceType,
} from '@/services/mushaf/QuranTextService';
import type {JustResultByLine} from '@/services/mushaf/JustificationService';
import {tajweedColors} from '@/constants/tajweedColors';

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
  fontFamily?: string;
  onParagraphReady?: (
    lineIndex: number,
    paragraph: SkParagraph,
    xPos: number,
  ) => void;
  highlights?: Array<{start: number; end: number; color: string}>;
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
  fontFamily = 'DigitalKhatt',
  onParagraphReady,
  highlights,
  backgroundHighlights,
}) => {
  const paragraph = useMemo(() => {
    const scale = (fontSize * justResult.fontSizeRatio) / FONTSIZE;
    const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
    const lineText = quranTextService.getLineText(pageNumber, lineIndex);
    const lineTextInfo = quranTextService.analyzeText(pageNumber, lineIndex);

    if (!lineText) return null;

    const color = Skia.Color(textColor);

    const textStyle: SkTextStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize: justResult.fontSizeRatio * fontSize,
    };

    // Basmallah lines (not on pages 1-2) get the basm feature
    if (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2) {
      textStyle.fontFeatures = [{name: 'basm', value: 1}];
    }

    const paragraphBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    paragraphBuilder.pushStyle(textStyle);

    for (
      let wordIndex = 0;
      wordIndex < lineTextInfo.wordInfos.length;
      wordIndex++
    ) {
      const wordInfo = lineTextInfo.wordInfos[wordIndex];

      // Render each character with optional font features and tajweed colors
      for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
        const char = lineText.charAt(i);
        const justInfo = justResult.fontFeatures.get(i);
        const matchedHighlight = highlights?.find(
          h => i >= h.start && i <= h.end,
        );
        const tajweedRule = charToRule?.get(i);

        const needsCustomStyle = justInfo || tajweedRule || matchedHighlight;

        if (needsCustomStyle) {
          const charStyle: SkTextStyle = {
            ...textStyle,
          };
          if (justInfo) {
            charStyle.fontFeatures = justInfo;
          }
          if (matchedHighlight) {
            charStyle.color = Skia.Color(matchedHighlight.color);
          } else if (tajweedRule && tajweedColors[tajweedRule]) {
            charStyle.color = Skia.Color(tajweedColors[tajweedRule]);
          }
          paragraphBuilder.pushStyle(charStyle);
          paragraphBuilder.addText(char);
          paragraphBuilder.pop();
        } else {
          paragraphBuilder.addText(char);
        }
      }

      // Add space between words with appropriate letter spacing
      const spaceType = lineTextInfo.spaces.get(wordInfo.endIndex + 1);
      if (spaceType !== undefined) {
        const newtextStyle: SkTextStyle = {
          ...textStyle,
        };

        if (spaceType === SpaceType.Aya) {
          newtextStyle.letterSpacing =
            (justResult.ayaSpacing - SPACEWIDTH) * scale;
        } else {
          newtextStyle.letterSpacing =
            (justResult.simpleSpacing - SPACEWIDTH) * scale;
        }

        paragraphBuilder.pushStyle(newtextStyle);
        paragraphBuilder.addText(' ');
        paragraphBuilder.pop();
      }
    }

    const maxWidth = pageWidth * 2;
    paragraphBuilder.pop();
    const p = paragraphBuilder.build();
    p.layout(maxWidth);

    return p;
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
    fontFamily,
    highlights,
  ]);

  if (!paragraph) return null;

  const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
  const maxWidth = pageWidth * 2;
  const currLineWidth = paragraph.getLongestLine();

  let xPos: number;
  if (
    lineInfo.lineType === 1 ||
    (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2)
  ) {
    // Centered lines: surah names and basmallah (except pages 1-2)
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
    const pHeight = paragraph.getHeight();
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

    for (const hl of backgroundHighlights) {
      try {
        const skRects = paragraph.getRectsForRange(hl.start, hl.end + 1);
        for (const rect of skRects) {
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: hl.color,
          });
        }
      } catch {
        // Ignore rect computation failures
      }
    }

    return rects.length > 0 ? rects : null;
  }, [paragraph, backgroundHighlights]);

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
    <Paragraph
      paragraph={paragraph}
      x={xPos}
      y={adjustedYPos}
      width={maxWidth}
    />
  );
};

export default React.memo(SkiaLine);
