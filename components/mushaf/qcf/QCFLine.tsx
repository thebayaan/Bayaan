// Builds + renders one line of a QCF V2 mushaf page. The line text is
// the concatenation of word-glyph codepoints; Skia justifies inter-word
// spacing via TextAlign.Justify when laid out at canvas width.
//
// Surah-name lines are NOT rendered here — they go through SkiaSurahHeader
// (same component DK uses).

import React, {useMemo} from 'react';
import {
  Paragraph,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider,
  type SkTextStyle,
} from '@shopify/react-native-skia';

interface QCFLineProps {
  text: string;
  fontMgr: SkTypefaceFontProvider;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  yPos: number;
  width: number;
  parStyle: Parameters<typeof Skia.ParagraphBuilder.Make>[0];
  onParagraphReady?: (paragraph: SkParagraph) => void;
}

const QCFLine: React.FC<QCFLineProps> = ({
  text,
  fontMgr,
  fontFamily,
  fontSize,
  textColor,
  yPos,
  width,
  parStyle,
  onParagraphReady,
}) => {
  const paragraph = useMemo<SkParagraph | null>(() => {
    if (!text) return null;
    const style: SkTextStyle = {
      color: Skia.Color(textColor),
      fontFamilies: [fontFamily],
      fontSize,
    };
    const builder = Skia.ParagraphBuilder.Make(parStyle, fontMgr);
    builder.pushStyle(style);
    builder.addText(text);
    const para = builder.build();
    para.layout(width);
    return para;
  }, [text, fontMgr, fontFamily, fontSize, textColor, width, parStyle]);

  React.useEffect(() => {
    if (paragraph && onParagraphReady) onParagraphReady(paragraph);
  }, [paragraph, onParagraphReady]);

  if (!paragraph) return null;
  return <Paragraph paragraph={paragraph} x={0} y={yPos} width={width} />;
};

export default QCFLine;
