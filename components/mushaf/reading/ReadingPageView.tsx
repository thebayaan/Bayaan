import React, {useMemo, useCallback, useEffect, useRef} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {
  getDkFontFamily, // @ai
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {
  useMushafPlayerStore,
  usePlaybackBasmalaSurah, // @ai
  usePlaybackVerseKeys, // @ai
} from '@/store/mushafPlayerStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getReadingPageItems,
  type ReadingPageItem,
} from '@/utils/mushafPageVerses';
import {useEnhancedVersesVersion} from '@/utils/enhancedVersesVersion'; // @ai
import {VerseItem} from '@/components/player/v2/PlayerContent/QuranView/VerseItem';
import SurahDivider from '@/components/player/v2/PlayerContent/QuranView/SurahDivider';
import BasmalaHeader from '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader';
import {getTranslationName} from '@/utils/translationLookup';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import Color from 'color';
import PageEdgeDecoration, {
  EDGE_BORDER_RADIUS,
  EDGE_HORIZONTAL_INSET,
} from '../PageEdgeDecoration';
import {moderateScale} from '@/utils/scale';
import {
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  READING_COLUMN_MAX_WIDTH, // @ai
  getPageEdgeLayout,
  readingColumnPadding, // @ai
} from '../constants';
// @ai-start
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {shownVerseUnitsOf} from '@/services/mushaf/MushafVerseMapService';
import {isVerseUnitRow} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';
import {useFirstContent} from '@/hooks/useFirstContent';
import {playbackBandUnitKeys} from '../skia/verseHighlightLayers';
import {usePlaybackBand} from '../skia/playbackBand';
import {readingPageUnitItems, themeHafsKeyOfRow} from './mushafVerseUnitRows';
import {VerseUnitsPending} from './VerseUnitsPending';
import {useRecitedVerseKey} from '@/store/recitationTrackingStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {selectedRowKeys} from './selectedRowKeys';
import {appLayoutDirection} from '@/utils/rtl';

const NO_KEYS: readonly string[] = Object.freeze([]);
// @ai-end

// Metadata row sits just above PAGE_PADDING_TOP (behind the header panel)
const METADATA_OFFSET = 30;

interface ReadingPageViewProps {
  pageNumber: number;
  textColor: string;
  surahLabel: string;
  juzLabel: string;
  pageLabel: string;
  labelColor: string;
  borderColor: string;
  cardColor: string;
  bgColor: string;
  isBookLayout: boolean;
  onTap?: () => void;
  // @ai-start
  /**
   * The pager item's live size. Where it is wider than the reading column
   * (iPad, a phone in landscape) the text sits in a centred column.
   */
  pageSize: {width: number; height: number};
  onFirstContent?: () => void;
  // @ai-end
}

// @ai-start
const ReadingPageView: React.FC<ReadingPageViewProps> = ({
  pageNumber,
  textColor,
  surahLabel,
  juzLabel,
  pageLabel,
  labelColor,
  borderColor,
  cardColor,
  bgColor,
  isBookLayout,
  onTap,
  pageSize,
  onFirstContent,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const verseOffsetsRef = useRef<Map<string, number>>(new Map());

  // Settings subscriptions
  const showTranslation = useMushafSettingsStore(s => s.showTranslation);
  const showTransliteration = useMushafSettingsStore(
    s => s.showTransliteration,
  );
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showWBW = useMushafSettingsStore(s => s.showWBW);
  const wbwShowTranslation = useMushafSettingsStore(s => s.wbwShowTranslation);
  const wbwShowTransliteration = useMushafSettingsStore(
    s => s.wbwShowTransliteration,
  );
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const translationFontSize = useMushafSettingsStore(
    s => s.translationFontSize,
  );
  const transliterationFontSize = useMushafSettingsStore(
    s => s.transliterationFontSize,
  );
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const translationName = getTranslationName(selectedTranslationId);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );

  // @ai-start
  // Same font as before for Hafs; a font that cannot draw a rewayah's marks
  // (IndoPak) is never used for non-Hafs text.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const dkFontFamily = getDkFontFamily(mushafRenderer, mushafRewayah);
  // @ai-end
  // Mushaf 1440 keeps its Hafs text on the QPC path; another rewayah's
  // text is drawn from its DigitalKhatt words (as on the mushaf pages). @ai
  const isDK =
    (mushafRenderer !== 'qcf_v2' || mushafRewayah !== 'hafs') &&
    mushafPreloadService.initialized &&
    digitalKhattDataService.initialized;
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;

  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  // Active ayah highlighting. currentVerseKey (the first Hafs verse being
  // recited) drives the auto-scroll; every recited Hafs verse is highlighted.
  // While the reader's own recitation is followed (Hafs only), that ayah
  // takes the player's place.
  const recitedVerseKey = useRecitedVerseKey();
  const playerVerseKey = useMushafPlayerStore(s => s.currentVerseKey);
  const currentVerseKey = recitedVerseKey ?? playerVerseKey;
  const playerVerseKeys = usePlaybackVerseKeys(); // @ai
  const playbackVerseKeys = useMemo(
    () => (recitedVerseKey ? [recitedVerseKey] : playerVerseKeys),
    [recitedVerseKey, playerVerseKeys],
  );
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const isPlaying = playbackState === 'playing' || recitedVerseKey !== null;
  // @ai — the surah whose basmala is being recited (the intro before its
  // first verse): its header's basmala is lit as a recited verse is.
  const basmalaSurah = usePlaybackBasmalaSurah();

  // @ai-start
  // Decision 3 (Release 1): a non-Hafs text lists the page's verses as its
  // rewayah's OWN verses (verse units, in its numbering;
  // mushafVerseUnitRows.ts), never Hafs verses under the rewayah's name.
  // Hafs keeps its Hafs verse rows exactly as before and never builds verse
  // units.
  const unitsRewayah = mushafRewayah === 'hafs' ? null : mushafRewayah;
  const {units: verseUnits, status: verseUnitsStatus} =
    useRewayahVerseUnits(unitsRewayah);
  const pageUnits =
    unitsRewayah && verseUnits?.rewayah === unitsRewayah ? verseUnits : null;
  // The follow-along band as rows of the rewayah: the band the mushaf pages
  // paint (verse-units contract 4.2).
  const playbackBand = usePlaybackBand();
  const bandKeys = useMemo(
    () =>
      pageUnits
        ? playbackBandUnitKeys(shownVerseUnitsOf(pageUnits), playbackBand)
        : NO_KEYS,
    [pageUnits, playbackBand],
  );
  // @ai-end

  // Counts rebuilds of the verse data: the page's rows are taken again when
  // another translation has been applied. Before, a page already visited
  // kept the previous translation's text under the new one's name.
  const versesVersion = useEnhancedVersesVersion();
  const items = useMemo<ReadingPageItem[]>(
    () =>
      // @ai — a rewayah's page: its verse rows (none until they are ready)
      unitsRewayah
        ? pageUnits
          ? readingPageUnitItems(pageUnits, pageNumber)
          : []
        : getReadingPageItems(pageNumber),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumber, unitsRewayah, pageUnits, versesVersion],
  );

  // @ai-start
  // The page's rows, or the message of a rewayah whose verse units failed. A
  // spinner is no content: the restore deadline covers a long wait.
  useFirstContent(
    !unitsRewayah ||
      pageUnits !== null ||
      verseUnitsStatus === 'error' ||
      verseUnitsStatus === 'unavailable',
    onFirstContent,
  );
  // @ai-end

  const {isRightPage} = useMemo(
    () => getPageEdgeLayout(pageNumber),
    [pageNumber],
  );

  // Always the size the pager gives its items. The screen size the app
  // launched with (portrait) was used on phones, which broke the pager in
  // landscape: its items were narrower and taller than the pages it turned.
  const pageWidth = pageSize.width;
  const pageHeight = pageSize.height;

  // Content area horizontal padding for the ScrollView. A phone in portrait
  // is narrower than the reading column, so it keeps its edge padding.
  const bookContentPadding = moderateScale(12);
  const contentHorizontalPadding = isBookLayout
    ? bookContentPadding
    : readingColumnPadding(pageWidth, PAGE_PADDING_HORIZONTAL + 8);

  // Book layout in a wide item: the card holds the reading column and is
  // centred with all four corners rounded, like a single mushaf page.
  const sheetWidth = Math.min(
    pageWidth,
    READING_COLUMN_MAX_WIDTH + (bookContentPadding + EDGE_HORIZONTAL_INSET) * 2,
  );
  const symmetricEdges = sheetWidth < pageWidth;

  // Width available for SurahDivider / content items
  const cardWidth =
    sheetWidth - EDGE_HORIZONTAL_INSET * (symmetricEdges ? 2 : 1);
  const contentItemWidth = isBookLayout
    ? cardWidth - bookContentPadding * 2
    : pageWidth - contentHorizontalPadding * 2;

  // Load annotations for the first surah on this page so
  // bookmark icons and highlights render correctly
  const loadAnnotationsForSurah = useVerseAnnotationsStore(
    s => s.loadAnnotationsForSurah,
  );
  const firstSurah = useMemo(() => {
    for (const item of items) {
      if (item.type === 'verse') return item.verse.surah_number;
    }
    return null;
  }, [items]);
  useEffect(() => {
    if (firstSurah) loadAnnotationsForSurah(firstSurah);
  }, [firstSurah, loadAnnotationsForSurah]);

  // Auto-scroll to active ayah within the page
  // @ai — a rewayah's page follows the band's first verse row
  const activeRowKey = unitsRewayah ? bandKeys[0] : currentVerseKey;
  useEffect(() => {
    if (!isPlaying || !activeRowKey) return;
    const y = verseOffsetsRef.current.get(activeRowKey);
    if (y != null) {
      scrollViewRef.current?.scrollTo({y, animated: true});
    }
  }, [isPlaying, activeRowKey]);

  // @ai-start
  // The verse a jump took the reader to (a search result, a bookmark, a
  // link, a similar verse) is selected in the mushaf's selection store, for
  // the page it is on. The rows here only read the verse list's own store,
  // so the page opened at its top with nothing lit and the verse often
  // below the fold. Its rows are lit as on the mushaf pages, and the page
  // scrolls to the first of them.
  const selectedVerseKeys = useMushafVerseSelectionStore(
    s => s.selectedVerseKeys,
  );
  const selectedRewayah = useMushafVerseSelectionStore(s => s.selectedRewayah);
  const selectedPageNumber = useMushafVerseSelectionStore(
    s => s.selectedPageNumber,
  );
  const selectedKeys = useMemo(
    () =>
      selectedPageNumber === pageNumber && (!unitsRewayah || pageUnits)
        ? selectedRowKeys(
            pageUnits ? shownVerseUnitsOf(pageUnits) : null,
            selectedRewayah,
            selectedVerseKeys,
          )
        : NO_KEYS,
    [
      selectedPageNumber,
      pageNumber,
      unitsRewayah,
      pageUnits,
      selectedRewayah,
      selectedVerseKeys,
    ],
  );

  // Where the content's first row sits on screen at scroll 0: just below
  // the header panel. A row scrolled to its own y would sit under the panel.
  // (The book card starts insets.top down, its content as much higher.)
  const firstRowInset = PAGE_PADDING_TOP - (isBookLayout ? insets.top : 0);
  const firstRowInsetRef = useRef(firstRowInset);
  useEffect(() => {
    firstRowInsetRef.current = firstRowInset;
  }, [firstRowInset]);
  const scrollToRowAt = useCallback((y: number, animated: boolean) => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - firstRowInsetRef.current),
      animated,
    });
  }, []);

  // The row being scrolled to. The page is usually mounted only as the
  // pager reaches it, and a row's y moves while the rows above it measure
  // (the verse text is drawn once its width is known): the row scrolls
  // again from its own onLayout until the reader drags the page.
  // Every jump writes a new selectedVerseKeys array, so the effect also runs
  // for a second jump to the verse still lit: after the reader dragged away,
  // that jump scrolls back to it instead of lighting it off screen.
  const jumpRowKey = selectedKeys[0] ?? null;
  const jumpRowKeyRef = useRef<string | null>(null);
  useEffect(() => {
    jumpRowKeyRef.current = jumpRowKey;
    if (!jumpRowKey) return;
    // A page already laid out (a jump within the page being read).
    const y = verseOffsetsRef.current.get(jumpRowKey);
    if (y != null) scrollToRowAt(y, true);
  }, [jumpRowKey, selectedVerseKeys, scrollToRowAt]);
  const handleScrollBeginDrag = useCallback(() => {
    jumpRowKeyRef.current = null;
  }, []);
  // @ai-end

  // Tap on verse → toggle immersive mode (matches DKPageView tap behavior)
  const handleVersePress = useCallback(() => {
    onTap?.();
  }, [onTap]);

  const renderItem = useCallback(
    (item: ReadingPageItem) => {
      if (item.type === 'surah_header') {
        return (
          <View key={`header-${item.surahNumber}`}>
            <SurahDivider
              width={contentItemWidth}
              surahNumber={item.surahNumber}
              textColor={labelColor}
              nameColor={textColor}
            />
            <BasmalaHeader
              visible={item.showBismillah}
              surahNumber={item.surahNumber} // @ai
              width={contentItemWidth}
              textColor={textColor}
              showTajweed={showTajweed}
              fontMgr={fontMgr}
              dkFontFamily={dkFontFamily}
              indexedTajweedData={indexedTajweedData}
              arabicTextWeight={arabicTextWeight}
              showAllahNameHighlight={showAllahNameHighlight}
              allahNameHighlightColor={allahNameHighlightColor}
              // @ai — lit while its basmala is recited; unset otherwise, so the
              // header's props stay exactly as before (readingViews.hafsGolden)
              isActive={
                (isPlaying && basmalaSurah === item.surahNumber) || undefined
              }
            />
          </View>
        );
      }

      // @ai — themes are Hafs-aligned: a rewayah verse row takes the theme
      // of the Hafs verse its first word is in (as on the mushaf pages)
      const unitRow = isVerseUnitRow(item.verse) ? item.verse : undefined;
      const themeKey = unitRow
        ? themeHafsKeyOfRow(unitRow)
        : item.verse.verse_key;
      const themeInfo =
        showThemes && themeKey
          ? themeDataService.getThemeForVerse(themeKey)
          : undefined;
      const themeBg =
        themeInfo && themeInfo.themeIndex % 2 === 0
          ? Color(textColor).alpha(0.12).toString()
          : undefined;

      return (
        <View
          key={item.verse.verse_key}
          onLayout={(e: LayoutChangeEvent) => {
            verseOffsetsRef.current.set(
              item.verse.verse_key,
              e.nativeEvent.layout.y,
            );
            // @ai — the row a jump is scrolling to: follow its new place
            if (jumpRowKeyRef.current === item.verse.verse_key) {
              scrollToRowAt(e.nativeEvent.layout.y, false); // @ai
            }
          }}
          style={
            themeBg ? {backgroundColor: themeBg, borderRadius: 6} : undefined
          }>
          <VerseItem
            verse={item.verse}
            onVersePress={handleVersePress}
            textColor={textColor}
            borderColor={borderColor}
            showTranslation={showTranslation}
            showTransliteration={showTransliteration}
            showTajweed={showTajweed}
            arabicFontFamily="Uthmani"
            transliterationFontSize={transliterationFontSize}
            translationFontSize={translationFontSize}
            arabicFontSize={arabicFontSize}
            fontMgr={fontMgr}
            dkFontFamily={dkFontFamily}
            indexedTajweedData={indexedTajweedData}
            isActive={
              isPlaying &&
              // @ai — a rewayah verse row: lit by the band's verse keys
              (unitRow
                ? bandKeys.includes(item.verse.verse_key)
                : playbackVerseKeys.includes(item.verse.verse_key))
            }
            source="mushaf"
            translationName={translationName}
            translationId={selectedTranslationId}
            showWBW={showWBW}
            wbwShowTranslation={wbwShowTranslation}
            wbwShowTransliteration={wbwShowTransliteration}
            unitRow={unitRow} // @ai — the row is this rewayah verse
            // @ai — the verse a jump took the reader to; unset otherwise, so
            // the row's props stay exactly as before (readingViews.hafsGolden)
            selected={selectedKeys.includes(item.verse.verse_key) || undefined}
          />
        </View>
      );
    },
    [
      contentItemWidth,
      textColor,
      labelColor,
      borderColor,
      showTranslation,
      showTransliteration,
      showTajweed,
      arabicFontSize,
      arabicTextWeight,
      translationFontSize,
      transliterationFontSize,
      fontMgr,
      dkFontFamily,
      indexedTajweedData,
      handleVersePress,
      playbackVerseKeys, // @ai
      basmalaSurah, // @ai
      bandKeys, // @ai
      selectedKeys, // @ai
      scrollToRowAt, // @ai
      isPlaying,
      translationName,
      selectedTranslationId,
      showWBW,
      wbwShowTranslation,
      wbwShowTransliteration,
      showAllahNameHighlight,
      allahNameHighlightColor,
      showThemes,
      textColor,
    ],
  );

  // Scroll content: metadata sits behind the panels, verse items are first visible
  const scrollContent = (
    <>
      {/* Top metadata: sits behind the header panel */}
      <View style={styles.metadataRow}>
        <Text
          style={[styles.metadataLabel, {color: labelColor}]}
          numberOfLines={1}>
          {surahLabel}
        </Text>
        <Text
          style={[styles.metadataLabel, {color: labelColor}]}
          numberOfLines={1}>
          {juzLabel}
        </Text>
      </View>
      {/* Verse items */}
      {/* @ai — a rewayah whose verse units are not ready: no rows yet
       *  (never its text as Hafs verses) */}
      {unitsRewayah && !pageUnits ? (
        <VerseUnitsPending
          status={verseUnitsStatus === 'ready' ? 'loading' : verseUnitsStatus}
          rewayah={unitsRewayah}
          color={labelColor}
        />
      ) : (
        items.map(item => renderItem(item))
      )}
      {/* Bottom page number: sits behind the bottom panel */}
      <Text style={[styles.pageNumber, {color: labelColor}]}>{pageLabel}</Text>
    </>
  );

  return (
    <View
      style={{
        width: pageWidth,
        height: pageHeight,
        // @ai — the page card, its edges and rounded corners are drawn in
        // physical book coordinates (as DKPageView): inherited RTL swapped
        // them to the wrong side in Arabic. The text re-takes the app's
        // direction in the scroll content below.
        direction: 'ltr',
        backgroundColor: isBookLayout ? bgColor : cardColor,
      }}>
      {isBookLayout ? (
        <View style={[styles.sheet, {width: sheetWidth}]}>
          <View
            style={[
              styles.bookCard,
              {
                top: insets.top,
                bottom: insets.top,
                backgroundColor: cardColor,
              },
              symmetricEdges
                ? {
                    left: EDGE_HORIZONTAL_INSET,
                    right: EDGE_HORIZONTAL_INSET,
                    borderRadius: EDGE_BORDER_RADIUS,
                  }
                : isRightPage
                  ? {
                      left: 0,
                      right: EDGE_HORIZONTAL_INSET,
                      borderTopRightRadius: EDGE_BORDER_RADIUS,
                      borderBottomRightRadius: EDGE_BORDER_RADIUS,
                    }
                  : {
                      left: EDGE_HORIZONTAL_INSET,
                      right: 0,
                      borderTopLeftRadius: EDGE_BORDER_RADIUS,
                      borderBottomLeftRadius: EDGE_BORDER_RADIUS,
                    },
            ]}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={{
                ...appLayoutDirection, // @ai — the text: see the root
                paddingHorizontal: bookContentPadding,
                paddingTop: PAGE_PADDING_TOP - METADATA_OFFSET - insets.top,
                paddingBottom: PAGE_PADDING_BOTTOM - insets.top,
              }}
              onScrollBeginDrag={handleScrollBeginDrag} // @ai
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              {scrollContent}
            </ScrollView>
          </View>
          <PageEdgeDecoration
            isRightPage={isRightPage}
            borderColor={borderColor}
            pageColor={cardColor}
            symmetric={symmetricEdges}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={{
            ...appLayoutDirection, // @ai — the text: see the root
            paddingTop: PAGE_PADDING_TOP - METADATA_OFFSET,
            paddingBottom: PAGE_PADDING_BOTTOM,
            paddingHorizontal: contentHorizontalPadding,
          }}
          onScrollBeginDrag={handleScrollBeginDrag} // @ai
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          {scrollContent}
        </ScrollView>
      )}
    </View>
  );
};
// @ai-end

const styles = StyleSheet.create({
  sheet: {
    height: '100%',
    alignSelf: 'center',
  },
  bookCard: {
    position: 'absolute',
    overflow: 'hidden',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  metadataLabel: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  scrollView: {
    flex: 1,
  },
  pageNumber: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default React.memo(ReadingPageView);
