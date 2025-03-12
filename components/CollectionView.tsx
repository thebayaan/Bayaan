import React, {useCallback} from 'react';
import {View, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {CircularReciterCard} from './cards/CircularReciterCard';
import {ReciterCard} from './cards/ReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {Reciter} from '@/data/reciterData';
import {useLoved} from '@/hooks/useLoved';

interface TrackItem {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
}

interface CollectionViewProps {
  onReciterPress: (reciter: Reciter) => void;
  onTrackPress: (track: {
    reciterId: string;
    surahId: number;
    rewayatId?: string;
  }) => void;
}

export default function CollectionView({
  onReciterPress,
  onTrackPress,
}: CollectionViewProps) {
  const {theme} = useTheme();
  const {favoriteReciters} = useFavoriteReciters();
  const {lovedTracks} = useLoved();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(10),
      paddingHorizontal: moderateScale(15),
    },
  });

  const renderItem = useCallback(
    ({item}: {item: Reciter | TrackItem}) => {
      if ('surahId' in item) {
        const reciter = favoriteReciters.find(r => r.id === item.reciterId);
        return (
          <ReciterCard
            imageUrl={reciter?.image_url || undefined}
            name={reciter?.name || ''}
            onPress={() =>
              onTrackPress({
                reciterId: item.reciterId,
                surahId: parseInt(item.surahId, 10),
                rewayatId: item.rewayatId,
              })
            }
          />
        );
      } else {
        return (
          <CircularReciterCard
            imageUrl={item.image_url || undefined}
            name={item.name}
            onPress={() => onReciterPress(item)}
          />
        );
      }
    },
    [onReciterPress, onTrackPress, favoriteReciters],
  );

  const collectionItems = [
    ...favoriteReciters,
    ...lovedTracks.map(track => ({
      reciterId: track.reciterId,
      surahId: track.surahId,
      rewayatId: track.rewayatId,
    })),
  ];

  const getItemKey = (item: Reciter | TrackItem) => {
    if ('id' in item) {
      return item.id;
    }
    return `${item.reciterId}-${item.surahId}${item.rewayatId ? `-${item.rewayatId}` : ''}`;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={collectionItems}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        numColumns={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: moderateScale(15)}}
      />
    </View>
  );
}
