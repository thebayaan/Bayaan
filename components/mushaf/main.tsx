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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  SURAH_NAMES,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  getJuzForPage,
  getHizbForPage,
} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import SkiaPage from './skia/SkiaPage';

const TOTAL_PAGES = 604;
const ANIMATION_DURATION = 300;

// ============================================================================
// Digital Khatt PageView (Skia-based with DK V1/V2 fonts)
// ============================================================================
const DKPageView: React.FC<{
  pageNumber: number;
  textColor: string;
  highlightColor: string;
  onTap?: () => void;
}> = ({pageNumber, textColor, highlightColor, onTap}) => {
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

  const immersiveAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - overlayOpacity.value,
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
  const currentJuz = getJuzForPage(currentPage);
  const currentHizb = getHizbForPage(currentPage);

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

  const openSettingsSheet = useCallback(() => {
    SheetManager.show('mushaf-layout');
  }, []);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* FlatList fills the entire screen */}
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={({item}) => (
          <DKPageView
            pageNumber={item}
            textColor={theme.colors.text}
            highlightColor={theme.colors.primary}
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
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}>
        <View style={styles.headerRow}>
          {/* Left: back button */}
          <Pressable
            style={styles.headerIcon}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>

          {/* Center: surah name + page/juz/hizb info */}
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerSurahName, {color: theme.colors.text}]}
              numberOfLines={1}>
              {currentSurahName}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                {color: theme.colors.textSecondary},
              ]}>
              Page {currentPage} | Juz {currentJuz} | Hizb {currentHizb}
            </Text>
          </View>

          {/* Right: search + settings */}
          <View style={styles.headerRight}>
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
            <Pressable
              style={styles.headerIcon}
              onPress={openSettingsSheet}
              accessibilityRole="button"
              accessibilityLabel="Mushaf settings">
              <Ionicons
                name="settings-outline"
                size={22}
                color={theme.colors.text}
              />
            </Pressable>
          </View>
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
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}>
        <Pressable
          style={styles.headerIcon}
          onPress={openSettingsSheet}
          accessibilityRole="button"
          accessibilityLabel="Mushaf settings">
          <Ionicons
            name="options-outline"
            size={24}
            color={theme.colors.text}
          />
        </Pressable>

        <Pressable
          style={styles.playButton}
          accessibilityRole="button"
          accessibilityLabel="Play">
          <Ionicons name="play" size={24} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* ================================================================ */}
      {/* Immersive mode overlay — fades IN when immersive                 */}
      {/* ================================================================ */}
      <Animated.View
        style={[styles.immersiveOverlay, immersiveAnimatedStyle]}
        pointerEvents="none">
        {/* Top row */}
        <View style={[styles.immersiveTop, {top: insets.top + 8}]}>
          <Text style={styles.immersiveText}>{currentSurahName}</Text>
          <Text style={styles.immersiveText}>
            Juz {currentJuz} | Hizb {currentHizb}
          </Text>
        </View>

        {/* Bottom row */}
        <View style={[styles.immersiveBottom, {bottom: insets.bottom + 12}]}>
          <Text style={styles.immersiveText}>{currentPage}</Text>
        </View>
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
  },
  headerSurahName: {
    fontSize: 20,
    fontFamily: 'Traditional-Arabic',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
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
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Immersive mode overlay
  immersiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  immersiveTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  immersiveBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
  },
  immersiveText: {
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    color: 'rgba(255,255,255,0.5)',
  },
});
