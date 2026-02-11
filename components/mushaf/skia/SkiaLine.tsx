import React, {useMemo} from 'react';
import {
  Paragraph,
  Skia,
  TextHeightBehavior,
  TextDirection,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {
  quranTextService,
  FONTSIZE,
  SPACEWIDTH,
  SpaceType,
} from '@/services/mushaf/QuranTextService';
import type {JustResultByLine} from '@/services/mushaf/JustificationService';

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
  textColor: string;
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
  textColor,
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
      fontFamilies: ['DigitalKhatt'],
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

      // Render each character with optional font features for justification
      for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
        const char = lineText.charAt(i);
        const justInfo = justResult.fontFeatures.get(i);

        if (justInfo) {
          const newtextStyle: SkTextStyle = {
            ...textStyle,
            fontFeatures: justInfo,
          };
          paragraphBuilder.pushStyle(newtextStyle);
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

  return <Paragraph paragraph={paragraph} x={xPos} y={yPos} width={maxWidth} />;
};

export default React.memo(SkiaLine);
