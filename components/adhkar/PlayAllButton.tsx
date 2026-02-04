/**
 * PlayAllButton Component
 *
 * Button to start/stop "Play All" adhkar playback.
 * Shows play icon with "Play All" text when idle, pause icon when playing.
 */

import React, {useMemo} from 'react';
import {TouchableOpacity, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, PauseIcon} from '@/components/Icons';

interface PlayAllButtonProps {
  onPress: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
}

export const PlayAllButton: React.FC<PlayAllButtonProps> = React.memo(
  function PlayAllButton({onPress, isPlaying = false, disabled = false}) {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const iconColor = disabled ? theme.colors.textSecondary : theme.colors.text;

    return (
      <TouchableOpacity
        style={[styles.button, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <View style={styles.iconContainer}>
          {isPlaying ? (
            <PauseIcon size={moderateScale(12)} color={iconColor} />
          ) : (
            <PlayIcon size={moderateScale(12)} color={iconColor} />
          )}
        </View>
        <Text style={[styles.text, disabled && styles.textDisabled]}>
          {isPlaying ? 'Pause' : 'Play All'}
        </Text>
      </TouchableOpacity>
    );
  },
);

PlayAllButton.displayName = 'PlayAllButton';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(6),
    },
    iconContainer: {
      width: moderateScale(16),
      height: moderateScale(16),
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    textDisabled: {
      color: theme.colors.textSecondary,
    },
    disabled: {
      opacity: 0.5,
    },
  });
