import React from 'react';
import {View, Pressable, Text} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {ActionButtonsProps} from '@/components/reciter-profile/types';
import Color from 'color';
import {Ionicons} from '@expo/vector-icons';

const GOLD_COLOR = '#FFD700';

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFavoritePress,
  onShufflePress,
  onPlayPress,
  isFavoriteReciter,
  onDownloadAllPress,
  isDownloadingAll = false,
  downloadAllProgress = 0,
  allDownloaded = false,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const getDownloadAllLabel = () => {
    if (isDownloadingAll) return 'Cancel downloading all surahs';
    if (allDownloaded) return 'All surahs downloaded';
    return 'Download all surahs';
  };

  return (
    <View style={styles.actionButtons}>
      <Pressable style={styles.circleButton} onPress={onFavoritePress}>
        <Ionicons
          name={isFavoriteReciter ? 'star' : 'star-outline'}
          size={moderateScale(20)}
          color={isFavoriteReciter ? GOLD_COLOR : theme.colors.textSecondary}
        />
      </Pressable>
      <Pressable
        style={[styles.circleButton, styles.playButton]}
        onPress={onPlayPress}>
        <View style={styles.playIconContainer}>
          <PlayIcon color={theme.colors.background} size={moderateScale(18)} />
        </View>
      </Pressable>
      <Pressable style={styles.circleButton} onPress={onShufflePress}>
        <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
      </Pressable>
      {/* @ai-start */}
      {onDownloadAllPress ? (
        <Pressable
          style={styles.circleButton}
          onPress={onDownloadAllPress}
          accessibilityRole="button"
          accessibilityLabel={getDownloadAllLabel()}>
          {isDownloadingAll ? (
            <Text style={styles.progressText} numberOfLines={1}>
              {`${Math.round(downloadAllProgress * 100)}%`}
            </Text>
          ) : (
            <Ionicons
              name={allDownloaded ? 'checkmark-circle' : 'download-outline'}
              size={moderateScale(20)}
              color={
                allDownloaded
                  ? theme.colors.text
                  : Color(theme.colors.text).alpha(0.7).toString()
              }
            />
          )}
        </Pressable>
      ) : null}
      {/* @ai-end */}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: moderateScale(16),
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(20),
    },
    circleButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
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
    // @ai-start
    progressText: {
      fontSize: moderateScale(11),
      fontWeight: '600',
      color: theme.colors.text,
    },
    // @ai-end
  });
