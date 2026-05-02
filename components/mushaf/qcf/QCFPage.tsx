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
// Surah header rendering is currently disabled (debugging the
// SkiaSurahHeader sizing on QCF pages — divider was rendering at a
// massive size). Header-line slot is left blank for now; reinstate
// after fixing.

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
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  qcfDataService,
  BASMALA_TEXT,
  BASMALA_FONT_FAMILY,
} from '@/services/mushaf/QCFDataService';
import {
  qcfFontFamilyForPage,
  qcfFontLoader,
} from '@/services/mushaf/QCFFontLoader';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
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
const BASMALA_PAGE_NUMBER = 1;

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

const QCFPage: React.FC<QCFPageProps> = ({
  pageNumber,
  textColor,
  contentMarginLeft,
  onReady,
  onTap,
}) => {
  const fontMgr = mushafPreloadService.fontMgr;
  const [fontReady, setFontReady] = useState<boolean>(() =>
    qcfFontLoader.isReady(pageNumber),
  );
  const [basmalaFontReady, setBasmalaFontReady] = useState<boolean>(() =>
    qcfFontLoader.isReady(BASMALA_PAGE_NUMBER),
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

  const hasBasmala = useMemo(
    () => pageLines.some(l => l.line_type === 'basmallah'),
    [pageLines],
  );

  // Load this page's font + page-1 font (for basmala), prefetch neighbors.
  useEffect(() => {
    if (!fontMgr) return;
    let cancelled = false;
    setError(null);
    setFontReady(qcfFontLoader.isReady(pageNumber));
    setBasmalaFontReady(qcfFontLoader.isReady(BASMALA_PAGE_NUMBER));

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

      if (hasBasmala) {
        try {
          await qcfFontLoader.ensure(BASMALA_PAGE_NUMBER, fontMgr);
          if (!cancelled) setBasmalaFontReady(true);
        } catch {
          // non-fatal
        }
      }

      qcfFontLoader.prefetch(
        [pageNumber - 1, pageNumber + 1, pageNumber - 2, pageNumber + 2],
        fontMgr,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber, hasBasmala]);

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
        // Skipped — see file header. Empty slot for now.
        continue;
      }

      if (line.line_type === 'basmallah') {
        if (!qcfFontLoader.isReady(BASMALA_PAGE_NUMBER)) continue;
        const built = buildOne(
          massageLineText(BASMALA_TEXT),
          BASMALA_FONT_FAMILY,
        );
        entries.push({key: `bs-${i}`, ...built, yPos});
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
    basmalaFontReady,
    pageLines,
    lineYPositions,
    pageNumber,
    textColor,
  ]);

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
