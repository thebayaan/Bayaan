import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, ShuffleIcon, DownloadIcon, PauseIcon} from '@/components/Icons';



interface CollectionActionButtonsProps {
  onShufflePress: () => void;
  onPlayPress: () => void;
  showDownloadIcon?: boolean;
  disabled?: boolean;
  isPlaying?: boolean;
}

export const CollectionActionButtons: React.FC<
  CollectionActionButtonsProps
> = ({onShufflePress, onPlayPress, showDownloadIcon = false, disabled = false, isPlaying = false}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={showDownloadIcon? styles.actionButtons : styles.actionButtonsWithoutDownload}>
      {showDownloadIcon && (
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.actionButton}
          disabled={true}>
          <DownloadIcon
            color={theme.colors.textSecondary + '40'}
            size={moderateScale(28)}
          />
        </TouchableOpacity>
      )}
      <View style={styles.rightAlignedButtons}>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.actionButton}
          onPress={onShufflePress}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(32)} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.99}
          style={[styles.playButton, disabled && styles.buttonDisabled]}
          onPress={onPlayPress}
          disabled={disabled}>
          <View style={styles.playIconContainer}>
            {isPlaying ? (
              <PauseIcon color={theme.colors.background} size={moderateScale(16)} />
            ) : (
              <PlayIcon color={theme.colors.background} size={moderateScale(16)} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    actionButtonsWithoutDownload: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-end',
    },
    actionButton: {
      width: moderateScale(56),
      height: moderateScale(56),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(28),
      marginHorizontal: moderateScale(5),
    },
    playButton: {
      backgroundColor: theme.colors.text,
      width: moderateScale(42),
      height: moderateScale(42),
      borderRadius: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: moderateScale(10),
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4), // Slight adjustment to center the play icon visually
    },
  });
