import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, TrashIcon} from '@/components/Icons';

interface DownloadActionButtonsProps {
  onClearAllPress: () => void;
  onPlayPress: () => void;
  disabled?: boolean;
}

export const DownloadActionButtons: React.FC<DownloadActionButtonsProps> = ({
  onClearAllPress,
  onPlayPress,
  disabled = false,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.actionButtons}>
      <View style={styles.rightAlignedButtons}>
        <TouchableOpacity
          activeOpacity={0.99}
          style={[styles.actionButton, disabled && styles.buttonDisabled]}
          onPress={onClearAllPress}
          disabled={disabled}>
          <TrashIcon color={theme.colors.text} size={moderateScale(28)} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.99}
          style={[styles.playButton, disabled && styles.buttonDisabled]}
          onPress={onPlayPress}
          disabled={disabled}>
          <PlayIcon color={'white'} size={moderateScale(18)} />
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
      marginBottom: moderateScale(10),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      width: moderateScale(50),
      height: moderateScale(50),
      borderRadius: moderateScale(25),
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(15),
    },
    playButton: {
      width: moderateScale(60),
      height: moderateScale(60),
      borderRadius: moderateScale(30),
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
