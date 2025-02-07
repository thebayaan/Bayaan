import React, {useCallback} from 'react';
import {View, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {CircularReciterCard} from './cards/CircularReciterCard';
import {ReciterCard} from './cards/ReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {Reciter} from '@/data/reciterData';
import {usePlayerStore} from '@/store/playerStore';

interface CollectionViewProps {
  onReciterPress: (reciter: Reciter) => void;
  onTrackPress: (track: {reciterId: string; surahId: number}) => void;
}

export default function CollectionView({
  onReciterPress,
  onTrackPress,
}: CollectionViewProps) {
  const {theme} = useTheme();
  const {favoriteReciters} = useFavoriteReciters();
  const {favoriteTrackIds} = usePlayerStore();

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
    ({item}: {item: Reciter | {reciterId: string; surahId: number}}) => {
      if ('surahId' in item) {
        const reciter = favoriteReciters.find(r => r.id === item.reciterId);
        return (
          <ReciterCard
            imageUrl={reciter?.image_url || undefined}
            name={reciter?.name || ''}
            onPress={() => onTrackPress(item)}
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

  const favoriteItems = [
    ...favoriteReciters,
    ...favoriteTrackIds.map(id => {
      const [reciterId, surahId] = id.split(':');
      return {reciterId, surahId: parseInt(surahId, 10)};
    }),
  ];

  return (
    <View style={styles.container}>
      <FlatList
        data={favoriteItems}
        renderItem={renderItem}
        keyExtractor={item =>
          'id' in item ? item.id : `${item.reciterId}-${item.surahId}`
        }
        numColumns={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: moderateScale(15)}}
      />
    </View>
  );
}
