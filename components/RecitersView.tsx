import React, {useMemo, useEffect} from 'react';
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
import {Theme} from '@/utils/themeUtils';
import {RecitersHero} from '@/components/hero/RecitersHero';
import {
  getTajweedReciters,
  getMemorizationReciters,
  getBeginnerFriendlyReciters,
  getDiverseRewayatReciters,
  getFeaturedReciters,
  getBayaanOriginalsReciters,
} from '@/data/reciterCollections';
import {useSettings} from '@/hooks/useSettings';

interface RecitersViewProps {
  onReciterPress: (reciter: Reciter) => void;
}

type SectionItem = Reciter | RecentlyPlayedTrack;

// Memoize the FlatList component
const MemoizedFlatList = React.memo(
  ({
    data,
    variant,
    onReciterPress,
  }: {
    data: SectionItem[];
    variant: 'recent' | 'circular' | 'default' | 'featured';
    onReciterPress: (reciter: Reciter) => void;
    theme: Theme;
  }) => (
    <FlatList
      data={data}
      renderItem={({item}) => (
        <RenderSectionItem
          item={item}
          variant={variant}
          onReciterPress={onReciterPress}
        />
      )}
      keyExtractor={item =>
        'timestamp' in item
          ? `${item.reciter.id}-${item.surah.id}-${item.timestamp}`
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
                : 140,
        offset:
          (variant === 'circular'
            ? 80
            : variant === 'recent'
              ? 200
              : variant === 'featured'
                ? 140
                : 140) * index,
        index,
      })}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.variant === nextProps.variant &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.theme === nextProps.theme,
);

MemoizedFlatList.displayName = 'MemoizedFlatList';

const RenderSectionItem = React.memo(
  ({
    item,
    variant,
    onReciterPress,
  }: {
    item: SectionItem;
    variant: 'recent' | 'circular' | 'default' | 'featured';
    onReciterPress: (reciter: Reciter) => void;
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
    theme,
  }: {
    title: string;
    data: SectionItem[];
    variant: 'recent' | 'circular' | 'default' | 'featured';
    onReciterPress: (reciter: Reciter) => void;
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
          theme={theme}
        />
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.variant === nextProps.variant &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.theme === nextProps.theme,
);

Section.displayName = 'Section';

function RecitersView({onReciterPress}: RecitersViewProps) {
  const {theme} = useTheme();
  const {recentTracks} = useRecentlyPlayedStore();
  const {favoriteReciters} = useFavoriteReciters();
  const {lovedTracks} = useLoved();
  const {
    incrementRecitersViewOpenCount,
    shouldShowNewToQuran,
  } = useSettings();

  // Track when the reciters view is opened
  useEffect(() => {
    incrementRecitersViewOpenCount();
  }, [incrementRecitersViewOpenCount]);

  const favoriteRecitersSection = useMemo(
    () => favoriteReciters.slice(0, 10),
    [favoriteReciters],
  );

  const collectionReciters = useMemo(() => {
    const reciterIdsFromLoved = lovedTracks.map(track => track.reciterId);
    const uniqueReciterIds = new Set([
      ...favoriteReciters.map(r => r.id),
      ...reciterIdsFromLoved,
    ]);

    return Array.from(uniqueReciterIds)
      .map(id => RECITERS.find(r => r.id === id))
      .filter((r): r is Reciter => r !== undefined)
      .slice(0, 5);
  }, [favoriteReciters, lovedTracks]);

  // Get specialized reciter collections
  const featuredReciters = useMemo(() => getFeaturedReciters(8), []);
  const bayaanOriginalsReciters = useMemo(
    () => getBayaanOriginalsReciters(10),
    [],
  );
  const beginnerFriendlyReciters = useMemo(
    () => getBeginnerFriendlyReciters(10),
    [],
  );
  const tajweedReciters = useMemo(() => getTajweedReciters(10), []);
  const memorizationReciters = useMemo(() => getMemorizationReciters(10), []);
  const diverseRewayatReciters = useMemo(
    () => getDiverseRewayatReciters(10),
    [],
  );

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

      {/* Style-based collections follow */}
      {diverseRewayatReciters.length > 0 && (
        <Section
          title="Diverse Rewayat"
          data={diverseRewayatReciters}
          variant="default"
          onReciterPress={onReciterPress}
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
    gap: moderateScale(12),
  },
});

export default React.memo(RecitersView, (prevProps, nextProps) => {
  return prevProps.onReciterPress === nextProps.onReciterPress;
});
