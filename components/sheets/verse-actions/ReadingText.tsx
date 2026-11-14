// @ai-generated
/**
 * One reading of a Quran word, drawn by Skia in the DigitalKhatt font the
 * mushaf uses for that rewayah (getDkFontFamily), with its silah marks in the
 * silah colour the mushaf uses. Quran text never goes through a UI font: until
 * the mushaf font manager is ready this draws an empty box of the line height.
 *
 * A small local paragraph builder (not SkiaVerseText, whose `text` path draws
 * no overlays, and not WBWVerseView's, which another track owns): the text is
 * laid out at `maxWidth`, then drawn at its own width so it sits at the start
 * of the row; a long reading wraps.
 */
import React, {useEffect, useMemo} from 'react';
import {View} from 'react-native';
import {
  Canvas,
  Paragraph,
  Skia,
  TextDirection,
  TextHeightBehavior,
  type SkParagraphStyle,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {tajweedColors} from '@/constants/tajweedColors';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import type {ReadingsRewayah} from '@/services/mushaf/wordReadingsFormat';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {disposeAfterPendingDraws} from '@/utils/skiaDeferredDispose';

const paragraphStyle: SkParagraphStyle = {
  textHeightBehavior: TextHeightBehavior.DisableAll,
  textDirection: TextDirection.RTL,
};

// The empty box shown until the font manager is ready: one line, at the
// 2.0x line pitch reading surfaces keep for Arabic.
const PLACEHOLDER_LINE_HEIGHT = 2;

export interface ReadingTextProps {
  /** The exact stored text of the reading (never retyped). */
  text: string;
  /** Whose text it is: picks the DigitalKhatt font as the mushaf does. */
  rewayah: ReadingsRewayah;
  fontSize: number;
  /** UTF-16 indices of the silah marks (and their vowels) to colour. */
  silahChars?: readonly number[];
  /** The widest the text may draw (the sheet's content width). */
  maxWidth: number;
  /** Defaults to the text itself. */
  accessibilityLabel?: string;
  /** Text colour; defaults to the theme's text colour. */
  color?: string;
}

const ReadingText: React.FC<ReadingTextProps> = ({
  text,
  rewayah,
  fontSize,
  silahChars,
  maxWidth,
  accessibilityLabel,
  color,
}) => {
  const {theme} = useTheme();
  const fontMgr = useMushafFontMgr();
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily = getDkFontFamily(renderer, rewayah);
  const textColor = color ?? theme.colors.text;
  const silahKey = silahChars ? silahChars.join(',') : '';

  const built = useMemo(() => {
    if (!fontMgr || !text || maxWidth <= 0) return null;
    const silah = new Set(silahKey ? silahKey.split(',').map(Number) : []);
    const base: SkTextStyle = {
      color: Skia.Color(textColor),
      fontFamilies: [fontFamily],
      fontSize,
    };
    const silahStyle: SkTextStyle = {
      ...base,
      color: Skia.Color(tajweedColors.silah),
    };
    const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
    builder.pushStyle(base);
    for (let i = 0; i < text.length; i++) {
      if (silah.has(i)) {
        builder.pushStyle(silahStyle);
        builder.addText(text.charAt(i));
        builder.pop();
      } else {
        builder.addText(text.charAt(i));
      }
    }
    builder.pop();
    const paragraph = builder.build();
    paragraph.layout(maxWidth);
    // Drawn at its own width, so a short reading sits at the row's start.
    const width = Math.min(maxWidth, Math.ceil(paragraph.getLongestLine()) + 1);
    paragraph.layout(width);
    return {paragraph, width, height: Math.ceil(paragraph.getHeight())};
  }, [fontMgr, text, maxWidth, silahKey, textColor, fontFamily, fontSize]);

  // SkParagraph holds native memory: dispose the previous one once no queued
  // draw can still use it (utils/skiaDeferredDispose.ts).
  useEffect(() => () => disposeAfterPendingDraws([built?.paragraph]), [built]);

  const label = accessibilityLabel ?? text;
  if (!built) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        style={{minHeight: Math.round(fontSize * PLACEHOLDER_LINE_HEIGHT)}}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{width: built.width, height: built.height}}>
      <Canvas
        pointerEvents="none"
        style={{width: built.width, height: built.height, direction: 'rtl'}}>
        <Paragraph
          paragraph={built.paragraph}
          x={0}
          y={0}
          width={built.width}
        />
      </Canvas>
    </View>
  );
};

export default React.memo(ReadingText);
