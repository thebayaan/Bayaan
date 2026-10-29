import React, {useMemo, useEffect, useRef, useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from '@/utils/scale';
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
import {
  AdhkarNowPlayingCard,
  useHasAdhkarSession,
} from '@/components/adhkar/AdhkarNowPlayingCard';
import {SuperCategory} from '@/types/adhkar';
import branding, {type HomeRow, type HomeRowId} from '@/config/branding';
// @ai-start
import {useTranslation} from 'react-i18next';
import {getReciterDisplayName, getSurahDisplayName} from '@/i18n/format';
import {useResponsive} from '@/hooks/useResponsive';
import {computeShelfLayout} from '@/utils/gridLayout';
// @ai-end

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

// @ai-start
/**
 * iPad shelf sizes, from the pane width: whole cards plus a peek of the
 * next (ipad-standards §5.3). Undefined on phones, which keep the fixed
 * card sizes below.
 */
interface ShelfSizes {
  cardWidth: number;
  avatarWidth: number;
}

const SHELF_PADDING = moderateScale(16);
const TABLET_SHELF_GAP = moderateScale(12);
const TABLET_SHELF_PEEK = 0.3;
const TABLET_MIN_CARD_WIDTH = 150;
const TABLET_MIN_AVATAR_WIDTH = 96;

function getShelfSizes(paneWidth: number): ShelfSizes {
  const shelf = {
    leadingPadding: SHELF_PADDING,
    gap: TABLET_SHELF_GAP,
    peek: TABLET_SHELF_PEEK,
    minColumns: 2,
  };
  return {
    cardWidth: computeShelfLayout(paneWidth, {
      ...shelf,
      minCardWidth: TABLET_MIN_CARD_WIDTH,
    }).itemWidth,
    avatarWidth: computeShelfLayout(paneWidth, {
      ...shelf,
      minCardWidth: TABLET_MIN_AVATAR_WIDTH,
    }).itemWidth,
  };
}

/** A card's phone size, or the shelf width at the same aspect ratio on iPad. */
function cardSize(
  shelf: ShelfSizes | undefined,
  phoneWidth: number,
  phoneHeight: number,
): {width: number; height: number} {
  if (!shelf) return {width: phoneWidth, height: phoneHeight};
  return {
    width: shelf.cardWidth,
    height: (shelf.cardWidth * phoneHeight) / phoneWidth,
  };
}
// @ai-end

// Memoize the FlatList component
const MemoizedFlatList = React.memo(
  ({
    data,
    variant,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
    showAdhkarTile,
    shelf, // @ai
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
    showAdhkarTile?: boolean;
    shelf?: ShelfSizes; // @ai
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
          shelf={shelf} // @ai
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
      contentContainerStyle={[
        styles.sectionContent,
        shelf && styles.tabletSectionContent, // @ai
      ]}
      ListHeaderComponent={
        showAdhkarTile ? (
          <View style={{flex: 1}}>
            <AdhkarNowPlayingCard
              variant="tile"
              width={shelf?.cardWidth} // @ai
            />
          </View>
        ) : null
      }
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={3}
      initialNumToRender={5}
      // @ai-start
      // No getItemLayout: card widths differ per variant, scale with the
      // device and include the gap and content padding, so any fixed length
      // mis-predicts offsets and, with removeClippedSubviews, can leave
      // cards blank while scrolling. These shelves are short, so measuring
      // is cheap.
      // @ai-end
    />
  ),
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.variant === nextProps.variant &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.onRewayatPress === nextProps.onRewayatPress &&
    prevProps.onPlaylistPress === nextProps.onPlaylistPress &&
    prevProps.showAdhkarTile === nextProps.showAdhkarTile &&
    prevProps.shelf === nextProps.shelf && // @ai
    prevProps.theme === nextProps.theme,
);

MemoizedFlatList.displayName = 'MemoizedFlatList';

// @ai-start
const RenderSectionItem = React.memo(
  ({
    item,
    variant,
    index,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
    shelf,
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
    shelf?: ShelfSizes;
  }) => {
    const {theme} = useTheme();
    const {t} = useTranslation(['home', 'common']);

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
            reciterName={item.uploadArtist || t('home.myRecitations')}
            surahName={item.uploadTitle || t('home.upload')}
            trackId={`upload:${item.userRecitationId}`}
            reciterId={item.reciter?.id || '__uploads__'}
            surahId={item.surah?.id || 0}
            duration={item.duration}
            progress={item.progress}
            index={index}
            isUserUpload
            userRecitationId={item.userRecitationId}
            width={shelf?.cardWidth}
          />
        );
      }

      if (!item.reciter?.name || !item.surah?.name) {
        return null;
      }

      return (
        <RecentReciterCard
          imageUrl={item.reciter.image_url ?? undefined}
          reciterName={getReciterDisplayName(item.reciter)}
          surahName={getSurahDisplayName(item.surah)}
          trackId={`${item.reciter.id}:${item.surah.id}`}
          reciterId={item.reciter.id}
          surahId={item.surah.id}
          duration={item.duration}
          progress={item.progress}
          rewayatId={item.rewayatId}
          index={index}
          width={shelf?.cardWidth}
        />
      );
    }

    if (variant === 'circular') {
      const reciter = item as Reciter;
      return (
        <CircularReciterCard
          imageUrl={reciter.image_url ?? undefined}
          name={getReciterDisplayName(reciter)}
          onPress={() => onReciterPress(reciter)}
          showFollowAlong={showFollowAlong}
          // The card adds 6pt around the photo.
          width={shelf ? shelf.avatarWidth - moderateScale(6) : undefined}
        />
      );
    }

    if (variant === 'featured') {
      const reciter = item as Reciter;
      return (
        <BrowseReciterCard
          reciter={reciter}
          onPress={() => onReciterPress(reciter)}
          {...cardSize(shelf, moderateScale(140), moderateScale(160))}
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
          {...cardSize(shelf, moderateScale(130), moderateScale(110))}
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
          {...cardSize(shelf, moderateScale(110), moderateScale(110))}
        />
      );
    }

    const reciter = item as Reciter;
    return (
      <BrowseReciterCard
        reciter={reciter}
        onPress={() => onReciterPress(reciter)}
        {...cardSize(shelf, moderateScale(120), moderateScale(140))}
        theme={theme}
        showFollowAlong={showFollowAlong}
      />
    );
  },
);
// @ai-end

RenderSectionItem.displayName = 'RenderSectionItem';

// Memoize the section component
// @ai-start
const Section = React.memo(
  ({
    title,
    data,
    variant,
    onReciterPress,
    onRewayatPress,
    onPlaylistPress,
    onClear,
    showAdhkarTile,
    shelf,
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
    showAdhkarTile?: boolean;
    shelf?: ShelfSizes;
    theme: Theme;
  }) => {
    const {t} = useTranslation(['home', 'common']);
    if (!data.length && !showAdhkarTile) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            {title}
          </Text>
          {onClear && data.length > 0 && (
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
                {t('common:actions.clear')}
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
          showAdhkarTile={showAdhkarTile}
          shelf={shelf}
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
    prevProps.showAdhkarTile === nextProps.showAdhkarTile &&
    prevProps.shelf === nextProps.shelf &&
    prevProps.theme === nextProps.theme,
);
// @ai-end

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

// @ai-start
function RecitersView({onReciterPress}: RecitersViewProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {recentTracks} = useRecentlyPlayedStore();
  const showAdhkarTile = useHasAdhkarSession();
  const {favoriteReciters} = useFavoriteReciters();
  const {lovedTracks} = useLoved();
  const downloads = useDownloadStore(state => state.downloads);
  const {playlists} = usePlaylists();
  const {incrementRecitersViewOpenCount, shouldShowNewToQuran} = useSettings();

  // Size iPad shelves from the pane beside the sidebar. The window width is
  // only a first guess until onLayout reports.
  const {isTablet, width: windowWidth} = useResponsive();
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setPaneWidth(prev => (prev === next ? prev : next));
  }, []);
  const shelf = useMemo(
    () => (isTablet ? getShelfSizes(paneWidth ?? windowWidth) : undefined),
    [isTablet, paneWidth, windowWidth],
  );
  const renderAdhkarItem = useCallback(
    ({item}: {item: SuperCategory}) => (
      <AdhkarBentoCard
        category={item}
        {...cardSize(shelf, moderateScale(140), moderateScale(100))}
      />
    ),
    [shelf],
  );

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
      validRecentTracks.length > 0 || showAdhkarTile ? (
        <Section
          title={t('home.continueListening')}
          data={validRecentTracks}
          variant="recent"
          onReciterPress={onReciterPress}
          onClear={handleClearRecentTracks}
          showAdhkarTile={showAdhkarTile}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    'new-to-quran':
      showNewToQuran && beginnerFriendlyReciters.length > 0 ? (
        <Section
          title={t('home.newToQuran')}
          data={beginnerFriendlyReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    favorites:
      favoriteRecitersSection.length > 0 ? (
        <Section
          title={t('home.yourFavorites')}
          data={favoriteRecitersSection}
          variant="circular"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    featured:
      featuredReciters.length > 0 ? (
        <Section
          title={t('home.featuredReciters')}
          data={featuredReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    adhkar:
      adhkarLoaded && adhkarCategories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              {t('common:terms.adhkar')}
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
                {t('home.seeMore')}
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={adhkarCategories}
            renderItem={renderAdhkarItem}
            keyExtractor={adhkarKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.sectionContent,
              shelf && styles.tabletSectionContent,
            ]}
          />
        </View>
      ) : null,

    'follow-along':
      followAlongReciters.length > 0 ? (
        <Section
          title={t('home.followAlong')}
          data={followAlongReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    playlists:
      playlists.length > 0 ? (
        <Section
          title={t('home.yourPlaylists')}
          data={seededShuffle(playlists, sessionSeed + 8).slice(0, 10)}
          variant="playlist"
          onReciterPress={onReciterPress}
          onPlaylistPress={handlePlaylistPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    exclusives:
      bayaanOriginalsReciters.length > 0 ? (
        <Section
          title={t('home.exclusives')}
          data={bayaanOriginalsReciters}
          variant="featured"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    tajweed:
      tajweedReciters.length > 0 ? (
        <Section
          title={t('home.bestForTajweed')}
          data={tajweedReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    memorization:
      memorizationReciters.length > 0 ? (
        <Section
          title={t('home.bestForMemorization')}
          data={memorizationReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    rewayat:
      rewayatTypes.length > 0 ? (
        <Section
          title={t('home.exploreByRewayah')}
          data={rewayatTypes}
          variant="rewayat"
          onReciterPress={onReciterPress}
          onRewayatPress={handleRewayatPress}
          shelf={shelf}
          theme={theme}
        />
      ) : null,

    collection:
      collectionReciters.length > 0 ? (
        <Section
          title={t('home.fromYourCollection')}
          data={collectionReciters}
          variant="default"
          onReciterPress={onReciterPress}
          shelf={shelf}
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
      removeClippedSubviews={true}
      onLayout={isTablet ? handleLayout : undefined}>
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
// @ai-end

// Module-level helper to keep the keyExtractor reference stable across
// renders.
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
    paddingHorizontal: SHELF_PADDING, // @ai
    gap: moderateScale(8),
  },
  // @ai-start
  tabletSectionContent: {
    gap: TABLET_SHELF_GAP,
  },
  // @ai-end
});

export default React.memo(RecitersView, (prevProps, nextProps) => {
  return prevProps.onReciterPress === nextProps.onReciterPress;
});
