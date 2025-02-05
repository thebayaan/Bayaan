import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterCard} from './cards/ReciterCard';
import {CircularReciterCard} from './cards/CircularReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {RecentReciterCard} from '@/components/cards/RecentReciterCard';
import {usePlayerStore} from '@/store/playerStore';
import {
  useRecentRecitersStore,
  RecentReciter,
} from '@/store/recentRecitersStore';
import Color from 'color';
import {ReciterImage} from '@/components/ReciterImage';
import {
  getFeaturedReciters,
  getFeaturedReciterOfTheDay,
} from '@/data/featuredReciters';

interface RecitersViewProps {
  onReciterPress: (reciter: Reciter) => void;
}

const HeroSection = ({
  reciter,
  onPress,
}: {
  reciter: Reciter;
  onPress: (reciter: Reciter) => void;
}) => {
  const {theme} = useTheme();
  const handlePress = React.useCallback(
    () => onPress(reciter),
    [reciter, onPress],
  );

  const styles = StyleSheet.create({
    hero: {
      marginHorizontal: moderateScale(15),
      marginBottom: verticalScale(24),
      padding: moderateScale(20),
      borderRadius: moderateScale(24),
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      flexDirection: 'row',
      alignItems: 'center',
    },
    imageContainer: {
      marginRight: moderateScale(16),
    },
    image: {
      width: moderateScale(100),
      height: moderateScale(100),
      borderRadius: moderateScale(10),
    },
    content: {
      flex: 1,
    },
    label: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(4),
    },
    name: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    moshafName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.hero}
      onPress={handlePress}>
      <View style={styles.imageContainer}>
        <ReciterImage
          imageUrl={reciter.image_url}
          reciterName={reciter.name}
          style={styles.image}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>RECITER OF THE DAY</Text>
        <Text style={styles.name} numberOfLines={1}>
          {reciter.name}
        </Text>
        <Text style={styles.moshafName} numberOfLines={1}>
          {reciter.moshaf_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const ItemSeparator = () => <View style={{width: moderateScale(12)}} />;

type SectionItem = Reciter | RecentReciter;

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
    const progress = useRecentRecitersStore(state =>
      'timestamp' in item
        ? state.getProgress(item.reciter.id, item.surah.id)
        : 0,
    );

    const duration = useRecentRecitersStore(state =>
      'timestamp' in item
        ? state.getDuration(item.reciter.id, item.surah.id)
        : 0,
    );

    if (variant === 'recent' && 'timestamp' in item) {
      // Only render if we have valid reciter data
      if (!item.reciter?.name || !item.surah?.name) {
        return null;
      }

      return (
        <RecentReciterCard
          imageUrl={item.reciter.image_url}
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
      return (
        <CircularReciterCard
          imageUrl={(item as Reciter).image_url}
          name={(item as Reciter).name}
          onPress={() => onReciterPress(item as Reciter)}
        />
      );
    }

    return (
      <ReciterCard
        imageUrl={(item as Reciter).image_url}
        name={(item as Reciter).name}
        moshafName={(item as Reciter).moshaf_name}
        onPress={() => onReciterPress(item as Reciter)}
      />
    );
  },
);

RenderSectionItem.displayName = 'RenderSectionItem';

export default function RecitersView({onReciterPress}: RecitersViewProps) {
  const {theme} = useTheme();
  const {recentReciters} = useRecentRecitersStore();
  const {favoriteReciters} = useFavoriteReciters();
  const {favoriteTrackIds} = usePlayerStore();

  // Random favorite reciters for the favorites section
  const randomFavoriteReciters = useMemo(() => {
    if (!favoriteReciters.length) return [];
    const shuffled = [...favoriteReciters].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [favoriteReciters]);

  // Random reciters for Featured section
  const featuredReciters = useMemo(() => getFeaturedReciters(10), []);

  // Different random reciters for New section
  const newReciters = useMemo(() => {
    const shuffled = [...RECITERS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, []);

  // Collection reciters (combining favorites and reciters from loved tracks)
  const collectionReciters = useMemo(() => {
    const reciterIdsFromLoved = favoriteTrackIds.map(id => id.split(':')[0]);
    const uniqueReciterIds = new Set([
      ...favoriteReciters.map(r => r.id),
      ...reciterIdsFromLoved,
    ]);

    const recitersFromCollection = Array.from(uniqueReciterIds)
      .map(id => RECITERS.find(r => r.id === id))
      .filter((r): r is Reciter => r !== undefined);

    const shuffled = [...recitersFromCollection].sort(
      () => 0.5 - Math.random(),
    );
    return shuffled.slice(0, 5);
  }, [favoriteReciters, favoriteTrackIds]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    section: {
      marginBottom: verticalScale(10),
    },
    sectionHeader: {
      marginBottom: verticalScale(5),
      paddingHorizontal: moderateScale(15),
    },
    sectionTitle: {
      fontSize: moderateScale(22),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    sectionDescription: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
  });

  const renderSection = (
    title: string,
    data: SectionItem[],
    description?: string,
    variant: 'recent' | 'circular' | 'default' = 'default',
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description && (
          <Text style={styles.sectionDescription}>{description}</Text>
        )}
      </View>
      <FlatList
        data={data}
        renderItem={({item}) => (
          <RenderSectionItem
            item={item}
            variant={variant}
            onReciterPress={onReciterPress}
          />
        )}
        keyExtractor={(item: SectionItem) =>
          'timestamp' in item ? `${item.reciter.id}-${item.timestamp}` : item.id
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: moderateScale(15),
          paddingVertical: verticalScale(8),
        }}
        snapToInterval={
          variant === 'circular'
            ? moderateScale(100)
            : variant === 'recent'
              ? moderateScale(200)
              : moderateScale(180)
        }
        decelerationRate="fast"
        snapToAlignment="start"
        ItemSeparatorComponent={ItemSeparator}
      />
    </View>
  );

  const featuredReciter = useMemo(() => getFeaturedReciterOfTheDay(), []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingVertical: verticalScale(20)}}
      showsVerticalScrollIndicator={false}>
      <HeroSection reciter={featuredReciter} onPress={onReciterPress} />
      {recentReciters.length > 0 &&
        renderSection(
          'Recently Played',
          recentReciters,
          'Continue listening where you left off',
          'recent',
        )}
      {randomFavoriteReciters.length > 0 &&
        renderSection(
          'Your Favorites',
          randomFavoriteReciters,
          'Your most loved reciters',
          'circular',
        )}
      {renderSection('Featured', featuredReciters, 'Discover popular reciters')}
      {renderSection('New', newReciters, 'Recently added to our collection')}
      {collectionReciters.length > 0 &&
        renderSection(
          'From your Collection',
          collectionReciters,
          'Reciters from your liked tracks',
          'default',
        )}
    </ScrollView>
  );
}
