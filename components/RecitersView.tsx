import React, {useMemo} from 'react';
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
import {ScrollingHero} from '@/components/ScrollingHero';
import {Theme} from '@/utils/themeUtils';

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
    variant: 'recent' | 'circular' | 'default';
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
        length: variant === 'circular' ? 80 : variant === 'recent' ? 200 : 140,
        offset:
          (variant === 'circular' ? 80 : variant === 'recent' ? 200 : 140) *
          index,
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
    variant: 'recent' | 'circular' | 'default';
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
    variant: 'recent' | 'circular' | 'default';
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

  const {mojawwadReciters, molimReciters, otherRewayatReciters} =
    useMemo(() => {
      return {
        mojawwadReciters: RECITERS.filter(r =>
          r.rewayat.some(rw => rw.style === 'mojawwad'),
        ).slice(0, 10),
        molimReciters: RECITERS.filter(r =>
          r.rewayat.some(rw => rw.style === 'molim'),
        ).slice(0, 10),
        otherRewayatReciters: RECITERS.filter(r =>
          r.rewayat.some(rw => rw.style !== 'hafs' && rw.style !== 'mujawwad'),
        ).slice(0, 10),
      };
    }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: verticalScale(32),
      }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}>
      <ScrollingHero />
      {recentTracks.length > 0 && (
        <View style={{marginTop: verticalScale(5)}}>
          <Section
            title="Continue Listening"
            data={recentTracks}
            variant="recent"
            onReciterPress={onReciterPress}
            theme={theme}
          />
        </View>
      )}
      {favoriteRecitersSection.length > 0 && (
        <Section
          title="Your Favorites"
          data={favoriteRecitersSection}
          variant="circular"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}
      {otherRewayatReciters.length > 0 && (
        <Section
          title="Other Rewayat"
          data={otherRewayatReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}
      {mojawwadReciters.length > 0 && (
        <Section
          title="Mojawwad"
          data={mojawwadReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}
      {molimReciters.length > 0 && (
        <Section
          title="Mo'lim"
          data={molimReciters}
          variant="default"
          onReciterPress={onReciterPress}
          theme={theme}
        />
      )}
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
