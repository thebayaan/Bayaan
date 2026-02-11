import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {TrackItem} from '@/components/TrackItem';
import {Track} from '@/types/audio';
import {ReciterImage} from '@/components/ReciterImage';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {useUploadsStore} from '@/store/uploadsStore';
import Color from 'color';

interface UploadQueueItemProps {
  track: Track;
  index: number;
  onPress: () => void;
}

const UploadQueueItem: React.FC<UploadQueueItemProps> = React.memo(
  ({track, index, onPress}) => {
    const {theme} = useTheme();

    const playbackState = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);

    const isCurrentTrack = currentIndex === index;
    const isPlaying =
      isCurrentTrack &&
      (playbackState === 'playing' || playbackState === 'buffering');

    const surahNum = track.surahId ? parseInt(track.surahId, 10) : undefined;
    const displayTitle = surahNum ? `${surahNum}. ${track.title}` : track.title;

    // Look up the full recitation for tags
    const recitation = useUploadsStore(state =>
      track.userRecitationId
        ? state.recitations.find(r => r.id === track.userRecitationId)
        : undefined,
    );

    const verseLabel = React.useMemo(() => {
      if (!recitation?.startVerse) return null;
      if (recitation.endVerse)
        return `${recitation.startVerse}-${recitation.endVerse}`;
      return `v${recitation.startVerse}`;
    }, [recitation?.startVerse, recitation?.endVerse]);

    const recordingLabel = React.useMemo(() => {
      if (recitation?.recordingType === 'salah') return 'Salah';
      if (recitation?.recordingType === 'studio') return 'Studio';
      return null;
    }, [recitation?.recordingType]);

    const categoryLabel = React.useMemo(() => {
      if (recitation?.type !== 'other' || !recitation?.category) return null;
      return (
        recitation.category.charAt(0).toUpperCase() +
        recitation.category.slice(1)
      );
    }, [recitation?.type, recitation?.category]);

    const tagBg = Color(theme.colors.text).alpha(0.06).toString();

    return (
      <Pressable style={uploadQueueStyles.container} onPress={onPress}>
        {track.reciterName && track.reciterName !== 'My Recitations' ? (
          <ReciterImage
            reciterName={track.reciterName}
            style={uploadQueueStyles.reciterImage}
          />
        ) : (
          <View
            style={[uploadQueueStyles.iconContainer, {backgroundColor: tagBg}]}>
            <Feather
              name="music"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          </View>
        )}
        <View style={uploadQueueStyles.info}>
          <View style={uploadQueueStyles.nameRow}>
            {isCurrentTrack ? (
              <GradientText
                style={[uploadQueueStyles.title, {color: theme.colors.text}]}
                surahId={surahNum ?? 0}>
                {displayTitle}
              </GradientText>
            ) : (
              <Text
                style={[uploadQueueStyles.title, {color: theme.colors.text}]}
                numberOfLines={1}>
                {displayTitle}
              </Text>
            )}
            {verseLabel && (
              <View style={[uploadQueueStyles.tag, {backgroundColor: tagBg}]}>
                <Text
                  style={[
                    uploadQueueStyles.tagText,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {verseLabel}
                </Text>
              </View>
            )}
            {recordingLabel && (
              <View style={[uploadQueueStyles.tag, {backgroundColor: tagBg}]}>
                <Text
                  style={[
                    uploadQueueStyles.tagText,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {recordingLabel}
                </Text>
              </View>
            )}
            {categoryLabel && (
              <View style={[uploadQueueStyles.tag, {backgroundColor: tagBg}]}>
                <Text
                  style={[
                    uploadQueueStyles.tagText,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {categoryLabel}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              uploadQueueStyles.artist,
              {color: theme.colors.textSecondary},
            ]}
            numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
        {isCurrentTrack && (
          <View style={uploadQueueStyles.indicator}>
            <NowPlayingIndicator
              isPlaying={isPlaying}
              barCount={3}
              surahId={surahNum ?? 0}
            />
          </View>
        )}
      </Pressable>
    );
  },
);

UploadQueueItem.displayName = 'UploadQueueItem';

const uploadQueueStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(18),
    flex: 1,
  },
  reciterImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(10),
    marginRight: moderateScale(12),
  },
  iconContainer: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    marginBottom: moderateScale(1),
  },
  title: {
    flexShrink: 1,
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
  tag: {
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(1),
    borderRadius: moderateScale(4),
  },
  tagText: {
    fontSize: moderateScale(9),
    fontFamily: 'Manrope-SemiBold',
  },
  artist: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
  },
  indicator: {
    marginLeft: moderateScale(8),
  },
});

interface QueueListProps {
  onQueueItemPress: (index: number) => void;
  onRemoveQueueItem: (index: number) => void;
}

interface IndexedTrack extends Track {
  _queueIndex: number;
}

export const QueueList: React.FC<QueueListProps> = ({
  onQueueItemPress,
  onRemoveQueueItem,
}) => {
  const {theme} = useTheme();
  const tracks = usePlayerStore(s => s.queue.tracks);
  const renderScrollComponent = useBottomSheetScrollableCreator();

  const indexedTracks: IndexedTrack[] = React.useMemo(
    () => tracks.map((t, i) => ({...t, _queueIndex: i})),
    [tracks],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<IndexedTrack>) => {
      const index = item._queueIndex;
      return (
        <View style={styles.trackItemContainer}>
          {item.isUserUpload ? (
            <UploadQueueItem
              track={item}
              index={index}
              onPress={() => onQueueItemPress(index)}
            />
          ) : (
            <TrackItem
              reciterId={item.reciterId}
              surahId={item.surahId || ''}
              rewayatId={item.rewayatId}
              onPress={() => onQueueItemPress(index)}
            />
          )}
          <Pressable
            style={styles.removeButton}
            onPress={() => onRemoveQueueItem(index)}>
            <MaterialCommunityIcons
              name="close"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      );
    },
    [onQueueItemPress, onRemoveQueueItem, theme.colors.text],
  );

  const keyExtractor = useCallback(
    (item: IndexedTrack, index: number) => `${item.id}-${index}`,
    [],
  );

  const renderHeader = useCallback(
    () => (
      <View style={[styles.header, {borderBottomColor: theme.colors.border}]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Queue
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.queueCount, {color: theme.colors.text}]}>
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    ),
    [theme.colors.border, theme.colors.text, tracks.length],
  );

  if (!tracks?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="playlist-music"
            size={moderateScale(48)}
            color={theme.colors.text}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, {color: theme.colors.text}]}>
            Queue is empty
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={indexedTracks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        renderScrollComponent={renderScrollComponent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        drawDistance={500}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingBottom: verticalScale(20),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: verticalScale(100),
  },
  emptyIcon: {
    marginBottom: verticalScale(16),
    opacity: 0.7,
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
    marginLeft: moderateScale(8),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueCount: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    opacity: 0.7,
  },
  trackItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: moderateScale(8),
  },
  removeButton: {
    padding: moderateScale(8),
  },
});
