// @ai-start
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {setStatusBarStyle} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import * as Clipboard from 'expo-clipboard';
import {MomentCard} from './MomentCard';
import {continueFromMs} from '@/services/moments/buildMoment';
import {
  momentsAudioService,
  MomentsPlaybackState,
} from '@/services/moments/MomentsAudioService';
import {
  useMomentsFeed,
  MomentCardData,
} from '@/services/moments/useMomentsFeed';
import {useMomentsStore} from '@/store/momentsStore';
import {isWholeSurah} from '@/services/moments/passages';
import {momentSourceFor} from '@/services/moments/momentSource';
import {momentsClipCache} from '@/services/moments/clipCache';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {getSurahById} from '@/services/dataService';
import {createTrack} from '@/utils/track';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import {showToast} from '@/utils/toastUtils';
import {lightHaptics} from '@/utils/haptics';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useMainPlayerActive, useOnMomentsFeed} from '@/hooks/useOnMomentsTab';
import {getSurahDisplayName} from '@/i18n/format';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import type {MomentActionType, MomentsEntry} from '@/services/analytics/events';
import {
  EndedMoment,
  MomentsSessionTracker,
} from '@/services/moments/momentsAnalytics';
import {
  applyFeedback,
  FeedAdjustments,
  FeedbackSignal,
  signalForEnd,
} from '@/services/moments/feedback';
import {getAyahCopyText} from '@/services/moments/verses';
import {PageTracker, samePlayback} from '@/services/moments/feedPlayback';

// How long the options sheet takes to close before another sheet can open.
const SHEET_CLOSE_MS = 400;

function toSource(card: MomentCardData) {
  // The downloaded clip when there is one, else a seek into the surah file.
  const local = card.clipFile
    ? momentsClipCache.getLocalUri(card.clipFile)
    : null;
  return momentSourceFor(card, local);
}

// How long a deferred card switch waits if the list never says it settled.
const SETTLE_BACKSTOP_MS = 700;

// The service only ever plays the active card, so this needs no binding.
const seekActive = (positionMs: number) => momentsAudioService.seek(positionMs);

/**
 * Playback for one card: live while it is the active card, null otherwise.
 * Only the active row subscribes, so status ticks re-render that card and
 * nothing else (not the list, not the off-screen cards).
 */
function useCardPlayback(
  cardKey: string,
  active: boolean,
): MomentsPlaybackState | null {
  const [state, setState] = useState<MomentsPlaybackState | null>(null);
  useEffect(() => {
    if (!active) {
      setState(null);
      return;
    }
    return momentsAudioService.subscribe(next =>
      setState(prev => (samePlayback(prev, next) ? prev : next)),
    );
  }, [active]);
  // Until the service switches to this card, show it at its start.
  return active && state?.key === cardKey ? state : null;
}

interface MomentActions {
  togglePlay: () => void;
  like: (card: MomentCardData) => void;
  favorite: (card: MomentCardData) => void;
  share: (card: MomentCardData) => void;
  openMore: (card: MomentCardData, ayah: number) => void;
  continueSurah: (card: MomentCardData) => void;
  openProfile: (card: MomentCardData) => void;
  holdSpeed: (card: MomentCardData, held: boolean) => void;
}

interface MomentRowProps {
  card: MomentCardData;
  active: boolean;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  isLiked: boolean;
  isFavorite: boolean;
  actions: MomentActions;
}

/** Binds the screen's actions to one card, with stable callbacks. */
const MomentRow = React.memo(function MomentRow({
  card,
  active,
  actions,
  ...rest
}: MomentRowProps) {
  const playback = useCardPlayback(card.key, active);
  const onLike = useCallback(() => actions.like(card), [actions, card]);
  const onToggleFavorite = useCallback(
    () => actions.favorite(card),
    [actions, card],
  );
  const onShare = useCallback(() => actions.share(card), [actions, card]);
  const onMore = useCallback(
    (ayah: number) => actions.openMore(card, ayah),
    [actions, card],
  );
  const onContinue = useCallback(
    () => actions.continueSurah(card),
    [actions, card],
  );
  const onOpenProfile = useCallback(
    () => actions.openProfile(card),
    [actions, card],
  );
  const onHoldSpeed = useCallback(
    (held: boolean) => actions.holdSpeed(card, held),
    [actions, card],
  );
  return (
    <MomentCard
      card={card}
      {...rest}
      playback={playback}
      onTogglePlay={actions.togglePlay}
      onLike={onLike}
      onToggleFavorite={onToggleFavorite}
      onShare={onShare}
      onMore={onMore}
      onContinue={onContinue}
      onOpenProfile={onOpenProfile}
      onSeek={seekActive}
      onHoldSpeed={onHoldSpeed}
    />
  );
});

const keyExtractor = (item: MomentCardData) => item.key;

type LovedTracks = ReturnType<typeof useLovedStore.getState>['tracks'];

function isLoved(tracks: LovedTracks, card: MomentCardData): boolean {
  return tracks.some(
    l =>
      l.reciterId === card.reciter.id &&
      l.surahId === String(card.passage.surah) &&
      l.rewayatId === card.rewayat.id,
  );
}

interface MomentsScreenProps {
  /** Where Moments was opened from, for analytics. */
  entry?: MomentsEntry;
}

export function MomentsScreen({entry = 'tab'}: MomentsScreenProps) {
  const {t} = useTranslation('home');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {isDarkMode} = useTheme();
  const {isTablet} = useResponsive();
  // Clear the tab bar, and the mini player when it shows.
  const tabInset = useBottomInset({ignorePlayer: !useMainPlayerActive()});
  const bottomInset = isTablet ? insets.bottom : tabInset;
  const resumeOnFocusRef = useRef(false);
  // Off the feed counts as away, including a profile pushed in this tab.
  const visible = useOnMomentsFeed();
  const visibleRef = useRef(visible);
  const playerSheetOpen = usePlayerStore(s => s.sheetMode === 'full');
  const {width, height} = useWindowDimensions();
  const {cards, loading, ensureAhead, reorderTail} = useMomentsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<MomentCardData>>(null);
  const activeIndexRef = useRef(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const trackerRef = useRef<MomentsSessionTracker | null>(null);
  // Session-only weight per reciter from skips, finishes and taps.
  const adjustmentsRef = useRef<FeedAdjustments>({});
  const pagerRef = useRef(new PageTracker(height, cards.length));
  pagerRef.current.setLayout(height, cards.length);

  const recordPlay = useMomentsStore(s => s.recordPlay);
  const lovedTracks = useLovedStore(s => s.tracks);
  const toggleLoved = useLovedStore(s => s.toggleLoved);
  const favoriteReciters = useFavoriteRecitersStore(s => s.favoriteReciters);
  const toggleFavoriteReciter = useFavoriteRecitersStore(
    s => s.toggleFavoriteReciter,
  );

  const activeCard = cards[activeIndex];

  const giveFeedback = useCallback(
    (reciterId: string, signal: FeedbackSignal) => {
      adjustmentsRef.current = applyFeedback(
        adjustmentsRef.current,
        reciterId,
        signal,
      );
      reorderTail(adjustmentsRef.current);
    },
    [reorderTail],
  );

  // A quick skip or a finish moves the reciter's weight for this session.
  const handleCardEnded = useCallback(
    (ended: EndedMoment | null | undefined) => {
      if (!ended) return;
      const signal = signalForEnd(ended.reason, ended.listenedMs);
      if (!signal) return;
      const reciterId = ended.card.reciter.id;
      const store = useMomentsStore.getState();
      if (signal === 'skip') store.recordSkip(reciterId);
      else store.recordComplete(reciterId);
      giveFeedback(reciterId, signal);
    },
    [giveFeedback],
  );

  const trackAction = useCallback(
    (card: MomentCardData, action: MomentActionType, enabled?: boolean) => {
      trackerRef.current?.action(card, action, enabled);
    },
    [],
  );

  useEffect(
    () =>
      momentsAudioService.subscribe(state => {
        trackerRef.current?.progress(state);
      }),
    [],
  );
  useEffect(() => () => momentsAudioService.release(), []);

  // Load both neighbors, the next one first, so either swipe starts at once.
  const preloadNeighbors = useCallback((index: number) => {
    const next = cardsRef.current[index + 1];
    const previous = cardsRef.current[index - 1];
    momentsAudioService.preload(
      next && toSource(next),
      previous && toSource(previous),
    );
  }, []);

  // Play the card on screen and load its neighbors.
  useEffect(() => {
    if (!activeCard) return;
    handleCardEnded(trackerRef.current?.activate(activeCard, activeIndex));
    // A swipe already started it the moment the page was decided.
    if (momentsAudioService.getState().key !== activeCard.key) {
      momentsAudioService.play(toSource(activeCard));
    } else {
      // It started before the tracker knew about it; catch the tracker up so
      // the first moments of listening count.
      trackerRef.current?.progress(momentsAudioService.getState());
    }
    // Cards can finish loading after the user has left the tab.
    if (!visibleRef.current) {
      momentsAudioService.pause();
      resumeOnFocusRef.current = true;
    }
    if (activeCard.clipFile) momentsClipCache.markPlayed(activeCard.clipFile);
    recordPlay(activeCard.reciter.id);
    preloadNeighbors(activeIndex);
    // Only re-run when the card on screen changes, not when more cards load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard?.key]);

  // Preload once the next card resolves after the current one started.
  const nextKey = cards[activeIndex + 1]?.key;
  useEffect(() => {
    if (!momentsAudioService.getState().key) return;
    preloadNeighbors(activeIndexRef.current);
  }, [nextKey, preloadNeighbors]);

  // Auto-advance when a moment ends.
  useEffect(
    () =>
      momentsAudioService.onEnded(key => {
        const index = activeIndexRef.current;
        if (cardsRef.current[index]?.key !== key) return;
        handleCardEnded(trackerRef.current?.complete(key));
        if (index + 1 < cardsRef.current.length) {
          // Keep the scroll from switching back while it passes the old card.
          pagerRef.current.expect(index + 1);
          listRef.current?.scrollToIndex({index: index + 1, animated: true});
          setActive(index + 1);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Pause when leaving the tab, and pick back up on return if it was
  // playing. Native tabs don't fire focus events reliably, so this follows
  // the route segments instead. One analytics session per visit, since the
  // tab stays mounted.
  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) return;
    const tracker = new MomentsSessionTracker({
      entry,
      priorPlays: useMomentsStore.getState().plays,
      sink: analyticsService,
    });
    trackerRef.current = tracker;
    tracker.start();
    const card = cardsRef.current[activeIndexRef.current];
    if (card) tracker.activate(card, activeIndexRef.current);
    // Don't take over if the main player started while away, e.g. a surah
    // played from the reciter profile.
    // Buffering counts too: a surah started just before back is still loading.
    const mainState = usePlayerStore.getState().playback.state;
    const mainActive = mainState === 'playing' || mainState === 'buffering';
    if (resumeOnFocusRef.current && !mainActive) momentsAudioService.resume();
    return () => {
      resumeOnFocusRef.current = momentsAudioService.getState().playing;
      momentsAudioService.pause();
      handleCardEnded(tracker.close());
      trackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Moments is meant to be watched, like a video, so it never plays in the
  // background: leaving the app or locking the phone pauses it, and coming
  // back resumes it if it was playing and the feed is still on screen.
  useEffect(() => {
    let resumeOnActive = false;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        if (!visibleRef.current) return;
        resumeOnActive = momentsAudioService.getState().playing;
        momentsAudioService.pause();
      } else if (next === 'active') {
        const mainState = usePlayerStore.getState().playback.state;
        const mainActive = mainState === 'playing' || mainState === 'buffering';
        if (resumeOnActive && visibleRef.current && !mainActive) {
          momentsAudioService.resume();
        }
        resumeOnActive = false;
      }
    });
    return () => sub.remove();
  }, []);

  // Light status bar over the black feed, but not over the full player.
  useEffect(() => {
    setStatusBarStyle(
      visible && !playerSheetOpen ? 'light' : isDarkMode ? 'light' : 'dark',
    );
  }, [visible, playerSheetOpen, isDarkMode]);

  // While the finger or momentum moves the list, React work and new audio
  // loads would compete with the scroll animation, so only the audio switches
  // then. The render, preloads and feed top-up wait for the list to settle.
  const scrollingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitActive = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
    const index = activeIndexRef.current;
    setActiveIndex(index);
    ensureAhead(index);
  }, [ensureAhead]);
  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const setActive = useCallback(
    (index: number | null) => {
      if (index === null || index === activeIndexRef.current) return;
      const card = cardsRef.current[index];
      if (!card) return;
      activeIndexRef.current = index;
      // Start it now rather than after the next render; the old card stops
      // in the same call, so the two never overlap.
      if (visibleRef.current) momentsAudioService.play(toSource(card));
      if (!scrollingRef.current) {
        commitActive();
        return;
      }
      // A backstop in case the list never reports that it stopped.
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        scrollingRef.current = false;
        commitActive();
      }, SETTLE_BACKSTOP_MS);
    },
    [commitActive],
  );

  // Switch cards as soon as the page is decided, not when the list stops.
  const handleBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollingRef.current = true;
      pagerRef.current.beginDrag(e.nativeEvent.contentOffset.y);
    },
    [],
  );
  const handleEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, targetContentOffset} = e.nativeEvent;
      setActive(
        pagerRef.current.endDrag(contentOffset.y, targetContentOffset?.y),
      );
    },
    [setActive],
  );
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActive(pagerRef.current.scroll(e.nativeEvent.contentOffset.y));
    },
    [setActive],
  );
  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActive(pagerRef.current.endMomentum(e.nativeEvent.contentOffset.y));
      scrollingRef.current = false;
      commitActive();
    },
    [setActive, commitActive],
  );
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const togglePlay = useCallback(() => {
    if (momentsAudioService.getState().playing) momentsAudioService.pause();
    else momentsAudioService.resume();
  }, []);

  const like = useCallback(
    (card: MomentCardData) => {
      lightHaptics();
      const liking = !isLoved(useLovedStore.getState().tracks, card);
      toggleLoved(card.reciter.id, String(card.passage.surah), card.rewayat.id);
      trackAction(card, 'like', liking);
      if (liking) giveFeedback(card.reciter.id, 'positive');
    },
    [toggleLoved, trackAction, giveFeedback],
  );

  const favorite = useCallback(
    (card: MomentCardData) => {
      lightHaptics();
      const adding = !useFavoriteRecitersStore
        .getState()
        .favoriteReciters.some(r => r.id === card.reciter.id);
      toggleFavoriteReciter(card.reciter.id);
      trackAction(card, 'favorite', adding);
      if (adding) giveFeedback(card.reciter.id, 'positive');
    },
    [toggleFavoriteReciter, trackAction, giveFeedback],
  );

  const share = useCallback(
    (card: MomentCardData) => {
      trackAction(card, 'share');
      const url = recitationShareUrl(
        card.reciter.slug ?? card.reciter.id,
        card.passage.surah,
        card.rewayat.id,
        Math.floor(card.clip.startMs / 1000),
      );
      // Hold the moment while the share sheet is up, so it doesn't end and
      // replay underneath it.
      const wasPlaying = momentsAudioService.getState().playing;
      momentsAudioService.pause();
      shareUrl(
        url,
        t('moments.shareMessage', {reciter: card.reciter.name}),
      ).finally(() => {
        if (wasPlaying && visibleRef.current) momentsAudioService.resume();
      });
    },
    [t, trackAction],
  );

  const openProfile = useCallback(
    (card: MomentCardData) => {
      trackAction(card, 'profile');
      // No pause here: leaving the feed pauses it and notes whether it was
      // playing, so back resumes the same moment.
      router.push({
        // Inside the Moments stack, so back returns to this moment.
        pathname: '/(tabs)/(d.moments)/reciter/[id]',
        params: {id: card.reciter.id},
      });
    },
    [router, trackAction],
  );

  const continueSurah = useCallback(
    async (card: MomentCardData, fromStart = false) => {
      const surah = getSurahById(card.passage.surah);
      if (!surah) return;
      trackAction(card, 'continue');
      giveFeedback(card.reciter.id, 'positive');
      momentsAudioService.pause();
      const track = await createTrack(card.reciter, surah, card.rewayat.id);
      // Restart the ayah that was playing (or the next one once the moment
      // finished), or start from the top when the moment was the whole surah
      // or the user asked for the full surah.
      const state = momentsAudioService.getState();
      const positionMs = state.key === card.key ? state.positionMs : null;
      const startSec =
        fromStart || isWholeSurah(card.passage)
          ? 0
          : continueFromMs(card.clip, positionMs) / 1000;
      await usePlayerStore.getState().updateQueue([track], 0, startSec);
      expandPlayerSheet();
    },
    [trackAction, giveFeedback],
  );

  const holdSpeed = useCallback(
    (card: MomentCardData, held: boolean) => {
      momentsAudioService.setRate(held ? 2 : 1);
      if (held) trackAction(card, 'speed');
    },
    [trackAction],
  );

  const copyAyah = useCallback(
    async (card: MomentCardData, ayah: number) => {
      await Clipboard.setStringAsync(getAyahCopyText(card.passage.surah, ayah));
      showToast(t('moments.ayahCopied'));
    },
    [t],
  );

  const openMore = useCallback(
    (card: MomentCardData, ayah: number) => {
      const surah = getSurahById(card.passage.surah);
      const surahName = surah ? getSurahDisplayName(surah) : '';
      SheetManager.show('collection-options', {
        payload: {
          title: card.reciter.name,
          subtitle: `${surahName} ${card.passage.surah}:${ayah}`,
          options: [
            {
              label: t('moments.goToReciter'),
              icon: 'user',
              onPress: () => openProfile(card),
            },
            {
              label: t('moments.playInFull', {surah: surahName}),
              icon: 'play',
              onPress: () => continueSurah(card, true),
            },
            {
              label: t('moments.share'),
              icon: 'share',
              // The share sheet can't open while this sheet is closing.
              onPress: () => setTimeout(() => share(card), SHEET_CLOSE_MS),
            },
            {
              label: t('moments.copyAyah'),
              icon: 'copy',
              onPress: () => copyAyah(card, ayah),
            },
          ],
        },
      });
    },
    [t, openProfile, continueSurah, share, copyAyah],
  );

  const actions = useMemo<MomentActions>(
    () => ({
      togglePlay,
      like,
      favorite,
      share,
      openMore,
      continueSurah,
      openProfile,
      holdSpeed,
    }),
    [
      togglePlay,
      like,
      favorite,
      share,
      openMore,
      continueSurah,
      openProfile,
      holdSpeed,
    ],
  );

  // Changes with layout, likes, favorites and the active card, never on a
  // playback tick (the active row subscribes to that itself).
  const renderItem = useCallback(
    ({item, index}: {item: MomentCardData; index: number}) => (
      <MomentRow
        card={item}
        active={index === activeIndex}
        width={width}
        height={height}
        topInset={insets.top}
        bottomInset={bottomInset}
        isLiked={isLoved(lovedTracks, item)}
        isFavorite={favoriteReciters.some(r => r.id === item.reciter.id)}
        actions={actions}
      />
    ),
    [
      width,
      height,
      insets.top,
      bottomInset,
      activeIndex,
      lovedTracks,
      favoriteReciters,
      actions,
    ],
  );

  return (
    <View style={styles.container}>
      {cards.length > 0 ? (
        <FlatList
          ref={listRef}
          data={cards}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onScrollBeginDrag={handleBeginDrag}
          onScrollEndDrag={handleEndDrag}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          onMomentumScrollEnd={handleScrollEnd}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
        />
      ) : (
        <View style={styles.empty}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.emptyTitle}>{t('moments.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('moments.emptyBody')}</Text>
            </>
          )}
        </View>
      )}

      <View
        style={[styles.header, {paddingTop: insets.top + 6}]}
        pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('moments.profile')}
          style={styles.headerButton}>
          <Ionicons
            name="person-circle-outline"
            size={moderateScale(28)}
            color="#FFFFFF"
          />
        </Pressable>
        <Text style={styles.title}>{t('moments.title')}</Text>
        <Pressable
          onPress={() => showToast(t('moments.filtersSoon'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('moments.filters')}
          style={styles.headerButton}>
          <Ionicons
            name="options-outline"
            size={moderateScale(24)}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
  },
  headerButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(17),
    color: '#FFFFFF',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
  },
  emptyTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(17),
    color: '#FFFFFF',
    marginBottom: moderateScale(6),
  },
  emptyBody: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
  },
});
// @ai-end
