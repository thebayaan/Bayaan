// QCF V2 mushaf renderer.
//
// Per-line Skia paragraphs, each at its own y position from
// calculateLineYPositions(). TextAlign.Center, layout to CONTENT_WIDTH.
// KFGQPC glyph advances already encode per-line spacing — no Justify
// needed (Skia's Justify can't engage on PUA codepoints with no
// whitespace anyway).
//
// fontSize is calibrated per-page from the widest ayah line, matching
// the KFGQPC typographer's intent (each page-font is designed so its
// widest line fills the page width at the natural design size).
//
// Surah-name lines render via SkiaSurahHeader (same component DK uses
// at SkiaPage.tsx). Basmallah lines render exactly like DK does: the
// Unicode BASMALLAH_TEXT in the DigitalKhatt font with the OpenType
// `basm` feature. This matches DK's printed-mushaf basmallah look so
// surah-start pages look identical between DK and QCF modes.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Canvas,
  Paragraph,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  type SkParagraph,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {PAGE_WIDTH, FONTSIZE} from '@/services/mushaf/QuranTextService';
import {
  qcfFontFamilyForPage,
  qcfFontLoader,
} from '@/services/mushaf/QCFFontLoader';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import SkiaSurahHeader from '../skia/SkiaSurahHeader';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  calculateLineYPositions,
} from '../constants';

interface QCFPageProps {
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  contentMarginLeft?: number;
  onReady?: () => void;
  onTap?: () => void;
}

const lineParStyle = {
  textDirection: TextDirection.RTL,
  textAlign: TextAlign.Center,
  textHeightBehavior: TextHeightBehavior.DisableAll,
};

const REF_FONT_SIZE = 100;
const FILL_RATIO = 0.97;

// DK's font + size for basmallah rendering. Matches SkiaPage's calc
// (FONTSIZE * scale * 0.9 where scale = CONTENT_WIDTH / PAGE_WIDTH).
const DK_FONT_FAMILY = 'DigitalKhattV2';
const DK_FONT_SIZE = (CONTENT_WIDTH / PAGE_WIDTH) * FONTSIZE * 0.9;

// Skia treats U+0020 (regular space) as a wrap-point and merges adjacent
// PUA word-glyphs at line start when no separator precedes them — the two
// failure modes are (a) first two words on every page rendering as one
// glyph blob and (b) hizb-marker pages where the QF API embeds a regular
// space inside the first word's code field. Replacing spaces with U+200A
// (HAIR SPACE) avoids both: it's non-breaking, narrow, and Skia treats it
// as letter-spacing rather than a word break. The same trick is what
// qcf_quran (Flutter) uses; see m4hmoud-atef/qcf_quran lib/src/qcf_page.dart.
const HAIR_SPACE = ' ';
const massageLineText = (text: string): string => {
  // Replace any embedded regular spaces with hair spaces.
  let t = text.replace(/ /g, HAIR_SPACE);
  // Insert a hair space after the first codepoint to keep its initial-form
  // glyph from merging with the next codepoint at line start. Skip if the
  // second char is already a hair space (e.g., already separated by the
  // hizb-marker case above).
  if (t.length > 1 && t[1] !== HAIR_SPACE) {
    t = t[0] + HAIR_SPACE + t.slice(1);
  }
  return t;
};

interface RenderEntry {
  key: string;
  paragraph: SkParagraph;
  yPos: number;
  width: number;
}

interface SurahHeaderEntry {
  key: string;
  surahNumber: number;
  yPos: number;
  lineHeight: number;
}

const QCFPage: React.FC<QCFPageProps> = ({
  pageNumber,
  textColor,
  dividerColor,
  contentMarginLeft,
  onReady,
  onTap,
}) => {
  const fontMgr = mushafPreloadService.fontMgr;

  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
    const refFont = Skia.Font(qcTypeface, 100);
    // Reference glyph U+E000 in QuranCommon. Using the explicit escape
    // (not the literal char) so editors / Edit tools can't strip the
    // invisible PUA character and silently break the calc.
    const ids = refFont.getGlyphIDs('');
    const widths = refFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (CONTENT_WIDTH / measuredW) * 100;
    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
  }, []);
  const [fontReady, setFontReady] = useState<boolean>(() =>
    qcfFontLoader.isReady(pageNumber),
  );
  const [error, setError] = useState<string | null>(null);

  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  const lineYPositions = useMemo(
    () => calculateLineYPositions(pageLines, pageNumber),
    [pageLines, pageNumber],
  );

  // Load this page's QCF page-font, prefetch neighbors. Basmallah no
  // longer needs the page-1 font — DK font handles it.
  useEffect(() => {
    if (!fontMgr) return;
    let cancelled = false;
    setError(null);
    setFontReady(qcfFontLoader.isReady(pageNumber));

    (async () => {
      try {
        await qcfFontLoader.ensure(pageNumber, fontMgr);
        if (!cancelled) setFontReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'QCF font load failed');
        }
        return;
      }

      qcfFontLoader.prefetch(
        [pageNumber - 1, pageNumber + 1, pageNumber - 2, pageNumber + 2],
        fontMgr,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber]);

  const renderEntries = useMemo<RenderEntry[]>(() => {
    if (!fontMgr || !fontReady) return [];

    const fontFamily = qcfFontFamilyForPage(pageNumber);

    // Measure every ayah line at REF_FONT_SIZE so we can pick fontSize and
    // also detect width outliers (one anomalously wide line that would
    // otherwise drag fontSize down for the whole page).
    const tmpBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    const lineWidths: number[] = [];
    for (const line of pageLines) {
      if (line.line_type !== 'ayah') continue;
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const text = massageLineText(words.map(w => w.code).join(''));

      tmpBuilder.reset();
      tmpBuilder.pushStyle({
        color: Skia.Color(textColor),
        fontFamilies: [fontFamily],
        fontSize: REF_FONT_SIZE,
      });
      tmpBuilder.addText(text);
      const para = tmpBuilder.build();
      para.layout(99999);
      lineWidths.push(para.getLongestLine());
      para.dispose();
    }
    if (lineWidths.length === 0) return [];

    // Outlier-skip: if the widest line is >5% wider than the second-widest
    // (e.g., page 27's line 14, which the printed mushaf wraps to line 15),
    // calibrate against the second-widest. The outlier line then overhangs
    // the canvas slightly via per-line natural-width centering below — much
    // better than shrinking the entire page to fit one anomaly.
    const sortedDesc = [...lineWidths].sort((a, b) => b - a);
    const widestRef =
      sortedDesc.length > 1 && sortedDesc[0] > sortedDesc[1] * 1.05
        ? sortedDesc[1]
        : sortedDesc[0];

    const fontSize =
      ((CONTENT_WIDTH * FILL_RATIO) / widestRef) * REF_FONT_SIZE;

    // Lay out each line at its INTRINSIC width (not canvas width) so outlier
    // lines overhang the canvas edges instead of wrapping. We position the
    // line with an explicit x-offset for centering at render time.
    const buildOne = (
      text: string,
      family: string,
    ): {paragraph: SkParagraph; width: number} => {
      const builder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
      builder.pushStyle({
        color: Skia.Color(textColor),
        fontFamilies: [family],
        fontSize,
      });
      builder.addText(text);
      const para = builder.build();
      para.layout(99999);
      const naturalWidth = para.getLongestLine();
      para.layout(Math.ceil(naturalWidth) + 2);
      return {paragraph: para, width: naturalWidth};
    };

    const entries: RenderEntry[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      const yPos = lineYPositions[i];

      if (line.line_type === 'surah_name') {
        // Rendered separately as a SkiaSurahHeader element; see the
        // surahHeaders memo below.
        continue;
      }

      if (line.line_type === 'basmallah') {
        // Render exactly like DK SkiaLine: BASMALLAH_TEXT in the DK
        // font with the OpenType `basm` feature, sized to DK's natural
        // basmallah size, centered in the canvas.
        const builder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
        builder.pushStyle({
          color: Skia.Color(textColor),
          fontFamilies: [DK_FONT_FAMILY],
          fontSize: DK_FONT_SIZE,
          fontFeatures: [{name: 'basm', value: 1}],
        });
        builder.addText(BASMALLAH_TEXT);
        const para = builder.build();
        para.layout(99999);
        const naturalWidth = para.getLongestLine();
        para.layout(Math.ceil(naturalWidth) + 2);
        entries.push({
          key: `bs-${i}`,
          paragraph: para,
          width: naturalWidth,
          yPos,
        });
        continue;
      }

      // ayah
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const text = massageLineText(words.map(w => w.code).join(''));
      const built = buildOne(text, fontFamily);
      entries.push({key: `ay-${i}`, ...built, yPos});
    }
    return entries;
  }, [
    fontMgr,
    fontReady,
    pageLines,
    lineYPositions,
    pageNumber,
    textColor,
  ]);

  // Surah-header lines (line_type === 'surah_name'). DK's SkiaSurahHeader
  // takes the same dividerFont + nameFontSize we computed above, plus the
  // surah number from DK's pageLines metadata.
  const surahHeaders = useMemo<SurahHeaderEntry[]>(() => {
    const entries: SurahHeaderEntry[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (line.line_type !== 'surah_name') continue;
      const yPos = lineYPositions[i];
      const lineHeight =
        i < lineYPositions.length - 1
          ? lineYPositions[i + 1] - lineYPositions[i]
          : CONTENT_HEIGHT - lineYPositions[i];
      entries.push({
        key: `sh-${i}`,
        surahNumber: line.surah_number,
        yPos,
        lineHeight,
      });
    }
    return entries;
  }, [pageLines, lineYPositions]);

  useEffect(() => {
    if (error) {
      onReady?.();
      return;
    }
    if (renderEntries.length > 0) onReady?.();
  }, [renderEntries.length, error, onReady]);

  const handleTap = useCallback(() => {
    onTap?.();
  }, [onTap]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(handleTap)();
      }),
    [handleTap],
  );

  if (!fontMgr || pageLines.length === 0) {
    return <View style={styles.page} />;
  }

  if (!fontReady || renderEntries.length === 0) {
    return (
      <GestureDetector gesture={tapGesture}>
        <View style={styles.page} />
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.page}>
        <Canvas
          style={{
            width: CONTENT_WIDTH,
            height: CONTENT_HEIGHT,
            marginLeft: contentMarginLeft ?? PAGE_PADDING_HORIZONTAL,
            marginTop: PAGE_PADDING_TOP,
          }}>
          {surahHeaderFonts.dividerFont &&
            surahHeaders.map(({key, surahNumber, yPos, lineHeight}) => (
              <SkiaSurahHeader
                key={key}
                dividerFont={surahHeaderFonts.dividerFont!}
                fontMgr={fontMgr}
                nameFontSize={surahHeaderFonts.nameFontSize}
                surahNumber={surahNumber}
                yPos={yPos}
                pageWidth={CONTENT_WIDTH}
                dividerColor={dividerColor}
                nameColor={textColor}
                lineHeight={lineHeight}
              />
            ))}
          {renderEntries.map(({key, paragraph, yPos, width}) => (
            <Paragraph
              key={key}
              paragraph={paragraph}
              x={(CONTENT_WIDTH - width) / 2}
              y={yPos}
              width={Math.ceil(width) + 2}
            />
          ))}
        </Canvas>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default QCFPage;
