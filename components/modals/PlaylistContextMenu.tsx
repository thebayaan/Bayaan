import React, {useState, useCallback, useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {useTheme} from '@/hooks/useTheme';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {downloadSurah} from '@/services/downloadService';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {ActivityIndicator} from 'react-native';
import {CheckIcon} from '@/components/Icons';
import {Ionicons} from '@expo/vector-icons';
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';

interface PlaylistContextMenuProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  playlistId: string;
  playlistName: string;
  playlistColor?: string;
  onDelete: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  bottomSheetRef,
  playlistId,
  playlistName,
  onDelete,
  onClose,
  onEdit,
}) => {
  const {theme} = useTheme();
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
  const progressUpdateThrottle = 50; // Update progress max once per 50ms (more responsive)

  // Get playlist download progress from store (persists across unmounts)
  // Subscribe to store changes to get reactive updates
  const playlistProgress = useDownloadStore(
    state => state.playlistDownloads[playlistId] || null,
  );
  const isDownloadingPlaylist = useDownloadStore(
    state => state.playlistDownloads[playlistId] !== undefined,
  );

  const [downloadProgress, setDownloadProgressState] = useState(
    playlistProgress || {current: 0, total: 0, percentage: 0},
  );

  // Sync with store progress when it changes
  useEffect(() => {
    if (playlistProgress) {
      setDownloadProgressState(playlistProgress);
    } else {
      setDownloadProgressState({current: 0, total: 0, percentage: 0});
    }
  }, [playlistProgress]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Don't cancel downloads on unmount, let them continue in background
    };
  }, []);

  // Get playlist items and transform to format compatible with useCollectionDownloadState
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

  // Calculate download state using custom hook
  const downloadState = useCollectionDownloadState(playlistData);

  const handleEdit = () => {
    if (onEdit) {
      // onEdit will handle closing the context menu
      // No need to close here as it's handled in handleEditPlaylist
      onEdit();
    }
  };

  const handleDelete = () => {
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
            onDelete();
            onClose();
          },
        },
      ],
    );
  };

  const handleDownloadPlaylist = useCallback(async () => {
    if (isDownloadingPlaylist) return;

    downloadCancelledRef.current = false;
    isMountedRef.current = true;

    try {
      // Initialize progress in store (persists across unmounts)
      const initialProgress = {
        current: 0,
        total: 0,
        percentage: 0,
      };
      setPlaylistDownloadProgress(playlistId, initialProgress);
      setDownloadProgressState(initialProgress);

      // Get all playlist items
      const playlistItems = await getPlaylistItems(playlistId);

      if (playlistItems.length === 0) {
        setPlaylistDownloadProgress(playlistId, null);
        if (isMountedRef.current) {
          Alert.alert('Empty Playlist', 'This playlist is empty.');
        }
        return;
      }

      // Filter out items that are already downloaded
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

      // Initialize progress
      const progress = {
        current: 0,
        total: itemsToDownload.length,
        percentage: 0,
      };
      setPlaylistDownloadProgress(playlistId, progress);
      if (isMountedRef.current) {
        setDownloadProgressState(progress);
      }

      // Download items sequentially with proper async yielding to prevent blocking
      const downloadItem = async (
        item: (typeof itemsToDownload)[0],
        index: number,
      ) => {
        const surahId = parseInt(item.surahId, 10);
        // Generate download ID with rewayatId if provided for proper tracking
        const downloadId = item.rewayatId
          ? `${item.reciterId}-${surahId}-${item.rewayatId}`
          : `${item.reciterId}-${surahId}`;

        // Skip if already downloading - use rewayat-aware check if rewayatId is provided
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

          // Download with throttled progress tracking
          const downloadResult = await downloadSurah(
            surahId,
            item.reciterId,
            item.rewayatId,
            progressValue => {
              // Throttle progress updates to prevent UI blocking
              const now = Date.now();
              if (
                now - lastProgressUpdateRef.current <
                progressUpdateThrottle
              ) {
                return;
              }
              lastProgressUpdateRef.current = now;

              // Calculate overall progress
              const itemProgress = progressValue / itemsToDownload.length;
              const completedProgress = index / itemsToDownload.length;
              const overallProgress = completedProgress + itemProgress;

              // Update individual item progress (lightweight, store-only)
              setDownloadProgress(downloadId, progressValue);

              const newProgress = {
                current: index + 1,
                total: itemsToDownload.length,
                percentage: Math.min(overallProgress * 100, 99),
              };

              // ONLY update persistent store - let React subscription handle UI updates
              // This prevents blocking when component is unmounted
              // Use setTimeout to ensure this doesn't block the download callback
              setTimeout(() => {
                setPlaylistDownloadProgress(playlistId, newProgress);
              }, 0);
            },
          );

          // Check if cancelled before adding download
          if (downloadCancelledRef.current) {
            clearDownloading(downloadId);
            return;
          }

          // Add to downloads
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

          // Update progress after download completes
          const newProgress = {
            current: index + 1,
            total: itemsToDownload.length,
            percentage: ((index + 1) / itemsToDownload.length) * 100,
          };

          // ONLY update persistent store - React subscription will update UI
          // Use setTimeout to prevent blocking
          setTimeout(() => {
            setPlaylistDownloadProgress(playlistId, newProgress);
          }, 0);
        } catch (error) {
          console.error(`Failed to download surah ${surahId}:`, error);
          clearDownloading(downloadId);
        }
      };

      // Process downloads one at a time with proper yielding
      for (let i = 0; i < itemsToDownload.length; i++) {
        // Check if cancelled
        if (downloadCancelledRef.current) {
          break;
        }

        // Process this download
        await downloadItem(itemsToDownload[i], i);

        // Yield to event loop after each download to keep UI responsive
        // Small delay allows React/UI to process pending updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Complete
      if (!downloadCancelledRef.current) {
        const finalProgress = {
          current: itemsToDownload.length,
          total: itemsToDownload.length,
          percentage: 100,
        };

        // Update store asynchronously to prevent blocking
        setTimeout(() => {
          setPlaylistDownloadProgress(playlistId, finalProgress);
        }, 0);

        // Wait a bit to show 100% before clearing
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
              `Successfully downloaded ${itemsToDownload.length} item${itemsToDownload.length === 1 ? '' : 's'} from "${playlistName}".`,
            );
          }
        }, 500);
      } else {
        // Cancelled - clear progress
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
      icon: 'trash-2',
      onPress: handleDelete,
      destructive: true,
      disabled: false,
    },
  ];

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['45%']}
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
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
                <Icon
                  name={option.icon}
                  type="feather"
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
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: moderateScale(16),
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
  optionDestructive: {
    // Background color is set inline for theme support
  },
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
