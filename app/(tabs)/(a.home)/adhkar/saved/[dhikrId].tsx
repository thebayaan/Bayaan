import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  FlatList,
  ViewToken,
  type LayoutChangeEvent,
} from 'react-native';
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  useFocusEffect,
} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {resolveViewableChange} from '@/components/adhkar/playAllScrollGuard';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {toSessionItems} from '@/services/adhkar/playback/sessionReducer';
import {
  setAdhkarFocus,
  clearAdhkarFocus,
  type AdhkarFocus,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {AdhkarSessionSourceProvider} from '@/components/adhkar/AdhkarSessionSourceContext';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useBottomInset} from '@/hooks/useBottomInset';
// @ai-start
import {useTranslation} from 'react-i18next';
import {appLayoutDirection} from '@/utils/rtl';
// @ai-end

const DhikrPage = React.memo(function DhikrPage({
  dhikr,
  isSaved,
  onSaveToggle,
  width,
}: {
  dhikr: Dhikr;
  isSaved: boolean;
  onSaveToggle: () => void;
  width: number; // @ai: the pager's measured width
}) {
  return (
    <View style={{width, flex: 1}}>
      <DhikrReader
        dhikr={dhikr}
        isSaved={isSaved}
        onSaveToggle={onSaveToggle}
      />
    </View>
  );
});

// @ai-start
const SavedDhikrReaderScreen: React.FC = () => {
  const {dhikrId, globalIndex: globalIndexParam} = useLocalSearchParams<{
    dhikrId: string;
    globalIndex?: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  // Glass headers are transparent, so content is padded below them. The
  // non-glass header is opaque and already takes its own space; padding
  // by headerHeight there would leave a blank band of that height.
  const contentTop = USE_GLASS ? headerHeight : 0;
  // Non-glass tab bars (and the floating player) overlay the screen, so the
  // page must clear them; glass keeps the safe-area inset only.
  const bottomInset = useBottomInset();
  const contentBottom = USE_GLASS ? insets.bottom : bottomInset;
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  const [initialIndex, setInitialIndex] = useState(
    globalIndexParam ? parseInt(globalIndexParam, 10) : 0,
  );

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved, savedIds} = useAdhkar();

  const session = useAdhkarSessionStore(s => s.session);
  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const isThisAllSession =
    session?.listId === 'saved' && session.mode === 'all';
  const sessionDhikrId =
    session?.listId === 'saved'
      ? (session.items[session.index]?.dhikrId ?? null)
      : null;
  // Where the session's dhikr sits in this screen's rows. session.index
  // counts the session's own items, which can drift from this list.
  const sessionIndex = useMemo(() => {
    if (sessionDhikrId === null) return null;
    const found = adhkarList.findIndex(d => d.id === sessionDhikrId);
    return found < 0 ? null : found;
  }, [sessionDhikrId, adhkarList]);

  // Load saved adhkar
  useEffect(() => {
    async function loadData() {
      try {
        const saved = await adhkarService.getSaved();

        // Fetch full dhikr data for each saved item
        const adhkarPromises = saved.map((s: SavedDhikr) =>
          adhkarService.getDhikr(s.dhikrId),
        );
        const adhkarResults = await Promise.all(adhkarPromises);

        // Filter out nulls
        const validAdhkar = adhkarResults.filter((d): d is Dhikr => d !== null);
        setAdhkarList(validAdhkar);
        const opened = validAdhkar.findIndex(d => d.id === dhikrId);
        if (opened >= 0) {
          setInitialIndex(opened);
          setCurrentIndex(opened);
        }
      } catch (error) {
        console.error('Failed to load saved adhkar:', error);
      } finally {
        setIsDataLoaded(true);
      }
    }

    loadData();
    // The opened dhikr only seeds the first position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update list when saved items change (item unsaved)
  useEffect(() => {
    if (isDataLoaded) {
      // Filter current list to only include items still saved
      setAdhkarList(prev => prev.filter(d => savedIds.has(d.id)));
    }
  }, [savedIds, isDataLoaded]);

  const sessionSource = useMemo(
    () =>
      adhkarList.length > 0
        ? {
            listId: 'saved',
            listTitle: t('adhkar.saved'),
            items: toSessionItems(adhkarList),
          }
        : null,
    [adhkarList, t],
  );

  // Follow the session when it advances through this list in Play All.
  // Row a Play All auto-scroll is heading to; null when no such scroll is in
  // flight. Viewable changes until it lands are not user swipes.
  const playAllScrollTarget = useRef<number | null>(null);
  // Follow only a change of the session's dhikr, never a paused or restored
  // session that merely points elsewhere when the reader opens.
  const followedDhikrId = useRef(sessionDhikrId);
  useEffect(() => {
    if (!isDataLoaded) return;
    if (sessionDhikrId === followedDhikrId.current) return;
    followedDhikrId.current = sessionDhikrId;
    if (!isThisAllSession || sessionIndex === null) return;
    if (sessionIndex === currentIndex) return;
    playAllScrollTarget.current = sessionIndex;
    flatListRef.current?.scrollToIndex({
      index: sessionIndex,
      animated: true,
    });
    setCurrentIndex(sessionIndex);
  }, [
    isThisAllSession,
    sessionDhikrId,
    sessionIndex,
    currentIndex,
    isDataLoaded,
  ]);

  // A surface asked to show the playing dhikr.
  const lastReveal = useRef(revealToken);
  useEffect(() => {
    if (revealToken === lastReveal.current) return;
    // Not this list's session: drop the request.
    if (sessionIndex === null) {
      lastReveal.current = revealToken;
      return;
    }
    // Still loading: keep the request pending until the rows exist.
    if (!isDataLoaded) return;
    lastReveal.current = revealToken;
    playAllScrollTarget.current = sessionIndex;
    flatListRef.current?.scrollToIndex({index: sessionIndex, animated: true});
    setCurrentIndex(sessionIndex);
  }, [revealToken, sessionIndex, isDataLoaded]);

  useFocusEffect(
    useCallback(() => {
      const mine: AdhkarFocus = {kind: 'reader', listId: 'saved'};
      setAdhkarFocus(mine);
      return () => clearAdhkarFocus(mine);
    }, []),
  );

  // Set native header with title + position subtitle
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerTitle: () => (
        <View style={{alignItems: 'center'}}>
          <Text
            style={{
              fontSize: moderateScale(16),
              fontFamily: theme.fonts.semiBold,
              color: theme.colors.text,
            }}>
            {t('adhkar.saved')}
          </Text>
          {adhkarList.length > 1 && (
            <Text
              style={{
                fontSize: moderateScale(12),
                fontFamily: theme.fonts.regular,
                color: theme.colors.textSecondary,
                marginTop: moderateScale(2),
              }}>
              {t('adhkar.position', {
                current: currentIndex + 1,
                total: adhkarList.length,
              })}
            </Text>
          )}
        </View>
      ),
    });
  }, [navigation, currentIndex, adhkarList.length, theme, t]);

  const handleSaveToggle = useCallback(
    (dhikr: Dhikr) => {
      toggleSaved(dhikr.id);
    },
    [toggleSaved],
  );

  // The first viewability report is the page the reader opened on, not a
  // user swipe.
  const sawFirstViewable = useRef(false);
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken<Dhikr>[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);
        if (!sawFirstViewable.current) {
          sawFirstViewable.current = true;
          return;
        }

        // Move the session when the user manually swipes (not from Play All
        // auto-scroll, which may pass several rows before it lands)
        const change = resolveViewableChange(
          playAllScrollTarget.current,
          newIndex,
        );
        playAllScrollTarget.current = change.target;
        if (
          isThisAllSession &&
          newIndex !== sessionIndex &&
          change.isUserSwipe
        ) {
          dispatch({
            type: 'swipedTo',
            listId: 'saved',
            dhikrId: viewableItems[0].item.id,
          });
        }
      }
    },
    [isThisAllSession, sessionIndex, dispatch],
  );

  // A drag is the user taking over, even mid auto-scroll.
  const handleScrollBeginDrag = useCallback(() => {
    playAllScrollTarget.current = null;
  }, []);

  // Any scroll that comes to rest ends the auto-scroll, even one that moved
  // nothing.
  const handleMomentumScrollEnd = useCallback(() => {
    playAllScrollTarget.current = null;
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // @ai-start
  // Pages are as wide as the pager itself, not the window: on iPad the
  // reader sits in a capped column beside the sidebar, where window-wide
  // pages were clipped and off-centre. The list waits for this measurement.
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const handlePagerLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setPageWidth(prev => (prev === next ? prev : next));
  }, []);

  // Keep the current page in place if the width changes later (rotation,
  // Split View).
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const lastPageWidth = useRef<number | null>(null);
  useEffect(() => {
    if (pageWidth === null) return;
    const previous = lastPageWidth.current;
    lastPageWidth.current = pageWidth;
    if (previous === null || previous === pageWidth) return;
    flatListRef.current?.scrollToOffset({
      offset: currentIndexRef.current * pageWidth,
      animated: false,
    });
  }, [pageWidth]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth ?? 0,
      offset: (pageWidth ?? 0) * index,
      index,
    }),
    [pageWidth],
  );
  // @ai-end

  const renderItem = useCallback(
    ({item}: {item: Dhikr}) => {
      return (
        <DhikrPage
          dhikr={item}
          isSaved={isSaved(item.id)}
          onSaveToggle={() => handleSaveToggle(item)}
          width={pageWidth ?? 0} // @ai
        />
      );
    },
    [isSaved, handleSaveToggle, pageWidth],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

  if (!dhikrId) {
    return null;
  }

  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: contentTop}]}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  if (adhkarList.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: contentTop}]}>
          <Text style={styles.emptyText}>{t('adhkar.noSaved')}</Text>
        </View>
      </View>
    );
  }

  return (
    <AdhkarSessionSourceProvider source={sessionSource}>
      <View style={styles.container}>
        <View
          style={[
            styles.listContainer,
            {paddingTop: contentTop, paddingBottom: contentBottom},
          ]}
          onLayout={handlePagerLayout}>
          {/* @ai: render once the pager width is known */}
          {pageWidth !== null && (
            <FlatList
              ref={flatListRef}
              style={appLayoutDirection}
              data={adhkarList}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={getItemLayout}
              onViewableItemsChanged={onViewableItemsChanged}
              onScrollBeginDrag={handleScrollBeginDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              viewabilityConfig={viewabilityConfig}
              windowSize={3}
              maxToRenderPerBatch={2}
              removeClippedSubviews={true}
              initialNumToRender={1}
              decelerationRate="fast"
              snapToInterval={pageWidth}
              snapToAlignment="start"
            />
          )}
        </View>
      </View>
    </AdhkarSessionSourceProvider>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContainer: {
      flex: 1,
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

export default SavedDhikrReaderScreen;
