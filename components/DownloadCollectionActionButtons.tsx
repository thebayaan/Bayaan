import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, TrashIcon, PauseIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';

interface DownloadCollectionActionButtonsProps {
  
  onPlayPress: () => void;
  disabled?: boolean;
  isPlaying?: boolean;
 
}

export const DownloadCollectionActionButtons: React.FC<DownloadCollectionActionButtonsProps> = ({
 
  onPlayPress, 
  disabled = false,
  
  isPlaying = false
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.actionButtons}>
 

      {/* Right side - Clear All and Play All buttons */}
      <View style={styles.rightAlignedButtons}>
        
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
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
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
    playIconContainer: {
      paddingLeft: moderateScale(4), // Slight adjustment to center the play icon visually
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
