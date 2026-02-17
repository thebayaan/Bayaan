/**
 * Builds Skia paragraph objects for the share card — reused by both the
 * preview Canvas and the offscreen capture path.
 */
import {
  Skia,
  TextDirection,
  TextAlign,
  type SkTypefaceFontProvider,
  type SkParagraph,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {
  SURAH_DIVIDER_CHAR,
  getQCFSurahNameChar,
} from '@/constants/surahNameGlyphs';
import {
  CARD_CONTENT_WIDTH,
  CARD_VERSE_FONT_SIZE,
  CARD_WATERMARK_FONT_SIZE,
  CARD_WATERMARK_ICON_SIZE,
  CARD_WATERMARK_GAP,
  CARD_VERSE_LINE_HEIGHT,
  CARD_TOP_PADDING,
  CARD_HEADER_BOTTOM_GAP,
  CARD_VERSE_BOTTOM_GAP,
  CARD_BOTTOM_PADDING,
  CARD_SURAH_GAP,
  CARD_HEADER_NAME_RATIO,
  LIGHT_COLORS,
  DARK_COLORS,
  type ShareCardColors,
} from './shareCardConstants';
import {tajweedColors} from '@/constants/tajweedColors';
import {getVerseTajweedMap} from '@/services/mushaf/DigitalKhattVerseTajweedService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

interface QuranEntry {
  verse_key: string;
  text: string;
}
const quranRaw = require('@/data/quran.json') as Record<string, QuranEntry>;
const textByKey: Record<string, string> = {};
for (const key of Object.keys(quranRaw)) {
  const entry = quranRaw[key];
  if (entry?.verse_key) textByKey[entry.verse_key] = entry.text;
}

// Reference coordinate system constants (from DigitalKhatt / QuranTextService)
const FONTSIZE = 1000;
const SPACEWIDTH = 100;

/** One visual section in the card (header + its verse text). */
interface SurahSection {
  surahNumber: number;
  verseKeys: string[];
  verseTexts: string[];
}

export interface ShareCardElements {
  /** Sections: each is a surah header + its verse text paragraph */
  sections: Array<{
    surahNumber: number;
    dividerParagraph: SkParagraph;
    dividerHeight: number;
    nameParagraph: SkParagraph;
    nameHeight: number;
    verseParagraph: SkParagraph;
    verseHeight: number;
  }>;
  watermarkParagraph: SkParagraph | null;
  watermarkHeight: number;
  watermarkTextWidth: number;
  watermarkIconSize: number;
  watermarkGap: number;
  totalHeight: number;
  colors: ShareCardColors;
}

/** Group verse keys by surah number, preserving order. */
function groupBySurah(verseKeys: string[]): SurahSection[] {
  const sections: SurahSection[] = [];
  let current: SurahSection | null = null;

  for (const vk of verseKeys) {
    const [surahStr] = vk.split(':');
    const surahNumber = parseInt(surahStr, 10);
    const text = textByKey[vk] ?? '';

    if (!current || current.surahNumber !== surahNumber) {
      current = {surahNumber, verseKeys: [], verseTexts: []};
      sections.push(current);
    }
    current.verseKeys.push(vk);
    if (text) current.verseTexts.push(text);
  }
  return sections;
}

/** Compute the font size that makes the divider glyph span exactly `targetWidth`. */
function computeDividerFontSize(
  typeface: SkTypeface,
  targetWidth: number,
): number {
  const refSize = 100;
  const refFont = Skia.Font(typeface, refSize);
  const ids = refFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
  const widths = refFont.getGlyphWidths(ids);
  const measuredW = widths[0] || 1;
  return (targetWidth / measuredW) * refSize;
}

/** Prepend U+06DD (Arabic End of Ayah) before trailing Arabic-Indic digits. */
function addVerseMarker(text: string): string {
  return text.replace(/([٠-٩]+)$/, '\u06DD$1');
}

/**
 * Build a combined tajweed map for the full joined text of a section.
 * Indices are relative to the final marked+joined string.
 */
function buildCombinedTajweedMap(
  verseKeys: string[],
  verseTexts: string[],
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> {
  const combined = new Map<number, string>();
  let globalOffset = 0;

  for (let vi = 0; vi < verseTexts.length; vi++) {
    const markedText = addVerseMarker(verseTexts[vi]);
    const tajMap = getVerseTajweedMap(verseKeys[vi], indexedTajweedData);

    if (tajMap) {
      for (const [rawIdx, rule] of tajMap) {
        // Tajweed rules apply to word characters, which come before the
        // verse-end digits. addVerseMarker only inserts ۝ before trailing
        // digits, so indices for word characters are unchanged.
        combined.set(globalOffset + rawIdx, rule);
      }
    }

    globalOffset += markedText.length;
    // +1 for the joining space between verses
    if (vi < verseTexts.length - 1) globalOffset += 1;
  }

  return combined;
}

export function buildShareCardParagraphs(
  verseKeys: string[],
  contentWidth: number,
  fontMgr: SkTypefaceFontProvider,
  isDarkMode: boolean,
  showWatermark: boolean,
  quranCommonTypeface: SkTypeface | null,
  fontFamily: string,
  showTajweed: boolean,
  indexedTajweedData: IndexedTajweedData | null,
): ShareCardElements {
  const colors = isDarkMode ? DARK_COLORS : LIGHT_COLORS;
  const scale = contentWidth / CARD_CONTENT_WIDTH;
  const verseFontSize = CARD_VERSE_FONT_SIZE * scale;
  const watermarkFontSize = CARD_WATERMARK_FONT_SIZE * scale;
  const topPadding = CARD_TOP_PADDING * scale;
  const headerBottomGap = CARD_HEADER_BOTTOM_GAP * scale;
  const verseBottomGap = CARD_VERSE_BOTTOM_GAP * scale;
  const bottomPadding = CARD_BOTTOM_PADDING * scale;
  const surahGap = CARD_SURAH_GAP * scale;

  const groups = groupBySurah(verseKeys);

  // Build sections
  const sections = groups.map(group => {
    // Divider paragraph (ornamental frame scaled to exact content width)
    const dividerFontSize = quranCommonTypeface
      ? computeDividerFontSize(quranCommonTypeface, contentWidth)
      : verseFontSize * 1.8;
    const divBuilder = Skia.ParagraphBuilder.Make(
      {textAlign: TextAlign.Center},
      fontMgr,
    );
    divBuilder.pushStyle({
      color: Skia.Color(colors.divider),
      fontFamilies: ['QuranCommon'],
      fontSize: dividerFontSize,
    });
    divBuilder.addText(SURAH_DIVIDER_CHAR);
    divBuilder.pop();
    const dividerParagraph = divBuilder.build();
    dividerParagraph.layout(contentWidth);
    const dividerHeight = dividerParagraph.getHeight();

    // QCF surah name paragraph (overlaid on divider)
    const qcfChar = getQCFSurahNameChar(group.surahNumber);
    const nameBuilder = Skia.ParagraphBuilder.Make(
      {textAlign: TextAlign.Center},
      fontMgr,
    );
    nameBuilder.pushStyle({
      color: Skia.Color(colors.text),
      fontFamilies: ['SurahNameQCF'],
      fontSize: dividerFontSize * CARD_HEADER_NAME_RATIO,
    });
    nameBuilder.addText(qcfChar);
    nameBuilder.pop();
    const nameParagraph = nameBuilder.build();
    nameParagraph.layout(contentWidth);
    const nameHeight = nameParagraph.getHeight();

    // Verse text paragraph — mirrors SkiaLine's rendering approach exactly:
    // char-by-char addText, inner push/pop spreads the full textStyle
    // (color + fontFamilies + fontSize) so Skia never falls back to defaults.
    const verseBuilder = Skia.ParagraphBuilder.Make(
      {textDirection: TextDirection.RTL, textAlign: TextAlign.Center},
      fontMgr,
    );

    const color = Skia.Color(colors.text);

    // textStyle matches SkiaLine exactly: color + fontFamilies + fontSize.
    // NO heightMultiplier here — inner pushes spread this object, and
    // heightMultiplier must NOT be re-specified in inner pushes.
    const textStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize: verseFontSize,
    };

    const allVerseText = group.verseTexts.map(addVerseMarker).join(' ');
    const fontScale = verseFontSize / FONTSIZE;
    const ayaLetterSpacing = SPACEWIDTH * fontScale;

    // Build combined tajweed map if enabled
    const tajweedMap =
      showTajweed && indexedTajweedData
        ? buildCombinedTajweedMap(
            group.verseKeys,
            group.verseTexts,
            indexedTajweedData,
          )
        : null;

    // Base push: includes heightMultiplier for line spacing (only here).
    verseBuilder.pushStyle({
      ...textStyle,
      heightMultiplier: CARD_VERSE_LINE_HEIGHT,
    });

    for (let i = 0; i < allVerseText.length; i++) {
      const char = allVerseText.charAt(i);

      if (char === ' ') {
        // Classify space — aya space: adjacent to Arabic-Indic digit or ۝
        const prevCode = i > 0 ? allVerseText.charCodeAt(i - 1) : 0;
        const nextCode =
          i < allVerseText.length - 1 ? allVerseText.charCodeAt(i + 1) : 0;
        const isAyaSpace =
          (prevCode >= 0x0660 && prevCode <= 0x0669) || nextCode === 0x06dd;

        // Every space gets push/pop with full textStyle (matches SkiaLine)
        if (isAyaSpace) {
          verseBuilder.pushStyle({
            ...textStyle,
            letterSpacing: ayaLetterSpacing,
          });
        } else {
          verseBuilder.pushStyle({...textStyle, letterSpacing: 0});
        }
        verseBuilder.addText(' ');
        verseBuilder.pop();
      } else {
        // Check tajweed coloring
        const tajweedRule = tajweedMap?.get(i);
        const tajColor = tajweedRule ? tajweedColors[tajweedRule] : undefined;

        if (tajColor) {
          // Spread full textStyle + override color (matches SkiaLine pattern)
          verseBuilder.pushStyle({...textStyle, color: Skia.Color(tajColor)});
          verseBuilder.addText(char);
          verseBuilder.pop();
        } else {
          // No custom style — stays in base run
          verseBuilder.addText(char);
        }
      }
    }

    verseBuilder.pop(); // pop base style
    const verseParagraph = verseBuilder.build();
    verseParagraph.layout(contentWidth);
    const verseHeight = verseParagraph.getHeight();

    return {
      surahNumber: group.surahNumber,
      dividerParagraph,
      dividerHeight,
      nameParagraph,
      nameHeight,
      verseParagraph,
      verseHeight,
    };
  });

  // Watermark: logo + "made with Bayaan" (left-aligned, manually centered in canvas)
  let watermarkParagraph: SkParagraph | null = null;
  let watermarkHeight = 0;
  let watermarkTextWidth = 0;
  const watermarkIconSize = CARD_WATERMARK_ICON_SIZE * scale;
  const watermarkGap = CARD_WATERMARK_GAP * scale;
  if (showWatermark) {
    const wmBuilder = Skia.ParagraphBuilder.Make(
      {textAlign: TextAlign.Left},
      fontMgr,
    );
    wmBuilder.pushStyle({
      color: Skia.Color(colors.secondary),
      fontFamilies: ['ManropeSemiBold'],
      fontSize: watermarkFontSize,
    });
    wmBuilder.addText('made with Bayaan');
    wmBuilder.pop();
    watermarkParagraph = wmBuilder.build();
    watermarkParagraph.layout(contentWidth);
    watermarkTextWidth = watermarkParagraph.getLongestLine();
    const textHeight = watermarkParagraph.getHeight();
    watermarkHeight = Math.max(watermarkIconSize, textHeight);
  }

  // Compute total height
  let totalHeight = topPadding;
  sections.forEach((section, i) => {
    if (i > 0) totalHeight += surahGap;
    totalHeight += section.dividerHeight + headerBottomGap;
    totalHeight += section.verseHeight + verseBottomGap;
  });
  if (watermarkParagraph) totalHeight += watermarkHeight;
  totalHeight += bottomPadding;

  return {
    sections,
    watermarkParagraph,
    watermarkHeight,
    watermarkTextWidth,
    watermarkIconSize,
    watermarkGap,
    totalHeight,
    colors,
  };
}
