import React, {
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  useState, // @ai
  useSyncExternalStore,
  forwardRef,
} from 'react';
import {FlatList} from 'react-native'; // @ai
import {Skia} from '@shopify/react-native-skia';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useFirstContent} from '@/hooks/useFirstContent'; // @ai
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {verticalScale} from '@/utils/scale';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useTheme} from '@/hooks/useTheme';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {
  digitalKhattDataService,
  getRewayahFontFamily,
} from '@/services/mushaf/DigitalKhattDataService';
import {parseAnchorKey} from '@/services/mushaf/RewayahVerseUnits'; // @ai
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {getPageTextIdentity} from './pageOverlays'; // @ai
// @ai-start
import {
  type MushafLayoutMetrics,
  VERTICAL_READER_VIEWABILITY,
} from '../constants';
// @ai-end
// @ai-start
import MushafPageContent from './MushafPageContent';
import ContinuousQCFPage from './ContinuousQCFPage';
import {useDrawsQCF} from '../qcf/useDrawsQCF';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {buildPageOffsets, pageItemLayout} from './continuousPageOffsets';
import {buildRenderConstants} from './continuousRenderConstants';
// @ai-end

const TOTAL_PAGES = 604;
const pages = Array.from({length: TOTAL_PAGES}, (_, i) => i + 1);

// Public handle (same interface as ContinuousListView)
export interface ContinuousMushafViewHandle {
  scrollToPage: (page: number, animated?: boolean) => void;
  scrollToSurah: (surahId: number, animated?: boolean) => void;
  scrollToVerse: (verseKey: string, animated?: boolean) => void;
}

interface ContinuousMushafViewProps {
  textColor: string;
  dividerColor: string;
  onTap?: () => void;
  initialPage: number;
  onCurrentPageChange?: (page: number) => void;
  /** Live layout metrics from `useMushafLayout()`. Threaded through so the
   *  continuous view responds to iPad width caps + rotation. */
  metrics: MushafLayoutMetrics;
  /** Whether a tap on the status bar scrolls back to page 1. Default on. @ai */
  scrollsToTop?: boolean; // @ai
  onFirstContent?: () => void; // @ai
}

const ContinuousMushafView = forwardRef<
  ContinuousMushafViewHandle,
  ContinuousMushafViewProps
>(
  (
    {
      textColor,
      dividerColor,
      onTap,
      initialPage,
      onCurrentPageChange,
      metrics,
      scrollsToTop = true, // @ai
      onFirstContent, // @ai
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const {theme} = useTheme();
    const listRef = useRef<FlatList<number>>(null); // @ai
    const render = useMemo(() => buildRenderConstants(metrics), [metrics]);
    const {lineWidth} = render;

    // Subscribe to preloaded fontMgr; no useFonts fallback that races
    // at first-mount.
    const fontMgr = useMushafFontMgr();

    // @ai-start
    // The list's first content size comes when the pages it renders first (the
    // page asked for and the next) have their layout, and VirtualizedList
    // scrolls to initialScrollIndex just before it passes that size on: the
    // page asked for is on screen. The list mounts after the fonts (below), so
    // the page has its text by then.
    const [listLaidOut, setListLaidOut] = useState(false);
    const handleContentSizeChange = useCallback(() => setListLaidOut(true), []);
    useFirstContent(listLaidOut, onFirstContent);
    // @ai-end

    // Surah header fonts (computed once from quranCommon typeface).
    // `fontMgr` dep mirrors the SkiaPage memo: when the preload completes
    // after this view mounted, the subscription re-renders but `lineWidth`
    // hasn't changed, so without `fontMgr` in deps the memo would stay on
    // its cached null-divider snapshot.
    const surahHeaderFonts = useMemo(() => {
      const qcTypeface = mushafPreloadService.quranCommonTypeface;
      if (!qcTypeface) return {dividerFont: null, nameFontSize: 0};
      const refFont = Skia.Font(qcTypeface, 100);
      const ids = refFont.getGlyphIDs('\uE000');
      const widths = refFont.getGlyphWidths(ids);
      const measuredW = widths[0] || 1;
      const scaledSize = (lineWidth / measuredW) * 100;
      return {
        dividerFont: Skia.Font(qcTypeface, scaledSize),
        nameFontSize: scaledSize * 0.4,
      };
    }, [lineWidth, fontMgr]);

    // Settings subscriptions
    const drawsQCF = useDrawsQCF(); // @ai — Mushaf 1440's glyphs (Hafs)
    const showTajweed = useMushafSettingsStore(s => s.showTajweed);
    const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
    const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
    const showAllahNameHighlight = useMushafSettingsStore(
      s => s.showAllahNameHighlight,
    );
    const allahNameHighlightColorSetting = useMushafSettingsStore(
      s => s.allahNameHighlightColor,
    );
    const rewayah = useMushafSettingsStore(s => s.rewayah);
    const showRewayahDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
    const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
    // @ai-start
    // Identity of the text drawn (see getPageTextIdentity), passed to every
    // page so mounted pages recompute their char-offset overlays when the DK
    // words change (rewayah switch, data reload). Side-cache loads for other
    // rewayat (the player) do not change it, so they re-render no page.
    const textIdentity = useSyncExternalStore(
      digitalKhattDataService.subscribeCacheChanges,
      getPageTextIdentity,
    );
    // @ai-end

    // @ai-start
    // Every page's height is known before it renders (its line count times
    // the line height), so the list is told where each page is instead of
    // estimating it: an estimate put the first scroll pages past the one asked
    // for. The DK lines are read again after a data reload (textIdentity).
    const contentTop = insets.top + verticalScale(60);
    const pageOffsets = useMemo(
      () =>
        buildPageOffsets(
          TOTAL_PAGES,
          page =>
            drawsQCF
              ? qcfDataService.getLineCount(page)
              : digitalKhattDataService.getPageLines(page).length,
          render.baseLineHeight,
          contentTop,
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [drawsQCF, render.baseLineHeight, contentTop, textIdentity],
    );
    const getItemLayout = useCallback(
      (_: ArrayLike<number> | null | undefined, index: number) =>
        pageItemLayout(pageOffsets, index),
      [pageOffsets],
    );
    // @ai-end

    const fontFamily =
      getRewayahFontFamily(
        rewayah as Parameters<typeof getRewayahFontFamily>[0],
      ) ??
      (mushafRenderer === 'dk_indopak'
        ? 'DigitalKhattIndoPak'
        : mushafRenderer === 'dk_v1'
          ? 'DigitalKhattV1'
          : 'DigitalKhattV2');
    const allahNameHighlightColor = useMemo(
      () =>
        getAllahNameHighlightColorHex(
          allahNameHighlightColorSetting,
          theme.isDarkMode,
        ),
      [allahNameHighlightColorSetting, theme.isDarkMode],
    );

    // Navigation
    const surahStartPages = digitalKhattDataService.initialized
      ? digitalKhattDataService.getSurahStartPages()
      : {};

    useImperativeHandle(ref, () => ({
      scrollToPage: (page: number, animated = false) => {
        listRef.current?.scrollToIndex({index: page - 1, animated});
      },
      scrollToSurah: (surahId: number, animated = false) => {
        const targetPage = surahStartPages[surahId];
        if (targetPage) {
          listRef.current?.scrollToIndex({
            index: targetPage - 1,
            animated,
          });
        }
      },
      scrollToVerse: (verseKey: string, animated = false) => {
        // @ai — a stored anchor 'S:A:W' (a verse unit's first slot) is on
        // the page of its Hafs verse's start (verse-units invariant 8).
        const loc =
          verseKey.split(':').length === 3 ? parseAnchorKey(verseKey) : null;
        // @ai The page of the Hafs verse's first word, with no word read.
        // scrollToVerse callers (playback page turns, search) pass Hafs keys.
        const page = digitalKhattDataService.getPageForVerse(
          loc ? `${loc.surah}:${loc.ayah}` : verseKey,
        );
        if (page) {
          listRef.current?.scrollToIndex({index: page - 1, animated});
        }
      },
    }));

    // Load annotations for visible surahs
    const loadAnnotationsForSurah = useVerseAnnotationsStore(
      s => s.loadAnnotationsForSurah,
    );
    const pageToSurah = digitalKhattDataService.initialized
      ? digitalKhattDataService.getPageToSurah()
      : {};

    const onViewableItemsChanged = useCallback(
      ({viewableItems}: {viewableItems: Array<{item: number}>}) => {
        if (viewableItems.length === 0) return;
        const page = viewableItems[0].item;
        onCurrentPageChange?.(page);
        const surahId = pageToSurah[page];
        if (surahId) loadAnnotationsForSurah(surahId);
      },
      [onCurrentPageChange, pageToSurah, loadAnnotationsForSurah],
    );

    const renderItem = useCallback(
      ({item}: {item: number}) => {
        if (!fontMgr) return null;
        // @ai-start
        // The page is as tall as its layout entry says: the list and the
        // page read the one value.
        const pageHeight = pageItemLayout(pageOffsets, item - 1).length;
        if (drawsQCF) {
          return (
            <ContinuousQCFPage
              pageNumber={item}
              textColor={textColor}
              dividerColor={dividerColor}
              onTap={onTap}
              render={render}
              pageHeight={pageHeight}
            />
          );
        }
        // @ai-end
        return (
          <MushafPageContent
            pageNumber={item}
            fontMgr={fontMgr}
            textColor={textColor}
            dividerColor={dividerColor}
            showTajweed={showTajweed}
            indexedTajweedData={indexedTajweedData}
            fontFamily={fontFamily}
            arabicTextWeight={arabicTextWeight}
            showAllahNameHighlight={showAllahNameHighlight}
            allahNameHighlightColor={allahNameHighlightColor}
            rewayah={rewayah}
            showRewayahDiffs={showRewayahDiffs}
            textIdentity={textIdentity} // @ai
            dividerFont={surahHeaderFonts.dividerFont}
            nameFontSize={surahHeaderFonts.nameFontSize}
            onTap={onTap}
            render={render}
            pageHeight={pageHeight} // @ai
          />
        );
      },
      [
        fontMgr,
        drawsQCF, // @ai
        textColor,
        dividerColor,
        showTajweed,
        indexedTajweedData,
        fontFamily,
        arabicTextWeight,
        showAllahNameHighlight,
        allahNameHighlightColor,
        rewayah,
        showRewayahDiffs,
        textIdentity, // @ai
        surahHeaderFonts,
        onTap,
        render,
        pageOffsets, // @ai
      ],
    );

    const keyExtractor = useCallback((item: number) => `page-${item}`, []);

    // @ai-start
    // The one font wait: the reader can open before the fonts (they finish
    // after the data), and the list mounts once they are there. Its first
    // layout then has the text of the page it opens on, and no page is drawn
    // blank first.
    if (!fontMgr) return null;
    // @ai-end

    return (
      <FlatList
        ref={listRef} // @ai
        data={pages}
        renderItem={renderItem}
        extraData={`${drawsQCF}-${showTajweed}-${arabicTextWeight}-${showAllahNameHighlight}-${allahNameHighlightColor}-${rewayah}-${showRewayahDiffs}-${textIdentity}`} // @ai
        keyExtractor={keyExtractor}
        initialScrollIndex={initialPage - 1}
        // @ai-start
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        // @ai-end
        contentContainerStyle={{
          paddingTop: contentTop, // @ai
          paddingBottom: insets.bottom + verticalScale(80),
        }}
        showsVerticalScrollIndicator={false}
        scrollsToTop={scrollsToTop} // @ai
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VERTICAL_READER_VIEWABILITY} // @ai
        onContentSizeChange={handleContentSizeChange} // @ai
      />
    );
  },
);
ContinuousMushafView.displayName = 'ContinuousMushafView';

export default React.memo(ContinuousMushafView);
