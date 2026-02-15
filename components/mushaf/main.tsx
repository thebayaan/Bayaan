import React, {useState, useMemo, useRef, useCallback, useEffect} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  Pressable,
  ViewToken,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {Ionicons} from '@expo/vector-icons';
import {SheetManager} from 'react-native-actions-sheet';
import {BackButton} from '@/components/BackButton';
import {PlayIcon} from '@/components/Icons';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  SURAH_NAMES,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  PAGE_PADDING_HORIZONTAL,
  getJuzForPage,
} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {SURAHS} from '@/data/surahData';
import SkiaPage from './skia/SkiaPage';

const TOTAL_PAGES = 604;
const ANIMATION_DURATION = 300;

// ============================================================================
// Helpers
// ============================================================================

function getSurahNamesForPage(pageNumber: number): string {
  const lines = digitalKhattDataService.getPageLines(pageNumber);
  const seen = new Set<number>();
  const names: string[] = [];
  for (const line of lines) {
    const num = line.surah_number;
    if (num >= 1 && num <= 114 && !seen.has(num)) {
      seen.add(num);
      names.push(SURAHS[num - 1].name);
    }
  }
  return names.join(' \u00B7 ');
}

// ============================================================================
// Digital Khatt PageView (Skia-based with DK V1/V2 fonts)
// ============================================================================
const DKPageView: React.FC<{
  pageNumber: number;
  textColor: string;
  highlightColor: string;
  surahLabel: string;
  juzLabel: string;
  pageLabel: string;
  labelColor: string;
  onTap?: () => void;
}> = ({
  pageNumber,
  textColor,
  highlightColor,
  surahLabel,
  juzLabel,
  pageLabel,
  labelColor,
  onTap,
}) => {
  const [pageReady, setPageReady] = useState(false);

  return (
    <View style={[styles.page, {opacity: pageReady ? 1 : 0}]}>
      <SkiaPage
        pageNumber={pageNumber}
        textColor={textColor}
        highlightColor={highlightColor}
        onReady={() => setPageReady(true)}
        onTap={onTap}
      />
      {/* Surah name(s) — top left */}
      <Text
        style={[
          styles.pageLabel,
          {
            color: labelColor,
            top: PAGE_PADDING_TOP - 30,
            left: PAGE_PADDING_HORIZONTAL + 8,
          },
        ]}
        numberOfLines={1}>
        {surahLabel}
      </Text>
      {/* Juz number — top right */}
      <Text
        style={[
          styles.pageLabel,
          {
            color: labelColor,
            top: PAGE_PADDING_TOP - 30,
            right: PAGE_PADDING_HORIZONTAL + 8,
            textAlign: 'right',
          },
        ]}
        numberOfLines={1}>
        {juzLabel}
      </Text>
      {/* Page number — bottom center */}
      <Text
        style={[
          styles.pageLabel,
          {
            color: labelColor,
            bottom: PAGE_PADDING_BOTTOM - 35,
            left: 0,
            right: 0,
            textAlign: 'center',
          },
        ]}>
        {pageLabel}
      </Text>
    </View>
  );
};

// ============================================================================
// MushafViewer (main exported component)
// ============================================================================
interface MushafViewerProps {
  pageNumber: number;
  initialVerseKey?: string;
}

export default function MushafViewer({
  pageNumber: initialPage,
}: MushafViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isImmersive, setIsImmersive] = useState(false);
  const {theme} = useTheme();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  // Reanimated overlay animation (same pattern as PlayerContent)
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    overlayOpacity.value = withTiming(isImmersive ? 0 : 1, {
      duration: ANIMATION_DURATION,
    });
  }, [isImmersive, overlayOpacity]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const toggleImmersive = useCallback(() => {
    setIsImmersive(prev => !prev);
  }, []);

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
    <View style={[styles.container, {backgroundColor: theme.colors.card}]}>
      {/* FlatList fills the entire screen */}
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={({item}) => (
          <DKPageView
            pageNumber={item}
            textColor={theme.colors.text}
            highlightColor={theme.colors.primary}
            surahLabel={getSurahNamesForPage(item)}
            juzLabel={`Juz ${getJuzForPage(item)}`}
            pageLabel={String(item)}
            labelColor={theme.colors.textSecondary}
            onTap={toggleImmersive}
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

      {/* ================================================================ */}
      {/* Normal mode header — fades out when immersive                    */}
      {/* ================================================================ */}
      <StatusBar hidden={isImmersive} animated />

      <Animated.View
        style={[
          styles.header,
          overlayAnimatedStyle,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}>
        <View style={styles.headerRow}>
          {/* Left: back button */}
          <BackButton onPress={() => router.back()} />

          {/* Center: surah name */}
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerSurahName, {color: theme.colors.text}]}
              numberOfLines={1}>
              {currentSurahName}
            </Text>
          </View>

          {/* Right: search */}
          <Pressable
            style={styles.headerIcon}
            onPress={openSurahSheet}
            accessibilityRole="button"
            accessibilityLabel="Search surahs">
            <Ionicons
              name="search-outline"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* ================================================================ */}
      {/* Normal mode bottom bar — fades out when immersive                */}
      {/* ================================================================ */}
      <Animated.View
        style={[
          styles.bottomBar,
          overlayAnimatedStyle,
          {
            paddingBottom: insets.bottom + 8,
            backgroundColor: theme.colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}>
        <Pressable
          style={[
            styles.circleButton,
            {
              backgroundColor: Color(theme.colors.textSecondary)
                .alpha(0.08)
                .toString(),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mushaf settings">
          <Ionicons
            name="options-outline"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>

        <Pressable
          style={[styles.circleButton, {backgroundColor: theme.colors.text}]}
          accessibilityRole="button"
          accessibilityLabel="Play">
          <View style={styles.playIconContainer}>
            <PlayIcon
              color={theme.colors.background}
              size={moderateScale(18)}
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Per-page metadata labels
  pageLabel: {
    position: 'absolute',
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },

  // Normal mode header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSurahName: {
    fontSize: 17,
    fontFamily: 'Traditional-Arabic',
  },
  headerIcon: {
    padding: 6,
  },

  // Normal mode bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  circleButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(12),
  },
  playIconContainer: {
    paddingLeft: moderateScale(4),
  },
});
