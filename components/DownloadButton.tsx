import React from 'react';
import {TouchableOpacity, View, ActivityIndicator} from 'react-native';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useTrackDownload} from '@/hooks/useDownload';
import {Track} from '@/types/audio';
import {DownloadStatus} from '@/services/download/types';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Color from 'color';

interface DownloadButtonProps {
  track: Track;
  size?: number;
  enableHaptics?: boolean;
  showProgress?: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export const DownloadButton: React.FC<DownloadButtonProps> = React.memo(
  ({track, size = 18, enableHaptics = true, showProgress = true}) => {
    const {theme} = useTheme();
    const {
      status,
      progress,
      isDownloaded,
      download,
      pause,
      resume,
      cancel,
      delete: deleteDownload,
    } = useTrackDownload(track);

    // Animation values
    const downloadProgress = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Update progress animation
    React.useEffect(() => {
      downloadProgress.value = withTiming(progress / 100, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });
    }, [progress]);

    // Pulse animation for downloading state
    React.useEffect(() => {
      if (status === 'downloading') {
        pulseScale.value = withRepeat(
          withTiming(1.1, {duration: 1000}),
          -1,
          true,
        );
      } else {
        pulseScale.value = withTiming(1, {duration: 200});
      }
    }, [status]);

    // Rotation animation for loading states
    React.useEffect(() => {
      if (status === 'downloading' || status === 'queued') {
        rotation.value = withRepeat(
          withTiming(360, {duration: 2000, easing: Easing.linear}),
          -1,
          false,
        );
      } else {
        rotation.value = withTiming(0, {duration: 200});
      }
    }, [status]);

    const handlePress = React.useCallback(async () => {
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      try {
        switch (status) {
          case 'pending':
          case 'failed':
            await download();
            break;
          case 'downloading':
            await pause();
            break;
          case 'paused':
            await resume();
            break;
          case 'completed':
            await deleteDownload();
            break;
          case 'queued':
            await cancel();
            break;
        }
      } catch (error) {
        console.error('Download action failed:', error);
        if (enableHaptics) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }, [
      status,
      download,
      pause,
      resume,
      cancel,
      deleteDownload,
      enableHaptics,
    ]);

    const getIcon = (): {name: string; type: string; color: string} => {
      switch (status) {
        case 'pending':
          return {
            name: 'download',
            type: 'feather',
            color: theme.colors.textSecondary,
          };
        case 'queued':
          return {
            name: 'clock',
            type: 'feather',
            color: theme.colors.primary,
          };
        case 'downloading':
          return {
            name: 'pause',
            type: 'feather',
            color: theme.colors.primary,
          };
        case 'paused':
          return {
            name: 'play',
            type: 'feather',
            color: theme.colors.warning,
          };
        case 'completed':
          return {
            name: 'check-circle',
            type: 'feather',
            color: theme.colors.success,
          };
        case 'failed':
          return {
            name: 'alert-circle',
            type: 'feather',
            color: theme.colors.error,
          };
        case 'cancelled':
          return {
            name: 'x-circle',
            type: 'feather',
            color: theme.colors.textSecondary,
          };
        default:
          return {
            name: 'download',
            type: 'feather',
            color: theme.colors.textSecondary,
          };
      }
    };

    const icon = getIcon();

    // Progress circle animation
    const progressStyle = useAnimatedStyle(() => ({
      transform: [
        {
          rotate: `${rotation.value}deg`,
        },
      ],
    }));

    // Pulse animation
    const pulseStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: pulseScale.value,
        },
      ],
    }));

    const shouldShowProgress =
      showProgress &&
      (status === 'downloading' || status === 'paused') &&
      progress > 0;

    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={{
          width: moderateScale(size + 8),
          height: moderateScale(size + 8),
          justifyContent: 'center',
          alignItems: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel(
          status,
          isDownloaded,
          progress,
        )}
        accessibilityHint={getAccessibilityHint(status)}>
        <AnimatedView style={[pulseStyle, {position: 'relative'}]}>
          {/* Progress Circle (shown during download) */}
          {shouldShowProgress && (
            <View
              style={{
                position: 'absolute',
                width: moderateScale(size + 6),
                height: moderateScale(size + 6),
                borderRadius: moderateScale((size + 6) / 2),
                borderWidth: 2,
                borderColor: Color(theme.colors.border).alpha(0.3).toString(),
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Animated.View
                style={[
                  progressStyle,
                  {
                    position: 'absolute',
                    width: moderateScale(size + 6),
                    height: moderateScale(size + 6),
                    borderRadius: moderateScale((size + 6) / 2),
                    borderWidth: 2,
                    borderColor: 'transparent',
                    borderTopColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
          )}

          {/* Loading spinner for queued state */}
          {status === 'queued' ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{
                width: moderateScale(size),
                height: moderateScale(size),
              }}
            />
          ) : (
            <Icon
              name={icon.name}
              type={icon.type}
              size={moderateScale(size)}
              color={icon.color}
            />
          )}
        </AnimatedView>
      </TouchableOpacity>
    );
  },
);

DownloadButton.displayName = 'DownloadButton';

function getAccessibilityLabel(
  status: DownloadStatus,
  isDownloaded: boolean,
  progress: number,
): string {
  switch (status) {
    case 'pending':
      return 'Download track';
    case 'queued':
      return 'Download queued';
    case 'downloading':
      return `Downloading ${progress}%`;
    case 'paused':
      return `Download paused at ${progress}%`;
    case 'completed':
      return 'Downloaded, tap to delete';
    case 'failed':
      return 'Download failed, tap to retry';
    case 'cancelled':
      return 'Download cancelled, tap to retry';
    default:
      return 'Download track';
  }
}

function getAccessibilityHint(status: DownloadStatus): string {
  switch (status) {
    case 'pending':
      return 'Downloads the track for offline listening';
    case 'queued':
      return 'Download is queued, tap to cancel';
    case 'downloading':
      return 'Tap to pause the download';
    case 'paused':
      return 'Tap to resume the download';
    case 'completed':
      return 'Tap to delete the downloaded file';
    case 'failed':
      return 'Tap to retry the download';
    case 'cancelled':
      return 'Tap to retry the download';
    default:
      return 'Manages download for this track';
  }
}
