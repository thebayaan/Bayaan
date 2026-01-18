import React, {useMemo, useEffect, useRef} from 'react';
import {View, Text, ScrollView, StyleSheet, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Reciter, RECITERS} from '@/data/reciterData';
import {BrowseReciterCard} from './browse/BrowseReciterCard';
import {CircularReciterCard} from './cards/CircularReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {RecentReciterCard} from '@/components/cards/RecentReciterCard';
import {useLoved} from '@/hooks/useLoved';
import {
  useRecentlyPlayedStore,
  RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {usePlaylists} from '@/hooks/usePlaylists';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import {UserPlaylist} from '@/services/playlist/PlaylistService';
import {Theme} from '@/utils/themeUtils';
import {RecitersHero} from '@/components/hero/RecitersHero';
import {
  getTajweedReciters,
  getMemorizationReciters,
  getBeginnerFriendlyReciters,
  getFeaturedReciters,
  getBayaanOriginalsReciters,
} from '@/data/reciterCollections';
import {getAllRewayatTypes, RewayatInfo} from '@/data/rewayatCollections';
import RewayatCard from '@/components/cards/RewayatCard';
import {useSettings} from '@/hooks/useSettings';
import {useRouter} from 'expo-router';

interface RecitersViewProps {
  onReciterPress: (reciter: Reciter) => void;
}

type SectionItem = Reciter | RecentlyPlayedTrack | RewayatInfo | UserPlaylist;

// Memoize the FlatList component
const MemoizedFlatList = React.memo(
  ({
    data,
    variant,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
  }: {
    data: SectionItem[];
    variant:
      | 'recent'
      | 'circular'
      | 'default'
      | 'featured'
      | 'rewayat'
      | 'playlist';
    onReciterPress: (reciter: Reciter) => void;
    onRewayatPress?: (rewayat: RewayatInfo) => void;
    onPlaylistPress?: (playlist: UserPlaylist) => void;
    theme: Theme;
  }) => (
    <FlatList
      data={data}
      renderItem={({item}) => (
        <RenderSectionItem
          item={item}
          variant={variant}
          onReciterPress={onReciterPress}
          onRewayatPress={onRewayatPress}
          onPlaylistPress={onPlaylistPress}
        />
      )}
      keyExtractor={item =>
        'timestamp' in item
          ? `${item.reciter.id}-${item.surah.id}-${item.timestamp}`
          : 'displayName' in item
            ? item.id
            : 'itemCount' in item && 'color' in item
              ? item.id
              : item.id
      }
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sectionContent}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={3}
      initialNumToRender={5}
      getItemLayout={(_, index) => ({
        length:
          variant === 'circular'
            ? 80
            : variant === 'recent'
              ? 200
              : variant === 'featured'
                ? 140
                : variant === 'rewayat'
                  ? 130
                  : variant === 'playlist'
                    ? 120
                    : 140,
        offset:
          (variant === 'circular'
            ? 80
            : variant === 'recent'
              ? 200
              : variant === 'featured'
                ? 140
                : variant === 'rewayat'
                  ? 130
                  : variant === 'playlist'
                    ? 120
                    : 140) * index,
        index,
      })}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.variant === nextProps.variant &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.onRewayatPress === nextProps.onRewayatPress &&
    prevProps.onPlaylistPress === nextProps.onPlaylistPress &&
    prevProps.theme === nextProps.theme,
);

MemoizedFlatList.displayName = 'MemoizedFlatList';

const RenderSectionItem = React.memo(
  ({
    item,
    variant,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
  }: {
    item: SectionItem;
    variant:
      | 'recent'
      | 'circular'
      | 'default'
      | 'featured'
      | 'rewayat'
      | 'playlist';
    onReciterPress: (reciter: Reciter) => void;
    onRewayatPress?: (rewayat: RewayatInfo) => void;
    onPlaylistPress?: (playlist: UserPlaylist) => void;
  }) => {
    const {theme} = useTheme();
    const progress = useRecentlyPlayedStore(state =>
      'timestamp' in item
        ? state.getProgress(item.reciter.id, item.surah.id)
        : 0,
    );

    const duration = useRecentlyPlayedStore(state =>
      'timestamp' in item
        ? state.getDuration(item.reciter.id, item.surah.id)
        : 0,
    );

    if (variant === 'recent' && 'timestamp' in item) {
      if (!item.reciter?.name || !item.surah?.name) {
        return null;
      }

      return (
        <RecentReciterCard
          imageUrl={item.reciter.image_url ?? undefined}
          reciterName={item.reciter.name}
          surahName={item.surah.name}
          trackId={`${item.reciter.id}:${item.surah.id}`}
          reciterId={item.reciter.id}
          surahId={item.surah.id}
          duration={duration}
          progress={progress}
          rewayatId={item.rewayatId}
        />
      );
    }

    if (variant === 'circular') {
      const reciter = item as Reciter;
      return (
        <CircularReciterCard
          imageUrl={reciter.image_url ?? undefined}
          name={reciter.name}
          onPress={() => onReciterPress(reciter)}
        />
      );
    }

    if (variant === 'featured') {
      const reciter = item as Reciter;
      return (
        <BrowseReciterCard
          reciter={reciter}
          onPress={() => onReciterPress(reciter)}
          width={moderateScale(140)}
          height={moderateScale(160)}
          theme={theme}
        />
      );
    }

    if (variant === 'rewayat' && 'displayName' in item) {
      const rewayat = item as RewayatInfo;
      return (
        <RewayatCard
          rewayat={rewayat}
          onPress={() => onRewayatPress?.(rewayat)}
          width={moderateScale(130)}
          height={moderateScale(110)}
        />
      );
    }

    if (variant === 'playlist' && 'itemCount' in item && 'color' in item) {
      const playlist = item as UserPlaylist;
      return (
        <PlaylistCard
          name={playlist.name}
          itemCount={playlist.itemCount}
          color={playlist.color}
          onPress={() => onPlaylistPress?.(playlist)}
          width={moderateScale(110)}
          height={moderateScale(110)}
        />
      );
    }

    const reciter = item as Reciter;
    return (
      <BrowseReciterCard
        reciter={reciter}
        onPress={() => onReciterPress(reciter)}
        width={moderateScale(120)}
        height={moderateScale(140)}
        theme={theme}
      />
    );
  },
);

RenderSectionItem.displayName = 'RenderSectionItem';

// Memoize the section component
const Section = React.memo(
  ({
    title,
    data,
    variant,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
    theme,
  }: {
    title: string;
    data: SectionItem[];
    variant:
      | 'recent'
      | 'circular'
      | 'default'
      | 'featured'
      | 'rewayat'
      | 'playlist';
    onReciterPress: (reciter: Reciter) => void;
    onRewayatPress?: (rewayat: RewayatInfo) => void;
    onPlaylistPress?: (playlist: UserPlaylist) => void;
    theme: Theme;
  }) => {
    if (!data.length) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
          {title}
        </Text>
        <MemoizedFlatList
          data={data}
          variant={variant}
          onReciterPress={onReciterPress}
          onRewayatPress={onRewayatPress}
          onPlaylistPress={onPlaylistPress}
          theme={theme}
        />
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.variant === nextProps.variant &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.onRewayatPress === nextProps.onRewayatPress &&
    prevProps.onPlaylistPress === nextProps.onPlaylistPress &&
    prevProps.theme === nextProps.theme,
);

Section.displayName = 'Section';

// Seeded shuffle function for consistent shuffling within a session
function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;

  // Simple seeded random number generator
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function RecitersView({onReciterPress}: RecitersViewProps) {
  const {theme} = useTheme();
  const router = useRouter();
  const {recentTracks} = useRecentlyPlayedStore();
  const {favoriteReciters} = useFavoriteReciters();
  const {lovedTracks} = useLoved();
  const downloads = useDownloadStore(state => state.downloads);
  const {playlists} = usePlaylists();
  const {incrementRecitersViewOpenCount, shouldShowNewToQuran} = useSettings();

  // Generate a session seed once when the component first mounts
  // This persists across re-renders but changes on app restart
  const sessionSeed = useRef(Date.now()).current;

  // Track when the reciters view is opened
  useEffect(() => {
    incrementRecitersViewOpenCount();
  }, [incrementRecitersViewOpenCount]);

  // Shuffle favorites for variety (uses session seed so consistent within session)
  const favoriteRecitersSection = useMemo(
    () => seededShuffle(favoriteReciters, sessionSeed).slice(0, 10),
    [favoriteReciters, sessionSeed],
  );

  const collectionReciters = useMemo(() => {
    // Reciters from loved tracks
    const reciterIdsFromLoved = lovedTracks.map(track => track.reciterId);

    // Reciters from downloads (completed only)
    const reciterIdsFromDownloads = downloads
      .filter(d => d.status === 'completed')
      .map(d => d.reciterId);

    // Combine all sources into a unique set
    // Sources: favorites, loved tracks, downloads
    const uniqueReciterIds = new Set([
      ...favoriteReciters.map(r => r.id),
      ...reciterIdsFromLoved,
      ...reciterIdsFromDownloads,
    ]);

    const reciters = Array.from(uniqueReciterIds)
      .map(id => RECITERS.find(r => r.id === id))
      .filter((r): r is Reciter => r !== undefined);

    // Shuffle for variety
    return seededShuffle(reciters, sessionSeed + 1).slice(0, 10);
  }, [favoriteReciters, lovedTracks, downloads, sessionSeed]);

  // Get specialized reciter collections with session-based shuffle
  // Each collection uses a different offset to the seed for unique shuffles
  const featuredReciters = useMemo(
    () => seededShuffle(getFeaturedReciters(8), sessionSeed + 2),
    [sessionSeed],
  );
  const bayaanOriginalsReciters = useMemo(
    () => seededShuffle(getBayaanOriginalsReciters(10), sessionSeed + 3),
    [sessionSeed],
  );
  const beginnerFriendlyReciters = useMemo(
    () => seededShuffle(getBeginnerFriendlyReciters(10), sessionSeed + 4),
    [sessionSeed],
  );
  const tajweedReciters = useMemo(
    () => seededShuffle(getTajweedReciters(10), sessionSeed + 5),
    [sessionSeed],
  );
  const memorizationReciters = useMemo(
    () => seededShuffle(getMemorizationReciters(10), sessionSeed + 6),
    [sessionSeed],
  );
  const rewayatTypes = useMemo(
    () => seededShuffle(getAllRewayatTypes(), sessionSeed + 7),
    [sessionSeed],
  );

  // Handler for rewayat card press
  const handleRewayatPress = (rewayat: RewayatInfo) => {
    // Parse the rewayat name to extract teacher and student
    // Format is typically "Student A'n Teacher"
    const parts = rewayat.name.split("A'n");
    const student = parts.length > 1 ? parts[0].trim() : '';
    const teacher = parts.length > 1 ? parts[1].trim() : rewayat.name;

    router.push({
      pathname: '/(tabs)/(a.home)/reciter/browse',
      params: {
        teacher,
        student,
        rewayatName: rewayat.displayName,
      },
    });
  };

  // Handler for playlist card press
  const handlePlaylistPress = (playlist: UserPlaylist) => {
    router.push({
      pathname: '/(tabs)/(a.home)/playlist/[id]',
      params: {id: playlist.id},
    });
  };

  const showNewToQuran = shouldShowNewToQuran();

  // Get random gradient colors from the utility

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: verticalScale(32),
      }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}>
      {/* Use the unified RecitersHero component */}
      <RecitersHero />

      {/* Recently played tracks - high priority for immediate access */}
      {recentTracks.length > 0 && (
        <Section
          title="Continue Listening"
          data={recentTracks}
          variant="recent"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* Where to start - for new users who need guidance (shown only first 5 times) */}
      {showNewToQuran && beginnerFriendlyReciters.length > 0 && (
        <Section
          title="New to Quran? Start Here"
          data={beginnerFriendlyReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* User favorites - personal relevance section */}
      {favoriteRecitersSection.length > 0 && (
        <Section
          title="Your Favorites"
          data={favoriteRecitersSection}
          variant="circular"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* Featured section - showcase spotlighted content prominently */}
      {featuredReciters.length > 0 && (
        <Section
          title="Featured Reciters"
          data={featuredReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* User playlists - personal collections */}
      {playlists.length > 0 && (
        <Section
          title="Your Playlists"
          data={seededShuffle(playlists, sessionSeed + 8).slice(0, 10)}
          variant="playlist"
          onReciterPress={onReciterPress}
          onPlaylistPress={handlePlaylistPress}
          theme={theme}
        />
      )}

      {/* Exclusives - exclusive content showcased prominently */}
      {bayaanOriginalsReciters.length > 0 && (
        <Section
          title="Exclusives"
          data={bayaanOriginalsReciters}
          variant="featured"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* Purpose-based collections come next */}
      {tajweedReciters.length > 0 && (
        <Section
          title="Best for Tajweed"
          data={tajweedReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {memorizationReciters.length > 0 && (
        <Section
          title="Best for Memorization"
          data={memorizationReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}

      {/* Rewayat collection - Browse by different narration styles */}
      {rewayatTypes.length > 0 && (
        <Section
          title="Explore by Rewayat"
          data={rewayatTypes}
          variant="rewayat"
          onReciterPress={onReciterPress}
          onRewayatPress={handleRewayatPress}
          theme={theme}
        />
      )}

      {/* Personal collection at the end */}
      {collectionReciters.length > 0 && (
        <Section
          title="From your Collection"
          data={collectionReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: moderateScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(16),
    paddingHorizontal: moderateScale(16),
  },
  sectionContent: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(8),
  },
});

export default React.memo(RecitersView, (prevProps, nextProps) => {
  return prevProps.onReciterPress === nextProps.onReciterPress;
});
