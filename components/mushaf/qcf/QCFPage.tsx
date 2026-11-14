// @ai-generated
// Mushaf 1440: a page of the KFGQPC 1441H Madinah print, drawn glyph by
// glyph from its QCF V4 page font.
//
//  - Layout (QCFPageLayout.ts): the print's own line breaks; full lines are
//    flush with both margins, the print's short lines are centred.
//  - Fonts (QCFFontLoader.ts): tajweed colours (day / night palette) or
//    plain outlines in the reading theme's text colour. A word drawn in its
//    own colour (a mistake, Allah's name) uses the plain outlines.
//  - Everything painted over the text comes from the overlays the
//    DigitalKhatt pages share (verse highlight layers, recitation
//    follow-along, hidden text, mistakes, verse-unit selection, the mistake
//    sheet), mapped onto these words by word id (qcfDkWordMap.ts). The page
//    is drawn only while the DigitalKhatt data service serves Hafs.
//
// Surah titles render via SkiaSurahHeader and basmala lines with the
// DigitalKhatt basmala (the printed surah-opening basmala), as on the
// DigitalKhatt pages.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  Canvas,
  DashPathEffect,
  Glyphs,
  Group,
  Line,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  vec,
  type SkFont,
  type SkParagraph,
  type SkTextStyle,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-worklets';
import Color from 'color';
import {SheetManager} from 'react-native-actions-sheet';
import {useTranslation} from 'react-i18next';
import {
  BASMALLAH_TEXT,
  digitalKhattDataService,
} from '@/services/mushaf/DigitalKhattDataService';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {
  layoutQCFPage,
  qcfWordAt,
  QCF_DEFAULT_LINE_EM,
  QCF_INK_ABOVE_EM,
  QCF_INK_BELOW_EM,
  QCF_LINE_WIDTH_RATIO,
  type QCFPageLayout,
} from '@/services/mushaf/QCFPageLayout';
import {
  buildQCFDkPageMap,
  mapDkCharColorsToQCFWords,
  mapDkHighlightsToQCF,
} from '@/services/mushaf/qcfDkWordMap';
import {
  getQCFFontVariant,
  qcfFontLoader,
  type QCFFontVariant,
} from '@/services/mushaf/QCFFontLoader';
import {
  FONTSIZE,
  PAGE_WIDTH,
  quranTextService,
} from '@/services/mushaf/QuranTextService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {usePlaybackBasmalaSurah} from '@/store/mushafPlayerStore';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {
  BOOKMARK_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
} from '@/types/verse-annotations';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {
  createTextStrokePaint,
  getArabicTextWeightStrokeWidth,
} from '@/utils/skiaTextWeight';
import {disposeAfterPendingDraws} from '@/utils/skiaDeferredDispose';
import SkiaSurahHeader from '../skia/SkiaSurahHeader';
import {
  computeLineAllahNameColorMaps,
  computePageDiffBackgrounds,
  getPageTextIdentity,
} from '../skia/pageOverlays';
import {
  basmalaPlaybackLines,
  computeUnitPageHighlightLayers,
  type LineHighlightMap,
} from '../skia/verseHighlightLayers';
import {usePlaybackBand} from '../skia/playbackBand';
import {useRecitationLineHighlights} from '../skia/useRecitationLineHighlights';
import {useRecitationHiddenText} from '../skia/useRecitationHiddenText';
import {useRecitationMarkColors} from '../skia/useRecitationMarkColors';
import {markAtChar} from '../skia/recitationTap';
import {
  useVerseUnitDragSelect,
  type LineCharHit,
} from '../skia/verseUnitDragSelect';
import {calculateLineYPositions} from '../constants';
import {
  CARET_HALF_WIDTH,
  CARET_HEIGHT,
  lineGlyphRuns,
  lineHighlightShapes,
  measureWordGlyphs,
  wordAdvanceEm,
  type WordGlyphs,
} from './qcfDrawing';

/** Where a page draws: its view, and the text block inside it. */
export interface QCFPageFrame {
  /** Size of the page's view. */
  width: number;
  height: number;
  /** The text block's place and size in the page's view. */
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
  /** Height of a line of the page's grid. */
  lineHeight: number;
  /**
   * Centre the lines of the two opening pages vertically (the paged mushaf,
   * as its DigitalKhatt pages do); the vertical scroll stacks them from the
   * top.
   */
  centerOpeningPages: boolean;
}

interface QCFPageProps {
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  frame: QCFPageFrame;
  onReady?: () => void;
  onTap?: () => void;
}

const DK_FONT_FAMILY = 'DigitalKhattV2';
const EMPTY_HIGHLIGHTS: LineHighlightMap = new Map();
const NO_WORD_COLORS: ReadonlyMap<number, string> = new Map();
// Ink reaches past a line's slot (measured over the 604 V4 page fonts: up to
// 1.58 em above and 1.01 em below the baseline); the canvas keeps room for
// it above the first line and below the last.
const INK_TOP_EM = 1.6;
const INK_BOTTOM_EM = 1.05;
// How far below its slot's middle a line's baseline sits (qcfBaseline).
const BASELINE_EM = (QCF_INK_ABOVE_EM - QCF_INK_BELOW_EM) / 2;

function isTransparent(color: string): boolean {
  try {
    return Color(color).alpha() === 0;
  } catch {
    return false;
  }
}

interface LoadedFonts {
  page: number;
  variant: QCFFontVariant;
  primary: SkTypeface;
  /** Plain outlines for words in their own colour (null until needed). */
  mono: SkTypeface | null;
}

const QCFPage: React.FC<QCFPageProps> = ({
  pageNumber,
  textColor,
  dividerColor,
  frame,
  onReady,
  onTap,
}) => {
  const {
    width,
    height,
    contentLeft,
    contentTop,
    contentWidth,
    contentHeight,
    lineHeight,
    centerOpeningPages,
  } = frame;
  const {theme} = useTheme();
  const isDarkMode = theme.isDarkMode;
  const {t} = useTranslation(['reader', 'common']);
  const fontMgr = useMushafFontMgr();

  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  // The page's own text colour decides the palette: reading themes can
  // differ from the app theme.
  const variant = getQCFFontVariant(showTajweed, Color(textColor).isLight());

  // ── Page model and its DigitalKhatt counterpart ─────────────────────────
  const page = useMemo(() => qcfDataService.getPage(pageNumber), [pageNumber]);
  // Identity of the DigitalKhatt text the overlays are computed on.
  const textIdentity = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    getPageTextIdentity,
  );
  const verseUnitsVersion = useSyncExternalStore(
    rewayahVerseUnitsService.subscribe,
    rewayahVerseUnitsService.getVersion,
  );
  const dkLines = useMemo(
    () => digitalKhattDataService.getPageLines(pageNumber),
    // textIdentity: re-read after a data reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumber, textIdentity],
  );
  const wordMap = useMemo(
    () =>
      buildQCFDkPageMap(page, dkLines, digitalKhattDataService, line =>
        digitalKhattDataService.getBasmalaSurah(line),
      ),
    // textIdentity: slot texts follow the words cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, dkLines, textIdentity],
  );

  // ── Fonts ────────────────────────────────────────────────────────────────
  const [fonts, setFonts] = useState<LoadedFonts | null>(() => {
    const primary = qcfFontLoader.peekTypeface(pageNumber, variant);
    return primary
      ? {
          page: pageNumber,
          variant,
          primary,
          mono:
            variant === 'v4-mono'
              ? primary
              : qcfFontLoader.peekTypeface(pageNumber, 'v4-mono'),
        }
      : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Never draw the fonts of another page or variant. A variant already in
  // memory (a revisited page, a tajweed or theme switch back) draws at once.
  const loaded =
    fonts && fonts.page === pageNumber && fonts.variant === variant
      ? fonts
      : null;
  const cachedPrimary = loaded
    ? null
    : qcfFontLoader.peekTypeface(pageNumber, variant);
  const current = useMemo<LoadedFonts | null>(
    () =>
      loaded ??
      (cachedPrimary
        ? {
            page: pageNumber,
            variant,
            primary: cachedPrimary,
            mono:
              variant === 'v4-mono'
                ? cachedPrimary
                : qcfFontLoader.peekTypeface(pageNumber, 'v4-mono'),
          }
        : null),
    [loaded, cachedPrimary, pageNumber, variant],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const ready = qcfFontLoader.getTypeface(pageNumber, variant);
    if (ready) {
      setFonts(previous =>
        previous?.page === pageNumber &&
        previous.variant === variant &&
        previous.primary === ready
          ? previous
          : {
              page: pageNumber,
              variant,
              primary: ready,
              mono:
                variant === 'v4-mono'
                  ? ready
                  : qcfFontLoader.getTypeface(pageNumber, 'v4-mono'),
            },
      );
    }
    (async () => {
      try {
        const primary = await qcfFontLoader.ensure(pageNumber, variant);
        if (cancelled) return;
        setFonts(previous =>
          previous?.page === pageNumber &&
          previous.variant === variant &&
          previous.primary === primary
            ? previous
            : {
                page: pageNumber,
                variant,
                primary,
                mono: variant === 'v4-mono' ? primary : null,
              },
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'QCF font load failed');
        }
        return;
      }
      if (cancelled) return;
      qcfFontLoader.prefetch(
        [
          pageNumber + 1,
          pageNumber - 1,
          pageNumber + 2,
          pageNumber - 2,
          pageNumber + 3,
          pageNumber - 3,
        ],
        variant,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNumber, variant, loadAttempt]);

  // ── Layout ───────────────────────────────────────────────────────────────
  const lineTops = useMemo(
    () =>
      centerOpeningPages
        ? calculateLineYPositions(
            page.lines.map(line => ({line_type: line.kind})),
            pageNumber,
            contentHeight,
            lineHeight,
          )
        : page.lines.map((_, index) => index * lineHeight),
    [centerOpeningPages, page, pageNumber, contentHeight, lineHeight],
  );

  // Every variant of a page font has the same glyphs and advances.
  const primaryTypeface = current?.primary ?? null;
  const wordGlyphs = useMemo<Map<number, WordGlyphs> | null>(() => {
    if (!primaryTypeface) return null;
    const unit = Skia.Font(primaryTypeface, 1000);
    unit.setLinearMetrics(true);
    return measureWordGlyphs(page, {
      glyphIds: text => primaryTypeface.getGlyphIDs(text),
      advancesEm: ids => unit.getGlyphWidths(ids).map(w => w / 1000),
    });
  }, [primaryTypeface, page]);

  const layout = useMemo<QCFPageLayout | null>(() => {
    if (!wordGlyphs) return null;
    return layoutQCFPage(page, word => wordAdvanceEm(wordGlyphs.get(word.id)), {
      contentWidth,
      lineTops,
      lineHeight,
    });
  }, [wordGlyphs, page, contentWidth, lineTops, lineHeight]);

  // Room the canvas keeps for ink above the first and below the last line
  // (a baseline sits BASELINE_EM below its slot's middle), from the size a
  // page draws at: every page's is within a few percent of this estimate.
  const estimatedFontSize =
    ((contentWidth * QCF_LINE_WIDTH_RATIO) / QCF_DEFAULT_LINE_EM) * 1.05;
  const overflowTop = Math.ceil(
    Math.max(
      0,
      (INK_TOP_EM - BASELINE_EM) * estimatedFontSize - lineHeight / 2,
    ),
  );
  const overflowBottom = Math.ceil(
    Math.max(
      0,
      (INK_BOTTOM_EM + BASELINE_EM) * estimatedFontSize - lineHeight / 2,
    ),
  );

  // ── Overlays (shared with the DigitalKhatt pages) ───────────────────────
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(allahNameHighlightColorSetting, isDarkMode),
    [allahNameHighlightColorSetting, isDarkMode],
  );
  const selectedVerseKeys = useMushafVerseSelectionStore(
    s => s.selectedVerseKeys,
  );
  const selectedRewayah = useMushafVerseSelectionStore(s => s.selectedRewayah);
  const selectedPageNumber = useMushafVerseSelectionStore(
    s => s.selectedPageNumber,
  );
  const persistentHighlights = useVerseAnnotationsStore(s => s.highlights);
  const bookmarkedVerseKeys = useVerseAnnotationsStore(
    s => s.bookmarkedVerseKeys,
  );
  const bookmarkRows = useVerseAnnotationsStore(s => s.bookmarkRows);
  const highlightRows = useVerseAnnotationsStore(s => s.highlightRows);
  const playbackBand = usePlaybackBand();
  const basmalaSurah = usePlaybackBasmalaSurah();

  const playbackColor = useMemo(
    () =>
      Color(textColor)
        .alpha(isDarkMode ? 0.1 : 0.12)
        .toString(),
    [textColor, isDarkMode],
  );
  const selectionColor = useMemo(
    () =>
      Color(textColor)
        .alpha(isDarkMode ? 0.15 : 0.18)
        .toString(),
    [textColor, isDarkMode],
  );

  const baseHighlights = useMemo<LineHighlightMap>(
    () =>
      computeUnitPageHighlightLayers({
        pageNumber,
        shown: mushafVerseMapService.getShownVerseUnits(),
        segments: mushafVerseMapService,
        // Mushaf 1440 draws Hafs: there are no differences to paint.
        diffHighlights: computePageDiffBackgrounds(pageNumber, false),
        themes: showThemes
          ? {
              color: Color(textColor).alpha(0.12).toString(),
              themeIndexOfHafsVerse: hafsKey =>
                themeDataService.getThemeForVerse(hafsKey)?.themeIndex,
            }
          : null,
        playbackBasmalaLines: basmalaPlaybackLines(
          dkLines,
          basmalaSurah,
          line => digitalKhattDataService.getBasmalaSurah(line),
          lineIndex =>
            quranTextService.getLineText(pageNumber, lineIndex).length,
        ),
        sources: {
          bookmarkedVerseKeys,
          persistentHighlights,
          bookmarkRows,
          highlightRows,
          playback: playbackBand,
          selection:
            selectedVerseKeys.length > 0 && selectedPageNumber === pageNumber
              ? {rewayah: selectedRewayah, verseKeys: selectedVerseKeys}
              : null,
        },
        bookmarkColor: BOOKMARK_HIGHLIGHT_COLOR,
        highlightColors: HIGHLIGHT_COLORS,
        playbackColor,
        selectionColor,
      }) ?? EMPTY_HIGHLIGHTS,
    // textIdentity / verseUnitsVersion: verse segments follow the text and
    // the shown verse units (singleton services, not read directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pageNumber,
      dkLines,
      showThemes,
      textColor,
      basmalaSurah,
      bookmarkedVerseKeys,
      persistentHighlights,
      bookmarkRows,
      highlightRows,
      playbackBand,
      selectedVerseKeys,
      selectedRewayah,
      selectedPageNumber,
      playbackColor,
      selectionColor,
      textIdentity,
      verseUnitsVersion,
    ],
  );

  // Recitation follow-along: recited ayat, the word being recited, mistake
  // underlines, added-word carets, skipped / look-alike ayah bands.
  const dkHighlights = useRecitationLineHighlights(
    pageNumber,
    dkLines,
    baseHighlights,
    textColor,
    isDarkMode,
  );
  const lineHighlights = useMemo(
    () => mapDkHighlightsToQCF(dkHighlights, wordMap),
    [dkHighlights, wordMap],
  );

  // Word colours: Allah's name, hidden words while memorising, mistakes.
  const allahNameMaps = useMemo(
    () =>
      computeLineAllahNameColorMaps(
        pageNumber,
        dkLines.length,
        allahNameHighlightColor,
        showAllahNameHighlight,
      ),
    // textIdentity: maps index into the DigitalKhatt line text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pageNumber,
      dkLines,
      allahNameHighlightColor,
      showAllahNameHighlight,
      textIdentity,
    ],
  );
  const dkCharColors = useRecitationMarkColors(
    dkLines,
    useRecitationHiddenText(dkLines, allahNameMaps),
    isDarkMode,
  );
  const wordColors = useMemo(
    () =>
      dkCharColors
        ? mapDkCharColorsToQCFWords(
            dkCharColors,
            dkLines,
            digitalKhattDataService,
          )
        : NO_WORD_COLORS,
    [dkCharColors, dkLines],
  );
  const needsMono =
    variant !== 'v4-mono' &&
    [...wordColors.values()].some(color => !isTransparent(color));

  // Tajweed colours come from the font: a word in its own colour is drawn
  // from the plain outlines, loaded when a word first needs them.
  useEffect(() => {
    if (!needsMono || !current || current.mono) return;
    let cancelled = false;
    qcfFontLoader
      .ensure(pageNumber, 'v4-mono')
      .then(mono => {
        if (cancelled) return;
        setFonts(previous => {
          const base =
            previous &&
            previous.page === pageNumber &&
            previous.variant === variant
              ? previous
              : current;
          return base ? {...base, mono} : previous;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsMono, current, pageNumber, variant]);

  // ── Drawing data ─────────────────────────────────────────────────────────
  const strokeWidth = layout
    ? getArabicTextWeightStrokeWidth(arabicTextWeight, layout.fontSize)
    : 0;

  const skFonts = useMemo(() => {
    const cache = new Map<string, SkFont>();
    return (typeface: SkTypeface, size: number): SkFont => {
      const key = `${typeface === current?.primary ? 'p' : 'm'}:${size}`;
      let font = cache.get(key);
      if (!font) {
        font = Skia.Font(typeface, size);
        font.setSubpixel(true);
        font.setLinearMetrics(true);
        cache.set(key, font);
      }
      return font;
    };
  }, [current]);

  const drawnLines = useMemo(() => {
    if (!layout || !wordGlyphs || !current) return [];
    return layout.lines.map(line => ({
      line,
      runs: lineGlyphRuns(line, wordGlyphs, wordColors, isTransparent),
      shapes: lineHighlightShapes(
        line,
        lineHighlights.get(line.lineIndex),
        layout.lineLeft,
        layout.lineWidth,
        contentWidth,
      ),
    }));
  }, [layout, wordGlyphs, current, wordColors, lineHighlights, contentWidth]);

  // Surah title ornament, sized to the line width as on DigitalKhatt pages.
  const lineWidth = contentWidth * QCF_LINE_WIDTH_RATIO;
  const lineLeft = (contentWidth - lineWidth) / 2;
  const surahHeaderFonts = useMemo(() => {
    const qcTypeface = mushafPreloadService.quranCommonTypeface;
    if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
    const refFont = Skia.Font(qcTypeface, 100);
    // The divider glyph, written as an escape so no editor can strip the
    // invisible private-use character.
    const ids = refFont.getGlyphIDs('\uE000');
    const measuredW = refFont.getGlyphWidths(ids)[0] || 1;
    const scaledSize = (lineWidth / measuredW) * 100;
    return {
      dividerFont: Skia.Font(qcTypeface, scaledSize),
      nameFontSize: scaledSize * 0.4,
    };
    // fontMgr: rebuild once the preload finishes after this page mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineWidth, fontMgr]);

  // Basmala lines: the DigitalKhatt surah-opening basmala, with the same
  // colours its DigitalKhatt line gets (Allah's name).
  const basmalaFontSize = (contentWidth / PAGE_WIDTH) * FONTSIZE * 0.9;
  const basmalas = useMemo(() => {
    if (!fontMgr) return [];
    const out: Array<{
      lineIndex: number;
      paragraph: SkParagraph;
      stroke: SkParagraph | null;
    }> = [];
    const basmalaStroke = getArabicTextWeightStrokeWidth(
      arabicTextWeight,
      basmalaFontSize,
    );
    page.lines.forEach((line, lineIndex) => {
      if (line.kind !== 'basmallah') return;
      const dkLineIndex = wordMap.dkBasmalaLineOf(lineIndex);
      const charColors =
        dkLineIndex !== undefined ? dkCharColors?.[dkLineIndex] : null;
      const build = (withStroke: boolean) => {
        const builder = Skia.ParagraphBuilder.Make(
          {
            textDirection: TextDirection.RTL,
            textAlign: TextAlign.Center,
            textHeightBehavior: TextHeightBehavior.DisableAll,
          },
          fontMgr,
        );
        const style = (color: string): SkTextStyle => ({
          color: Skia.Color(color),
          fontFamilies: [DK_FONT_FAMILY],
          fontSize: basmalaFontSize,
          fontFeatures: [{name: 'basm', value: 1}],
        });
        const push = (color: string) => {
          const paint = withStroke
            ? createTextStrokePaint(Skia.Color(color), basmalaStroke)
            : undefined;
          if (paint) builder.pushStyle(style(color), paint);
          else builder.pushStyle(style(color));
        };
        push(textColor);
        for (let i = 0; i < BASMALLAH_TEXT.length; i++) {
          const color = charColors?.get(i);
          if (color) push(color);
          builder.addText(BASMALLAH_TEXT[i]);
          if (color) builder.pop();
        }
        builder.pop();
        const paragraph = builder.build();
        paragraph.layout(lineWidth);
        return paragraph;
      };
      out.push({
        lineIndex,
        paragraph: build(false),
        stroke: basmalaStroke > 0 ? build(true) : null,
      });
    });
    return out;
  }, [
    fontMgr,
    page,
    wordMap,
    dkCharColors,
    textColor,
    arabicTextWeight,
    basmalaFontSize,
    lineWidth,
  ]);
  useEffect(
    () => () =>
      disposeAfterPendingDraws(basmalas.flatMap(b => [b.paragraph, b.stroke])),
    [basmalas],
  );

  // ── Ready, taps, long-press selection ───────────────────────────────────
  useEffect(() => {
    if (error || layout) onReady?.();
  }, [layout, error, onReady]);

  const charAtPoint = useCallback(
    (x: number, y: number): LineCharHit | null => {
      if (!layout) return null;
      const hit = qcfWordAt(layout, x - contentLeft, y - contentTop);
      if (!hit) return null;
      const slot = wordMap.slotOf(hit.word.id);
      return slot
        ? {lineIndex: slot.lineIndex, charIndex: slot.span.start}
        : null;
    },
    [layout, wordMap, contentLeft, contentTop],
  );

  const {
    onDragStart: handleDragStart,
    onDragUpdate: handleDragUpdate,
    onDragEnd: handleDragEnd,
  } = useVerseUnitDragSelect(pageNumber, charAtPoint);

  // A tap on a word marked while reciting opens it; any other tap is the
  // page's own.
  const handleTap = useCallback(
    (x: number, y: number) => {
      const {marks} = useRecitationTrackingStore.getState();
      if (marks.length > 0) {
        const hit = charAtPoint(x, y);
        const line = hit ? dkLines[hit.lineIndex] : undefined;
        const mark =
          hit && line ? markAtChar(line, hit.charIndex, marks) : null;
        if (mark) {
          SheetManager.show('recitation-mistake', {payload: {mark}}).catch(
            () => undefined,
          );
          return;
        }
      }
      onTap?.();
    },
    [charAtPoint, dkLines, onTap],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(event => {
        'worklet';
        runOnJS(handleTap)(event.x, event.y);
      }),
    [handleTap],
  );

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
    [handleDragStart, handleDragUpdate, handleDragEnd],
  );

  const composedGesture = useMemo(
    () => Gesture.Exclusive(longPressDragGesture, tapGesture),
    [longPressDragGesture, tapGesture],
  );

  const pageStyle = {width, height};

  // Tajweed on or off draws from the same downloaded font, so a retry is
  // the only way forward.
  if (error) {
    return (
      <View style={[pageStyle, styles.loadStatus]}>
        <Text style={{color: textColor}}>
          {t('reader:mushaf.pageLoadFailed')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLoadAttempt(attempt => attempt + 1)}>
          <Text style={[styles.action, {color: textColor}]}>
            {t('common:actions.tryAgain')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!layout || !current || page.lines.length === 0) {
    return (
      <GestureDetector gesture={composedGesture}>
        <View style={[pageStyle, styles.loadStatus]}>
          <ActivityIndicator color={textColor} />
        </View>
      </GestureDetector>
    );
  }

  const {dividerFont} = surahHeaderFonts;
  const dotWidth = Math.max(1.5, layout.fontSize * 0.07);
  const boldOffset = strokeWidth * 0.55;
  const primaryIsColor = variant !== 'v4-mono';

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={[pageStyle, styles.page]}>
        <Canvas
          style={{
            position: 'absolute',
            left: contentLeft,
            top: contentTop - overflowTop,
            width: contentWidth,
            height: contentHeight + overflowTop + overflowBottom,
          }}>
          <Group transform={[{translateY: overflowTop}]}>
            {dividerFont &&
              fontMgr &&
              layout.lines.map(placed =>
                placed.line.kind === 'surah_name' &&
                placed.line.surahNumber !== null ? (
                  <SkiaSurahHeader
                    key={`sh-${placed.lineIndex}`}
                    dividerFont={dividerFont}
                    fontMgr={fontMgr}
                    nameFontSize={surahHeaderFonts.nameFontSize}
                    surahNumber={placed.line.surahNumber}
                    yPos={placed.top}
                    pageWidth={lineWidth}
                    xOffset={lineLeft}
                    dividerColor={dividerColor}
                    nameColor={textColor}
                    lineHeight={placed.height}
                  />
                ) : null,
              )}
            {basmalas.map(({lineIndex, paragraph, stroke}) => {
              const placed = layout.lines[lineIndex];
              const y =
                placed.top +
                Math.max(0, (placed.height - paragraph.getHeight()) / 2);
              const lit = lineHighlights.get(lineIndex)?.wholeLine ?? [];
              return (
                <Group key={`bs-${lineIndex}`}>
                  {lit.map((color, i) => (
                    <RoundedRect
                      key={i}
                      x={lineLeft}
                      y={placed.top + placed.height * 0.04}
                      width={lineWidth}
                      height={placed.height * 0.92}
                      r={4}
                      color={color}
                    />
                  ))}
                  {stroke && (
                    <Paragraph
                      paragraph={stroke}
                      x={lineLeft}
                      y={y}
                      width={lineWidth}
                    />
                  )}
                  <Paragraph
                    paragraph={paragraph}
                    x={lineLeft}
                    y={y}
                    width={lineWidth}
                  />
                </Group>
              );
            })}
            {drawnLines.map(({line, runs, shapes}) => (
              <Group key={`ln-${line.lineIndex}`}>
                {shapes.map((shape, i) =>
                  shape.style === 'band' ? (
                    <RoundedRect
                      key={`b${i}`}
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      r={4}
                      color={shape.color}
                    />
                  ) : null,
                )}
                {runs.map((run, i) => {
                  const ownColor = run.color !== null;
                  const typeface =
                    ownColor && current.mono ? current.mono : current.primary;
                  const font = skFonts(typeface, line.fontSize);
                  const color = run.color ?? textColor;
                  const isColorFont =
                    primaryIsColor && typeface === current.primary;
                  return (
                    <Group key={`g${i}`}>
                      {strokeWidth > 0 &&
                        (isColorFont ? (
                          <Glyphs
                            font={font}
                            glyphs={run.glyphs}
                            x={boldOffset}
                            y={0}
                            color={color}
                          />
                        ) : (
                          <Glyphs
                            font={font}
                            glyphs={run.glyphs}
                            x={0}
                            y={0}
                            color={color}
                            style="stroke"
                            strokeWidth={strokeWidth}
                            strokeJoin="round"
                            strokeCap="round"
                          />
                        ))}
                      <Glyphs
                        font={font}
                        glyphs={run.glyphs}
                        x={0}
                        y={0}
                        color={color}
                      />
                    </Group>
                  );
                })}
                {shapes.map((shape, i) => {
                  if (shape.style === 'caret') {
                    const half = line.fontSize * CARET_HALF_WIDTH;
                    const bottom = shape.y + shape.height;
                    const top = vec(
                      shape.x,
                      bottom - line.fontSize * CARET_HEIGHT,
                    );
                    return [-half, half].map(side => (
                      <Line
                        key={`c${i}${side}`}
                        p1={top}
                        p2={vec(shape.x + side, bottom)}
                        color={shape.color}
                        style="stroke"
                        strokeWidth={dotWidth}
                        strokeCap="round"
                      />
                    ));
                  }
                  if (shape.style !== 'underline') return null;
                  const y = shape.y + shape.height - dotWidth / 2;
                  return (
                    <Line
                      key={`u${i}`}
                      p1={vec(shape.x + dotWidth, y)}
                      p2={vec(shape.x + shape.width - dotWidth, y)}
                      color={shape.color}
                      style="stroke"
                      strokeWidth={dotWidth}
                      strokeCap="round">
                      <DashPathEffect intervals={[0.01, dotWidth * 2.2]} />
                    </Line>
                  );
                })}
              </Group>
            ))}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  // The canvas reaches past the page for the ink of its first and last line.
  page: {
    overflow: 'visible',
  },
  loadStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  action: {
    textDecorationLine: 'underline',
  },
});

export default React.memo(QCFPage);
