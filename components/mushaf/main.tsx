import React, {useState, useMemo, useRef, useCallback, useEffect} from 'react';
import {useKeepAwake} from 'expo-keep-awake';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ScrollView,
  ViewToken,
  StatusBar,
  BackHandler,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {useResponsive} from '@/hooks/useResponsive';
import {FlatList} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useRouter, useNavigation} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {Ionicons, Feather} from '@expo/vector-icons';
import {mushafShareUrl, shareUrl} from '@/utils/shareUtils';
import {SheetManager} from 'react-native-actions-sheet';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {BackButton} from '@/components/BackButton';
import MushafSearchView from './MushafSearchView';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  getJuzForPage,
  getPageEdgeLayout,
  useMushafLayout,
  type MushafLayoutMetrics,
} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {SURAHS} from '@/data/surahData';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
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
import {analyticsService} from '@/services/analytics/AnalyticsService';

const TOTAL_PAGES = 604;
const ANIMATION_DURATION = 300;

// ============================================================================
// Spread helpers — iPad landscape renders two facing pages per FlatList item.
// Spread N (0-indexed) contains pages (2N+1, 2N+2), with the odd page on the
// right and the even page on the left (standard RTL mushaf convention).
// ============================================================================
interface Spread {
  /** Odd-numbered page (right side in RTL reading order). */
  right: number;
  /** Even-numbered page (left side). `null` only if the mushaf has an odd
   *  total page count — for 604 pages every spread has both. */
  left: number | null;
}

const SPREAD_COUNT = Math.ceil(TOTAL_PAGES / 2);

function pageToSpreadIndex(page: number): number {
  return Math.floor((page - 1) / 2);
}

function spreadPrimaryPage(spread: Spread): number {
  return spread.right;
}

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
  metrics: MushafLayoutMetrics;
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
  metrics,
  onTap,
}) => {
  const [pageReady, setPageReady] = useState(false);
  const insets = useSafeAreaInsets();

  const {isRightPage, contentMarginLeft} = useMemo(
    () => getPageEdgeLayout(pageNumber),
    [pageNumber],
  );

  // On tablet single-page views there is no facing page on the "spine" side,
  // so the asymmetric book-edge look leaves a sharp corner floating in empty
  // edgeBg — the user perceives that as a clipped / cut-off card. Render
  // with all four corners rounded instead. `facingPages` is still the source
  // of truth: once we add the real two-page spread, that path will use the
  // asymmetric decoration on each half of the spread.
  const useSymmetricEdges =
    isBookLayout &&
    !metrics.facingPages &&
    metrics.pageWidth < metrics.screenWidth;

  // In fullscreen mode, use symmetric padding; in book mode the content sits
  // against the spine. When we force symmetric edges on tablet single-page
  // we also symmetric-center the content so labels and page number align
  // with the centered card.
  const effectiveMarginLeft =
    isBookLayout && !useSymmetricEdges ? contentMarginLeft : undefined;
  const effectiveOuterMargin =
    isBookLayout && !useSymmetricEdges
      ? metrics.pageWidth - contentMarginLeft - metrics.contentWidth
      : metrics.paddingHorizontal;
  const effectiveLabelLeft =
    isBookLayout && !useSymmetricEdges
      ? contentMarginLeft + 8
      : metrics.paddingHorizontal + 8;

  // Center page number vertically between content bottom and bottom border
  const pageNumberBottom = isBookLayout
    ? insets.top + (metrics.paddingBottom - insets.top) / 2 - 8
    : metrics.paddingBottom - 35;

  return (
    <View
      style={{
        width: metrics.pageWidth,
        height: metrics.screenHeight,
        backgroundColor: isBookLayout ? bgColor : cardColor,
        opacity: pageReady ? 1 : 0,
      }}>
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
              useSymmetricEdges
                ? {
                    left: EDGE_HORIZONTAL_INSET,
                    right: EDGE_HORIZONTAL_INSET,
                    borderTopLeftRadius: EDGE_BORDER_RADIUS,
                    borderBottomLeftRadius: EDGE_BORDER_RADIUS,
                    borderTopRightRadius: EDGE_BORDER_RADIUS,
                    borderBottomRightRadius: EDGE_BORDER_RADIUS,
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
        screenWidth={metrics.pageWidth}
        screenHeight={metrics.screenHeight}
        contentWidth={metrics.contentWidth}
        contentHeight={metrics.contentHeight}
        baseLineHeight={metrics.baseLineHeight}
        paddingHorizontal={metrics.paddingHorizontal}
        paddingTop={metrics.paddingTop}
      />
      {isBookLayout && (
        <PageEdgeDecoration
          isRightPage={isRightPage}
          borderColor={borderColor}
          pageColor={cardColor}
          symmetric={useSymmetricEdges}
        />
      )}
      {/* Surah name(s) — top left */}
      <Text
        style={[
          styles.pageLabel,
          {
            color: labelColor,
            top: metrics.paddingTop - 30,
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
            top: metrics.paddingTop - 30,
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
// DKSpreadView: FlatList item that hosts either a single centered page
// (phone + iPad portrait) or two facing pages (iPad landscape).
//
// When `metrics.facingPages` is true, the view renders
//   [ even-page | gap | odd-page ]
// so RTL reading order (right → left) matches a physical mushaf.
// ============================================================================
const DKSpreadView: React.FC<{
  /** Primary page (odd / right side in facing mode). */
  pageNumber: number;
  /** Facing left page (even). Only used when `metrics.facingPages` is true. */
  leftPageNumber?: number | null;
  textColor: string;
  labelColor: string;
  borderColor: string;
  cardColor: string;
  bgColor: string;
  edgeBg: string;
  isBookLayout: boolean;
  metrics: MushafLayoutMetrics;
  onTap?: () => void;
}> = ({
  pageNumber,
  leftPageNumber,
  textColor,
  labelColor,
  borderColor,
  cardColor,
  bgColor,
  edgeBg,
  isBookLayout,
  metrics,
  onTap,
}) => {
  const spreadBg = isBookLayout ? edgeBg : cardColor;

  // Phone landscape: full-width scrollable page.
  if (metrics.scrollContainerHeight) {
    return (
      <ScrollView
        style={{
          width: metrics.screenWidth,
          height: metrics.scrollContainerHeight,
          backgroundColor: spreadBg,
        }}
        contentContainerStyle={{height: metrics.screenHeight}}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <DKPageView
          pageNumber={pageNumber}
          textColor={textColor}
          surahLabel={getSurahNamesForPage(pageNumber)}
          juzLabel={`Juz ${getJuzForPage(pageNumber)}`}
          pageLabel={String(pageNumber)}
          labelColor={labelColor}
          borderColor={borderColor}
          cardColor={cardColor}
          bgColor={bgColor}
          isBookLayout={isBookLayout}
          metrics={metrics}
          onTap={onTap}
        />
      </ScrollView>
    );
  }

  // Fast-path for phones: width === screenWidth + offset === 0 means the
  // outer wrapper is a no-op, matching the pre-iPad layout byte-for-byte.
  const needsCentering = metrics.pageWidth < metrics.screenWidth;

  if (!needsCentering) {
    return (
      <DKPageView
        pageNumber={pageNumber}
        textColor={textColor}
        surahLabel={getSurahNamesForPage(pageNumber)}
        juzLabel={`Juz ${getJuzForPage(pageNumber)}`}
        pageLabel={String(pageNumber)}
        labelColor={labelColor}
        borderColor={borderColor}
        cardColor={cardColor}
        bgColor={bgColor}
        isBookLayout={isBookLayout}
        metrics={metrics}
        onTap={onTap}
      />
    );
  }

  // iPad landscape: render two facing pages side by side. Even page on the
  // left, odd page on the right. The inner DKPageView sizes itself with
  // `metrics.pageWidth` so the pair fits within `screenWidth` with
  // `facingGap` breathing room.
  if (metrics.facingPages && leftPageNumber != null) {
    return (
      <View
        style={{
          width: metrics.screenWidth,
          height: metrics.screenHeight,
          backgroundColor: spreadBg,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <DKPageView
          pageNumber={leftPageNumber}
          textColor={textColor}
          surahLabel={getSurahNamesForPage(leftPageNumber)}
          juzLabel={`Juz ${getJuzForPage(leftPageNumber)}`}
          pageLabel={String(leftPageNumber)}
          labelColor={labelColor}
          borderColor={borderColor}
          cardColor={cardColor}
          bgColor={bgColor}
          isBookLayout={isBookLayout}
          metrics={metrics}
          onTap={onTap}
        />
        <View style={{width: metrics.facingGap, height: '100%'}} />
        <DKPageView
          pageNumber={pageNumber}
          textColor={textColor}
          surahLabel={getSurahNamesForPage(pageNumber)}
          juzLabel={`Juz ${getJuzForPage(pageNumber)}`}
          pageLabel={String(pageNumber)}
          labelColor={labelColor}
          borderColor={borderColor}
          cardColor={cardColor}
          bgColor={bgColor}
          isBookLayout={isBookLayout}
          metrics={metrics}
          onTap={onTap}
        />
      </View>
    );
  }

  // iPad portrait single-page: centered in spread area.
  return (
    <View
      style={{
        width: metrics.screenWidth,
        height: metrics.screenHeight,
        backgroundColor: spreadBg,
        alignItems: 'center',
      }}>
      <DKPageView
        pageNumber={pageNumber}
        textColor={textColor}
        surahLabel={getSurahNamesForPage(pageNumber)}
        juzLabel={`Juz ${getJuzForPage(pageNumber)}`}
        pageLabel={String(pageNumber)}
        labelColor={labelColor}
        borderColor={borderColor}
        cardColor={cardColor}
        bgColor={bgColor}
        isBookLayout={isBookLayout}
        metrics={metrics}
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
  // iOS 26: sync search mode from store (toolbar search button sets store directly)
  const storeSearchMode = useMushafPlayerStore(s => s.isSearchMode);
  useEffect(() => {
    if (!USE_GLASS) return;
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
  const rewayah = useMushafSettingsStore(s => s.rewayah);
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
  const {isTablet} = useResponsive();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();

  // Measured size of the FlatList container. Using `useWindowDimensions()`
  // alone overestimates the available space on iPad because the stack
  // header and toolbar eat real pixels that `useSafeAreaInsets()` does not
  // report. `onLayout` gives us the exact space the pages actually own.
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setContainerSize(prev => {
      if (prev && prev.width === width && prev.height === height) return prev;
      return {width, height};
    });
  }, []);

  // On rotation the measured size is stale for a frame — fall back to window
  // dims until `onLayout` reports the new size.
  useEffect(() => {
    setContainerSize(null);
  }, [windowWidth, windowHeight]);

  // Live mushaf layout metrics — tracks rotation / iPad / safe area.
  // On non-glass devices the `MushafPlayerBar` renders as a fixed-height
  // absolute bar; account for it so the page never sits underneath.
  //
  // Phone path: keep behaviour identical — don't pass measured dims so the
  // existing frozen-padding math still applies.
  // Tablet path: always use measured dims (falls back to window on first frame).
  const metrics = useMushafLayout({
    insets,
    toolbarHeight: USE_GLASS ? 0 : 60,
    headerHeight: USE_GLASS ? 0 : 60,
    containerWidth: isTablet ? containerSize?.width : undefined,
    containerHeight: isTablet ? containerSize?.height : undefined,
  });

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

  // Spread list — only used when `metrics.facingPages` is true (iPad
  // landscape). Kept stable across renders to avoid re-triggering FlatList
  // recycling on every metrics change.
  const spreads = useMemo<Spread[]>(
    () =>
      Array.from({length: SPREAD_COUNT}, (_, i) => {
        const right = i * 2 + 1;
        const left = i * 2 + 2;
        return {right, left: left > TOTAL_PAGES ? null : left};
      }),
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

  // --- Analytics: mushaf page tracking ---
  const pageReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageVisibleSinceRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const pagesOpenedRef = useRef<number>(1);
  const pagesReadRef = useRef<number>(0);

  const trackPageChange = useCallback(
    (page: number) => {
      const surahId = pageToSurah[page] || 1;
      const juzNumber = getJuzForPage(page);

      // Fire page_opened
      analyticsService.trackMushafPageOpened({
        page_number: page,
        surah_id: surahId,
        juz_number: juzNumber,
      });
      pagesOpenedRef.current += 1;

      // Clear existing page_read timer
      if (pageReadTimerRef.current) {
        clearTimeout(pageReadTimerRef.current);
      }

      // Start new 15s timer for page_read
      pageVisibleSinceRef.current = Date.now();
      pageReadTimerRef.current = setTimeout(() => {
        const durationMs = Date.now() - pageVisibleSinceRef.current;
        analyticsService.trackMushafPageRead({
          page_number: page,
          duration_ms: durationMs,
          surah_id: surahId,
        });
        pagesReadRef.current += 1;
      }, 15_000);
    },
    [pageToSurah],
  );

  // Track initial page + start page_read timer on mount
  useEffect(() => {
    trackPageChange(initialPage);
    return () => {
      // Session ended on unmount
      if (pageReadTimerRef.current) {
        clearTimeout(pageReadTimerRef.current);
      }
      analyticsService.trackMushafSessionEnded({
        pages_opened: pagesOpenedRef.current,
        pages_read: pagesReadRef.current,
        total_duration_ms: Date.now() - sessionStartRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSharePage = useCallback(() => {
    const url = mushafShareUrl(currentPage, isDarkMode ? 'dark' : 'light');
    shareUrl(url, `Check out page ${currentPage} of the Quran on Bayaan`);
  }, [currentPage, isDarkMode]);

  // iOS 26: configure Stack navigator header based on current mode
  useEffect(() => {
    if (!USE_GLASS) return;

    if (isImmersive || isSearchMode) {
      // Hide native header — search overlay renders its own UI
      navigation.setOptions({
        headerShown: false,
        headerSearchBarOptions: undefined,
      });
      return;
    }

    // Normal mode: Glass/blur title + options button
    const TitleWrapper = USE_GLASS ? GlassView : FrostedView;
    const titleWrapperProps = USE_GLASS
      ? {
          glassEffectStyle: 'regular' as const,
          colorScheme: glassColorScheme,
          tintColor: isDarkMode ? 'rgba(0,0,0,0.5)' : undefined,
        }
      : {};
    navigation.setOptions({
      headerShown: true,
      headerBackVisible: true,
      headerSearchBarOptions: undefined,
      headerTitle: () => (
        <TitleWrapper
          {...titleWrapperProps}
          style={{
            borderRadius: moderateScale(14),
            paddingHorizontal: moderateScale(14),
            paddingVertical: moderateScale(6),
            overflow: 'hidden' as const,
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
              Page {currentPage} · Juz {getJuzForPage(currentPage)} ·{' '}
              {getRewayahShortLabel(rewayah)}
            </Text>
          </Pressable>
        </TitleWrapper>
      ),
      headerLeft: undefined,
      headerRight: () => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: moderateScale(20),
            paddingHorizontal: moderateScale(6),
          }}>
          <Pressable onPress={handleSharePage} hitSlop={8}>
            <Feather
              name="share"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() =>
              SheetManager.show('mushaf-layout', {
                payload: {context: 'mushaf'},
              })
            }
            hitSlop={8}>
            <Ionicons
              name="options-outline"
              size={moderateScale(22)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      ),
    });
  }, [
    isImmersive,
    isSearchMode,
    currentPage,
    currentSurahId,
    rewayah,
    handleSharePage,
    theme,
    isDarkMode,
    navigation,
  ]);

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length === 0) return;
      const first = viewableItems[0].item;
      if (first == null) return;
      // Page number depends on data shape: `number` for single-page data,
      // `Spread` object for facing-pages data.
      const page: number =
        typeof first === 'number' ? first : spreadPrimaryPage(first as Spread);
      setCurrentPage(page);
      useMushafPlayerStore.setState({currentPage: page});
      mushafSessionStore.setLastReadPage(page);
      trackPageChange(page);
      const surahId = digitalKhattDataService.initialized
        ? digitalKhattDataService.getPageToSurah()[page]
        : undefined;
      if (surahId) {
        useMushafSettingsStore.getState().updateActiveChain(surahId, page);
      }
    },
    [trackPageChange],
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    [],
  );

  // Convert a logical page number to the current FlatList's item index
  // (spread index when facing-pages is active, page index otherwise).
  const pageToFlatListIndex = useCallback(
    (page: number) =>
      metrics.facingPages ? pageToSpreadIndex(page) : page - 1,
    [metrics.facingPages],
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
          index: pageToFlatListIndex(targetPage),
          animated: false,
        });
      }
    },
    [isVertical, pageToFlatListIndex],
  );

  const navigateToPageAnimated = useCallback(
    (targetPage: number) => {
      if (isVertical) {
        continuousListRef.current?.scrollToPage(targetPage, true);
      } else {
        flatListRef.current?.scrollToIndex({
          index: pageToFlatListIndex(targetPage),
          animated: true,
        });
      }
    },
    [isVertical, pageToFlatListIndex],
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
          index: pageToFlatListIndex(page),
          animated: false,
        });
      }
    },
    [isVertical, pageToFlatListIndex],
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
        trackPageChange(page);
        const surahId = pageToSurah[page];
        if (surahId) {
          useMushafSettingsStore.getState().updateActiveChain(surahId, page);
        }
      }
    },
    [currentPage, pageToSurah, trackPageChange],
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
      onLayout={onContainerLayout}
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
          metrics={metrics}
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
      ) : metrics.facingPages && viewMode === 'mushaf' ? (
        <FlatList
          ref={flatListRef}
          data={spreads}
          renderItem={({item}) => (
            <DKSpreadView
              pageNumber={item.right}
              leftPageNumber={item.left}
              textColor={readingColors.text}
              labelColor={readingColors.textSecondary}
              borderColor={edgeBorderColor}
              cardColor={pageBg}
              bgColor={edgeBg}
              edgeBg={edgeBg}
              isBookLayout={isBookLayout}
              metrics={metrics}
              onTap={toggleImmersive}
            />
          )}
          keyExtractor={item => `spread-${item.right}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(
            pageToSpreadIndex(currentPage),
            SPREAD_COUNT - 1,
          )}
          getItemLayout={(_, index) => ({
            length: metrics.screenWidth,
            offset: metrics.screenWidth * index,
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
      ) : (
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={({item}) => {
            if (viewMode === 'list') {
              return (
                <ReadingPageView
                  pageNumber={item}
                  textColor={readingColors.text}
                  surahLabel={getSurahNamesForPage(item)}
                  juzLabel={`Juz ${getJuzForPage(item)}`}
                  pageLabel={String(item)}
                  labelColor={readingColors.textSecondary}
                  borderColor={edgeBorderColor}
                  cardColor={pageBg}
                  bgColor={edgeBg}
                  isBookLayout={isBookLayout}
                  onTap={toggleImmersive}
                />
              );
            }
            return (
              <DKSpreadView
                pageNumber={item}
                textColor={readingColors.text}
                labelColor={readingColors.textSecondary}
                borderColor={edgeBorderColor}
                cardColor={pageBg}
                bgColor={edgeBg}
                edgeBg={edgeBg}
                isBookLayout={isBookLayout}
                metrics={metrics}
                onTap={toggleImmersive}
              />
            );
          }}
          keyExtractor={item => item.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(currentPage - 1, TOTAL_PAGES - 1)}
          getItemLayout={(_, index) => ({
            length: metrics.screenWidth,
            offset: metrics.screenWidth * index,
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
          {/* Non-glass: custom header (iOS 26 uses Stack navigator header) */}
          {!USE_GLASS && (
            <Animated.View
              style={[
                styles.header,
                overlayAnimatedStyle,
                {
                  paddingTop: insets.top + moderateScale(8),
                  paddingLeft: Math.max(insets.left, moderateScale(12)),
                  paddingRight: Math.max(insets.right, moderateScale(12)),
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
                      Page {currentPage} · Juz {getJuzForPage(currentPage)} ·{' '}
                      {getRewayahShortLabel(rewayah)}
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
          {/* Normal mode bottom bar — non-glass (iOS 26 uses Stack.Toolbar)  */}
          {/* ================================================================ */}
          {!USE_GLASS && (
            <Animated.View
              style={[
                styles.bottomBar,
                overlayAnimatedStyle,
                {
                  paddingBottom: insets.bottom + 8,
                  paddingLeft: insets.left,
                  paddingRight: insets.right,
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
    // width and height are provided inline per-page so pages stay in sync
    // with live window dimensions (rotation / iPad split-view aware).
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
