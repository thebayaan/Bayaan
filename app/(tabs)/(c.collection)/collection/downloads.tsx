import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ListRenderItem,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {TrackItem} from '@/components/TrackItem';
import {ReciterDownloadsListItem} from '@/components/ReciterDownloadsListItem';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {
  useDownloadActions,
  useDownloads,
} from '@/services/player/store/downloadSelectors';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createDownloadedTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {DownloadIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {shuffleArray} from '@/utils/arrayUtils';
import Color from 'color';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';

interface DownloadDataItem {
  download: DownloadedSurah;
  reciter: Reciter | null;
  surah: Surah | null;
}

interface GroupedItem {
  type: 'single' | 'group';
  reciterId: string;
  downloadData?: DownloadDataItem;
  downloadCount?: number;
}

export default function DownloadsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const downloads = useDownloads();
  const {removeDownload, clearAllDownloads} = useDownloadActions();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const [downloadData, setDownloadData] = useState<DownloadDataItem[]>([]);

  const handleOptionsMenu = useCallback(() => {
    SheetManager.show('collection-options', {
      payload: {
        title: 'Downloads',
        subtitle: `${downloads.length} ${
          downloads.length === 1 ? 'surah' : 'surahs'
        } downloaded`,
        options: [
          {
            label: 'Remove All Downloads',
            icon: 'trash-2',
            destructive: true,
            onPress: () => clearAllDownloads(),
          },
        ],
      },
    });
  }, [downloads.length, clearAllDownloads]);

  const renderHeaderRight = useCallback(
    () => (
      <Pressable onPress={handleOptionsMenu} hitSlop={8}>
        <Feather
          name="more-horizontal"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      </Pressable>
    ),
    [handleOptionsMenu, theme.colors.text],
  );

  useCollectionNativeHeader({
    title: 'Downloads',
    scrollY,
    hasContent: downloads.length > 0,
    headerRight: downloads.length > 0 ? renderHeaderRight : undefined,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        headerContainer: {
          width: '100%',
          overflow: 'hidden',
        },
        contentArea: {
          width: '100%',
          alignItems: 'center',
          paddingTop: USE_GLASS ? moderateScale(16) : insets.top + moderateScale(40),
          paddingBottom: moderateScale(10),
          overflow: 'hidden',
          backgroundColor: theme.colors.background,
        },
        contentCenter: {
          alignItems: 'center',
          paddingHorizontal: moderateScale(20),
        },
        heroIconContainer: {
          width: moderateScale(64),
          height: moderateScale(64),
          borderRadius: moderateScale(32),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.1)
            .toString(),
        },
        heroIconInner: {
          width: moderateScale(56),
          height: moderateScale(56),
          borderRadius: moderateScale(28),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
        },
        title: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
          letterSpacing: -0.3,
        },
        subtitle: {
          fontSize: moderateScale(12),
          color: theme.colors.text,
          fontFamily: theme.fonts.regular,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        actionButtons: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: moderateScale(4),
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(20),
          gap: moderateScale(16),
        },
        circleButton: {
          width: moderateScale(42),
          height: moderateScale(42),
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
          padding: moderateScale(8),
        },
        playButton: {
          width: moderateScale(42),
          height: moderateScale(42),
          backgroundColor: theme.colors.text,
        },
        playIconContainer: {
          paddingLeft: moderateScale(4),
        },
        disabledButton: {
          opacity: 0.4,
        },
        listContentContainer: {
          flexGrow: 1,
          paddingBottom: moderateScale(65),
        },
        fixedBackButton: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          left: moderateScale(15),
          zIndex: 5,
          padding: moderateScale(8),
        },
        emptyHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(16),
        },
        emptyHeaderBack: {
          width: moderateScale(36),
          height: moderateScale(36),
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyHeaderTitle: {
          flex: 1,
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
        },
        emptyContent: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: moderateScale(32),
          paddingBottom: moderateScale(60),
        },
        emptyIcon: {
          marginBottom: moderateScale(16),
        },
        emptyTitle: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        emptySubtitle: {
          fontSize: moderateScale(13),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginBottom: moderateScale(20),
        },
      }),
    [theme, insets.top],
  );

  useEffect(() => {
    const loadDownloadData = async () => {
      const data = await Promise.all(
        downloads.map(async download => {
          const [reciter, surah] = await Promise.all([
            getReciterById(download.reciterId),
            getSurahById(parseInt(download.surahId, 10)),
          ]);
          return {
            download,
            reciter: reciter || null,
            surah: surah || null,
          };
        }),
      );
      setDownloadData(data);
    };

    if (downloads.length > 0) {
      loadDownloadData();
    } else {
      setDownloadData([]);
    }
  }, [downloads]);

  const groupedItems = useMemo(() => {
    const byReciter: Record<string, DownloadDataItem[]> = {};
    for (const item of downloadData) {
      const rid = item.download.reciterId;
      if (!byReciter[rid]) {
        byReciter[rid] = [];
      }
      byReciter[rid].push(item);
    }

    const items: GroupedItem[] = [];
    for (const [reciterId, reciterDownloads] of Object.entries(byReciter)) {
      if (reciterDownloads.length === 1) {
        items.push({
          type: 'single',
          reciterId,
          downloadData: reciterDownloads[0],
        });
      } else {
        items.push({
          type: 'group',
          reciterId,
          downloadCount: reciterDownloads.length,
        });
      }
    }

    return items;
  }, [downloadData]);

  const handleSurahPress = useCallback(
    async (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      try {
        const track = createDownloadedTrack(
          reciter,
          surah,
          download.filePath,
          download.rewayatId,
        );
        await updateQueue([track], 0);
        await play();
      } catch (error) {
        console.error('Error playing downloaded surah', error);
      }
    },
    [updateQueue, play],
  );

  const handleRemoveDownload = useCallback(
    (download: DownloadedSurah) => {
      removeDownload(
        download.reciterId,
        download.surahId,
        download.rewayatId || undefined,
      );
    },
    [removeDownload],
  );

  const handleShowOptions = useCallback(
    (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      const track = createDownloadedTrack(
        reciter,
        surah,
        download.filePath,
        download.rewayatId,
      );

      SheetManager.show('download-options', {
        payload: {
          download,
          surah,
          reciterId: download.reciterId,
          rewayatId: download.rewayatId,
          onPlay: () => handleSurahPress(download, reciter, surah),
          onAddToQueue: () => {
            addToQueue([track]);
          },
          onRemoveDownload: () => handleRemoveDownload(download),
        },
      });
    },
    [handleSurahPress, addToQueue, handleRemoveDownload],
  );

  const handleReciterGroupOptions = useCallback(
    (reciterId: string) => {
      const reciterDownloads = downloadData.filter(
        item => item.download.reciterId === reciterId,
      );
      const reciterName = reciterDownloads[0]?.reciter?.name || 'Reciter';

      SheetManager.show('collection-options', {
        payload: {
          title: reciterName,
          subtitle: `${reciterDownloads.length} ${
            reciterDownloads.length === 1 ? 'surah' : 'surahs'
          } downloaded`,
          options: [
            {
              label: 'Play All',
              icon: 'play',
              customIcon: (
                <PlayIcon color={theme.colors.text} size={moderateScale(20)} />
              ),
              onPress: async () => {
                const tracks = reciterDownloads
                  .filter(item => item.reciter && item.surah)
                  .map(item =>
                    createDownloadedTrack(
                      item.reciter!,
                      item.surah!,
                      item.download.filePath,
                      item.download.rewayatId,
                    ),
                  );
                if (tracks.length > 0) {
                  await updateQueue(tracks, 0);
                  await play();
                }
              },
            },
            {
              label: 'Remove All Downloads',
              icon: 'trash-2',
              destructive: true,
              onPress: async () => {
                for (const item of reciterDownloads) {
                  await removeDownload(
                    item.download.reciterId,
                    item.download.surahId,
                    item.download.rewayatId || undefined,
                  );
                }
              },
            },
          ],
        },
      });
    },
    [downloadData, updateQueue, play, removeDownload, theme.colors.text],
  );

  const handlePlayAll = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const trackPromises = downloadData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return createDownloadedTrack(
          item.reciter,
          item.surah,
          item.download.filePath,
          item.download.rewayatId,
        );
      });

      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length === 0) return;

      await updateQueue(validTracks, 0);
      await play();
    } catch (error) {
      console.error('Error playing all downloads:', error);
    }
  }, [downloadData, updateQueue, play]);

  const handleShuffle = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const shuffledItems = shuffleArray([...downloadData]).filter(
        item => item.reciter && item.surah,
      );

      if (shuffledItems.length === 0) return;

      const tracks = shuffledItems.map(item =>
        createDownloadedTrack(
          item.reciter!,
          item.surah!,
          item.download.filePath,
          item.download.rewayatId,
        ),
      );

      await updateQueue(tracks, 0);
      await play();
    } catch (error) {
      console.error('Error shuffling downloads:', error);
    }
  }, [downloadData, updateQueue, play]);

  const hasDownloads = downloadData.length > 0;

  if (downloads.length === 0) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>Downloads</Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <DownloadIcon
              color={theme.colors.textSecondary}
              size={moderateScale(48)}
              filled={true}
            />
          </View>
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySubtitle}>
            Download surahs to see them here
          </Text>
        </View>
      </View>
    );
  }

  const ListHeaderComponent = () => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.contentArea}>
          <View style={styles.contentCenter}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconInner}>
                <DownloadIcon
                  color={theme.colors.text}
                  size={moderateScale(30)}
                  filled={true}
                />
              </View>
            </View>
            <Text style={styles.title}>Downloads</Text>
            <Text style={styles.subtitle}>
              {downloads.length} {downloads.length === 1 ? 'surah' : 'surahs'}{' '}
              downloaded
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {!USE_GLASS && (
            <Pressable
              style={[
                styles.circleButton,
                !hasDownloads && styles.disabledButton,
              ]}
              onPress={hasDownloads ? handleOptionsMenu : undefined}
              disabled={!hasDownloads}>
              <Feather
                name="more-horizontal"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            </Pressable>
          )}
          <Pressable
            style={[
              styles.circleButton,
              styles.playButton,
              !hasDownloads && styles.disabledButton,
            ]}
            onPress={hasDownloads ? handlePlayAll : undefined}
            disabled={!hasDownloads}>
            <View style={styles.playIconContainer}>
              <PlayIcon
                color={theme.colors.background}
                size={moderateScale(16)}
              />
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.circleButton,
              !hasDownloads && styles.disabledButton,
            ]}
            onPress={hasDownloads ? handleShuffle : undefined}
            disabled={!hasDownloads}>
            <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderItem: ListRenderItem<GroupedItem> = ({item}) => {
    if (item.type === 'group') {
      return (
        <ReciterDownloadsListItem
          reciterId={item.reciterId}
          downloadCount={item.downloadCount!}
          onPress={() =>
            router.push(`/collection/reciter-downloads/${item.reciterId}`)
          }
          onOptionsPress={() => handleReciterGroupOptions(item.reciterId)}
          onLongPress={() => handleReciterGroupOptions(item.reciterId)}
        />
      );
    }

    const {download, reciter, surah} = item.downloadData!;

    if (!reciter || !surah) {
      return null;
    }

    return (
      <TrackItem
        reciterId={download.reciterId}
        surahId={download.surahId}
        rewayatId={download.rewayatId}
        onPress={() => handleSurahPress(download, reciter, surah)}
        onPlayPress={() => handleSurahPress(download, reciter, surah)}
        onOptionsPress={() => handleShowOptions(download, reciter, surah)}
        onLongPress={() => handleShowOptions(download, reciter, surah)}
      />
    );
  };

  return (
    <View style={styles.container}>
      {!USE_GLASS && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={groupedItems}
        renderItem={renderItem}
        keyExtractor={item =>
          item.type === 'group'
            ? `group-${item.reciterId}`
            : `single-${item.reciterId}-${item.downloadData!.download.surahId}`
        }
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title="Downloads" scrollY={scrollY} />
      )}
    </View>
  );
}
