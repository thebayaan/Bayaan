import React, {useMemo, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
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
  getFollowAlongReciters,
} from '@/data/reciterCollections';
import {useTimestampStore} from '@/store/timestampStore';
import {getAllRewayatTypes, RewayatInfo} from '@/data/rewayatCollections';
import RewayatCard from '@/components/cards/RewayatCard';
import {useSettings} from '@/hooks/useSettings';
import {useRouter} from 'expo-router';
import Color from 'color';
import {useReciterFollowAlong} from '@/hooks/useFollowAlong';
import {useBottomInset} from '@/hooks/useBottomInset';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAdhkarStore} from '@/store/adhkarStore';
import {AdhkarBentoCard} from '@/components/adhkar/AdhkarBentoCard';
import {SuperCategory} from '@/types/adhkar';
import branding, {type HomeRow, type HomeRowId} from '@/config/branding';

/**
 * Fallback row order used when `branding.homeRowConfig` is undefined.
 * Matches the historical hardcoded order so behavior is unchanged for any
 * branding that omits the field. Forks declare their own array in
 * `config/branding.js` to reorder, hide, or omit rows entirely.
 */
const DEFAULT_HOME_ROW_CONFIG: readonly HomeRow[] = [
  {id: 'continue-listening', enabled: true},
  {id: 'new-to-quran', enabled: true},
  {id: 'favorites', enabled: true},
  {id: 'featured', enabled: true},
  {id: 'adhkar', enabled: true},
  {id: 'follow-along', enabled: true},
  {id: 'playlists', enabled: true},
  {id: 'exclusives', enabled: true},
  {id: 'tajweed', enabled: true},
  {id: 'memorization', enabled: true},
  {id: 'rewayat', enabled: true},
  {id: 'collection', enabled: true},
];

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
      renderItem={({item, index}) => (
        <RenderSectionItem
          item={item}
          variant={variant}
          index={index}
          onReciterPress={onReciterPress}
          onRewayatPress={onRewayatPress}
          onPlaylistPress={onPlaylistPress}
        />
      )}
      keyExtractor={item =>
        'timestamp' in item
          ? `${item.reciter?.id ?? 'unknown'}-${item.surah?.id ?? 'unknown'}-${
              item.timestamp
            }`
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
    index,
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
    index: number;
    onReciterPress: (reciter: Reciter) => void;
    onRewayatPress?: (rewayat: RewayatInfo) => void;
    onPlaylistPress?: (playlist: UserPlaylist) => void;
  }) => {
    const {theme} = useTheme();

    // Derive reciter ID for follow-along badge
    const reciterId =
      'timestamp' in item
        ? (item as RecentlyPlayedTrack).reciter?.id
        : 'rewayat' in item
          ? (item as Reciter).id
          : undefined;
    const showFollowAlong = useReciterFollowAlong(reciterId);

    if (variant === 'recent' && 'timestamp' in item) {
      if (item.isUserUpload) {
        return (
          <RecentReciterCard
            imageUrl={
              item.reciter?.id !== '__uploads__'
                ? (item.reciter?.image_url ?? undefined)
                : undefined
            }
            reciterName={item.uploadArtist || 'My Recitations'}
            surahName={item.uploadTitle || 'Upload'}
            trackId={`upload:${item.userRecitationId}`}
            reciterId={item.reciter?.id || '__uploads__'}
            surahId={item.surah?.id || 0}
            duration={item.duration}
            progress={item.progress}
            index={index}
            isUserUpload
            userRecitationId={item.userRecitationId}
          />
        );
      }

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
          duration={item.duration}
          progress={item.progress}
          rewayatId={item.rewayatId}
          index={index}
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
          showFollowAlong={showFollowAlong}
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
          showFollowAlong={showFollowAlong}
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
          playlistId={playlist.id}
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
        showFollowAlong={showFollowAlong}
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
    onClear,
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
    onClear?: () => void;
    theme: Theme;
  }) => {
    if (!data.length) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            {title}
          </Text>
          {onClear && (
            <Pressable onPress={onClear} hitSlop={8}>
              <Text
                style={[
                  styles.clearButton,
                  {
                    color: Color(theme.colors.textSecondary)
                      .alpha(0.5)
                      .toString(),
                  },
                ]}>
                Clear
              </Text>
            </Pressable>
          )}
        </View>
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
    prevProps.onClear === nextProps.onClear &&
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
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
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

  // Filter out any corrupted recent tracks (missing reciter or surah data)
  // Upload tracks are valid if they have userRecitationId
  const validRecentTracks = useMemo(
    () =>
      recentTracks.filter(track =>
        track.isUserUpload
          ? !!track.userRecitationId
          : track.reciter?.id &&
            track.reciter?.name &&
            track.surah?.id &&
            track.surah?.name,
      ),
    [recentTracks],
  );

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
  const registryLoaded = useTimestampStore(s => s.registryLoaded);
  const followAlongReciters = useMemo(
    () =>
      registryLoaded
        ? seededShuffle(getFollowAlongReciters(), sessionSeed + 9)
        : [],
    [sessionSeed, registryLoaded],
  );
  const rewayatTypes = useMemo(() => getAllRewayatTypes(), []);

  // Handler for rewayat card press
  const handleRewayatPress = (rewayat: RewayatInfo) => {
    router.push({
      pathname: '/(tabs)/(a.home)/reciter/browse',
      params: {
        teacher: rewayat.teacher,
        student: rewayat.student,
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

  const handleClearRecentTracks = useCallback(() => {
    useRecentlyPlayedStore.getState().clearRecentTracks();
  }, []);

  const showNewToQuran = shouldShowNewToQuran();

  // Adhkar data for the section at the bottom
  const mainSuperCategories = useAdhkarStore(
    state => state.mainSuperCategories,
  );
  const adhkarLoaded = useAdhkarStore(state => state.superCategoriesLoaded);

  // Interleave adhkar categories for consistent display order
  const adhkarCategories = useMemo(() => {
    const left = mainSuperCategories
      .filter(c => c.column === 'left')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const right = mainSuperCategories
      .filter(c => c.column === 'right')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const result: SuperCategory[] = [];
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < left.length) result.push(left[i]);
      if (i < right.length) result.push(right[i]);
    }
    return result;
  }, [mainSuperCategories]);

  /**
   * Pre-built JSX for each home row. Each value is `null` when the row's
   * data is empty (rows self-hide regardless of `enabled`). The render
   * order is determined by `branding.homeRowConfig` below, not by the
   * order of entries here.
   *
   * Pre-building (rather than factory functions) avoids
   * `react/no-unstable-nested-components`; runtime cost is identical to
   * inline conditional rendering (each branch's null-return is what
   * Bayaan already did with `{cond && <Section …/>}`).
   */
  const rowNodes: Record<HomeRowId, React.ReactNode> = {
    'continue-listening':
      validRecentTracks.length > 0 ? (
        <Section
          title="Continue Listening"
          data={validRecentTracks}
          variant="recent"
          onReciterPress={onReciterPress}
          onClear={handleClearRecentTracks}
          theme={theme}
        />
      ) : null,

    'new-to-quran':
      showNewToQuran && beginnerFriendlyReciters.length > 0 ? (
        <Section
          title="New to Quran? Start Here"
          data={beginnerFriendlyReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    favorites:
      favoriteRecitersSection.length > 0 ? (
        <Section
          title="Your Favorites"
          data={favoriteRecitersSection}
          variant="circular"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    featured:
      featuredReciters.length > 0 ? (
        <Section
          title="Featured Reciters"
          data={featuredReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    adhkar:
      adhkarLoaded && adhkarCategories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Adhkar
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/(a.home)/adhkar')}
              hitSlop={8}>
              <Text
                style={[
                  styles.seeMoreButton,
                  {
                    color: Color(theme.colors.textSecondary)
                      .alpha(0.5)
                      .toString(),
                  },
                ]}>
                See More
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={adhkarCategories}
            renderItem={renderAdhkarItem}
            keyExtractor={adhkarKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionContent}
          />
        </View>
      ) : null,

    'follow-along':
      followAlongReciters.length > 0 ? (
        <Section
          title="Follow Along"
          data={followAlongReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    playlists:
      playlists.length > 0 ? (
        <Section
          title="Your Playlists"
          data={seededShuffle(playlists, sessionSeed + 8).slice(0, 10)}
          variant="playlist"
          onReciterPress={onReciterPress}
          onPlaylistPress={handlePlaylistPress}
          theme={theme}
        />
      ) : null,

    exclusives:
      bayaanOriginalsReciters.length > 0 ? (
        <Section
          title="Exclusives"
          data={bayaanOriginalsReciters}
          variant="featured"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    tajweed:
      tajweedReciters.length > 0 ? (
        <Section
          title="Best for Tajweed"
          data={tajweedReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    memorization:
      memorizationReciters.length > 0 ? (
        <Section
          title="Best for Memorization"
          data={memorizationReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,

    rewayat:
      rewayatTypes.length > 0 ? (
        <Section
          title="Explore by Rewayah"
          data={rewayatTypes}
          variant="rewayat"
          onReciterPress={onReciterPress}
          onRewayatPress={handleRewayatPress}
          theme={theme}
        />
      ) : null,

    collection:
      collectionReciters.length > 0 ? (
        <Section
          title="From your Collection"
          data={collectionReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      ) : null,
  };

  const homeRowConfig = branding.homeRowConfig ?? DEFAULT_HOME_ROW_CONFIG;

  // RFC-008 — Listen-tab top-region slot. Forks may replace the default
  // `RecitersHero` via `branding.listenTabTopComponent`; capitalised here
  // so it can be used as a JSX element. `undefined` keeps Bayaan's hero.
  const ListenTabTopComponent = branding.listenTabTopComponent;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        USE_GLASS
          ? undefined
          : {paddingTop: insets.top, paddingBottom: bottomInset}
      }
      contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}>
      {/* RFC-008 — Listen-tab top region. Default is the unified
       * `RecitersHero`; forks may substitute their own via
       * `branding.listenTabTopComponent`. */}
      {ListenTabTopComponent ? <ListenTabTopComponent /> : <RecitersHero />}

      {homeRowConfig
        .filter(row => row.enabled)
        .map(row => (
          <React.Fragment key={row.id}>
            {rowNodes[row.id] ?? null}
          </React.Fragment>
        ))}
    </ScrollView>
  );
}

// Module-level helpers to keep the renderItem/keyExtractor references
// stable across renders (avoids react/no-unstable-nested-components).
const renderAdhkarItem = ({item}: {item: SuperCategory}) => (
  <AdhkarBentoCard
    category={item}
    width={moderateScale(140)}
    height={moderateScale(100)}
  />
);

const adhkarKeyExtractor = (item: SuperCategory) => item.id;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: moderateScale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    marginBottom: moderateScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-SemiBold',
  },
  clearButton: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
  },
  seeMoreButton: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
  },
  sectionContent: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(8),
  },
});

export default React.memo(RecitersView, (prevProps, nextProps) => {
  return prevProps.onReciterPress === nextProps.onReciterPress;
});
