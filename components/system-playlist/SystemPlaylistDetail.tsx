import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated as RNAnimated,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {TrackItem} from '@/components/TrackItem';
import {
  getReciterById,
  getSurahById,
  getAllReciters,
} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {SystemPlaylistHeader} from './SystemPlaylistHeader';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {
  formatDuration,
  getSystemPlaylistEstimatedDuration,
} from '@/utils/systemPlaylistHelpers';
import Color from 'color';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {getFeaturedReciters} from '@/data/featuredReciters';
import {SheetManager} from 'react-native-actions-sheet';
import {useNavigation} from 'expo-router';
import {useHeaderHeight} from '@react-navigation/elements';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';

interface PlaylistTrack {
  surahId: number;
  reciterId?: string;
  rewayatId?: string;
  surah?: Surah;
  reciter?: Reciter;
}

interface PlaylistDataItem {
  track: PlaylistTrack;
  reciter: Reciter | null;
  surah: Surah | null;
}

interface SystemPlaylistDetailProps {
  playlist: SystemPlaylist;
}

/**
 * Find a featured reciter that has all the surahs in the playlist available
 */
async function findSuitableReciter(
  surahIds: number[],
): Promise<Reciter | null> {
  // First try featured reciters (they usually have complete collections)
  const featuredReciters = getFeaturedReciters(10);

  for (const reciter of featuredReciters) {
    const hasAllSurahs = reciter.rewayat.some(rewayat => {
      if (!rewayat.surah_list) return true;
      const availableSurahs = rewayat.surah_list.filter(
        (id): id is number => id !== null,
      );
      return surahIds.every(surahId => availableSurahs.includes(surahId));
    });

    if (hasAllSurahs) {
      return reciter;
    }
  }

  // Fallback: search all reciters
  const allReciters = await getAllReciters();
  for (const reciter of allReciters) {
    const hasAllSurahs = reciter.rewayat.some(rewayat => {
      if (!rewayat.surah_list) return true;
      const availableSurahs = rewayat.surah_list.filter(
        (id): id is number => id !== null,
      );
      return surahIds.every(surahId => availableSurahs.includes(surahId));
    });

    if (hasAllSurahs) {
      return reciter;
    }
  }

  return null;
}

/**
 * Find the best rewayat for a reciter that has all the surahs
 */
function findBestRewayat(
  reciter: Reciter,
  surahIds: number[],
): string | undefined {
  for (const rewayat of reciter.rewayat) {
    if (!rewayat.surah_list) {
      return rewayat.id;
    }

    const availableSurahs = rewayat.surah_list.filter(
      (id): id is number => id !== null,
    );
    if (surahIds.every(surahId => availableSurahs.includes(surahId))) {
      return rewayat.id;
    }
  }

  return reciter.rewayat[0]?.id;
}

const isGlass = USE_GLASS;

const SystemPlaylistDetail: React.FC<SystemPlaylistDetailProps> = ({
  playlist,
}) => {
  const {theme} = useTheme();
  const {updateQueue, addToQueue, play} = usePlayerActions();
  const {startNewChain} = useRecentlyPlayedStore();
  const navigation = useNavigation();
  const iosHeaderHeight = isGlass ? useHeaderHeight() : 0;

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // iOS: reveal playlist title in native header on scroll
  const headerTitleShownRef = useRef(false);
  useLayoutEffect(() => {
    if (!isGlass) return;
    navigation.setOptions({
      headerTitle: '',
    });
  }, [navigation]);

  const [playlistData, setPlaylistData] = useState<PlaylistDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContentContainer: {
          paddingBottom: moderateScale(100),
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: moderateScale(14),
          fontFamily: theme.fonts.regular,
          marginTop: moderateScale(40),
          paddingHorizontal: moderateScale(20),
        },
        trackItemWrapper: {
          marginBottom: moderateScale(0),
        },
        surahOnlyItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: moderateScale(16),
          paddingVertical: moderateScale(14),
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
        },
        surahOnlyContent: {
          flex: 1,
        },
        surahOnlyTitle: {
          fontSize: moderateScale(15),
          fontFamily: theme.fonts.semiBold,
          color: theme.colors.text,
          marginBottom: moderateScale(4),
        },
        surahOnlySubtitle: {
          fontSize: moderateScale(13),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
        },
        playButton: {
          paddingHorizontal: moderateScale(14),
          paddingVertical: moderateScale(8),
          borderRadius: moderateScale(8),
          backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
        },
        playButtonText: {
          fontSize: moderateScale(12),
          fontFamily: theme.fonts.medium,
          color: theme.colors.text,
        },
        reciterInfo: {
          marginTop: moderateScale(2),
          fontSize: moderateScale(11),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
          opacity: 0.8,
        },
      }),
    [theme],
  );

  // Load playlist data and find a suitable reciter for surah-only playlists
  useEffect(() => {
    async function loadPlaylistData() {
      setLoading(true);
      try {
        const surahIds = playlist.items.map(item => item.surahId);

        // For surah-only playlists, find a suitable reciter
        if (playlist.type === 'surah-only') {
          const reciter = await findSuitableReciter(surahIds);
          if (reciter) {
            setSelectedReciter(reciter);
            const rewayatId = findBestRewayat(reciter, surahIds);
            setSelectedRewayatId(rewayatId);
          }
        }

        // Load surah data
        const data = await Promise.all(
          playlist.items.map(async item => {
            const surah = await getSurahById(item.surahId);
            let reciter: Reciter | null = null;

            // For fully-curated playlists, use the specified reciter
            if (item.reciterId) {
              const fetchedReciter = await getReciterById(item.reciterId);
              reciter = fetchedReciter ?? null;
            }

            return {
              track: {
                surahId: item.surahId,
                reciterId: item.reciterId,
                rewayatId: item.rewayatId,
                surah: surah ?? undefined,
                reciter: reciter ?? undefined,
              },
              reciter,
              surah: surah ?? null,
            };
          }),
        );

        setPlaylistData(data);
      } catch (error) {
        console.error('Error loading system playlist data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPlaylistData();
  }, [playlist]);

  // Create tracks for surah-only playlist using selected reciter
  const createTracksForSurahOnlyPlaylist = useCallback(
    async (
      startIndex = 0,
    ): Promise<{
      tracks: Awaited<ReturnType<typeof createTrack>>[];
      reciter: Reciter;
      rewayatId: string;
    } | null> => {
      if (!selectedReciter || !selectedRewayatId) {
        console.error('No suitable reciter found for playlist');
        Alert.alert(
          'No Reciter Available',
          'Could not find a reciter with all surahs in this playlist. Please try a different playlist.',
        );
        return null;
      }

      try {
        const trackPromises = playlistData.map(async item => {
          if (!item.surah) return null;
          return await createTrack(
            selectedReciter,
            item.surah,
            selectedRewayatId,
          );
        });

        const allTracks = (await Promise.all(trackPromises)).filter(
          (track): track is NonNullable<typeof track> => track !== null,
        );

        if (allTracks.length === 0) return null;

        const reorderedTracks = [
          ...allTracks.slice(startIndex),
          ...allTracks.slice(0, startIndex),
        ];

        return {
          tracks: reorderedTracks,
          reciter: selectedReciter,
          rewayatId: selectedRewayatId,
        };
      } catch (error) {
        console.error('Error creating tracks:', error);
        return null;
      }
    },
    [selectedReciter, selectedRewayatId, playlistData],
  );

  // Create tracks for fully-curated playlist
  const createTracksForFullyCuratedPlaylist = useCallback(
    async (
      startIndex = 0,
    ): Promise<{
      tracks: Awaited<ReturnType<typeof createTrack>>[];
      reciter: Reciter;
      rewayatId?: string;
    } | null> => {
      if (playlistData.length === 0) return null;

      try {
        const trackPromises = playlistData.map(async item => {
          if (!item.reciter || !item.surah) return null;
          return await createTrack(
            item.reciter,
            item.surah,
            item.track.rewayatId,
          );
        });

        const allTracks = (await Promise.all(trackPromises)).filter(
          (track): track is NonNullable<typeof track> => track !== null,
        );

        if (allTracks.length === 0) return null;

        const reorderedTracks = [
          ...allTracks.slice(startIndex),
          ...allTracks.slice(0, startIndex),
        ];

        const firstItem = playlistData[startIndex] || playlistData[0];
        if (!firstItem?.reciter) return null;

        return {
          tracks: reorderedTracks,
          reciter: firstItem.reciter,
          rewayatId: firstItem.track.rewayatId,
        };
      } catch (error) {
        console.error('Error creating tracks:', error);
        return null;
      }
    },
    [playlistData],
  );

  const handlePlayAll = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      let result: {
        tracks: Awaited<ReturnType<typeof createTrack>>[];
        reciter: Reciter;
        rewayatId?: string;
      } | null;

      if (playlist.type === 'surah-only') {
        result = await createTracksForSurahOnlyPlaylist(0);
      } else {
        result = await createTracksForFullyCuratedPlaylist(0);
      }

      if (!result || result.tracks.length === 0) return;

      await updateQueue(result.tracks, 0);
      await play();

      // Add first track to recent history
      const firstSurah = playlistData[0]?.surah;
      if (firstSurah) {
        await startNewChain(
          result.reciter,
          firstSurah,
          0,
          0,
          result.rewayatId ?? '',
        );
      }
    } catch (error) {
      console.error('Error playing system playlist:', error);
      Alert.alert('Error', 'Failed to play playlist. Please try again.');
    }
  }, [
    playlist.type,
    playlistData,
    createTracksForSurahOnlyPlaylist,
    createTracksForFullyCuratedPlaylist,
    updateQueue,
    play,
    startNewChain,
  ]);

  const handleShufflePlay = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      let result: {
        tracks: Awaited<ReturnType<typeof createTrack>>[];
        reciter: Reciter;
        rewayatId?: string;
      } | null;

      if (playlist.type === 'surah-only') {
        result = await createTracksForSurahOnlyPlaylist(0);
      } else {
        result = await createTracksForFullyCuratedPlaylist(0);
      }

      if (!result || result.tracks.length === 0) return;

      // Shuffle the tracks
      const shuffledTracks = [...result.tracks].sort(() => Math.random() - 0.5);

      await updateQueue(shuffledTracks, 0);
      await play();

      // Add first shuffled track to recent history
      const firstTrack = shuffledTracks[0];
      const firstSurah = playlistData.find(
        item => item.surah?.id === parseInt(firstTrack.surahId || '0', 10),
      )?.surah;

      if (firstSurah) {
        await startNewChain(
          result.reciter,
          firstSurah,
          0,
          0,
          result.rewayatId ?? '',
        );
      }
    } catch (error) {
      console.error('Error shuffling system playlist:', error);
      Alert.alert('Error', 'Failed to shuffle playlist. Please try again.');
    }
  }, [
    playlist.type,
    playlistData,
    createTracksForSurahOnlyPlaylist,
    createTracksForFullyCuratedPlaylist,
    updateQueue,
    play,
    startNewChain,
  ]);

  const handleSurahPress = useCallback(
    async (
      track: PlaylistTrack,
      index: number,
      reciter?: Reciter,
      surah?: Surah,
    ) => {
      try {
        let result: {
          tracks: Awaited<ReturnType<typeof createTrack>>[];
          reciter: Reciter;
          rewayatId?: string;
        } | null;

        if (playlist.type === 'surah-only') {
          result = await createTracksForSurahOnlyPlaylist(index);
        } else {
          if (!reciter || !surah) return;
          result = await createTracksForFullyCuratedPlaylist(index);
        }

        if (!result || result.tracks.length === 0) return;

        await updateQueue(result.tracks, 0);
        await play();

        // Add the selected track to recent history
        const selectedSurah = playlistData[index]?.surah;
        if (selectedSurah) {
          await startNewChain(
            result.reciter,
            selectedSurah,
            0,
            0,
            result.rewayatId ?? '',
          );
        }
      } catch (error) {
        console.error('Error playing track:', error);
        Alert.alert('Error', 'Failed to play track. Please try again.');
      }
    },
    [
      playlist.type,
      playlistData,
      createTracksForSurahOnlyPlaylist,
      createTracksForFullyCuratedPlaylist,
      updateQueue,
      play,
      startNewChain,
    ],
  );

  const handleShowTrackOptions = useCallback(
    async (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      const audioTrack = await createTrack(reciter, surah, track.rewayatId);

      SheetManager.show('surah-options', {
        payload: {
          surah,
          reciterId: track.reciterId,
          rewayatId: track.rewayatId,
          onAddToQueue: async (s: Surah) => {
            if (audioTrack) {
              await addToQueue([audioTrack]);
            }
          },
        },
      });
    },
    [addToQueue],
  );

  const renderItem = useCallback(
    ({item, index}: {item: PlaylistDataItem; index: number}) => {
      const {track, reciter, surah} = item;

      if (!surah) {
        return null;
      }

      // For surah-only playlists, show a custom item
      if (playlist.type === 'surah-only') {
        return (
          <Pressable
            style={styles.surahOnlyItem}
            onPress={() => handleSurahPress(track, index)}>
            <View style={styles.surahOnlyContent}>
              <Text style={styles.surahOnlyTitle}>
                {surah.id}. {surah.name}
              </Text>
              <Text style={styles.surahOnlySubtitle}>
                {surah.translated_name_english}
              </Text>
              {selectedReciter && (
                <Text style={styles.reciterInfo}>
                  with {selectedReciter.name}
                </Text>
              )}
            </View>
            <View style={styles.playButton}>
              <Text style={styles.playButtonText}>Play</Text>
            </View>
          </Pressable>
        );
      }

      // For fully-curated playlists, use TrackItem
      if (!reciter || !track.reciterId) {
        return null;
      }

      return (
        <View style={styles.trackItemWrapper}>
          <TrackItem
            reciterId={track.reciterId}
            surahId={String(track.surahId)}
            rewayatId={track.rewayatId}
            onPress={() => handleSurahPress(track, index, reciter, surah)}
            onPlayPress={() => handleSurahPress(track, index, reciter, surah)}
            onOptionsPress={() => handleShowTrackOptions(track, reciter, surah)}
          />
        </View>
      );
    },
    [
      playlist.type,
      styles,
      selectedReciter,
      handleSurahPress,
      handleShowTrackOptions,
    ],
  );

  const estimatedDuration = useMemo(
    () => getSystemPlaylistEstimatedDuration(playlist),
    [playlist],
  );

  const canPlay = useMemo(
    () => playlist.type === 'fully-curated' || selectedReciter !== null,
    [playlist.type, selectedReciter],
  );

  const listHeaderComponent = useMemo(
    () => (
      <SystemPlaylistHeader
        title={playlist.title}
        description={playlist.description}
        itemCount={playlist.items.length}
        estimatedDuration={
          estimatedDuration ? formatDuration(estimatedDuration) : null
        }
        onPlayPress={handlePlayAll}
        onShufflePress={canPlay ? handleShufflePlay : undefined}
        canPlayImmediately={canPlay}
        theme={theme}
      />
    ),
    [
      playlist,
      estimatedDuration,
      canPlay,
      handlePlayAll,
      handleShufflePlay,
      theme,
    ],
  );

  const keyExtractor = useCallback(
    (item: PlaylistDataItem, index: number) => `${item.track.surahId}-${index}`,
    [],
  );

  const listEmptyComponent = useMemo(
    () => <Text style={styles.emptyText}>No surahs in this playlist</Text>,
    [styles.emptyText],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNAnimated.FlatList
        data={playlistData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={[
          styles.listContentContainer,
          isGlass && {paddingTop: iosHeaderHeight},
        ]}
        ListEmptyComponent={listEmptyComponent}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: true,
            listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (!isGlass) return;
              const y = e.nativeEvent.contentOffset.y;
              // Show title after scrolling past the header area
              const threshold = moderateScale(120);
              const shouldShow = y >= threshold;
              if (shouldShow !== headerTitleShownRef.current) {
                headerTitleShownRef.current = shouldShow;
                navigation.setOptions({
                  headerTitle: shouldShow ? playlist.title : '',
                });
              }
            },
          },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      {!isGlass && (
        <CollectionStickyHeader title={playlist.title} scrollY={scrollY} />
      )}
    </View>
  );
};

export default SystemPlaylistDetail;
