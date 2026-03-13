import React, {useState, useMemo, useRef, useCallback, useEffect} from 'react';
import {useKeepAwake} from 'expo-keep-awake';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ViewToken,
  StatusBar,
  BackHandler,
  Platform,
} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useRouter, useNavigation} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {Ionicons} from '@expo/vector-icons';
import {SheetManager} from 'react-native-actions-sheet';
import {GlassView} from 'expo-glass-effect';
import {useGlassColorScheme} from '@/hooks/useGlassProps';
import {BackButton} from '@/components/BackButton';
import MushafSearchView from './MushafSearchView';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PAGE_PADDING_HORIZONTAL,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  CONTENT_WIDTH,
  getJuzForPage,
  getPageEdgeLayout,
} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {SURAHS} from '@/data/surahData';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafAutoPageTurn} from '@/hooks/useMushafAutoPageTurn';
import {MushafPlayerBar} from './MushafPlayerBar';
import SkiaPage from './skia/SkiaPage';
import ReadingPageView from './reading/ReadingPageView';
import ContinuousListView, {
  type ContinuousListViewHandle,
} from './reading/ContinuousListView';
import ContinuousMushafView from './skia/ContinuousMushafView';
import PageEdgeDecoration, {
  EDGE_BORDER_RADIUS,
  EDGE_HORIZONTAL_INSET,
} from './PageEdgeDecoration';

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
  if (names.length > 0) return names.join(' \u00B7 ');

  // Fallback: surah_number is only set on surah_name lines in the DB,
  // so pages without a header need the pageToSurah mapping.
  const pageToSurah = digitalKhattDataService.getPageToSurah();
  const surahId = pageToSurah[pageNumber];
  if (surahId >= 1 && surahId <= 114) return SURAHS[surahId - 1].name;
  return '';
}

// ============================================================================
// Digital Khatt PageView (Skia-based with DK V1/V2 fonts)
// ============================================================================
const DKPageView: React.FC<{
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
}> = ({
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
  const [pageReady, setPageReady] = useState(false);
  const insets = useSafeAreaInsets();

  const {isRightPage, contentMarginLeft} = useMemo(
    () => getPageEdgeLayout(pageNumber),
    [pageNumber],
  );

  // In fullscreen mode, use symmetric padding; in book mode, use asymmetric
  const effectiveMarginLeft = isBookLayout ? contentMarginLeft : undefined;
  const effectiveOuterMargin = isBookLayout
    ? SCREEN_WIDTH - contentMarginLeft - CONTENT_WIDTH
    : PAGE_PADDING_HORIZONTAL;
  const effectiveLabelLeft = isBookLayout
    ? contentMarginLeft + 8
    : PAGE_PADDING_HORIZONTAL + 8;

  // Center page number vertically between content bottom and bottom border
  const pageNumberBottom = isBookLayout
    ? insets.top + (PAGE_PADDING_BOTTOM - insets.top) / 2 - 8
    : PAGE_PADDING_BOTTOM - 35;

  return (
    <View
      style={[
        styles.page,
        {
          backgroundColor: isBookLayout ? bgColor : cardColor,
          opacity: pageReady ? 1 : 0,
        },
      ]}>
      {isBookLayout && (
        <>
          {/* Card-colored background inside the frame, rounded to match outermost border */}
          <View
            style={[
              {
                position: 'absolute',
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
            ]}
          />
        </>
      )}
      <SkiaPage
        pageNumber={pageNumber}
        textColor={textColor}
        dividerColor={labelColor}
        contentMarginLeft={effectiveMarginLeft}
        onReady={() => setPageReady(true)}
        onTap={onTap}
      />
      {isBookLayout && (
        <PageEdgeDecoration
          isRightPage={isRightPage}
          borderColor={borderColor}
          pageColor={cardColor}
        />
      )}
      {/* Surah name(s) — top left */}
      <Text
        style={[
          styles.pageLabel,
          {
            color: labelColor,
            top: PAGE_PADDING_TOP - 30,
            left: effectiveLabelLeft,
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
            right: effectiveOuterMargin + 8,
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
            bottom: pageNumberBottom,
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
  useKeepAwake();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isSearchMode, setIsSearchModeRaw] = useState(false);
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);
  const setIsSearchMode = useCallback(
    (value: boolean | ((prev: boolean) => boolean), autoFocus?: boolean) => {
      const next = typeof value === 'function' ? value(isSearchMode) : value;
      setIsSearchModeRaw(next);
      // Defer store update to avoid setState-during-render
      queueMicrotask(() => {
        useMushafPlayerStore.setState({isSearchMode: next});
      });
      if (!next) setAutoFocusSearch(false);
      else if (autoFocus) setAutoFocusSearch(true);
    },
    [isSearchMode],
  );
  // iOS: sync search mode from store (toolbar search button sets store directly)
  const storeSearchMode = useMushafPlayerStore(s => s.isSearchMode);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (storeSearchMode !== isSearchMode) {
      setIsSearchModeRaw(storeSearchMode);
      // Toolbar search button always means "search with focus"
      if (storeSearchMode) setAutoFocusSearch(true);
    }
  }, [storeSearchMode]);

  const {theme, isDarkMode} = useTheme();
  const readingColors = useReadingThemeColors();
  const glassColorScheme = useGlassColorScheme();
  const pageLayout = useMushafSettingsStore(s => s.pageLayout);
  const viewMode = useMushafSettingsStore(s => s.viewMode);
  const scrollDirection = useMushafSettingsStore(s => s.scrollDirection);
  const isVertical = scrollDirection === 'vertical';
  const isBookLayout = pageLayout === 'book';
  const edgeBg = isDarkMode ? '#000' : readingColors.card;
  const pageBg = isDarkMode ? readingColors.card : readingColors.background;
  const edgeBorderColor = isDarkMode
    ? Color(theme.colors.border).darken(0.3).toString()
    : Color(theme.colors.border).lighten(0.3).toString();
  const router = useRouter();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const continuousListRef = useRef<ContinuousListViewHandle>(null);
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
    setIsImmersive(prev => {
      useMushafPlayerStore.setState({isImmersive: !prev});
      return !prev;
    });
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

  // iOS: configure Stack navigator header based on current mode
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    if (isImmersive || isSearchMode) {
      // Hide native header — search overlay renders its own UI
      navigation.setOptions({
        headerShown: false,
        headerSearchBarOptions: undefined,
      });
      return;
    }

    // Normal mode: GlassView title + options button
    navigation.setOptions({
      headerShown: true,
      headerBackVisible: true,
      headerSearchBarOptions: undefined,
      headerTitle: () => (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={glassColorScheme}
          tintColor={isDarkMode ? 'rgba(0,0,0,0.5)' : undefined}
          style={{
            borderRadius: moderateScale(14),
            paddingHorizontal: moderateScale(14),
            paddingVertical: moderateScale(6),
          }}>
          <Pressable
            onPress={() => setIsSearchMode(true)}
            accessibilityRole="button"
            accessibilityLabel="Search surahs"
            style={{alignItems: 'center'}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: moderateScale(4),
              }}>
              <Text
                style={{
                  fontSize: moderateScale(16),
                  fontFamily: 'Manrope-SemiBold',
                  color: theme.colors.text,
                }}
                numberOfLines={1}>
                {SURAHS[currentSurahId - 1].name}
              </Text>
              <Ionicons
                name="chevron-down"
                size={moderateScale(14)}
                color={theme.colors.textSecondary}
              />
            </View>
            <Text
              style={{
                fontSize: moderateScale(12),
                fontFamily: 'Manrope-Regular',
                color: theme.colors.textSecondary,
              }}>
              Page {currentPage} · Juz {getJuzForPage(currentPage)}
            </Text>
          </Pressable>
        </GlassView>
      ),
      headerLeft: undefined,
      headerRight: () => (
        <Pressable
          onPress={() =>
            SheetManager.show('mushaf-layout', {
              payload: {context: 'mushaf'},
            })
          }
          hitSlop={10}
          style={{padding: moderateScale(6)}}>
          <Ionicons
            name="options-outline"
            size={moderateScale(22)}
            color={theme.colors.text}
          />
        </Pressable>
      ),
    });
  }, [
    isImmersive,
    isSearchMode,
    currentPage,
    currentSurahId,
    theme,
    isDarkMode,
    navigation,
  ]);

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].item) {
        const page = viewableItems[0].item as number;
        setCurrentPage(page);
        useMushafPlayerStore.setState({currentPage: page});
        mushafSessionStore.setLastReadPage(page);
        // Update the active reading chain (swipe = same chain, even across surah boundaries)
        const surahId = digitalKhattDataService.initialized
          ? digitalKhattDataService.getPageToSurah()[page]
          : undefined;
        if (surahId) {
          useMushafSettingsStore.getState().updateActiveChain(surahId, page);
        }
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

  const navigateToPage = useCallback(
    (targetPage: number) => {
      setIsSearchMode(false);
      // Explicit navigation = start a new chain (preserves old position)
      const surahId = digitalKhattDataService.initialized
        ? digitalKhattDataService.getPageToSurah()[targetPage]
        : undefined;
      if (surahId) {
        useMushafSettingsStore.getState().startNewChain(surahId, targetPage);
      }
      if (isVertical) {
        continuousListRef.current?.scrollToPage(targetPage);
      } else {
        flatListRef.current?.scrollToIndex({
          index: targetPage - 1,
          animated: false,
        });
      }
    },
    [isVertical],
  );

  const navigateToPageAnimated = useCallback(
    (targetPage: number) => {
      if (isVertical) {
        continuousListRef.current?.scrollToPage(targetPage, true);
      } else {
        flatListRef.current?.scrollToIndex({
          index: targetPage - 1,
          animated: true,
        });
      }
    },
    [isVertical],
  );

  // In vertical mode, scroll to the exact verse during playback
  const navigateToVerseAnimated = useCallback((verseKey: string) => {
    continuousListRef.current?.scrollToVerse(verseKey, true);
  }, []);

  // Auto-page-turn during mushaf playback
  useMushafAutoPageTurn(
    currentPage,
    navigateToPageAnimated,
    isVertical ? navigateToVerseAnimated : undefined,
  );

  const navigateToSurah = useCallback(
    (surahId: number) => {
      setIsSearchMode(false);
      if (isVertical) {
        continuousListRef.current?.scrollToSurah(surahId);
      } else {
        const targetPage = surahStartPages[surahId];
        if (targetPage) navigateToPage(targetPage);
      }
    },
    [isVertical, surahStartPages, navigateToPage],
  );

  // Subscribe to external navigation requests (e.g. from SimilarVersesSheet)
  const navRequestId = useMushafNavigationStore(s => s.requestId);
  useEffect(() => {
    if (navRequestId === 0) return;
    const {targetPage, targetVerseKey, clear} =
      useMushafNavigationStore.getState();
    if (targetPage) {
      navigateToPage(targetPage);
      if (targetVerseKey) {
        useMushafVerseSelectionStore
          .getState()
          .selectVerse(targetVerseKey, targetPage);
      }
      clear();
    }

    // Auto-clear the temporary highlight after 2 seconds
    const timer = setTimeout(() => {
      useMushafVerseSelectionStore.getState().clearSelection();
    }, 3000);

    return () => clearTimeout(timer);
  }, [navRequestId, navigateToPage]);

  const navigateToVerse = useCallback(
    (verseKey: string, page: number) => {
      if (isVertical) {
        setIsSearchMode(false);
        continuousListRef.current?.scrollToVerse(verseKey);
      } else {
        navigateToPage(page);
      }
      useMushafVerseSelectionStore.getState().selectVerse(verseKey, page);
      const timer = setTimeout(() => {
        useMushafVerseSelectionStore.getState().clearSelection();
      }, 3000);
      return () => clearTimeout(timer);
    },
    [isVertical, navigateToPage],
  );

  const resumeChain = useCallback(
    (index: number, page: number) => {
      setIsSearchMode(false);
      useMushafSettingsStore.getState().resumeChain(index);
      if (isVertical) {
        continuousListRef.current?.scrollToPage(page);
      } else {
        flatListRef.current?.scrollToIndex({
          index: page - 1,
          animated: false,
        });
      }
    },
    [isVertical],
  );

  const openSearchMode = useCallback(() => setIsSearchMode(true, false), []);
  const openSearchWithFocus = useCallback(
    () => setIsSearchMode(true, true),
    [],
  );

  // Vertical mode callbacks — update the same state as horizontal FlatList
  const handleContinuousPageChange = useCallback(
    (page: number) => {
      if (page !== currentPage) {
        setCurrentPage(page);
        useMushafPlayerStore.setState({currentPage: page});
        mushafSessionStore.setLastReadPage(page);
        const surahId = pageToSurah[page];
        if (surahId) {
          useMushafSettingsStore.getState().updateActiveChain(surahId, page);
        }
      }
    },
    [currentPage, pageToSurah],
  );

  // Mushaf player state
  const mushafPlaybackState = useMushafPlayerStore(s => s.playbackState);
  const isPlayerActive = mushafPlaybackState !== 'idle';

  // Update mushaf player store with current page for auto-page-turn
  useEffect(() => {
    if (isPlayerActive) {
      useMushafPlayerStore.setState({currentPage: currentPage});
    }
  }, [currentPage, isPlayerActive]);

  // Android back handler — exit search mode instead of popping screen
  useEffect(() => {
    if (!isSearchMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsSearchMode(false);
      return true;
    });
    return () => sub.remove();
  }, [isSearchMode]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isVertical
            ? readingColors.background
            : isBookLayout
              ? edgeBg
              : readingColors.card,
        },
      ]}>
      {/* Content area: horizontal FlatList or vertical continuous view */}
      {isVertical && viewMode === 'mushaf' ? (
        <ContinuousMushafView
          ref={continuousListRef}
          textColor={readingColors.text}
          dividerColor={readingColors.textSecondary}
          onTap={toggleImmersive}
          initialPage={currentPage}
          onCurrentPageChange={handleContinuousPageChange}
        />
      ) : isVertical && viewMode === 'list' ? (
        <ContinuousListView
          ref={continuousListRef}
          textColor={readingColors.text}
          labelColor={readingColors.textSecondary}
          borderColor={edgeBorderColor}
          onTap={toggleImmersive}
          initialPage={currentPage}
          onCurrentPageChange={handleContinuousPageChange}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={({item}) => {
            const commonProps = {
              pageNumber: item,
              textColor: readingColors.text,
              surahLabel: getSurahNamesForPage(item),
              juzLabel: `Juz ${getJuzForPage(item)}`,
              pageLabel: String(item),
              labelColor: readingColors.textSecondary,
              borderColor: edgeBorderColor,
              cardColor: pageBg,
              bgColor: edgeBg,
              isBookLayout,
              onTap: toggleImmersive,
            };
            return viewMode === 'list' ? (
              <ReadingPageView {...commonProps} />
            ) : (
              <DKPageView {...commonProps} />
            );
          }}
          keyExtractor={item => item.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(currentPage - 1, TOTAL_PAGES - 1)}
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
      )}

      {/* ================================================================ */}
      {/* Normal mode header — fades out when immersive                    */}
      {/* ================================================================ */}
      <StatusBar hidden={isImmersive && !isSearchMode} animated />

      {!isSearchMode && (
        <>
          {/* Android: custom header (iOS uses Stack navigator header from _layout) */}
          {Platform.OS === 'android' && (
            <Animated.View
              style={[
                styles.header,
                overlayAnimatedStyle,
                {
                  paddingTop: insets.top + moderateScale(8),
                  backgroundColor: theme.colors.background,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.border,
                },
              ]}
              pointerEvents={isImmersive ? 'none' : 'auto'}>
              <View style={styles.headerRow}>
                {/* Left: back button */}
                <View style={styles.headerSide}>
                  <BackButton onPress={() => router.back()} />
                </View>

                {/* Center: tappable surah name + page/juz info */}
                <Pressable
                  style={styles.headerCenter}
                  onPress={openSearchMode}
                  accessibilityRole="button"
                  accessibilityLabel="Search surahs">
                  <View
                    style={[
                      styles.headerBox,
                      {
                        backgroundColor: Color(theme.colors.text)
                          .alpha(0.06)
                          .toString(),
                      },
                    ]}>
                    <View style={styles.headerBoxFirstRow}>
                      <Text
                        style={[
                          styles.headerSurahName,
                          {color: theme.colors.text},
                        ]}
                        numberOfLines={1}>
                        {SURAHS[currentSurahId - 1].name}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={moderateScale(14)}
                        color={theme.colors.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.headerMeta,
                        {color: theme.colors.textSecondary},
                      ]}>
                      Page {currentPage} · Juz {getJuzForPage(currentPage)}
                    </Text>
                  </View>
                </Pressable>

                {/* Right: settings */}
                <View style={[styles.headerSide, {alignItems: 'flex-end'}]}>
                  <Pressable
                    style={styles.headerIcon}
                    onPress={() =>
                      SheetManager.show('mushaf-layout', {
                        payload: {context: 'mushaf'},
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Mushaf settings">
                    <Ionicons
                      name="options-outline"
                      size={moderateScale(22)}
                      color={theme.colors.text}
                    />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ================================================================ */}
          {/* Normal mode bottom bar — Android only (iOS uses Stack.Toolbar)  */}
          {/* ================================================================ */}
          {Platform.OS === 'android' && (
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
              <MushafPlayerBar
                currentPage={currentPage}
                onSearch={openSearchWithFocus}
              />
            </Animated.View>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* Search mode overlay                                               */}
      {/* ================================================================ */}
      {isSearchMode && (
        <MushafSearchView
          onNavigateToPage={navigateToPage}
          onResumeChain={resumeChain}
          onNavigateToSurah={navigateToSurah}
          onNavigateToVerse={navigateToVerse}
          onClose={() => setIsSearchMode(false)}
          surahStartPages={surahStartPages}
          pageToSurah={pageToSurah}
          autoFocusSearch={autoFocusSearch}
        />
      )}
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
    paddingHorizontal: moderateScale(12),
    paddingBottom: moderateScale(8),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: moderateScale(44),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(10),
  },
  headerBoxFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  headerSurahName: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
  },
  headerMeta: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
  },
  headerIcon: {
    padding: moderateScale(6),
  },

  // Normal mode bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
