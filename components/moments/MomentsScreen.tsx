// @ai-start
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useFocusEffect, useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {setStatusBarStyle} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import * as Clipboard from 'expo-clipboard';
import {MomentCard} from './MomentCard';
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

function toSource(card: MomentCardData) {
  // The downloaded clip when there is one, else a seek into the surah file.
  const local = card.clipFile
    ? momentsClipCache.getLocalUri(card.clipFile)
    : null;
  return momentSourceFor(card, local);
}

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
  // Clear the tab bar; the player is hidden on this tab.
  const tabInset = useBottomInset({ignorePlayer: true});
  const bottomInset = isTablet ? insets.bottom : tabInset;
  const resumeOnFocusRef = useRef(false);
  const {width, height} = useWindowDimensions();
  const {cards, loading, ensureAhead, reorderTail} = useMomentsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playback, setPlayback] = useState<MomentsPlaybackState>(
    momentsAudioService.getState(),
  );
  const listRef = useRef<FlatList<MomentCardData>>(null);
  const activeIndexRef = useRef(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const trackerRef = useRef<MomentsSessionTracker | null>(null);
  // Session-only weight per reciter from skips, finishes and taps.
  const adjustmentsRef = useRef<FeedAdjustments>({});

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
        setPlayback(state);
        trackerRef.current?.progress(state);
      }),
    [],
  );
  useEffect(() => () => momentsAudioService.release(), []);

  // Play the card on screen and load the next one behind it.
  useEffect(() => {
    if (!activeCard) return;
    handleCardEnded(trackerRef.current?.activate(activeCard, activeIndex));
    momentsAudioService.play(toSource(activeCard));
    if (activeCard.clipFile) momentsClipCache.markPlayed(activeCard.clipFile);
    recordPlay(activeCard.reciter.id);
    const next = cards[activeIndex + 1];
    if (next) momentsAudioService.preload(toSource(next));
    // Only re-run when the card on screen changes, not when more cards load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard?.key]);

  // Preload once the next card resolves after the current one started.
  const nextKey = cards[activeIndex + 1]?.key;
  useEffect(() => {
    const next = cardsRef.current[activeIndexRef.current + 1];
    if (next && playback.key) momentsAudioService.preload(toSource(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey]);

  // Auto-advance when a moment ends.
  useEffect(
    () =>
      momentsAudioService.onEnded(key => {
        const index = activeIndexRef.current;
        if (cardsRef.current[index]?.key !== key) return;
        handleCardEnded(trackerRef.current?.complete(key));
        if (index + 1 < cardsRef.current.length) {
          listRef.current?.scrollToIndex({index: index + 1, animated: true});
          setActive(index + 1);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Pause when leaving the tab, and pick back up on return if it was
  // playing. The status bar stays light over the black feed.
  // One analytics session per visit, since the tab stays mounted.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      const tracker = new MomentsSessionTracker({
        entry,
        priorPlays: useMomentsStore.getState().plays,
        sink: analyticsService,
      });
      trackerRef.current = tracker;
      tracker.start();
      const card = cardsRef.current[activeIndexRef.current];
      if (card) tracker.activate(card, activeIndexRef.current);
      if (resumeOnFocusRef.current) momentsAudioService.resume();
      return () => {
        resumeOnFocusRef.current = momentsAudioService.getState().playing;
        momentsAudioService.pause();
        handleCardEnded(tracker.close());
        trackerRef.current = null;
        setStatusBarStyle(isDarkMode ? 'light' : 'dark');
      };
    }, [entry, isDarkMode, handleCardEnded]),
  );

  const setActive = useCallback(
    (index: number) => {
      if (index === activeIndexRef.current) return;
      activeIndexRef.current = index;
      setActiveIndex(index);
      ensureAhead(index);
    },
    [ensureAhead],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActive(Math.round(e.nativeEvent.contentOffset.y / height));
    },
    [height, setActive],
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
      shareUrl(url, t('moments.shareMessage', {reciter: card.reciter.name}));
    },
    [t, trackAction],
  );

  const openProfile = useCallback(
    (card: MomentCardData) => {
      trackAction(card, 'profile');
      momentsAudioService.pause();
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
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
      // Pick up right where the moment stopped, or from the top when the
      // moment was the whole surah or the user asked for the full surah.
      const startSec =
        fromStart || isWholeSurah(card.passage) ? 0 : card.clip.endMs / 1000;
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
              onPress: () => share(card),
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

  const renderItem = useCallback(
    ({item, index}: {item: MomentCardData; index: number}) => (
      <MomentCard
        card={item}
        width={width}
        height={height}
        topInset={insets.top}
        bottomInset={bottomInset}
        playback={index === activeIndex ? playback : null}
        isLiked={isLoved(lovedTracks, item)}
        isFavorite={favoriteReciters.some(r => r.id === item.reciter.id)}
        onTogglePlay={togglePlay}
        onLike={() => like(item)}
        onToggleFavorite={() => favorite(item)}
        onShare={() => share(item)}
        onMore={ayah => openMore(item, ayah)}
        onContinue={() => continueSurah(item)}
        onOpenProfile={() => openProfile(item)}
        onSeek={ms => momentsAudioService.seek(ms)}
        onHoldSpeed={held => holdSpeed(item, held)}
      />
    ),
    [
      width,
      height,
      insets.top,
      bottomInset,
      activeIndex,
      playback,
      lovedTracks,
      favoriteReciters,
      togglePlay,
      like,
      favorite,
      share,
      openProfile,
      continueSurah,
      openMore,
      holdSpeed,
    ],
  );

  return (
    <View style={styles.container}>
      {cards.length > 0 ? (
        <FlatList
          ref={listRef}
          data={cards}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
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
