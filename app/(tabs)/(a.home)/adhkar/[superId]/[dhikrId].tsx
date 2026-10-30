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
  type LayoutChangeEvent, // @ai
  type ListViewToken,
  Pressable,
} from 'react-native';
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  useFocusEffect,
} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {resolveViewableChange} from '@/components/adhkar/playAllScrollGuard';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {
  getSuperCategoryDisplayTitle,
  shortenCategoryTitle,
} from '@/utils/adhkarUtils';
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
import {dhikrShareUrl, shareUrl} from '@/utils/shareUtils';
import branding from '@/config/branding';
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

interface CategoryTitleMap {
  [categoryId: string]: string;
}

// @ai-start
const DhikrReaderScreen: React.FC = () => {
  const {
    superId,
    dhikrId,
    globalIndex: globalIndexParam,
    categoryShortTitle: initialCategoryTitle,
    superCategoryTitle,
  } = useLocalSearchParams<{
    superId: string;
    dhikrId: string;
    globalIndex?: string;
    categoryShortTitle?: string;
    superCategoryTitle?: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  // Glass headers are transparent, so content is padded below them. The
  // non-glass header is opaque and already takes its own space; padding
  // by headerHeight there would leave a blank band of that height.
  const contentTop = USE_GLASS ? headerHeight : 0;
  // Non-glass tab bars (and the floating player) overlay the screen, so the
  // page must clear them; glass keeps the safe-area inset only.
  const bottomInset = useBottomInset();
  // @ai: the pager is not a scroll view, so the native tab bar does not
  // inset it; clear the tab bar and mini player on every platform, or the
  // dhikr's play/copy/share row sits under the floating player.
  const contentBottom = bottomInset;
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  const [initialIndex, setInitialIndex] = useState(
    globalIndexParam ? parseInt(globalIndexParam, 10) : 0,
  );

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [categoryTitles, setCategoryTitles] = useState<CategoryTitleMap>({});
  const [loadedListTitle, setLoadedListTitle] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved} = useAdhkar();

  const session = useAdhkarSessionStore(s => s.session);
  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const isThisAllSession =
    session?.listId === superId && session.mode === 'all';
  const sessionDhikrId =
    session?.listId === superId
      ? (session.items[session.index]?.dhikrId ?? null)
      : null;
  // Where the session's dhikr sits in this screen's rows. session.index
  // counts the session's own items, which can drift from this list.
  const sessionIndex = useMemo(() => {
    if (sessionDhikrId === null) return null;
    const found = adhkarList.findIndex(d => d.id === sessionDhikrId);
    return found < 0 ? null : found;
  }, [sessionDhikrId, adhkarList]);

  useEffect(() => {
    async function loadData() {
      if (!superId) {
        setIsDataLoaded(true);
        return;
      }

      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          const flatAdhkar = data.categoryGroups.flatMap(g => g.adhkar);
          setAdhkarList(flatAdhkar);
          setLoadedListTitle(getSuperCategoryDisplayTitle(data.superCategory));
          const opened = flatAdhkar.findIndex(d => d.id === dhikrId);
          if (opened >= 0) {
            setInitialIndex(opened);
            setCurrentIndex(opened);
          }

          const titlesMap: CategoryTitleMap = {};
          data.categoryGroups.forEach(group => {
            titlesMap[group.categoryId] = shortenCategoryTitle(
              group.categoryTitle,
            );
          });
          setCategoryTitles(titlesMap);
        }
      } catch (error) {
        console.error('Failed to load adhkar data:', error);
      } finally {
        setIsDataLoaded(true);
      }
    }

    loadData();
    // The opened dhikr only seeds the first position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superId]);

  const currentDhikr = useMemo(() => {
    return adhkarList[currentIndex] || null;
  }, [adhkarList, currentIndex]);

  const sessionSource = useMemo(
    () =>
      superId && adhkarList.length > 0
        ? {
            listId: superId,
            listTitle:
              superCategoryTitle || loadedListTitle || t('adhkar.dhikr'),
            items: toSessionItems(adhkarList),
          }
        : null,
    [superId, adhkarList, superCategoryTitle, loadedListTitle, t],
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
      if (!superId) return;
      const mine: AdhkarFocus = {kind: 'reader', listId: superId};
      setAdhkarFocus(mine);
      return () => clearAdhkarFocus(mine);
    }, [superId]),
  );

  const displayTitle = useMemo(() => {
    if (currentDhikr && categoryTitles[currentDhikr.categoryId]) {
      return categoryTitles[currentDhikr.categoryId];
    }
    return initialCategoryTitle || superCategoryTitle || t('adhkar.dhikr');
  }, [
    currentDhikr,
    categoryTitles,
    initialCategoryTitle,
    superCategoryTitle,
    t,
  ]);

  const handleShareDhikr = useCallback(() => {
    if (!superId || !currentDhikr) return;
    const url = dhikrShareUrl(superId, currentDhikr.id);
    shareUrl(url, t('adhkar.shareDhikr', {appName: branding.appName}));
  }, [superId, currentDhikr, t]);

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
            }}
            numberOfLines={1}>
            {displayTitle}
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
      headerRight: () => (
        <Pressable
          onPress={handleShareDhikr}
          hitSlop={8}
          style={{
            padding: moderateScale(4),
            paddingHorizontal: moderateScale(8),
          }}>
          <Feather
            name="share"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      ),
    });
  }, [
    navigation,
    displayTitle,
    currentIndex,
    adhkarList.length,
    handleShareDhikr,
    theme,
    t,
  ]);

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
    ({viewableItems}: {viewableItems: (ListViewToken & {item: Dhikr})[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
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
          change.isUserSwipe &&
          superId
        ) {
          dispatch({
            type: 'swipedTo',
            listId: superId,
            dhikrId: viewableItems[0].item.id,
          });
        }
      }
    },
    [isThisAllSession, sessionIndex, superId, dispatch],
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

  if (!dhikrId || !superId) {
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
          <Text style={styles.emptyText}>{t('adhkar.noneFound')}</Text>
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

export default DhikrReaderScreen;
