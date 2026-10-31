// QCF V2 / V4 tajweed mushaf renderer.
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

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native'; // @ai
import {
  Canvas,
  Group,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  type SkParagraph,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {
  buildQCFLineRenderModel,
  buildQCFLineAllahNameMap,
  findQCFVerseAtCharIndex,
  type QCFLineRenderModel,
} from '@/services/mushaf/QCFLineService';
import {PAGE_WIDTH, FONTSIZE} from '@/services/mushaf/QuranTextService';
import {
  qcfFontFamilyForPage,
  qcfFontLoader,
  getQCFFontVariant, // @ai
} from '@/services/mushaf/QCFFontLoader';
import {qcfLayoutCacheService} from '@/services/mushaf/QCFLayoutCacheService';
import {fitQCFLinePositions} from '@/services/mushaf/QCFVerticalLayout'; // @ai
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {getTextAllahNameCharMap} from '@/services/mushaf/AllahNameHighlightService';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  usePlaybackBasmalaSurah, // @ai
  usePlaybackVerseKeys, // @ai
} from '@/store/mushafPlayerStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useTheme} from '@/hooks/useTheme';
import {useTranslation} from 'react-i18next'; // @ai
import SkiaSurahHeader from '../skia/SkiaSurahHeader';
import {
  type MushafLayoutMetrics, // @ai
  calculateLineYPositions,
  canvasBottomOverflow, // @ai
} from '../constants';
import {showVerseActions} from '@/components/sheets/showVerseActions'; // @ai
import {useMushafRangePickStore} from '@/store/mushafRangePickStore'; // @ai

interface QCFPageProps {
  metrics: MushafLayoutMetrics; // @ai
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

// Skia treats U+0020 (regular space) as a wrap-point and merges adjacent
// PUA word-glyphs at line start when no separator precedes them — the two
// failure modes are (a) first two words on every page rendering as one
// glyph blob and (b) hizb-marker pages where the QF API embeds a regular
// space inside the first word's code field. Replacing spaces with U+200A
// (HAIR SPACE) avoids both: it's non-breaking, narrow, and Skia treats it
// as letter-spacing rather than a word break. The same trick is what
// qcf_quran (Flutter) uses; see m4hmoud-atef/qcf_quran lib/src/qcf_page.dart.
interface RenderEntry {
  key: string;
  lineIndex: number;
  paragraph: SkParagraph;
  strokeParagraph: SkParagraph | null;
  boldOffset: number;
  yPos: number;
  width: number;
  model: QCFLineRenderModel | null;
}

interface SurahHeaderEntry {
  key: string;
  surahNumber: number;
  yPos: number;
  lineHeight: number;
}

const QCFPage: React.FC<QCFPageProps> = ({
  metrics, // @ai
  pageNumber,
  textColor,
  dividerColor,
  contentMarginLeft,
  onReady,
  onTap,
}) => {
  // @ai-start
  const {
    contentWidth: CONTENT_WIDTH,
    contentHeight: CONTENT_HEIGHT,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: PAGE_PADDING_TOP,
    baseLineHeight,
  } = metrics;
  const pageStyle = {width: metrics.pageWidth, height: metrics.screenHeight};
  const basmallahFontSize = (CONTENT_WIDTH / PAGE_WIDTH) * FONTSIZE * 0.9;
  // @ai-end
  const {theme} = useTheme();
  const {t} = useTranslation(['reader', 'common']); // @ai
  const fontMgr = useMushafFontMgr();
  // @ai-start
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  // Use the actual page text color: reading themes can differ from the app theme.
  const fontVariant = getQCFFontVariant(
    showTajweed,
    Color(textColor).isLight(),
  );
  const fontFamily = qcfFontFamilyForPage(pageNumber, fontVariant);
  // @ai-end
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const selectedVerseKeys = useMushafVerseSelectionStore(
    s => s.selectedVerseKeys,
  );
  const selectedPageNumber = useMushafVerseSelectionStore(
    s => s.selectedPageNumber,
  );
  const selectVerse = useMushafVerseSelectionStore(s => s.selectVerse);
  const selectVerseRange = useMushafVerseSelectionStore(
    s => s.selectVerseRange,
  );
  // @ai — every Hafs verse the reciter is reciting (a rewayah recitation's
  // verse can cover several Hafs verses); empty when idle.
  const playbackVerseKeys = usePlaybackVerseKeys();
  // @ai — the surah whose basmala is being recited (the intro before its
  // first verse): its basmallah line is painted as a recited verse is.
  const basmalaSurah = usePlaybackBasmalaSurah();

  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
    const refFont = Skia.Font(qcTypeface, 100);
    // Reference glyph U+E000 in QuranCommon. Using the explicit escape
    // (not the literal char) so editors / Edit tools can't strip the
    // invisible PUA character and silently break the calc.
    const ids = refFont.getGlyphIDs('\uE000');
    const widths = refFont.getGlyphWidths(ids);
    const measuredW = widths[0] || 1;
    const scaledSize = (CONTENT_WIDTH / measuredW) * 100;
    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
  }, [CONTENT_WIDTH]); // @ai
  // @ai-start
  const [loadedFont, setLoadedFont] = useState<{
    family: string;
    manager: NonNullable<typeof fontMgr>;
  } | null>(() =>
    fontMgr && qcfFontLoader.isReady(pageNumber, fontMgr, fontVariant)
      ? {family: fontFamily, manager: fontMgr}
      : null,
  );
  // A previous page/variant becoming ready must never expose an unloaded font.
  const fontReady =
    loadedFont?.family === fontFamily && loadedFont?.manager === fontMgr;
  const [loadAttempt, setLoadAttempt] = useState(0);
  // @ai-end
  const [error, setError] = useState<string | null>(null);

  const pageLines = useMemo<DKLine[]>(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  const rawLineYPositions = useMemo(
    // @ai-start
    () =>
      calculateLineYPositions(
        pageLines,
        pageNumber,
        CONTENT_HEIGHT,
        baseLineHeight,
      ),
    [pageLines, pageNumber, CONTENT_HEIGHT, baseLineHeight],
    // @ai-end
  );

  const orderedVerseKeys = useMemo(
    () => qcfDataService.getOrderedVerseKeysForPage(pageNumber),
    [pageNumber],
  );
  const orderedVerseKeysRef = useRef<string[]>(orderedVerseKeys);
  orderedVerseKeysRef.current = orderedVerseKeys;

  const dragStartVerseKeyRef = useRef<string | null>(null);
  const dragCurrentVerseKeyRef = useRef<string | null>(null);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );

  const selectionBgColor = useMemo(
    () => Color(textColor).alpha(0.18).toString(),
    [textColor],
  );

  const playbackBgColor = useMemo(
    () => Color(textColor).alpha(0.22).toString(),
    [textColor],
  );

  const themeBgColor = useMemo(
    () => Color(textColor).alpha(0.12).toString(),
    [textColor],
  );

  // @ai-start
  const layoutMetrics = useMemo(() => {
    if (!fontMgr || !fontReady) return null;

    const cached = qcfLayoutCacheService.getPageLayout(
      pageNumber,
      fontFamily,
      CONTENT_WIDTH,
    );
    if (cached) return cached;

    const tmpBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    const lineWidthsAtRef: Array<{lineIndex: number; width: number}> = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (line.line_type !== 'ayah') continue;
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const text = buildQCFLineRenderModel(words).renderedText;

      tmpBuilder.reset();
      tmpBuilder.pushStyle({
        color: Skia.Color(textColor),
        fontFamilies: [fontFamily],
        fontSize: REF_FONT_SIZE,
      });
      tmpBuilder.addText(text);
      const para = tmpBuilder.build();
      para.layout(99999);
      lineWidthsAtRef.push({
        lineIndex: i,
        width: para.getLongestLine(),
      });
      para.dispose();
    }
    if (lineWidthsAtRef.length === 0) return null;

    const sortedDesc = [...lineWidthsAtRef]
      .map(entry => entry.width)
      .sort((a, b) => b - a);
    const widestRef =
      sortedDesc.length > 1 && sortedDesc[0] > sortedDesc[1] * 1.05
        ? sortedDesc[1]
        : sortedDesc[0];

    const measured = {
      fontSize: ((CONTENT_WIDTH * FILL_RATIO) / widestRef) * REF_FONT_SIZE,
      lineWidthsAtRef,
    };
    qcfLayoutCacheService.setPageLayout(
      pageNumber,
      fontFamily,
      CONTENT_WIDTH,
      measured,
    );
    return measured;
  }, [
    fontMgr,
    fontReady,
    fontFamily,
    pageLines,
    pageNumber,
    textColor,
    CONTENT_WIDTH,
  ]);
  // @ai-end

  const lineBackgroundHighlights = useMemo(() => {
    const byLine = new Map<
      number,
      Array<{start: number; end: number; color: string}>
    >();
    const selectedSet =
      selectedPageNumber === pageNumber && selectedVerseKeys.length > 0
        ? new Set(selectedVerseKeys)
        : null;
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      // @ai-start
      if (
        line.line_type === 'basmallah' &&
        basmalaSurah !== null &&
        digitalKhattDataService.getBasmalaSurah(line) === basmalaSurah
      ) {
        byLine.set(i, [
          {start: 0, end: BASMALLAH_TEXT.length - 1, color: playbackBgColor},
        ]);
        continue;
      }
      // @ai-end
      if (line.line_type !== 'ayah') continue;
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const model = buildQCFLineRenderModel(words);
      const ranges: Array<{start: number; end: number; color: string}> = [];
      for (const segment of model.verseSegments) {
        if (
          playbackVerseKeys.includes(segment.verseKey) && // @ai
          !selectedSet?.has(segment.verseKey)
        ) {
          ranges.push({
            start: segment.startCharIndex,
            end: segment.endCharIndex,
            color: playbackBgColor,
          });
          continue;
        }
        if (showThemes && !selectedSet?.has(segment.verseKey)) {
          const themeInfo = themeDataService.getThemeForVerse(segment.verseKey);
          if (themeInfo && themeInfo.themeIndex % 2 === 0) {
            ranges.push({
              start: segment.startCharIndex,
              end: segment.endCharIndex,
              color: themeBgColor,
            });
          }
        }
        if (selectedSet?.has(segment.verseKey)) {
          ranges.push({
            start: segment.startCharIndex,
            end: segment.endCharIndex,
            color: selectionBgColor,
          });
        }
      }
      if (ranges.length > 0) {
        byLine.set(i, ranges);
      }
    }

    return byLine;
  }, [
    pageLines,
    pageNumber,
    selectedPageNumber,
    selectedVerseKeys,
    playbackVerseKeys, // @ai
    basmalaSurah, // @ai
    playbackBgColor,
    selectionBgColor,
    showThemes,
    themeBgColor,
  ]);

  // Load this page's QCF page-font, prefetch neighbors. Basmallah no
  // longer needs the page-1 font — DK font handles it.
  // @ai-start
  useEffect(() => {
    if (!fontMgr) return;
    let cancelled = false;
    setError(null);
    setLoadedFont(
      qcfFontLoader.isReady(pageNumber, fontMgr, fontVariant)
        ? {family: fontFamily, manager: fontMgr}
        : null,
    );

    (async () => {
      try {
        await qcfFontLoader.ensure(pageNumber, fontMgr, fontVariant);
        if (!cancelled) setLoadedFont({family: fontFamily, manager: fontMgr});
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'QCF font load failed');
        }
        return;
      }

      if (cancelled) return;
      qcfFontLoader.prefetch(
        [
          pageNumber - 1,
          pageNumber + 1,
          pageNumber - 2,
          pageNumber + 2,
          pageNumber - 3,
          pageNumber + 3,
        ],
        fontMgr,
        fontVariant,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [fontMgr, pageNumber, fontFamily, fontVariant, loadAttempt]);
  // @ai-end

  // @ai-start
  const rawRenderEntries = useMemo<RenderEntry[]>(() => {
    if (!fontMgr || !fontReady || !layoutMetrics) return [];

    const fontSize = layoutMetrics.fontSize;
    const lineWidthAtRefByLine = new Map(
      layoutMetrics.lineWidthsAtRef.map(entry => [
        entry.lineIndex,
        entry.width,
      ]),
    );

    // Lay out each line at its INTRINSIC width (not canvas width) so outlier
    // lines overhang the canvas edges instead of wrapping. We position the
    // line with an explicit x-offset for centering at render time.
    const buildOne = (
      text: string,
      family: string,
      charToColor?: Map<number, string> | null,
      options?: {
        fontSize?: number;
        fontFeatures?: Array<{name: string; value: number}>;
        widthAtRef?: number;
      },
    ): {
      paragraph: SkParagraph;
      strokeParagraph: SkParagraph | null;
      boldOffset: number;
      width: number;
    } => {
      const color = Skia.Color(textColor);
      const effectiveFontSize = options?.fontSize ?? fontSize;
      const strokeWidth = getArabicTextWeightStrokeWidth(
        arabicTextWeight,
        effectiveFontSize,
      );
      const baseStyle: SkTextStyle = {
        color,
        fontFamilies: [family],
        fontSize: effectiveFontSize,
      };
      if (options?.fontFeatures?.length) {
        baseStyle.fontFeatures = options.fontFeatures;
      }

      const widthFromCache =
        options?.widthAtRef != null
          ? (options.widthAtRef * effectiveFontSize) / REF_FONT_SIZE
          : null;

      const buildParagraph = (withStroke: boolean) => {
        const builder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
        const pushStyle = (style: SkTextStyle, styleColor: string) => {
          const strokePaint = withStroke
            ? createTextStrokePaint(Skia.Color(styleColor), strokeWidth)
            : undefined;
          if (strokePaint) {
            builder.pushStyle(style, strokePaint);
          } else {
            builder.pushStyle(style);
          }
        };

        pushStyle(baseStyle, textColor);
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const colorOverride = charToColor?.get(i);
          if (colorOverride) {
            const charStyle: SkTextStyle = {
              ...baseStyle,
              color: Skia.Color(colorOverride),
            };
            pushStyle(charStyle, colorOverride);
            builder.addText(char);
            builder.pop();
          } else {
            builder.addText(char);
          }
        }
        builder.pop();
        const para = builder.build();
        let naturalWidth = widthFromCache;
        if (naturalWidth == null) {
          para.layout(99999);
          naturalWidth = para.getLongestLine();
        }
        para.layout(Math.ceil(naturalWidth) + 2);
        return {paragraph: para, width: naturalWidth};
      };

      const base = buildParagraph(false);
      const stroke = strokeWidth > 0 ? base.paragraph : null;
      return {
        paragraph: base.paragraph,
        strokeParagraph: stroke,
        boldOffset: strokeWidth * 0.55,
        width: base.width,
      };
    };

    const entries: RenderEntry[] = [];
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      const yPos = rawLineYPositions[i];

      if (line.line_type === 'surah_name') {
        // Rendered separately as a SkiaSurahHeader element; see the
        // surahHeaders memo below.
        continue;
      }

      if (line.line_type === 'basmallah') {
        const basmallahAllahMap =
          showAllahNameHighlight && allahNameHighlightColor
            ? new Map(
                [
                  ...(getTextAllahNameCharMap(BASMALLAH_TEXT)?.keys() ?? []),
                ].map(index => [index, allahNameHighlightColor] as const),
              )
            : null;
        const built = buildOne(
          BASMALLAH_TEXT,
          DK_FONT_FAMILY,
          basmallahAllahMap,
          {
            fontSize: basmallahFontSize,
            fontFeatures: [{name: 'basm', value: 1}],
          },
        );
        entries.push({
          key: `bs-${i}`,
          lineIndex: i,
          paragraph: built.paragraph,
          strokeParagraph: built.strokeParagraph,
          boldOffset: built.boldOffset,
          width: built.width,
          yPos,
          model: null,
        });
        continue;
      }

      // ayah
      const words = qcfDataService.getWordsForLine(
        pageNumber,
        line.line_number,
      );
      if (words.length === 0) continue;
      const model = buildQCFLineRenderModel(words);
      const text = model.renderedText;
      const charToColor =
        !showTajweed && showAllahNameHighlight && allahNameHighlightColor
          ? buildQCFLineAllahNameMap(words, allahNameHighlightColor)
          : null;
      const built = buildOne(text, fontFamily, charToColor, {
        widthAtRef: lineWidthAtRefByLine.get(i),
      });
      entries.push({
        key: `ay-${i}`,
        lineIndex: i,
        ...built,
        yPos,
        model,
      });
    }
    return entries;
  }, [
    basmallahFontSize,
    allahNameHighlightColor,
    arabicTextWeight,
    fontMgr,
    fontReady,
    fontFamily,
    layoutMetrics,
    pageLines,
    rawLineYPositions,
    pageNumber,
    showAllahNameHighlight,
    showTajweed,
    textColor,
  ]);

  // V4's paragraph boxes are taller than the legacy line pitch. Fit their
  // measured bottoms above the page's reserved footer, keeping glyph sizes
  // and V2 spacing unchanged. Headers, highlights and hit tests share this fit.
  const lineYPositions = useMemo(
    () =>
      showTajweed
        ? fitQCFLinePositions(
            rawLineYPositions,
            rawRenderEntries.map(entry => ({
              lineIndex: entry.lineIndex,
              height: entry.paragraph.getHeight(),
            })),
            CONTENT_HEIGHT,
          )
        : rawLineYPositions,
    [showTajweed, rawLineYPositions, rawRenderEntries, CONTENT_HEIGHT],
  );

  const renderEntries = useMemo(
    () =>
      lineYPositions === rawLineYPositions
        ? rawRenderEntries
        : rawRenderEntries.map(entry => ({
            ...entry,
            yPos: lineYPositions[entry.lineIndex],
          })),
    [lineYPositions, rawLineYPositions, rawRenderEntries],
  );

  // @ai-end
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
  }, [pageLines, lineYPositions, CONTENT_HEIGHT]); // @ai

  useEffect(() => {
    if (error) {
      onReady?.();
      return;
    }
    if (renderEntries.length > 0) onReady?.();
  }, [renderEntries.length, error, onReady]);

  const renderEntryByLine = useMemo(() => {
    const map = new Map<number, RenderEntry>();
    for (const entry of renderEntries) {
      map.set(entry.lineIndex, entry);
    }
    return map;
  }, [renderEntries]);

  const findLineAtY = useCallback(
    (canvasY: number): number => {
      for (let i = 0; i < lineYPositions.length; i++) {
        const lineTop = lineYPositions[i];
        const lineBottom =
          i < lineYPositions.length - 1
            ? lineYPositions[i + 1]
            : CONTENT_HEIGHT;
        if (canvasY >= lineTop && canvasY < lineBottom) {
          return i;
        }
      }
      return -1;
    },
    [lineYPositions, CONTENT_HEIGHT], // @ai
  );

  const hitTestVerse = useCallback(
    (eventX: number, eventY: number) => {
      const canvasX = eventX - (contentMarginLeft ?? PAGE_PADDING_HORIZONTAL);
      const canvasY = eventY - PAGE_PADDING_TOP;

      if (
        canvasX < 0 ||
        canvasX > CONTENT_WIDTH ||
        canvasY < 0 ||
        canvasY > CONTENT_HEIGHT
      ) {
        return null;
      }

      const lineIndex = findLineAtY(canvasY);
      if (lineIndex < 0) return null;

      const entry = renderEntryByLine.get(lineIndex);
      if (!entry?.model) return null;

      const paragraphX = canvasX - (CONTENT_WIDTH - entry.width) / 2;
      const paragraphY = canvasY - entry.yPos;
      const charIndex = entry.paragraph.getGlyphPositionAtCoordinate(
        paragraphX,
        paragraphY,
      );

      return findQCFVerseAtCharIndex(entry.model, charIndex);
    },
    // @ai-start
    [
      contentMarginLeft,
      findLineAtY,
      renderEntryByLine,
      CONTENT_WIDTH,
      CONTENT_HEIGHT,
      PAGE_PADDING_HORIZONTAL,
      PAGE_PADDING_TOP,
    ],
    // @ai-end
  );

  const handleDragStart = useCallback(
    (eventX: number, eventY: number) => {
      const segment = hitTestVerse(eventX, eventY);
      if (!segment) {
        dragStartVerseKeyRef.current = null;
        return;
      }

      dragStartVerseKeyRef.current = segment.verseKey;
      dragCurrentVerseKeyRef.current = segment.verseKey;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      selectVerse(segment.verseKey, pageNumber);
    },
    [hitTestVerse, pageNumber, selectVerse],
  );

  const handleDragUpdate = useCallback(
    (eventX: number, eventY: number) => {
      if (Platform.OS === 'android') return;

      const startKey = dragStartVerseKeyRef.current;
      if (!startKey) return;

      const segment = hitTestVerse(eventX, eventY);
      if (!segment) return;

      const currentKey = segment.verseKey;
      if (currentKey === dragCurrentVerseKeyRef.current) return;

      const ordered = orderedVerseKeysRef.current;
      const startIdx = ordered.indexOf(startKey);
      const currentIdx = ordered.indexOf(currentKey);
      if (startIdx === -1 || currentIdx === -1) return;

      if (currentIdx < startIdx) {
        if (dragCurrentVerseKeyRef.current !== startKey) {
          dragCurrentVerseKeyRef.current = startKey;
          selectVerse(startKey, pageNumber);
        }
        return;
      }

      dragCurrentVerseKeyRef.current = currentKey;
      const range = ordered.slice(startIdx, currentIdx + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (range.length === 1) {
        selectVerse(range[0], pageNumber);
      } else {
        selectVerseRange(range, pageNumber);
      }
    },
    [hitTestVerse, pageNumber, selectVerse, selectVerseRange],
  );

  const handleDragEnd = useCallback(() => {
    const startKey = dragStartVerseKeyRef.current;
    if (!startKey) return;

    const store = useMushafVerseSelectionStore.getState();
    const keys = store.selectedVerseKeys;
    if (keys.length === 0) return;

    const firstKey = keys[0];
    const [surahStr, ayahStr] = firstKey.split(':');
    showVerseActions({
      verseKey: firstKey,
      surahNumber: parseInt(surahStr, 10),
      ayahNumber: parseInt(ayahStr, 10),
      verseKeys: keys.length > 1 ? keys : undefined,
      source: 'mushaf',
    });

    dragStartVerseKeyRef.current = null;
    dragCurrentVerseKeyRef.current = null;
  }, []);

  // @ai-start: while the Listen sheet picks a range, a tap picks the verse
  // under it, like a long-press.
  const handleTap = useCallback(
    (x: number, y: number) => {
      if (useMushafRangePickStore.getState().active) {
        handleDragStart(x, y);
        handleDragEnd();
        return;
      }
      onTap?.();
    },
    [onTap, handleDragStart, handleDragEnd],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(event => {
        'worklet';
        runOnJS(handleTap)(event.x, event.y);
      }),
    [handleTap],
  );
  // @ai-end

  const longPressDragGesture = useMemo(
    () =>
      Platform.OS === 'android'
        ? Gesture.LongPress()
            .minDuration(400)
            .maxDistance(20)
            .onStart(event => {
              'worklet';
              runOnJS(handleDragStart)(event.x, event.y);
            })
            .onEnd(() => {
              'worklet';
              runOnJS(handleDragEnd)();
            })
        : Gesture.Pan()
            .activateAfterLongPress(400)
            .minDistance(0)
            .onStart(event => {
              'worklet';
              runOnJS(handleDragStart)(event.x, event.y);
            })
            .onUpdate(event => {
              'worklet';
              runOnJS(handleDragUpdate)(event.x, event.y);
            })
            .onEnd(() => {
              'worklet';
              runOnJS(handleDragEnd)();
            }),
    [handleDragEnd, handleDragStart, handleDragUpdate],
  );

  const composedGesture = useMemo(
    () => Gesture.Exclusive(longPressDragGesture, tapGesture),
    [longPressDragGesture, tapGesture],
  );

  if (!fontMgr || pageLines.length === 0) {
    return <View style={pageStyle} />;
  }

  // @ai-start
  if (error) {
    return (
      <View style={[pageStyle, styles.loadStatus]}>
        <Text style={{color: textColor}}>
          {t('reader:mushaf.pageLoadFailed')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLoadAttempt(attempt => attempt + 1)}>
          <Text style={{color: textColor, textDecorationLine: 'underline'}}>
            {t('common:actions.tryAgain')}
          </Text>
        </Pressable>
        {showTajweed && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (useMushafSettingsStore.getState().showTajweed) {
                useMushafSettingsStore.getState().toggleTajweed();
              }
            }}>
            <Text style={{color: textColor, textDecorationLine: 'underline'}}>
              {t('reader:mushaf.turnOffTajweed')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!fontReady || renderEntries.length === 0) {
    return (
      <GestureDetector gesture={composedGesture}>
        <View style={[pageStyle, styles.loadStatus]}>
          <ActivityIndicator color={textColor} />
        </View>
      </GestureDetector>
    );
  }
  // @ai-end

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={pageStyle}>
        <Canvas
          style={{
            width: CONTENT_WIDTH,
            height:
              CONTENT_HEIGHT +
              canvasBottomOverflow(layoutMetrics?.fontSize ?? 0), // @ai
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
          {renderEntries.map(
            ({
              key,
              lineIndex,
              paragraph,
              strokeParagraph,
              boldOffset,
              yPos,
              width,
            }) => (
              <Group key={key}>
                {(lineBackgroundHighlights.get(lineIndex) ?? []).map(
                  (highlight, index) => {
                    const rects = paragraph.getRectsForRange(
                      highlight.start,
                      highlight.end + 1,
                    );
                    return rects.map((rect, rectIndex) => (
                      <RoundedRect
                        key={`${key}-bg-${index}-${rectIndex}`}
                        x={(CONTENT_WIDTH - width) / 2 + rect.x}
                        y={yPos + rect.y}
                        width={rect.width}
                        height={rect.height}
                        r={4}
                        color={highlight.color}
                      />
                    ));
                  },
                )}
                {strokeParagraph && (
                  <Paragraph
                    paragraph={strokeParagraph}
                    x={(CONTENT_WIDTH - width) / 2 + boldOffset}
                    y={yPos}
                    width={Math.ceil(width) + 2}
                  />
                )}
                <Paragraph
                  paragraph={paragraph}
                  x={(CONTENT_WIDTH - width) / 2}
                  y={yPos}
                  width={Math.ceil(width) + 2}
                />
              </Group>
            ),
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  // @ai-start
  loadStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  // @ai-end
});

export default QCFPage;
