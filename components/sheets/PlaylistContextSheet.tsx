import React, {useState, useCallback, useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {useTheme} from '@/hooks/useTheme';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {downloadSurah} from '@/services/downloadService';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {ActivityIndicator} from 'react-native';
import {CheckIcon} from '@/components/Icons';
import {Ionicons} from '@expo/vector-icons';
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';
import Color from 'color';

export const PlaylistContextSheet = (props: SheetProps<'playlist-context'>) => {
  const {theme} = useTheme();
  const payload = props.payload;
  const playlistId = payload?.playlistId ?? '';
  const playlistName = payload?.playlistName ?? '';
  const onDelete = payload?.onDelete;
  const onEdit = payload?.onEdit;

  const {getPlaylistItems} = usePlaylistsStore();
  const {
    addDownload,
    setDownloading,
    clearDownloading,
    setDownloadProgress,
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
    setPlaylistDownloadProgress,
  } = useDownloadStore();

  const isMountedRef = useRef(true);
  const downloadCancelledRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);
  const progressUpdateThrottle = 50;

  const playlistProgress = useDownloadStore(
    state => state.playlistDownloads[playlistId] || null,
  );
  const isDownloadingPlaylist = useDownloadStore(
    state => state.playlistDownloads[playlistId] !== undefined,
  );

  const [downloadProgress, setDownloadProgressState] = useState(
    playlistProgress || {current: 0, total: 0, percentage: 0},
  );

  useEffect(() => {
    if (playlistProgress) {
      setDownloadProgressState(playlistProgress);
    } else {
      setDownloadProgressState({current: 0, total: 0, percentage: 0});
    }
  }, [playlistProgress]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [playlistData, setPlaylistData] = useState<
    Array<{
      reciter: {id: string};
      surah: {id: number};
      track: {
        reciterId: string;
        surahId: string;
        rewayatId?: string;
      };
    }>
  >([]);

  useEffect(() => {
    if (!playlistId) return;
    const loadPlaylistData = async () => {
      const items = await getPlaylistItems(playlistId);
      const transformedData = items.map(item => ({
        reciter: {id: item.reciterId},
        surah: {id: parseInt(item.surahId, 10)},
        track: {
          reciterId: item.reciterId,
          surahId: item.surahId,
          rewayatId: item.rewayatId,
        },
      }));
      setPlaylistData(transformedData);
    };
    loadPlaylistData();
  }, [getPlaylistItems, playlistId]);

  const downloadState = useCollectionDownloadState(playlistData);

  const handleClose = useCallback(() => {
    SheetManager.hide('playlist-context');
  }, []);

  const handleEdit = useCallback(() => {
    handleClose();
    // Wait for context sheet to close before showing edit sheet
    setTimeout(() => {
      if (onEdit) {
        onEdit();
      }
    }, 300);
  }, [onEdit, handleClose]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlistName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete();
            }
            handleClose();
          },
        },
      ],
    );
  }, [playlistName, onDelete, handleClose]);

  const handleDownloadPlaylist = useCallback(async () => {
    if (isDownloadingPlaylist || !playlistId) return;

    downloadCancelledRef.current = false;
    isMountedRef.current = true;

    try {
      const initialProgress = {
        current: 0,
        total: 0,
        percentage: 0,
      };
      setPlaylistDownloadProgress(playlistId, initialProgress);
      setDownloadProgressState(initialProgress);

      const playlistItems = await getPlaylistItems(playlistId);

      if (playlistItems.length === 0) {
        setPlaylistDownloadProgress(playlistId, null);
        if (isMountedRef.current) {
          Alert.alert('Empty Playlist', 'This playlist is empty.');
        }
        return;
      }

      const itemsToDownload = playlistItems.filter(item => {
        if (item.rewayatId) {
          return !isDownloadedWithRewayat(
            item.reciterId,
            item.surahId,
            item.rewayatId,
          );
        }
        return !isDownloaded(item.reciterId, item.surahId);
      });

      if (itemsToDownload.length === 0) {
        setPlaylistDownloadProgress(playlistId, null);
        if (isMountedRef.current) {
          Alert.alert(
            'Already Downloaded',
            'All items in this playlist are already downloaded.',
          );
        }
        return;
      }

      const progress = {
        current: 0,
        total: itemsToDownload.length,
        percentage: 0,
      };
      setPlaylistDownloadProgress(playlistId, progress);
      if (isMountedRef.current) {
        setDownloadProgressState(progress);
      }

      const downloadItem = async (
        item: (typeof itemsToDownload)[0],
        index: number,
      ) => {
        const surahId = parseInt(item.surahId, 10);
        const downloadId = item.rewayatId
          ? `${item.reciterId}-${surahId}-${item.rewayatId}`
          : `${item.reciterId}-${surahId}`;

        const isCurrentlyDownloading = item.rewayatId
          ? isDownloadingWithRewayat(
              item.reciterId,
              item.surahId,
              item.rewayatId,
            )
          : isDownloading(item.reciterId, item.surahId);

        if (isCurrentlyDownloading) {
          return;
        }

        try {
          setDownloading(downloadId);

          const downloadResult = await downloadSurah(
            surahId,
            item.reciterId,
            item.rewayatId,
            progressValue => {
              const now = Date.now();
              if (
                now - lastProgressUpdateRef.current <
                progressUpdateThrottle
              ) {
                return;
              }
              lastProgressUpdateRef.current = now;

              const itemProgress = progressValue / itemsToDownload.length;
              const completedProgress = index / itemsToDownload.length;
              const overallProgress = completedProgress + itemProgress;

              setDownloadProgress(downloadId, progressValue);

              const newProgress = {
                current: index + 1,
                total: itemsToDownload.length,
                percentage: Math.min(overallProgress * 100, 99),
              };

              setTimeout(() => {
                setPlaylistDownloadProgress(playlistId, newProgress);
              }, 0);
            },
          );

          if (downloadCancelledRef.current) {
            clearDownloading(downloadId);
            return;
          }

          addDownload({
            reciterId: item.reciterId,
            surahId: item.surahId,
            rewayatId: item.rewayatId || '',
            filePath: downloadResult.filePath,
            fileSize: downloadResult.fileSize,
            downloadDate: Date.now(),
            status: 'completed',
          });

          clearDownloading(downloadId);

          const newProgress = {
            current: index + 1,
            total: itemsToDownload.length,
            percentage: ((index + 1) / itemsToDownload.length) * 100,
          };

          setTimeout(() => {
            setPlaylistDownloadProgress(playlistId, newProgress);
          }, 0);
        } catch (error) {
          console.error(`Failed to download surah ${surahId}:`, error);
          clearDownloading(downloadId);
        }
      };

      for (let i = 0; i < itemsToDownload.length; i++) {
        if (downloadCancelledRef.current) {
          break;
        }

        await downloadItem(itemsToDownload[i], i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (!downloadCancelledRef.current) {
        const finalProgress = {
          current: itemsToDownload.length,
          total: itemsToDownload.length,
          percentage: 100,
        };

        setTimeout(() => {
          setPlaylistDownloadProgress(playlistId, finalProgress);
        }, 0);

        setTimeout(() => {
          setPlaylistDownloadProgress(playlistId, null);
          if (isMountedRef.current) {
            setDownloadProgressState({
              current: 0,
              total: 0,
              percentage: 0,
            });
            Alert.alert(
              'Download Complete',
              `Successfully downloaded ${itemsToDownload.length} item${
                itemsToDownload.length === 1 ? '' : 's'
              } from "${playlistName}".`,
            );
          }
        }, 500);
      } else {
        setPlaylistDownloadProgress(playlistId, null);
      }
    } catch (error) {
      console.error('Failed to download playlist:', error);
      setPlaylistDownloadProgress(playlistId, null);
      if (isMountedRef.current) {
        setDownloadProgressState({
          current: 0,
          total: 0,
          percentage: 0,
        });
        Alert.alert(
          'Download Failed',
          'An error occurred while downloading the playlist. Please try again.',
        );
      }
    }
  }, [
    playlistId,
    playlistName,
    isDownloadingPlaylist,
    getPlaylistItems,
    setDownloading,
    clearDownloading,
    setDownloadProgress,
    addDownload,
    setPlaylistDownloadProgress,
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
  ]);

  if (!playlistId) {
    return null;
  }

  const options = [
    {
      label: 'Edit Playlist',
      icon: 'edit-2',
      onPress: handleEdit,
      destructive: false,
      disabled: false,
    },
    {
      label: downloadState.allDownloaded ? 'Downloaded' : 'Download Playlist',
      icon: 'download',
      onPress: handleDownloadPlaylist,
      destructive: false,
      disabled:
        isDownloadingPlaylist ||
        downloadState.hasNoTracks ||
        downloadState.allDownloaded,
      isDownloadOption: true,
    },
    {
      label: 'Delete Playlist',
      icon: 'minus-circle',
      onPress: handleDelete,
      destructive: true,
      disabled: false,
    },
  ];

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        {backgroundColor: theme.colors.background},
      ]}
      indicatorStyle={[
        styles.indicator,
        {backgroundColor: Color(theme.colors.text).alpha(0.3).toString()},
      ]}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={[styles.playlistName, {color: theme.colors.text}]}>
          {playlistName}
        </Text>

        {isDownloadingPlaylist && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressText, {color: theme.colors.text}]}>
                Downloading playlist...
              </Text>
              <Text
                style={[
                  styles.progressPercentage,
                  {color: theme.colors.primary},
                ]}>
                {Math.round(downloadProgress.percentage)}%
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${downloadProgress.percentage}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressSubtext,
                {color: theme.colors.textSecondary},
              ]}>
              {downloadProgress.current} of {downloadProgress.total} items
            </Text>
          </View>
        )}

        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.option,
                !option.destructive && {backgroundColor: theme.colors.card},
                option.disabled && styles.optionDisabled,
                option.destructive && [
                  styles.optionDestructive,
                  {backgroundColor: 'rgba(255, 68, 68, 0.1)'},
                ],
              ]}
              onPress={option.onPress}
              disabled={option.disabled}
              activeOpacity={option.disabled ? 1 : 0.7}>
              {isDownloadingPlaylist && option.isDownloadOption ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  style={styles.downloadIcon}
                />
              ) : option.isDownloadOption ? (
                downloadState.allDownloaded && !downloadState.hasNoTracks ? (
                  <CheckIcon
                    color={
                      option.disabled
                        ? theme.colors.textSecondary
                        : theme.colors.text
                    }
                    size={moderateScale(20)}
                  />
                ) : (
                  <Ionicons
                    name="arrow-down"
                    size={moderateScale(20)}
                    color={
                      option.disabled
                        ? theme.colors.textSecondary
                        : theme.colors.text
                    }
                  />
                )
              ) : (
                <Feather
                  name={option.icon as any}
                  size={moderateScale(20)}
                  color={
                    option.disabled
                      ? theme.colors.textSecondary
                      : option.destructive
                      ? '#ff4444'
                      : theme.colors.text
                  }
                />
              )}
              <Text
                style={[
                  styles.optionText,
                  {color: theme.colors.text},
                  option.disabled && styles.optionTextDisabled,
                  option.destructive && styles.optionTextDestructive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    paddingTop: moderateScale(8),
  },
  indicator: {
    width: moderateScale(40),
  },
  container: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  playlistName: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  optionsContainer: {
    gap: moderateScale(8),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionDestructive: {},
  optionText: {
    fontSize: moderateScale(16),
    marginLeft: moderateScale(12),
    fontWeight: '500',
  },
  optionTextDisabled: {
    opacity: 0.5,
  },
  optionTextDestructive: {
    color: '#ff4444',
  },
  progressContainer: {
    marginBottom: moderateScale(16),
    padding: moderateScale(12),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  progressText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  progressBarContainer: {
    height: moderateScale(4),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: moderateScale(2),
    overflow: 'hidden',
    marginBottom: moderateScale(4),
  },
  progressBar: {
    height: '100%',
    borderRadius: moderateScale(2),
  },
  progressSubtext: {
    fontSize: moderateScale(12),
    textAlign: 'center',
  },
  downloadIcon: {
    marginRight: 0,
  },
});
