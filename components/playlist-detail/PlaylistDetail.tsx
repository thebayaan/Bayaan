import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ListRenderItem,
  Animated as RNAnimated,
  Pressable,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {TrackItem} from '@/components/TrackItem';
import {SurahOptionsRow} from '@/components/sheets/options/surahOptions'; // @ai
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu'; // @ai
import {
  PlaylistOptionsMenu,
  type PlaylistOptionsPayload,
} from '@/components/sheets/options/playlistOptions'; // @ai
import {usePlaylists} from '@/hooks/usePlaylists';
import {getReciterByIdSync, getSurahById} from '@/services/dataService'; // @ai
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTrack, createUserUploadTrack} from '@/utils/track';
import {useUploadsStore} from '@/store/uploadsStore';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-start
import {CollectionScreenHeader} from '@/components/collection/CollectionScreenHeader';
import {SurahCover} from '@/components/collection/CollectionArt';
import {
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PanelRow,
} from '@/components/collection/CollectionPanel';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {flipX} from '@/utils/rtl';
// @ai-end
import {useRouter} from 'expo-router';
import * as Haptics from 'expo-haptics';
import {UserPlaylist} from '@/services/database/DatabaseService';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
import {USE_GLASS} from '@/hooks/useGlassProps';
// @ai-start
import {useTranslation} from 'react-i18next';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {queueFromIndex} from '@/utils/queueFromIndex'; // @ai
import {showCreatePlaylistSheet} from '@/components/collection/showCreatePlaylistSheet'; // @ai
// @ai-end

interface PlaylistTrack {
  id: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  userRecitationId?: string;
  surah?: Surah;
  reciter?: Reciter;
}

interface PlaylistDataItem {
  track: PlaylistTrack;
  reciter: Reciter | null;
  surah: Surah | null;
}

interface PlaylistDetailProps {
  id: string;
}

// @ai-start
const PlaylistDetail: React.FC<PlaylistDetailProps> = ({id}) => {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const router = useRouter();
  const {t} = useTranslation(['collection', 'common']);
  const nativeMenus = useNativeOptionsMenu(); // @ai
  const {
    getPlaylist,
    getPlaylistItems,
    removeFromPlaylist,
    updatePlaylist,
    deletePlaylist,
    playlists,
  } = usePlaylists();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [playlistData, setPlaylistData] = useState<PlaylistDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldClearPlaylistRef = useRef(true);
  // @ai-start
  // The shared store's copy of this playlist. Its count, name and timestamp
  // change when the playlist is edited from anywhere (another tab, the
  // player's "Add to collection"), which is the cue to reload this screen.
  const storePlaylist = playlists.find(p => p.id === id);
  // Only the newest load may write its result: reloads can overlap.
  const loadSeqRef = useRef(0);
  // Set while this screen deletes its own playlist and goes back, so the
  // "no longer exists" view does not flash during the back animation.
  const leavingRef = useRef(false);
  // @ai-end

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContentContainer: {
      flexGrow: 1,
    },
    // @ai
    headerActions: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(32),
    },
    // @ai-start
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(32),
    },
    notFoundText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(20),
    },
    notFoundButton: {
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(24),
      borderRadius: moderateScale(12),
      backgroundColor: theme.colors.card,
    },
    notFoundButtonText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    // @ai-end
  });

  // @ai-start
  // Reload when the playlist changes in the shared store, not only on mount:
  // a surah added from another tab used to leave this screen saying "empty"
  // until it was closed and reopened.
  useEffect(() => {
    loadPlaylistData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    storePlaylist?.itemCount,
    storePlaylist?.updatedAt,
    storePlaylist?.name,
  ]);
  // @ai-end

  const loadPlaylistData = useCallback(async () => {
    // @ai-start
    if (leavingRef.current) return;
    const seq = ++loadSeqRef.current;
    // @ai-end
    try {
      // @ai `loading` starts true and is not raised again: a reload keeps the
      // list on screen (and its scroll position) instead of blanking it.
      const playlistInfo = await getPlaylist(id);

      const playlistItems = await getPlaylistItems(id);

      // @ai-start
      // Reciters come from the catalogue in memory. The async lookup
      // reloaded the whole catalogue once per row.
      const enrichedData = playlistItems.map(item => {
        const reciter = getReciterByIdSync(item.reciterId);
        const surah = getSurahById(parseInt(item.surahId, 10));

        return {
          track: {
            id: item.id,
            surahId: item.surahId,
            reciterId: item.reciterId,
            rewayatId: item.rewayatId,
            userRecitationId: item.userRecitationId,
            surah,
            reciter,
          },
          reciter: reciter || null,
          surah: surah || null,
        };
      });
      // @ai-end

      // @ai-start
      if (seq !== loadSeqRef.current || leavingRef.current) return;
      setPlaylist(playlistInfo);
      // @ai-end
      setPlaylistData(enrichedData);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false); // @ai
    }
  }, [id, getPlaylist, getPlaylistItems]);

  const handleSurahPress = useCallback(
    // @ai The row is found by its id; the other two are kept for callers.
    async (track: PlaylistTrack, _reciter: Reciter, _surah: Surah) => {
      try {
        const trackPromises = playlistData.map(async item => {
          if (!item.reciter || !item.surah) return null;
          if (item.track.userRecitationId) {
            const upload = useUploadsStore
              .getState()
              .recitations.find(r => r.id === item.track.userRecitationId);
            if (upload) return createUserUploadTrack(upload);
            return null;
          }
          return await createTrack(
            item.reciter,
            item.surah,
            item.track.rewayatId,
          );
        });

        // @ai-start
        // One entry per row, null where a row cannot be played.
        const rowTracks = await Promise.all(trackPromises);

        // The tapped row is found by its own id. Matching on reciter and
        // surah could pick another row of the same recitation.
        const selectedIndex = playlistData.findIndex(
          item => item.track.id === track.id,
        );

        // Nothing to play for this row (its upload was deleted). Starting
        // the next row instead would play something the user did not tap.
        if (selectedIndex === -1 || !rowTracks[selectedIndex]) return;

        // Keep the playlist's order and start at the tapped row. The queue
        // used to be rotated to put that row first, so Previous could never
        // reach the rows above it.
        const queue = queueFromIndex(rowTracks, selectedIndex);

        await updateQueue(queue.tracks, queue.startIndex);
        await play();
        // @ai-end
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [updateQueue, play, playlistData],
  );

  const handleRemoveFromPlaylist = useCallback(
    async (track: PlaylistTrack) => {
      try {
        await removeFromPlaylist(track.id);
        // @ai Drop the row in place. The store's new item count reloads the
        // list right after, without blanking it.
        setPlaylistData(prev => prev.filter(i => i.track.id !== track.id));
      } catch (error) {
        console.error('Failed to remove item from playlist:', error);
      }
    },
    [removeFromPlaylist], // @ai
  );

  const handlePlayAll = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        if (item.track.userRecitationId) {
          const upload = useUploadsStore
            .getState()
            .recitations.find(r => r.id === item.track.userRecitationId);
          if (upload) return createUserUploadTrack(upload);
          return null;
        }
        return await createTrack(
          item.reciter,
          item.surah,
          item.track.rewayatId,
        );
      });

      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length === 0) return;

      await updateQueue(validTracks, 0);
      await play();
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [playlistData, updateQueue, play]);

  const handleShuffle = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        if (item.track.userRecitationId) {
          const upload = useUploadsStore
            .getState()
            .recitations.find(r => r.id === item.track.userRecitationId);
          if (upload) return createUserUploadTrack(upload);
          return null;
        }
        return await createTrack(
          item.reciter,
          item.surah,
          item.track.rewayatId,
        );
      });

      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length > 0) {
        const shuffledTracks = [...validTracks].sort(() => Math.random() - 0.5);
        await updateQueue(shuffledTracks, 0);
        await play();
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [playlistData, updateQueue, play]);

  const existingPlaylistColors = React.useMemo(
    () => playlists.map(p => p.color).filter(Boolean) as string[],
    [playlists],
  );

  // @ai-start
  // Built at render so tablets can show it as a native menu.
  const playlistOptions = useMemo<PlaylistOptionsPayload | null>(() => {
    if (!playlist) return null;

    const handleEditForThisPlaylist = async () => {
      shouldClearPlaylistRef.current = false;

      // @ai-start
      const result = await showCreatePlaylistSheet({
        existingColors: existingPlaylistColors,
        isEditMode: true,
        initialName: playlist.name,
        initialColor: playlist.color || '#6366F1',
      });
      // @ai-end

      if (result?.name && result?.color) {
        try {
          await updatePlaylist(playlist.id, {
            name: result.name,
            color: result.color,
          });
          await loadPlaylistData();
        } catch (error: unknown) {
          console.error('Failed to update playlist:', error);
        }
      }

      setTimeout(() => {
        shouldClearPlaylistRef.current = true;
      }, 600);
    };

    const handleDeleteForThisPlaylist = async () => {
      leavingRef.current = true; // @ai
      try {
        await deletePlaylist(playlist.id);
        router.back();
      } catch (error: unknown) {
        leavingRef.current = false; // @ai
        console.error('Failed to delete playlist:', error);
      }
    };

    return {
      playlistId: playlist.id,
      playlistName: playlist.name,
      playlistColor: playlist.color,
      onDelete: handleDeleteForThisPlaylist,
      onEdit: handleEditForThisPlaylist,
    };
  }, [
    playlist,
    deletePlaylist,
    router,
    existingPlaylistColors,
    updatePlaylist,
    loadPlaylistData,
  ]);

  const handleOptionsPress = useCallback(() => {
    if (!playlistOptions) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    shouldClearPlaylistRef.current = true;
    showSheet('playlist-context', {payload: playlistOptions});
  }, [playlistOptions]);
  // @ai-end

  const renderHeaderRight = useCallback(
    () => (
      <Pressable
        onPress={handleOptionsPress}
        hitSlop={8}
        accessibilityRole="button" // @ai
        accessibilityLabel={t('collectionScreen.actions.moreOptions')}>
        <Feather
          name="more-horizontal"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
        {nativeMenus && playlistOptions && (
          <PlaylistOptionsMenu payload={playlistOptions} />
        )}
      </Pressable>
    ),
    [handleOptionsPress, theme.colors.text, nativeMenus, playlistOptions, t],
  );

  useCollectionNativeHeader({
    title: playlist?.name || t('common:terms.playlist'),
    scrollY,
    hasContent: !loading && playlistData.length > 0,
    headerRight: !loading && playlist ? renderHeaderRight : undefined,
  });

  // @ai-start
  // The options payload for a playlist track, shared by the sheet (phones)
  // and the row's native menu (tablets). The queue track is built only when
  // "Add to queue" is chosen.
  const buildTrackOptions = useCallback(
    (track: PlaylistTrack, reciter: Reciter, surah: Surah) => ({
      surah,
      reciterId: track.reciterId,
      rewayatId: track.rewayatId,
      onAddToQueue: async () => {
        let audioTrack;
        if (track.userRecitationId) {
          const upload = useUploadsStore
            .getState()
            .recitations.find(r => r.id === track.userRecitationId);
          if (upload) audioTrack = createUserUploadTrack(upload);
        }
        if (!audioTrack) {
          audioTrack = await createTrack(reciter, surah, track.rewayatId);
        }
        if (audioTrack) {
          await addToQueue([audioTrack]);
        }
      },
      onRemoveFromPlaylist: () => handleRemoveFromPlaylist(track),
    }),
    [addToQueue, handleRemoveFromPlaylist],
  );

  const handleShowTrackOptions = useCallback(
    (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      showSheet('surah-options', {
        payload: buildTrackOptions(track, reciter, surah),
      });
    },
    [buildTrackOptions],
  );
  // @ai-end

  // @ai-start
  // Laid out like the other Collection screens: the playlist's mosaic and
  // count, its name, Play, then Shuffle.
  const coverSurahs = useMemo(
    () =>
      playlistData
        .slice(0, 4)
        .map(item => item.surah?.id ?? Number(item.track.surahId)),
    [playlistData],
  );
  const ListHeaderComponent = useCallback(() => {
    if (!playlist) return null;
    const hasItems = playlistData.length > 0;
    return (
      <CollectionScreenHeader
        category="playlists"
        preview={
          coverSurahs.length > 0
            ? {kind: 'mosaic', surahIds: coverSurahs}
            : null
        }
        title={playlist.name}
        meta={
          playlist.description
            ? t('collectionScreen.meta.pair', {
                a: t('common:counts.surahs', {count: playlistData.length}),
                b: playlist.description,
              })
            : t('common:counts.surahs', {count: playlistData.length})
        }
        primary={{
          label: t('collectionScreen.actions.playAll'),
          icon: (
            <PlayIcon
              color={theme.colors.background}
              size={moderateScale(15)}
            />
          ),
          onPress: handlePlayAll,
          disabled: !hasItems,
        }}
        secondary={[
          {
            label: t('common:actions.shuffle'),
            icon: (
              <ShuffleIcon color={theme.colors.text} size={moderateScale(15)} />
            ),
            onPress: handleShuffle,
            disabled: !hasItems,
          },
        ]}
        actions={
          // No native header here: back on the start, ••• on the end.
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common:actions.back')}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
                style={flipX}
              />
            </Pressable>
            <Pressable
              onPress={handleOptionsPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('collectionScreen.actions.moreOptions')}>
              <Feather
                name="more-horizontal"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              {nativeMenus && playlistOptions ? (
                <PlaylistOptionsMenu payload={playlistOptions} />
              ) : null}
            </Pressable>
          </View>
        }
      />
    );
  }, [
    playlist,
    playlistData.length,
    coverSurahs,
    handlePlayAll,
    handleShuffle,
    handleOptionsPress,
    nativeMenus,
    playlistOptions,
    router,
    styles.headerActions,
    theme,
    t,
  ]);
  // @ai-end

  const renderItem: ListRenderItem<PlaylistDataItem> = ({item, index}) => {
    const {track, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    return (
      <PanelRow first={index === 0} last={index === playlistData.length - 1}>
        <SurahOptionsRow payload={buildTrackOptions(track, reciter, surah)}>
          <TrackItem
            transparent // @ai
            showSurahNumber={false} // @ai
            art={
              <SurahCover
                surahId={surah.id}
                size={PANEL_ART_SIZE}
                radius={PANEL_ART_RADIUS}
              />
            }
            reciterId={track.reciterId}
            surahId={track.surahId}
            rewayatId={track.rewayatId}
            userRecitationId={track.userRecitationId}
            onPress={() => handleSurahPress(track, reciter, surah)}
            onPlayPress={() => handleSurahPress(track, reciter, surah)}
            onOptionsPress={() => handleShowTrackOptions(track, reciter, surah)}
            onLongPress={() => handleShowTrackOptions(track, reciter, surah)}
          />
        </SurahOptionsRow>
      </PanelRow>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{t('common:status.loading')}</Text>
      </View>
    );
  }

  // @ai-start
  // The playlist was deleted from another screen (or the link is stale).
  // This used to sit on "Loading…" forever, with no back button on devices
  // without the native header.
  if (!playlist) {
    return (
      <View style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>
            {t('playlistDetail.notFound')}
          </Text>
          <Pressable
            style={styles.notFoundButton}
            onPress={() => router.back()}
            accessibilityRole="button">
            <Text style={styles.notFoundButtonText}>
              {t('common:actions.back')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }
  // @ai-end

  return (
    <View style={styles.container}>
      <RNAnimated.FlatList
        data={playlistData}
        renderItem={renderItem}
        keyExtractor={item => item.track.id}
        ListHeaderComponent={ListHeaderComponent() ?? undefined} // @ai
        contentContainerStyle={[
          styles.listContentContainer,
          {paddingBottom: listBottomPadding}, // @ai
        ]}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('playlistDetail.empty')}</Text>
        }
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title={playlist.name} scrollY={scrollY} />
      )}
    </View>
  );
};
// @ai-end

export default PlaylistDetail;
