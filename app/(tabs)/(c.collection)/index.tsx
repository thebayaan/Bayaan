import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {HeartIcon, DownloadIcon} from '@/components/Icons';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {TrackItem} from '@/components/TrackItem';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {Theme} from '@/utils/themeUtils';
import {Reciter} from '@/data/reciterData';
import {useLoved} from '@/hooks/useLoved';
import type {IconProps} from '@/components/Icons';
import {getReciterById, getSurahById} from '@/services/dataService';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {BlurView} from '@react-native-community/blur';
import {Ionicons} from '@expo/vector-icons';

// Consistent colors for icons
const HEART_COLOR = 'red';
const GOLD_COLOR = '#FFD700';

// Define a type for icon components (both custom Icons and Ionicons)
type IconComponent = React.FC<IconProps> | typeof Ionicons;

interface CollectionItem {
  id: string;
  title: string;
  icon: IconComponent;
  useIonicons?: boolean;
  iconColor?: string;
}

const collectionItems: CollectionItem[] = [
  {id: 'loved', title: 'Loved Surahs', icon: HeartIcon, iconColor: HEART_COLOR},
  {
    id: 'favorite-reciters',
    title: 'Favorite Reciters',
    icon: Ionicons,
    useIonicons: true,
    iconColor: GOLD_COLOR,
  },
  // {id: 'playlists', title: 'Playlists', icon: PlaylistIcon},
  {
    id: 'downloads',
    title: 'Downloads',
    icon: DownloadIcon,
    iconColor: '#10B981',
  },
];

function calculatePreviewItemWidth(width: number, columns: number) {
  const screenMargin = moderateScale(20) * 2; // Left and right screen margins
  const gapWidth = moderateScale(8); // Gap between items
  const totalGapWidth = gapWidth * (columns - 1);

  const availableWidth = width - screenMargin - totalGapWidth;
  return availableWidth / columns;
}

export default function CollectionScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const previewStyles = createPreviewStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {lovedTracks} = useLoved();
  const {favoriteReciters} = useFavoriteReciters();
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {width} = useWindowDimensions();

  // Get first 4 items for preview (changed from 3)
  const previewLoved = lovedTracks.slice(0, 3);
  const previewReciters = favoriteReciters.slice(0, 4); // Changed from 3 to 4

  const renderCollectionItem = ({item}: {item: CollectionItem}) => {
    const renderPreviewItems = () => {
      if (item.id === 'loved' && lovedTracks.length > 0) {
        return (
          <View style={previewStyles.previewContainer}>
            {previewLoved.map(track => (
              <TrackItem
                key={`${track.reciterId}:${track.surahId}:${track.rewayatId || ''}`}
                reciterId={track.reciterId}
                surahId={track.surahId}
                rewayatId={track.rewayatId}
                onPress={() => handleLovedTrackPress(track)}
              />
            ))}
          </View>
        );
      }

      if (item.id === 'favorite-reciters' && favoriteReciters.length > 0) {
        const previewColumns = 4; // Fixed to 4 columns for preview
        const previewItemWidth = calculatePreviewItemWidth(
          width,
          previewColumns,
        );

        return (
          <View style={previewStyles.gridContainer}>
            <View style={previewStyles.gridRow}>
              {previewReciters.map(reciter => (
                <View
                  key={reciter.id}
                  style={{
                    width: previewItemWidth,
                    alignItems: 'center',
                  }}>
                  <CircularReciterCard
                    imageUrl={reciter.image_url || undefined}
                    name={reciter.name}
                    onPress={() => handleReciterPress(reciter)}
                    size="small"
                  />
                </View>
              ))}
            </View>
          </View>
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
          {item.useIonicons ? (
            <Ionicons
              name="star"
              size={moderateScale(35)}
              color={item.iconColor || theme.colors.text}
            />
          ) : (
            <item.icon
              color={item.iconColor || theme.colors.text}
              size={moderateScale(35)}
              filled={true}
            />
          )}
          <Text style={styles.listItemText}>{item.title}</Text>
          <Icon
            name="arrow-right"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        {renderPreviewItems()}
      </View>
    );
  };

  const handleLovedTrackPress = async (track: {
    reciterId: string;
    surahId: string;
    rewayatId?: string;
  }) => {
    try {
      const [reciter, surah] = await Promise.all([
        getReciterById(track.reciterId),
        getSurahById(parseInt(track.surahId, 10)),
      ]);

      if (!reciter || !surah) {
        throw new Error('Reciter or surah not found');
      }

      // If track already has a rewayatId, use it
      // Otherwise, find the loved track to get its rewayatId
      let rewayatId = track.rewayatId;
      if (!rewayatId) {
        const lovedTrack = lovedTracks.find(
          t => t.reciterId === track.reciterId && t.surahId === track.surahId,
        );
        rewayatId = lovedTrack?.rewayatId || reciter.rewayat[0]?.id;
      }

      // Create track for the selected surah
      const tracks = await createTracksForReciter(reciter, [surah], rewayatId);

      // Update queue and start playing
      await updateQueue(tracks, 0);
      await play();

      // Add to recently played list with the rewayatId
      await addRecentTrack(reciter, surah, 0, 0, rewayatId);

      // Set current reciter for batch loading
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing loved track:', error);
    }
  };

  const handleReciterPress = (reciter: Reciter) => {
    router.push(`/reciter/${reciter.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: 0}]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={10}
            blurType={theme.isDarkMode ? 'dark' : 'light'}
            style={[styles.blurContainer]}>
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              styles.blurContainer,
              {
                backgroundColor: theme.colors.background,
                opacity: 0.95,
              },
            ]}>
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </View>
        )}
      </View>
      <ScrollView style={styles.content}>
        <View style={{paddingTop: insets.top}} />
        <FlatList
          data={collectionItems}
          renderItem={renderCollectionItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      </ScrollView>
    </View>
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
      opacity: 0.8,
      marginTop: moderateScale(4),
    },
    gridContainer: {
      marginTop: moderateScale(4),
      paddingHorizontal: moderateScale(20),
    },
    gridRow: {
      flexDirection: 'row',
      gap: moderateScale(8),
      justifyContent: 'flex-start',
    },
  });

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: moderateScale(56),
      zIndex: 100,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.85,
    },
    content: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: moderateScale(15),
      paddingTop: moderateScale(20),
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(15),
    },
    listItemText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginLeft: moderateScale(15),
      flex: 1,
    },
  });
