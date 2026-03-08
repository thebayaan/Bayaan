import React, {useMemo, useCallback, useEffect} from 'react';
import {View, ScrollView, StyleSheet, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getReadingPageItems,
  type ReadingPageItem,
} from '@/utils/mushafPageVerses';
import {VerseItem} from '@/components/player/v2/PlayerContent/QuranView/VerseItem';
import SurahDivider from '@/components/player/v2/PlayerContent/QuranView/SurahDivider';
import BasmalaHeader from '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader';
import {getTranslationName} from '@/utils/translationLookup';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import Color from 'color';
import PageEdgeDecoration, {
  EDGE_BORDER_RADIUS,
  EDGE_HORIZONTAL_INSET,
} from '../PageEdgeDecoration';
import {moderateScale} from 'react-native-size-matters';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  getPageEdgeLayout,
} from '../constants';

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
}

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
}) => {
  const insets = useSafeAreaInsets();

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

  const dkFontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';
  const isDK =
    (mushafRenderer === 'dk_v1' ||
      mushafRenderer === 'dk_v2' ||
      mushafRenderer === 'dk_indopak') &&
    mushafPreloadService.initialized &&
    digitalKhattDataService.initialized;
  const fontMgr = isDK ? mushafPreloadService.fontMgr : null;

  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  const items = useMemo(() => getReadingPageItems(pageNumber), [pageNumber]);

  const {isRightPage} = useMemo(
    () => getPageEdgeLayout(pageNumber),
    [pageNumber],
  );

  // Content area horizontal padding for the ScrollView
  const bookContentPadding = moderateScale(12);
  const contentHorizontalPadding = isBookLayout
    ? bookContentPadding
    : PAGE_PADDING_HORIZONTAL + 8;

  // Width available for SurahDivider / content items
  const cardWidth = SCREEN_WIDTH - EDGE_HORIZONTAL_INSET;
  const contentItemWidth = isBookLayout
    ? cardWidth - bookContentPadding * 2
    : SCREEN_WIDTH - contentHorizontalPadding * 2;

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
              width={contentItemWidth}
              textColor={textColor}
              showTajweed={showTajweed}
              fontMgr={fontMgr}
              dkFontFamily={dkFontFamily}
              indexedTajweedData={indexedTajweedData}
            />
          </View>
        );
      }

      const themeInfo = showThemes
        ? themeDataService.getThemeForVerse(item.verse.verse_key)
        : undefined;
      const themeBg =
        themeInfo && themeInfo.themeIndex % 2 === 0
          ? Color(textColor).alpha(0.12).toString()
          : undefined;

      return (
        <View
          key={item.verse.verse_key}
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
            source="mushaf"
            translationName={translationName}
            translationId={selectedTranslationId}
            showWBW={showWBW}
            wbwShowTranslation={wbwShowTranslation}
            wbwShowTransliteration={wbwShowTransliteration}
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
      translationFontSize,
      transliterationFontSize,
      fontMgr,
      dkFontFamily,
      indexedTajweedData,
      handleVersePress,
      translationName,
      selectedTranslationId,
      showWBW,
      wbwShowTranslation,
      wbwShowTransliteration,
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
      {items.map(item => renderItem(item))}
      {/* Bottom page number: sits behind the bottom panel */}
      <Text style={[styles.pageNumber, {color: labelColor}]}>{pageLabel}</Text>
    </>
  );

  return (
    <View
      style={[
        styles.page,
        {backgroundColor: isBookLayout ? bgColor : cardColor},
      ]}>
      {isBookLayout ? (
        <>
          <View
            style={[
              styles.bookCard,
              {
                top: insets.top,
                bottom: insets.top,
                backgroundColor: cardColor,
              },
              isRightPage
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
              style={styles.scrollView}
              contentContainerStyle={{
                paddingHorizontal: bookContentPadding,
                paddingTop: PAGE_PADDING_TOP - METADATA_OFFSET - insets.top,
                paddingBottom: PAGE_PADDING_BOTTOM - insets.top,
              }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              {scrollContent}
            </ScrollView>
          </View>
          <PageEdgeDecoration
            isRightPage={isRightPage}
            borderColor={borderColor}
            pageColor={cardColor}
          />
        </>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: PAGE_PADDING_TOP - METADATA_OFFSET,
            paddingBottom: PAGE_PADDING_BOTTOM,
            paddingHorizontal: contentHorizontalPadding,
          }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          {scrollContent}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
