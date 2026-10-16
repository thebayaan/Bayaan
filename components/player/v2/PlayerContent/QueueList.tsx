import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
// @ai-start
import {usePlayerScrollable} from '@/hooks/usePlayerScrollable';
// @ai-end
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
// @ai-start
import {useTranslation} from 'react-i18next';
import {localizeDigits, getTrackDisplayTitle} from '@/i18n/format';
import {
  getTrackArtistLabel,
  getUploadCategoryLabel,
  UNTAGGED_UPLOAD_ARTIST,
} from '@/utils/uploadLabels';
// @ai-end

interface UploadQueueItemProps {
  track: Track;
  index: number;
  onPress: () => void;
}

// @ai-start
const UploadQueueItem: React.FC<UploadQueueItemProps> = React.memo(
  ({track, index, onPress}) => {
    const {theme} = useTheme();
    const {t} = useTranslation(['player', 'common']);

    const playbackState = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);

    const isCurrentTrack = currentIndex === index;
    const isPlaying =
      isCurrentTrack &&
      (playbackState === 'playing' || playbackState === 'buffering');

    const surahNum = track.surahId ? parseInt(track.surahId, 10) : undefined;
    const displayTitle = surahNum
      ? `${localizeDigits(surahNum)}. ${getTrackDisplayTitle(track)}`
      : track.title;

    // Look up the full recitation for tags
    const recitation = useUploadsStore(state =>
      track.userRecitationId
        ? state.recitations.find(r => r.id === track.userRecitationId)
        : undefined,
    );

    const verseLabel = React.useMemo(() => {
      if (!recitation?.startVerse) return null;
      if (recitation.endVerse)
        return localizeDigits(
          `${recitation.startVerse}-${recitation.endVerse}`,
        );
      return t('queue.verseShort', {verse: recitation.startVerse});
    }, [recitation?.startVerse, recitation?.endVerse, t]);

    const recordingLabel = React.useMemo(() => {
      if (recitation?.recordingType === 'salah')
        return t('uploads.recordingType.salah');
      if (recitation?.recordingType === 'studio')
        return t('uploads.recordingType.studio');
      return null;
    }, [recitation?.recordingType, t]);

    const categoryLabel = React.useMemo(() => {
      if (recitation?.type !== 'other' || !recitation?.category) return null;
      return getUploadCategoryLabel(recitation.category);
    }, [recitation?.type, recitation?.category]);

    const tagBg = Color(theme.colors.text).alpha(0.06).toString();

    return (
      <Pressable style={uploadQueueStyles.container} onPress={onPress}>
        {track.reciterName && track.reciterName !== UNTAGGED_UPLOAD_ARTIST ? (
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
            {getTrackArtistLabel(track)}
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
// @ai-end

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

// @ai-start
export const QueueList: React.FC<QueueListProps> = ({
  onQueueItemPress,
  onRemoveQueueItem,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['player', 'common']);
  const tracks = usePlayerStore(s => s.queue.tracks);
  const renderScrollComponent = usePlayerScrollable();

  const indexedTracks: IndexedTrack[] = React.useMemo(
    () => tracks.map((t, i) => ({...t, _queueIndex: i})),
    [tracks],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<IndexedTrack>) => {
      const index = item._queueIndex;
      return (
        <View
          style={[
            styles.trackItemContainer,
            {backgroundColor: theme.colors.card},
          ]}>
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
    [onQueueItemPress, onRemoveQueueItem, theme.colors.text, theme.colors.card],
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
            {t('common:terms.queue')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.queueCount, {color: theme.colors.text}]}>
            {t('common:counts.tracks', {count: tracks.length})}
          </Text>
        </View>
      </View>
    ),
    [theme.colors.border, theme.colors.text, tracks.length, t],
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
            {t('queue.empty')}
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
// @ai-end

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingTop: verticalScale(8),
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
