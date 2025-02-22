import React, {useMemo, useRef, useEffect, useCallback, useState} from 'react';
import {View, Text, ScrollView, StyleSheet, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Reciter, RECITERS} from '@/data/reciterData';
import {ReciterCard} from './cards/ReciterCard';
import {CircularReciterCard} from './cards/CircularReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {RecentReciterCard} from '@/components/cards/RecentReciterCard';
import {useLoved} from '@/hooks/useLoved';
import {
  useRecentlyPlayedStore,
  RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';
import {getFeaturedReciters} from '@/data/featuredReciters';
import {ScrollingHero} from '@/components/ScrollingHero';

interface RecitersViewProps {
  onReciterPress: (reciter: Reciter) => void;
}

const ItemSeparator = () => <View style={{width: moderateScale(8)}} />;

type SectionItem = Reciter | RecentlyPlayedTrack;

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
      // Only render if we have valid reciter data
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
      <ReciterCard
        imageUrl={reciter.image_url ?? undefined}
        name={reciter.name}
        onPress={() => onReciterPress(reciter)}
      />
    );
  },
);

RenderSectionItem.displayName = 'RenderSectionItem';

export default function RecitersView({onReciterPress}: RecitersViewProps) {
  const {theme} = useTheme();
  const {recentTracks} = useRecentlyPlayedStore();
  const {favoriteReciters} = useFavoriteReciters();
  const {lovedTracks} = useLoved();
  const [isInitialized, setIsInitialized] = useState(false);

  // Use refs for all randomly sorted lists to maintain stability
  const favoriteRecitersRef = useRef<Reciter[]>([]);
  const newRecitersRef = useRef<Reciter[]>([]);
  const collectionRecitersRef = useRef<Reciter[]>([]);
  const featuredRecitersRef = useRef<Reciter[]>([]);

  // Initialize random lists once
  useEffect(() => {
    // Initialize featured reciters first
    featuredRecitersRef.current = getFeaturedReciters(10);

    // Initialize new reciters
    const shuffled = [...RECITERS].sort(() => 0.5 - Math.random());
    newRecitersRef.current = shuffled.slice(0, 10);

    // Mark initialization as complete
    setIsInitialized(true);
  }, []); // Only run once on mount

  // Update favorite reciters when they change
  useEffect(() => {
    if (
      favoriteReciters.length !== favoriteRecitersRef.current.length ||
      favoriteReciters.some(
        (r, i) => r.id !== favoriteRecitersRef.current[i]?.id,
      )
    ) {
      const shuffled = [...favoriteReciters].sort(() => 0.5 - Math.random());
      favoriteRecitersRef.current = shuffled.slice(0, 10);
    }
  }, [favoriteReciters]);

  // Update collection reciters when dependencies change
  useEffect(() => {
    const reciterIdsFromLoved = lovedTracks.map(track => track.reciterId);
    const uniqueReciterIds = new Set([
      ...favoriteReciters.map(r => r.id),
      ...reciterIdsFromLoved,
    ]);

    const recitersFromCollection = Array.from(uniqueReciterIds)
      .map(id => RECITERS.find(r => r.id === id))
      .filter((r): r is Reciter => r !== undefined);

    // Only update if the collection has actually changed
    const currentIds = new Set(collectionRecitersRef.current.map(r => r.id));
    const newIds = new Set(recitersFromCollection.map(r => r.id));

    if (
      recitersFromCollection.length !== collectionRecitersRef.current.length ||
      ![...currentIds].every(id => newIds.has(id))
    ) {
      const shuffled = [...recitersFromCollection].sort(
        () => 0.5 - Math.random(),
      );
      collectionRecitersRef.current = shuffled.slice(0, 5);
    }
  }, [favoriteReciters, lovedTracks]);

  // Memoize the filtered reciter lists
  const {otherRewayatReciters, mojawwadReciters, molimReciters} =
    useMemo(() => {
      const others = RECITERS.filter(
        reciter =>
          reciter.rewayat.some(
            r => r.name.toLowerCase() !== "hafs a'n assem".toLowerCase(),
          ) &&
          !featuredRecitersRef.current.some(f => f.id === reciter.id) &&
          !newRecitersRef.current.some(n => n.id === reciter.id),
      ).slice(0, 10);

      const mojawwad = RECITERS.filter(
        reciter =>
          reciter.rewayat.some(r => r.style.toLowerCase() === 'mojawwad') &&
          !featuredRecitersRef.current.some(f => f.id === reciter.id) &&
          !newRecitersRef.current.some(n => n.id === reciter.id) &&
          !others.some(o => o.id === reciter.id),
      ).slice(0, 10);

      const molim = RECITERS.filter(
        reciter =>
          reciter.rewayat.some(r => r.style.toLowerCase() === 'molim') &&
          !featuredRecitersRef.current.some(f => f.id === reciter.id) &&
          !newRecitersRef.current.some(n => n.id === reciter.id) &&
          !others.some(o => o.id === reciter.id) &&
          !mojawwad.some(m => m.id === reciter.id),
      ).slice(0, 10);

      return {
        otherRewayatReciters: others,
        mojawwadReciters: mojawwad,
        molimReciters: molim,
      };
    }, []); // Empty dependency array since we're using refs

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
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    sectionDescription: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      textAlign: 'center',
      marginVertical: moderateScale(20),
    },
  });

  // Memoize the renderSection function
  const renderSection = useCallback(
    (
      title: string,
      data: SectionItem[],
      variant: 'recent' | 'circular' | 'default' = 'default',
    ) => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
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
            'timestamp' in item
              ? `${item.reciter.id}-${item.timestamp}`
              : item.id
          }
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: moderateScale(8),
            paddingVertical: verticalScale(8),
          }}
          snapToInterval={
            variant === 'circular'
              ? moderateScale(91)
              : variant === 'recent'
                ? moderateScale(200)
                : moderateScale(180)
          }
          decelerationRate="fast"
          snapToAlignment="start"
          ItemSeparatorComponent={ItemSeparator}
        />
      </View>
    ),
    [onReciterPress, styles.section, styles.sectionHeader, styles.sectionTitle],
  );

  const handleBrowseAll = useCallback(() => {
    // TODO: Implement browse all navigation
    console.log('Browse all pressed');
  }, []);

  // Don't render anything until initialization is complete
  if (!isInitialized) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingVertical: verticalScale(20)}}
      showsVerticalScrollIndicator={false}>
      <ScrollingHero onBrowseAll={handleBrowseAll} />
      {recentTracks.length > 0 &&
        renderSection('Continue Listening', recentTracks, 'recent')}
      {favoriteRecitersRef.current.length > 0 &&
        renderSection(
          'Your Favorites',
          favoriteRecitersRef.current,
          'circular',
        )}
      {renderSection('New', newRecitersRef.current)}
      {otherRewayatReciters.length > 0 &&
        renderSection('Other Rewayat', otherRewayatReciters)}
      {mojawwadReciters.length > 0 &&
        renderSection('Mojawwad', mojawwadReciters)}
      {molimReciters.length > 0 && renderSection("Mo'lim", molimReciters)}
      {collectionRecitersRef.current.length > 0 &&
        renderSection('From your Collection', collectionRecitersRef.current)}
    </ScrollView>
  );
}
