import * as Font from 'expo-font';
import React, {useEffect, useState, useMemo, useRef, useCallback} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  Pressable,
  ViewToken,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {Ionicons} from '@expo/vector-icons';
import {SheetManager} from 'react-native-actions-sheet';
const surahHeaderGlyphsMap: Record<
  string,
  string
> = require('@/data/mushaf/legacy/SURAH_HEADERS.json');
import {
  useMushafSettingsStore,
  type MushafRenderer,
} from '@/store/mushafSettingsStore';
import {SURAH_NAMES, PLAYER_RESERVED_HEIGHT} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import SkiaPage from './skia/SkiaPage';

// Surah header font
const surahHeaderFont = require('@/data/mushaf/legacy/SURAH_HEADERS.ttf');
let isSurahHeaderFontLoaded = false;

async function loadSurahHeaderFont(): Promise<boolean> {
  if (isSurahHeaderFontLoaded) {
    return true;
  }

  try {
    await Font.loadAsync({
      SURAH_HEADERS: surahHeaderFont,
    });
    isSurahHeaderFontLoaded = true;
    return true;
  } catch (error) {
    console.error('Error loading surah header font:', error);
    return false;
  }
}

import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  IS_COMPACT_DEVICE,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  AYAH_LINE_SPACING,
  LINES_PER_PAGE,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  BASE_LINE_HEIGHT,
  calculateLineYPositions,
} from './constants';

const TOTAL_PAGES = 604;

const SURAH_HEADER_FONT_SIZE = CONTENT_WIDTH * 0.25;

// ============================================================================
// Digital Khatt PageView (Skia-based with DK V1/V2 fonts)
// ============================================================================
const DKPageView: React.FC<{
  pageNumber: number;
  textColor: string;
  highlightColor: string;
}> = ({pageNumber, textColor, highlightColor}) => {
  const [pageReady, setPageReady] = useState(false);

  // Prefer preloaded font from MushafPreloadService (ready before tab mounts).
  // Fall back to module-level flag + async load for edge cases.
  const [surahHeaderFontLoaded, setSurahHeaderFontLoaded] = useState(
    mushafPreloadService.surahHeaderFontLoaded || isSurahHeaderFontLoaded,
  );

  useEffect(() => {
    if (surahHeaderFontLoaded) return;
    let isActive = true;
    loadSurahHeaderFont().then(success => {
      if (isActive) setSurahHeaderFontLoaded(success);
    });
    return () => {
      isActive = false;
    };
  }, [surahHeaderFontLoaded]);

  const pageLines = useMemo(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  const lineYPositions = useMemo(
    () => calculateLineYPositions(pageLines, pageNumber),
    [pageLines, pageNumber],
  );

  return (
    <View style={[styles.page, {opacity: pageReady ? 1 : 0}]}>
      {/* Skia Canvas renders ayah + basmallah lines */}
      <SkiaPage
        pageNumber={pageNumber}
        textColor={textColor}
        highlightColor={highlightColor}
        onReady={() => setPageReady(true)}
      />

      {surahHeaderFontLoaded &&
        pageLines.map((line, index) => {
          if (line.line_type !== 'surah_name') return null;

          const yPos = PAGE_PADDING_TOP + lineYPositions[index];
          const headerTopOffset = BASE_LINE_HEIGHT * 0.15;

          const surahText =
            surahHeaderGlyphsMap[`surah-${line.surah_number}`] ??
            `سورة ${SURAH_NAMES[line.surah_number]}`;

          return (
            <Text
              key={`surah-${pageNumber}-${line.line_number}`}
              style={[
                styles.surahText,
                {
                  top: yPos + headerTopOffset,
                  color: textColor,
                },
              ]}>
              {surahText}
            </Text>
          );
        })}

      <View style={styles.pageNumberContainer}>
        <Text style={[styles.pageNumber, {color: textColor}]}>
          {pageNumber}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// Inline settings toolbar (mushaf renderer toggle)
// ============================================================================
const MUSHAF_OPTIONS: {key: MushafRenderer; label: string}[] = [
  {key: 'dk_v1', label: 'Madani 1405'},
  {key: 'dk_v2', label: 'Madani 1421'},
];

const MushafInlineSettings: React.FC<{textColor: string}> = ({textColor}) => {
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const setMushafRenderer = useMushafSettingsStore(s => s.setMushafRenderer);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const toggleTajweed = useMushafSettingsStore(s => s.toggleTajweed);

  return (
    <View style={styles.inlineSettings}>
      <Pressable
        style={[styles.settingsPill, showTajweed && styles.settingsPillActive]}
        onPress={toggleTajweed}>
        <Text
          style={[
            styles.settingsPillText,
            {color: showTajweed ? '#fff' : textColor},
          ]}>
          Tajweed
        </Text>
      </Pressable>
      <View style={styles.fontToggleGroup}>
        {MUSHAF_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[
              styles.settingsPill,
              mushafRenderer === opt.key && styles.settingsPillActive,
            ]}
            onPress={() => setMushafRenderer(opt.key)}>
            <Text
              style={[
                styles.settingsPillText,
                {color: mushafRenderer === opt.key ? '#fff' : textColor},
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// ============================================================================
// MushafViewer (main exported component)
// ============================================================================
export default function MushafViewer({
  pageNumber: initialPage,
}: {
  pageNumber: number;
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const {theme} = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const pages = useMemo(
    () => Array.from({length: TOTAL_PAGES}, (_, i) => i + 1),
    [],
  );

  // DK data is pre-initialized by MushafPreloadService (AppInitializer priority 5)
  // before this tab mounts, so the synchronous check is safe.
  const pageToSurah = digitalKhattDataService.initialized
    ? digitalKhattDataService.getPageToSurah()
    : {};
  const surahStartPages = digitalKhattDataService.initialized
    ? digitalKhattDataService.getSurahStartPages()
    : {};

  const currentSurahId = pageToSurah[currentPage] || 1;
  const currentSurahName = SURAH_NAMES[currentSurahId];

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].item) {
        setCurrentPage(viewableItems[0].item);
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    [],
  );

  const navigateToSurah = useCallback(
    (surahId: number) => {
      const targetPage = surahStartPages[surahId];
      if (targetPage && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: targetPage - 1,
          animated: false,
        });
      }
    },
    [surahStartPages],
  );

  const openSurahSheet = useCallback(() => {
    SheetManager.show('mushaf-surah-selector', {
      payload: {currentSurahId, onSelect: navigateToSurah},
    });
  }, [currentSurahId, navigateToSurah]);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* Header with surah name + inline settings */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.surahSelector} onPress={openSurahSheet}>
            <Text style={[styles.headerSurahName, {color: theme.colors.text}]}>
              {currentSurahName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={theme.colors.text}
              style={styles.chevronIcon}
            />
          </Pressable>

          <MushafInlineSettings textColor={theme.colors.text} />
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={({item}) => (
          <DKPageView
            pageNumber={item}
            textColor={theme.colors.text}
            highlightColor={theme.colors.primary}
          />
        )}
        keyExtractor={item => item.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(initialPage - 1, TOTAL_PAGES - 1)}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        inverted
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={7}
        maxToRenderPerBatch={3}
        initialNumToRender={1}
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surahSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSurahName: {
    fontSize: 18,
    fontFamily: 'Traditional-Arabic',
  },
  chevronIcon: {
    marginLeft: 4,
  },
  inlineSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fontToggleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  settingsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  settingsPillActive: {
    backgroundColor: 'rgba(80,80,80,0.7)',
  },
  settingsPillText: {
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  surahText: {
    position: 'absolute',
    fontSize: SURAH_HEADER_FONT_SIZE,
    fontFamily: 'SURAH_HEADERS',
    textAlign: 'center',
    width: CONTENT_WIDTH,
    left: PAGE_PADDING_HORIZONTAL,
    lineHeight: BASE_LINE_HEIGHT * 1.3,
  },
  pageNumberContainer: {
    position: 'absolute',
    bottom: PLAYER_RESERVED_HEIGHT + 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pageNumber: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
