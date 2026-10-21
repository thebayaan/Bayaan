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
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
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
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {getSurahById} from '@/services/dataService';
import {createTrack} from '@/utils/track';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import {showToast} from '@/utils/toastUtils';
import {lightHaptics} from '@/utils/haptics';

// Expanding during the navigation transition gets cancelled by the sheet.
const CONTINUE_EXPAND_DELAY_MS = 400;

function toSource(card: MomentCardData) {
  return {
    key: card.key,
    url: card.url,
    startMs: card.clip.startMs,
    endMs: card.clip.endMs,
  };
}

export function MomentsScreen() {
  const {t} = useTranslation('home');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const {cards, loading, ensureAhead} = useMomentsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playback, setPlayback] = useState<MomentsPlaybackState>(
    momentsAudioService.getState(),
  );
  const listRef = useRef<FlatList<MomentCardData>>(null);
  const activeIndexRef = useRef(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const recordPlay = useMomentsStore(s => s.recordPlay);
  const lovedTracks = useLovedStore(s => s.tracks);
  const toggleLoved = useLovedStore(s => s.toggleLoved);
  const favoriteReciters = useFavoriteRecitersStore(s => s.favoriteReciters);
  const toggleFavoriteReciter = useFavoriteRecitersStore(
    s => s.toggleFavoriteReciter,
  );

  const activeCard = cards[activeIndex];

  useEffect(() => momentsAudioService.subscribe(setPlayback), []);
  useEffect(() => () => momentsAudioService.release(), []);

  // Play the card on screen and load the next one behind it.
  useEffect(() => {
    if (!activeCard) return;
    momentsAudioService.play(toSource(activeCard));
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
        if (index + 1 < cardsRef.current.length) {
          listRef.current?.scrollToIndex({index: index + 1, animated: true});
          setActive(index + 1);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Stop when leaving the screen (Settings, a profile, the player).
  useFocusEffect(
    useCallback(() => {
      return () => momentsAudioService.pause();
    }, []),
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
      toggleLoved(card.reciter.id, String(card.passage.surah), card.rewayat.id);
    },
    [toggleLoved],
  );

  const favorite = useCallback(
    (card: MomentCardData) => {
      lightHaptics();
      toggleFavoriteReciter(card.reciter.id);
    },
    [toggleFavoriteReciter],
  );

  const share = useCallback(
    (card: MomentCardData) => {
      const url = recitationShareUrl(
        card.reciter.slug ?? card.reciter.id,
        card.passage.surah,
        card.rewayat.id,
        Math.floor(card.clip.startMs / 1000),
      );
      shareUrl(url, t('moments.shareMessage', {reciter: card.reciter.name}));
    },
    [t],
  );

  const openProfile = useCallback(
    (card: MomentCardData) => {
      momentsAudioService.pause();
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: card.reciter.id},
      });
    },
    [router],
  );

  const continueSurah = useCallback(
    async (card: MomentCardData) => {
      const surah = getSurahById(card.passage.surah);
      if (!surah) return;
      momentsAudioService.pause();
      const track = await createTrack(card.reciter, surah, card.rewayat.id);
      // Pick up right where the moment stopped, or from the top when the
      // moment was the whole surah.
      const startSec = isWholeSurah(card.passage) ? 0 : card.clip.endMs / 1000;
      await usePlayerStore.getState().updateQueue([track], 0, startSec);
      // The player sheet sits under this full-screen route, so leave it
      // first and expand once the transition has settled.
      router.back();
      setTimeout(expandPlayerSheet, CONTINUE_EXPAND_DELAY_MS);
    },
    [router],
  );

  const renderItem = useCallback(
    ({item, index}: {item: MomentCardData; index: number}) => (
      <MomentCard
        card={item}
        width={width}
        height={height}
        topInset={insets.top}
        bottomInset={insets.bottom}
        playback={index === activeIndex ? playback : null}
        isLiked={lovedTracks.some(
          l =>
            l.reciterId === item.reciter.id &&
            l.surahId === String(item.passage.surah) &&
            l.rewayatId === item.rewayat.id,
        )}
        isFavorite={favoriteReciters.some(r => r.id === item.reciter.id)}
        onTogglePlay={togglePlay}
        onLike={() => like(item)}
        onToggleFavorite={() => favorite(item)}
        onShare={() => share(item)}
        onMore={() => openProfile(item)}
        onContinue={() => continueSurah(item)}
        onOpenProfile={() => openProfile(item)}
        onSeek={ms => momentsAudioService.seek(ms)}
        onHoldSpeed={held => momentsAudioService.setRate(held ? 2 : 1)}
      />
    ),
    [
      width,
      height,
      insets.top,
      insets.bottom,
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
    ],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
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
          onPress={() => router.push('/(tabs)/(d.settings)')}
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
