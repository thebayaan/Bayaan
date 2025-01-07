import React from 'react';
import {View, Text, FlatList, TouchableOpacity, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {HeartIcon, StarIcon} from '@/components/Icons';
import {usePlayerStore} from '@/store/playerStore';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {TrackItem} from '@/components/TrackItem';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {Theme} from '@/utils/themeUtils';
import {usePlayback} from '@/hooks/usePlayback';
import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
import {getReciterById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';

const collectionItems = [
  {id: 'loved', title: 'Loved Surahs', icon: HeartIcon},
  {id: 'favorite-reciters', title: 'Favorite Reciters', icon: StarIcon},
  // {id: 'playlists', title: 'Playlists', icon: PlaylistIcon},
  // {id: 'downloads', title: 'Downloads', icon: DownloadIcon},
];

export default function CollectionScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const previewStyles = createPreviewStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {favoriteTrackIds} = usePlayerStore();
  const {favoriteReciters} = useFavoriteReciters();
  const {navigateToPlayer} = usePlayerNavigation();
  const {playLovedTrack} = usePlayback();

  // Get first 3 items for preview
  const previewLoved = favoriteTrackIds.slice(0, 3);
  const previewReciters = favoriteReciters.slice(0, 3);

  const renderCollectionItem = ({
    item,
  }: {
    item: {
      id: string;
      icon: React.FC<{color: string; size: number}>;
      title: string;
    };
  }) => {
    const renderPreviewItems = () => {
      if (item.id === 'loved' && favoriteTrackIds.length > 0) {
        return (
          <View style={previewStyles.previewContainer}>
            {previewLoved.map(trackId => (
              <TrackItem
                key={trackId}
                reciterId={trackId.split(':')[0]}
                surahId={trackId.split(':')[1]}
                onPress={() => handleLovedTrackPress(trackId)}
              />
            ))}
          </View>
        );
      }

      if (item.id === 'favorite-reciters' && favoriteReciters.length > 0) {
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={previewStyles.horizontalScroll}
            contentContainerStyle={previewStyles.horizontalScrollContent}>
            {previewReciters.map(reciter => (
              <CircularReciterCard
                key={reciter.id}
                imageUrl={reciter.image_url}
                name={reciter.name}
                onPress={() => handleReciterPress(reciter)}
                size="small"
              />
            ))}
          </ScrollView>
        );
      }

      return null;
    };

    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.listItem}
          onPress={() => router.push(`/collection/${item.id}`)}>
          <item.icon
            color={theme.colors.textSecondary}
            size={moderateScale(35)}
          />
          <Text style={styles.listItemText}>{item.title}</Text>
          <Icon
            name="chevron-right"
            type="feather"
            size={moderateScale(30)}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>
        {renderPreviewItems()}
      </View>
    );
  };

  const handleLovedTrackPress = async (trackId: string) => {
    try {
      const [reciterId] = trackId.split(':');
      const reciter = getReciterById(reciterId);
      navigateToPlayer(reciter?.image_url);
      playLovedTrack(trackId, favoriteTrackIds);
    } catch (error) {
      console.error('Error playing loved track:', error);
    }
  };

  const handleReciterPress = (reciter: Reciter) => {
    router.push(`/reciter/${reciter.id}`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]} />
      <FlatList
        data={collectionItems}
        renderItem={renderCollectionItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        scrollEnabled={false}
      />
    </ScrollView>
  );
}

const createPreviewStyles = (theme: Theme) =>
  ScaledSheet.create({
    previewSection: {
      marginTop: moderateScale(20),
      paddingHorizontal: moderateScale(20),
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(10),
    },
    previewTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    seeAllButton: {
      fontSize: moderateScale(14),
      color: theme.colors.primary,
    },
    previewContent: {
      marginTop: moderateScale(10),
    },
    horizontalScroll: {
      marginTop: moderateScale(10),
    },
    horizontalScrollContent: {
      paddingHorizontal: moderateScale(20),
      gap: moderateScale(15),
      flexDirection: 'row',
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: moderateScale(14),
      textAlign: 'center',
      marginVertical: moderateScale(20),
    },
    previewContainer: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(10),
      opacity: 0.8,
      gap: moderateScale(8),
    },
  });
