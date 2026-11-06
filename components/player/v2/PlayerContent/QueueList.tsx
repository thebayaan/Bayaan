import React, {useCallback, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
// @ai-start
import {usePlayerScrollable} from '@/hooks/usePlayerScrollable';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import type {ReadingThemeColors} from '@/constants/readingThemes';
// @ai-end
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {Track} from '@/types/audio';
import {ReciterImage} from '@/components/ReciterImage';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {useUploadsStore} from '@/store/uploadsStore';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
import {
  localizeDigits,
  getReciterDisplayName,
  getSurahDisplayName,
  getTrackDisplayTitle,
  getTrackArtistDisplay,
} from '@/i18n/format';
// @ai-end

const EMPTY_TRACKS: Track[] = [];

// @ai-start
type QueueSection = 'nowPlaying' | 'upNext' | 'played';

type QueueRowItem =
  | {kind: 'section'; section: QueueSection; count: number}
  | {kind: 'track'; track: Track; index: number; section: QueueSection};

export interface RowDisplay {
  title: string;
  subtitle: string;
  tags: string[];
  surahId: number;
}

/** Title, reciter line and tags for one queue row. */
export function useRowDisplay(track: Track): RowDisplay {
  const {t} = useTranslation(['player', 'common']);
  const recitation = useUploadsStore(state =>
    track.isUserUpload && track.userRecitationId
      ? state.recitations.find(r => r.id === track.userRecitationId)
      : undefined,
  );

  return useMemo(() => {
    const surahId = track.surahId ? parseInt(track.surahId, 10) : 0;

    if (track.isUserUpload) {
      const tags: string[] = [];
      if (recitation?.startVerse) {
        tags.push(
          recitation.endVerse
            ? localizeDigits(`${recitation.startVerse}-${recitation.endVerse}`)
            : t('queue.verseShort', {verse: recitation.startVerse}),
        );
      }
      if (recitation?.recordingType === 'salah') {
        tags.push(t('uploads.recordingType.salah'));
      } else if (recitation?.recordingType === 'studio') {
        tags.push(t('uploads.recordingType.studio'));
      }
      if (recitation?.type === 'other' && recitation.category) {
        tags.push(
          recitation.category.charAt(0).toUpperCase() +
            recitation.category.slice(1),
        );
      }
      return {
        title: surahId
          ? `${localizeDigits(surahId)}. ${getTrackDisplayTitle(track)}`
          : track.title,
        subtitle: getTrackArtistDisplay(track),
        tags,
        surahId,
      };
    }

    const reciter = track.reciterId
      ? getReciterByIdSync(track.reciterId)
      : undefined;
    const surah = surahId ? getSurahById(surahId) : undefined;
    const rewayat = track.rewayatId
      ? reciter?.rewayat?.find(r => r.id === track.rewayatId)
      : undefined;
    return {
      title: surah
        ? `${localizeDigits(surah.id)}. ${getSurahDisplayName(surah)}`
        : getTrackDisplayTitle(track),
      subtitle: reciter
        ? getReciterDisplayName(reciter)
        : getTrackArtistDisplay(track),
      tags: rewayat ? [getDisplayLabelFromName(rewayat.name)] : [],
      surahId,
    };
  }, [track, recitation, t]);
}

interface QueueRowProps {
  track: Track;
  index: number;
  section: QueueSection;
  colors: ReadingThemeColors;
  onPress: (index: number) => void;
  onRemove: (index: number) => void;
}

const QueueRow: React.FC<QueueRowProps> = React.memo(
  ({track, index, section, colors, onPress, onRemove}) => {
    const {t} = useTranslation(['player', 'common']);
    const display = useRowDisplay(track);
    const isCurrent = section === 'nowPlaying';
    const isPlaying = usePlayerStore(
      s =>
        isCurrent &&
        (s.playback.state === 'playing' || s.playback.state === 'buffering'),
    );

    const subtle = Color(colors.text).alpha(0.06).toString();
    const pressed = Color(colors.text).alpha(0.05).toString();
    // Keeps artwork (and its placeholder) visible on dark backgrounds.
    const edge = Color(colors.text).alpha(0.12).toString();
    const tags = display.tags.map(tag => (
      <View key={tag} style={[styles.tag, {backgroundColor: subtle}]}>
        <Text
          style={[styles.tagText, {color: colors.textSecondary}]}
          numberOfLines={1}>
          {tag}
        </Text>
      </View>
    ));
    const showArtwork =
      !!track.reciterName && track.reciterName !== 'My Recitations';

    return (
      <View
        style={[
          styles.row,
          isCurrent && [styles.currentRow, {backgroundColor: subtle}],
          section === 'played' && styles.playedRow,
        ]}>
        <Pressable
          style={({pressed: isPressed}) => [
            styles.rowBody,
            isPressed && !isCurrent && {backgroundColor: pressed},
          ]}
          onPress={() => onPress(index)}
          accessibilityRole="button"
          accessibilityLabel={`${display.title}, ${display.subtitle}`}>
          {showArtwork ? (
            <ReciterImage
              reciterName={track.reciterName}
              imageUrl={track.artwork || undefined}
              style={[
                styles.artwork,
                isCurrent && styles.currentArtwork,
                styles.artworkEdge,
                {borderColor: edge},
              ]}
            />
          ) : (
            <View
              style={[
                styles.artwork,
                isCurrent && styles.currentArtwork,
                styles.artworkPlaceholder,
                {backgroundColor: subtle},
              ]}>
              <Feather
                name="music"
                size={moderateScale(16)}
                color={colors.textSecondary}
              />
            </View>
          )}
          <View style={styles.info}>
            {isCurrent ? (
              <GradientText
                style={[styles.title, styles.currentTitle]}
                surahId={display.surahId}>
                {display.title}
              </GradientText>
            ) : (
              <Text
                style={[styles.title, {color: colors.text}]}
                numberOfLines={1}>
                {display.title}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Text
                style={[styles.subtitle, {color: colors.textSecondary}]}
                numberOfLines={1}>
                {display.subtitle}
              </Text>
              {!isCurrent && tags}
            </View>
            {/* The current row has room for its tags on their own line, so
                the reciter's name isn't cut short. */}
            {isCurrent && tags.length > 0 && (
              <View style={styles.metaRow}>{tags}</View>
            )}
          </View>
        </Pressable>
        {isCurrent ? (
          <View style={styles.trailing}>
            <NowPlayingIndicator
              isPlaying={isPlaying}
              barCount={3}
              surahId={display.surahId}
            />
          </View>
        ) : (
          <Pressable
            style={styles.trailing}
            onPress={() => onRemove(index)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('queue.remove', {title: display.title})}>
            <View style={[styles.removeCircle, {backgroundColor: subtle}]}>
              <MaterialCommunityIcons
                name="close"
                size={moderateScale(14)}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>
        )}
      </View>
    );
  },
);
QueueRow.displayName = 'QueueRow';

interface QueueListProps {
  onQueueItemPress: (index: number) => void;
  onRemoveQueueItem: (index: number) => void;
  /** Space kept clear above the list, e.g. for the floating header card. */
  contentPaddingTop?: number;
  /** Space kept clear below the list, e.g. for the floating controls card. */
  contentPaddingBottom?: number;
}

/**
 * The play queue: the current track highlighted under "Now Playing", the
 * rest of the queue under "Up Next", and tracks already played at the end.
 */
export const QueueList: React.FC<QueueListProps> = ({
  onQueueItemPress,
  onRemoveQueueItem,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
}) => {
  const colors = useReadingThemeColors();
  const {t} = useTranslation(['player', 'common']);
  const tracks = usePlayerStore(s => s.queue.tracks) ?? EMPTY_TRACKS;
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  const renderScrollComponent = usePlayerScrollable();

  const items = useMemo<QueueRowItem[]>(() => {
    const out: QueueRowItem[] = [];
    const current = tracks[currentIndex];
    if (current) {
      out.push({kind: 'section', section: 'nowPlaying', count: 1});
      out.push({
        kind: 'track',
        track: current,
        index: currentIndex,
        section: 'nowPlaying',
      });
    }
    const next = tracks.length - currentIndex - 1;
    if (next > 0) {
      out.push({kind: 'section', section: 'upNext', count: next});
      for (let i = currentIndex + 1; i < tracks.length; i++) {
        out.push({
          kind: 'track',
          track: tracks[i],
          index: i,
          section: 'upNext',
        });
      }
    }
    if (currentIndex > 0) {
      out.push({kind: 'section', section: 'played', count: currentIndex});
      for (let i = 0; i < currentIndex; i++) {
        out.push({
          kind: 'track',
          track: tracks[i],
          index: i,
          section: 'played',
        });
      }
    }
    return out;
  }, [tracks, currentIndex]);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<QueueRowItem>) => {
      if (item.kind === 'section') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
              {t(`queue.${item.section}`)}
            </Text>
            {item.section !== 'nowPlaying' && (
              <Text
                style={[styles.sectionCount, {color: colors.textSecondary}]}>
                {localizeDigits(item.count)}
              </Text>
            )}
          </View>
        );
      }
      return (
        <QueueRow
          track={item.track}
          index={item.index}
          section={item.section}
          colors={colors}
          onPress={onQueueItemPress}
          onRemove={onRemoveQueueItem}
        />
      );
    },
    [colors, onQueueItemPress, onRemoveQueueItem, t],
  );

  const keyExtractor = useCallback(
    (item: QueueRowItem) =>
      item.kind === 'section'
        ? `section-${item.section}`
        : `${item.track.id}-${item.index}`,
    [],
  );

  const getItemType = useCallback(
    (item: QueueRowItem) =>
      item.kind === 'section' ? 'section' : `track-${item.section}`,
    [],
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        <Text style={[styles.headerTitle, {color: colors.text}]}>
          {t('common:terms.queue')}
        </Text>
        <Text style={[styles.headerCount, {color: colors.textSecondary}]}>
          {t('common:counts.tracks', {count: tracks.length})}
        </Text>
      </View>
    ),
    [colors.text, colors.textSecondary, tracks.length, t],
  );

  if (!tracks?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              {backgroundColor: Color(colors.text).alpha(0.06).toString()},
            ]}>
            <MaterialCommunityIcons
              name="playlist-music"
              size={moderateScale(32)}
              color={colors.textSecondary}
            />
          </View>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('queue.empty')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: contentPaddingTop + moderateScale(8),
          paddingBottom: contentPaddingBottom + moderateScale(28),
        }}
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
  header: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(4),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontFamily: 'Manrope-Bold',
    letterSpacing: -0.5,
  },
  headerCount: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: moderateScale(6),
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(8),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: moderateScale(8),
    borderRadius: moderateScale(16),
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  currentRow: {
    paddingVertical: moderateScale(4),
  },
  playedRow: {
    opacity: 0.55,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingStart: moderateScale(12),
    borderRadius: moderateScale(16),
    borderCurve: 'continuous',
  },
  artwork: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(10),
    borderCurve: 'continuous',
  },
  artworkEdge: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  currentArtwork: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(12),
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: moderateScale(3),
  },
  title: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
  },
  currentTitle: {
    fontFamily: 'Manrope-Bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  subtitle: {
    flexShrink: 1,
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
  },
  tag: {
    flexShrink: 0,
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(1),
    borderRadius: moderateScale(6),
  },
  tagText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-SemiBold',
  },
  trailing: {
    width: moderateScale(48),
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCircle: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: moderateScale(14),
    paddingBottom: moderateScale(100),
  },
  emptyIconCircle: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
  },
});
