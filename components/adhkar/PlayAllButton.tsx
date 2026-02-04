/**
 * PlayAllButton Component
 *
 * Button to start/stop "Play All" adhkar playback.
 * Shows play icon when idle, pause icon when playing.
 */

import React, {useMemo} from 'react';
import {TouchableOpacity} from 'react-native';
import {Icon} from '@rneui/themed';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface PlayAllButtonProps {
  onPress: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
}

export const PlayAllButton: React.FC<PlayAllButtonProps> = React.memo(
  ({onPress, isPlaying = false, disabled = false}) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
      <TouchableOpacity
        style={[styles.button, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          type="feather"
          size={moderateScale(20)}
          color={disabled ? theme.colors.textSecondary : theme.colors.primary}
        />
      </TouchableOpacity>
    );
  },
);

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    button: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
  });
