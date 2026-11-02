import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
} from 'react';
import {View, Text, FlatList, Pressable, StyleSheet} from 'react-native';
import {useRouter, useNavigation, useFocusEffect, Link} from 'expo-router';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Ionicons} from '@expo/vector-icons';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import {
  AdhkarJumpPill,
  jumpPillDirection,
  visibleRowIndices,
  type RowToken,
} from '@/components/adhkar/AdhkarJumpPill';
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {
  playAllState,
  toSessionItems,
} from '@/services/adhkar/playback/sessionReducer';
import {
  setAdhkarFocus,
  clearAdhkarFocus,
  type AdhkarFocus,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {
  DhikrCardRow,
  chunkRows,
  rowOf,
  useDhikrColumns,
} from '@/components/adhkar/DhikrCardRow'; // @ai

// Space between the header and a card the jump pill scrolls to.
const JUMP_GAP = 8;

// @ai-start
const SavedAdhkarScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  const bottomInset = useBottomInset();
  const {savedIds} = useAdhkar();
  const {columns, spacing} = useDhikrColumns(); // @ai

  // Check if currently playing saved adhkar
  const playAllStatus = useAdhkarSessionStore(s =>
    playAllState(s.session, 'saved'),
  );

  const currentDhikrId = useAdhkarSessionStore(s =>
    s.session?.listId === 'saved'
      ? (s.session.items[s.session.index]?.dhikrId ?? null)
      : null,
  );
  const sessionPlaying = useAdhkarSessionStore(
    s =>
      s.session?.listId === 'saved' &&
      (s.session.status === 'playing' || s.session.status === 'loading'),
  );

  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
  const flatListRef = useRef<FlatList<Dhikr[]>>(null);

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved adhkar on mount and when savedIds changes
  useEffect(() => {
    async function loadSavedAdhkar() {
      try {
        setIsLoading(true);
        const saved = await adhkarService.getSaved();

        // Fetch full dhikr data for each saved item
        const adhkarPromises = saved.map((s: SavedDhikr) =>
          adhkarService.getDhikr(s.dhikrId),
        );
        const adhkarResults = await Promise.all(adhkarPromises);

        // Filter out nulls and reverse to show newest first
        const validAdhkar = adhkarResults.filter((d): d is Dhikr => d !== null);
        setAdhkarList(validAdhkar);
      } catch (error) {
        console.error('Failed to load saved adhkar:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedAdhkar();
  }, [savedIds.size]); // Reload when saved count changes

  // The list renders rows of cards: one per row, two on a wide iPad. @ai
  const rows = useMemo(
    () => chunkRows(adhkarList, columns),
    [adhkarList, columns],
  );

  // Where the session's dhikr sits in this screen's rows (session.index
  // counts the session's own items, which keep a row unsaved since).
  const sessionIndex = useMemo(() => {
    if (currentDhikrId === null) return null;
    const found = adhkarList.findIndex(d => d.id === currentDhikrId);
    return found < 0 ? null : found;
  }, [currentDhikrId, adhkarList]);

  // The playing card's top lands just under the transparent header. On iOS
  // glass the list scrolls under the header (contentInset); elsewhere it
  // starts below it (marginTop).
  const scrollViewOffset =
    (USE_GLASS ? headerHeight : 0) + moderateScale(JUMP_GAP);

  const scrollToPlaying = useCallback(() => {
    if (sessionIndex === null) return;
    flatListRef.current?.scrollToIndex({
      index: rowOf(sessionIndex, columns),
      viewPosition: 0,
      viewOffset: scrollViewOffset,
      animated: true,
    });
  }, [sessionIndex, columns, scrollViewOffset]);

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
    if (isLoading) return;
    lastReveal.current = revealToken;
    retriedScroll.current = false;
    scrollToPlaying();
  }, [revealToken, sessionIndex, isLoading, scrollToPlaying]);

  // Unmeasured rows: scroll toward the playing row, then retry once per press.
  const retriedScroll = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );
  const onScrollToIndexFailed = useCallback(
    (info: {highestMeasuredFrameIndex: number}) => {
      if (retriedScroll.current) return;
      retriedScroll.current = true;
      flatListRef.current?.scrollToIndex({
        index: Math.max(0, info.highestMeasuredFrameIndex),
        animated: false,
      });
      retryTimer.current = setTimeout(scrollToPlaying, 100);
    },
    [scrollToPlaying],
  );
  const handleJumpPress = useCallback(() => {
    retriedScroll.current = false;
    scrollToPlaying();
  }, [scrollToPlaying]);

  // Rows changed (e.g. unsave): drop stale viewability until the list reports.
  useEffect(() => {
    setVisibleIndices([]);
  }, [rows]);

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: RowToken<Dhikr[]>[]}) => {
      setVisibleIndices(
        visibleRowIndices(viewableItems, ({index, item}) =>
          index == null ? undefined : item.map((_, k) => index * columns + k),
        ),
      );
    },
    [columns],
  );
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Play All handler
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const handlePlayAll = useCallback(() => {
    if (adhkarList.length === 0) return;
    const source = {
      listId: 'saved',
      listTitle: t('adhkar.saved'),
      items: toSessionItems(adhkarList),
    };
    const wasActive = playAllStatus !== 'idle';
    dispatch({type: 'pressPlayAll', source});
    if (wasActive) return;
    const session = useAdhkarSessionStore.getState().session;
    if (!session || session.listId !== 'saved') return;
    const firstId = session.items[session.index]?.dhikrId;
    const firstIndex = adhkarList.findIndex(d => d.id === firstId);
    if (firstIndex < 0) return;
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
      params: {
        dhikrId: adhkarList[firstIndex].id,
        globalIndex: String(firstIndex),
        playAll: 'true',
      },
    });
  }, [adhkarList, t, playAllStatus, dispatch, router]);

  useFocusEffect(
    useCallback(() => {
      const mine: AdhkarFocus = {kind: 'list', listId: 'saved'};
      setAdhkarFocus(mine);
      return () => clearAdhkarFocus(mine);
    }, []),
  );

  // Set native header options dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: {backgroundColor: 'transparent'},
      headerTintColor: theme.colors.text,
      headerShadowVisible: false,
      headerTitleAlign: 'center',
      ...(USE_GLASS
        ? {headerBackButtonDisplayMode: 'minimal', headerBackTitle: ' '}
        : {}),
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
          <Text
            style={{
              fontSize: moderateScale(12),
              fontFamily: theme.fonts.regular,
              color: theme.colors.textSecondary,
              marginTop: moderateScale(2),
            }}>
            {t('adhkar.count', {count: adhkarList.length})}
          </Text>
        </View>
      ),
      headerRight: () => (
        <View style={{paddingHorizontal: moderateScale(4)}}>
          <PlayAllButton
            onPress={handlePlayAll}
            state={playAllStatus}
            disabled={isLoading || adhkarList.length === 0}
          />
        </View>
      ),
    });
  }, [
    navigation,
    adhkarList.length,
    handlePlayAll,
    playAllStatus,
    isLoading,
    theme,
    t,
  ]);

  const renderCard = useCallback(
    (item: Dhikr, index: number) => (
      <Link
        key={item.id}
        href={{
          pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
          params: {
            dhikrId: item.id,
            globalIndex: index.toString(),
          },
        }}
        asChild>
        <Pressable style={StyleSheet.flatten([{flex: 1}])}>
          {USE_GLASS ? (
            <Link.AppleZoom>
              <DhikrListItem
                dhikr={item}
                index={index}
                isCurrent={item.id === currentDhikrId}
                isPlaying={item.id === currentDhikrId && sessionPlaying}
                fill={spacing !== null}
              />
            </Link.AppleZoom>
          ) : (
            <DhikrListItem
              dhikr={item}
              index={index}
              isCurrent={item.id === currentDhikrId}
              isPlaying={item.id === currentDhikrId && sessionPlaying}
              fill={spacing !== null}
            />
          )}
        </Pressable>
      </Link>
    ),
    [currentDhikrId, sessionPlaying, spacing],
  );

  // @ai-start
  const renderItem = useCallback(
    ({item: row, index}: {item: Dhikr[]; index: number}) =>
      spacing ? (
        <DhikrCardRow spacing={spacing} columns={columns}>
          {row.map((d, k) => renderCard(d, index * columns + k))}
        </DhikrCardRow>
      ) : (
        renderCard(row[0], index)
      ),
    [spacing, columns, renderCard],
  );

  const keyExtractor = useCallback((row: Dhikr[]) => row[0].id, []);
  // @ai-end

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: headerHeight}]}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  if (adhkarList.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyContainer, {paddingTop: headerHeight}]}>
          <Ionicons
            name="bookmark-outline"
            size={moderateScale(48)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.emptyText}>{t('adhkar.noSavedYet')}</Text>
          <Text style={styles.emptySubtext}>{t('adhkar.noSavedHint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          spacing && styles.listContentPaired, // @ai
          {paddingBottom: bottomInset},
        ]}
        contentInset={USE_GLASS ? {top: headerHeight} : undefined}
        contentOffset={USE_GLASS ? {x: 0, y: -headerHeight} : undefined}
        scrollIndicatorInsets={USE_GLASS ? {top: headerHeight} : undefined}
        style={!USE_GLASS ? {marginTop: headerHeight} : undefined}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
      <AdhkarJumpPill
        direction={jumpPillDirection(visibleIndices, sessionIndex)}
        playing={sessionPlaying}
        top={headerHeight + moderateScale(8)}
        onPress={handleJumpPress}
      />
    </View>
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: moderateScale(32),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginTop: moderateScale(16),
    },
    emptySubtext: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(8),
    },
    listContent: {
      paddingTop: moderateScale(8),
    },
    // @ai-start
    listContentPaired: {
      paddingTop: 12,
    },
    // @ai-end
  });

export default SavedAdhkarScreen;
