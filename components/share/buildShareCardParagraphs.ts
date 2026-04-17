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
  CARD_BASMALLAH_FONT_RATIO,
  CARD_BASMALLAH_BOTTOM_GAP,
  LIGHT_COLORS,
  DARK_COLORS,
  type ShareCardColors,
} from './shareCardConstants';
import {
  BASMALLAH_TEXT,
  digitalKhattDataService,
} from '@/services/mushaf/DigitalKhattDataService';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import type {RewayahId} from '@/store/mushafSettingsStore';

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
  /** Sections: each is a surah header + optional basmallah + verse text paragraph */
  sections: Array<{
    surahNumber: number;
    dividerParagraph: SkParagraph;
    dividerHeight: number;
    nameParagraph: SkParagraph;
    nameHeight: number;
    basmallahParagraph: SkParagraph | null;
    basmallahHeight: number;
    verseParagraph: SkParagraph;
    verseHeight: number;
  }>;
  watermarkParagraph: SkParagraph | null;
  watermarkHeight: number;
  watermarkTextWidth: number;
  watermarkIconSize: number;
  watermarkGap: number;
  /** Rendered only when rewayah !== 'hafs' — small label disclosing the
   *  reading on the share card so recipients can tell which text they're
   *  seeing. Rendered centered, above the watermark. */
  rewayahLabelParagraph: SkParagraph | null;
  rewayahLabelHeight: number;
  totalHeight: number;
  colors: ShareCardColors;
}

/** Group verse keys by surah number, preserving order. */
function groupBySurah(
  verseKeys: string[],
  rewayah: RewayahId | undefined,
): SurahSection[] {
  const sections: SurahSection[] = [];
  let current: SurahSection | null = null;

  for (const vk of verseKeys) {
    const [surahStr] = vk.split(':');
    const surahNumber = parseInt(surahStr, 10);
    // Prefer DK text for the active rewayah so the rendered share card
    // matches what the user is reading. Fall back to the static Hafs JSON
    // for verses DK doesn't cover yet.
    const text =
      digitalKhattDataService.getVerseText(vk, rewayah) || textByKey[vk] || '';

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

export function buildShareCardParagraphs(
  verseKeys: string[],
  contentWidth: number,
  fontMgr: SkTypefaceFontProvider,
  isDarkMode: boolean,
  showWatermark: boolean,
  quranCommonTypeface: SkTypeface | null,
  fontFamily: string,
  showBasmallah: boolean,
  rewayah?: RewayahId,
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
  const basmallahBottomGap = CARD_BASMALLAH_BOTTOM_GAP * scale;

  const groups = groupBySurah(verseKeys, rewayah);

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

    // Basmallah paragraph (between divider and verse text)
    // Skip for Al-Fatiha (verse 1 IS the basmallah) and At-Tawbah (no basmallah)
    let basmallahParagraph: SkParagraph | null = null;
    let basmallahHeight = 0;
    const skipBasmallah = group.surahNumber === 1 || group.surahNumber === 9;
    if (showBasmallah && !skipBasmallah && BASMALLAH_TEXT) {
      const basmallahFontSize = verseFontSize * CARD_BASMALLAH_FONT_RATIO;
      const basmBuilder = Skia.ParagraphBuilder.Make(
        {textDirection: TextDirection.RTL, textAlign: TextAlign.Center},
        fontMgr,
      );
      basmBuilder.pushStyle({
        color: Skia.Color(colors.text),
        fontFamilies: [fontFamily],
        fontSize: basmallahFontSize,
        fontFeatures: [{name: 'basm', value: 1}],
      });
      basmBuilder.addText(BASMALLAH_TEXT);
      basmBuilder.pop();
      basmallahParagraph = basmBuilder.build();
      basmallahParagraph.layout(contentWidth);
      basmallahHeight = basmallahParagraph.getHeight();
    }

    // Verse text paragraph
    const verseBuilder = Skia.ParagraphBuilder.Make(
      {textDirection: TextDirection.RTL, textAlign: TextAlign.Center},
      fontMgr,
    );

    const color = Skia.Color(colors.text);
    const textStyle = {
      color,
      fontFamilies: [fontFamily],
      fontSize: verseFontSize,
    };

    const allVerseText = group.verseTexts.map(addVerseMarker).join(' ');
    const fontScale = verseFontSize / FONTSIZE;
    const ayaLetterSpacing = SPACEWIDTH * fontScale;

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
        verseBuilder.addText(char);
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
      basmallahParagraph,
      basmallahHeight,
      verseParagraph,
      verseHeight,
    };
  });

  // Rewayah disclosure label (only when non-Hafs). Rendered centered, above
  // the watermark, so the share card makes the reading explicit.
  let rewayahLabelParagraph: SkParagraph | null = null;
  let rewayahLabelHeight = 0;
  if (rewayah && rewayah !== 'hafs') {
    const labelBuilder = Skia.ParagraphBuilder.Make(
      {textAlign: TextAlign.Center},
      fontMgr,
    );
    labelBuilder.pushStyle({
      color: Skia.Color(colors.secondary),
      fontFamilies: ['ManropeSemiBold'],
      fontSize: watermarkFontSize,
    });
    labelBuilder.addText(getRewayahShortLabel(rewayah));
    labelBuilder.pop();
    rewayahLabelParagraph = labelBuilder.build();
    rewayahLabelParagraph.layout(contentWidth);
    rewayahLabelHeight = rewayahLabelParagraph.getHeight();
  }

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
    if (section.basmallahParagraph) {
      totalHeight += section.basmallahHeight + basmallahBottomGap;
    }
    totalHeight += section.verseHeight + verseBottomGap;
  });
  if (rewayahLabelParagraph) totalHeight += rewayahLabelHeight;
  if (watermarkParagraph) totalHeight += watermarkHeight;
  totalHeight += bottomPadding;

  return {
    sections,
    watermarkParagraph,
    watermarkHeight,
    watermarkTextWidth,
    watermarkIconSize,
    watermarkGap,
    rewayahLabelParagraph,
    rewayahLabelHeight,
    totalHeight,
    colors,
  };
}
