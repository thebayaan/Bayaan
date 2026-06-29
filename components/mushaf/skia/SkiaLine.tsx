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
import {
  quranTextService,
  FONTSIZE,
  SPACEWIDTH,
  SpaceType,
} from '@/services/mushaf/QuranTextService';
import type {JustResultByLine} from '@/services/mushaf/JustificationService';
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
  backgroundHighlights,
}) => {
  const paragraphs = useMemo(() => {
    const scale = (fontSize * justResult.fontSizeRatio) / FONTSIZE;
    const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
    const lineText = quranTextService.getLineText(pageNumber, lineIndex);
    const lineTextInfo = quranTextService.analyzeText(pageNumber, lineIndex);

    if (!lineText) return null;

    const color = Skia.Color(textColor);
    const effectiveFontSize = justResult.fontSizeRatio * fontSize;
    const strokeWidth = getArabicTextWeightStrokeWidth(
      arabicTextWeight,
      effectiveFontSize,
    );

    const textStyle: SkTextStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize: effectiveFontSize,
    };

    // Basmallah lines (not on pages 1-2) get the basm feature
    if (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2) {
      textStyle.fontFeatures = [{name: 'basm', value: 1}];
    }

    const buildParagraph = (withStroke: boolean) => {
      const paragraphBuilder = Skia.ParagraphBuilder.Make(
        lineParStyle,
        fontMgr,
      );

      const pushStyle = (style: SkTextStyle, styleColor: SkColor) => {
        const strokePaint = withStroke
          ? createTextStrokePaint(styleColor, strokeWidth)
          : undefined;
        if (strokePaint) {
          paragraphBuilder.pushStyle(style, strokePaint);
        } else {
          paragraphBuilder.pushStyle(style);
        }
      };

      pushStyle(textStyle, color);

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
          const tajweedRule = charToRule?.get(i);
          const customColor = charToColor?.get(i);

          const needsCustomStyle = justInfo || tajweedRule || customColor;

          if (needsCustomStyle) {
            const charStyle: SkTextStyle = {
              ...textStyle,
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

    return {
      paragraph: buildParagraph(false),
      strokeParagraph: strokeWidth > 0 ? buildParagraph(true) : null,
    };
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

  const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
  const maxWidth = pageWidth * 2;
  const currLineWidth = paragraph?.getLongestLine() ?? 0;

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
