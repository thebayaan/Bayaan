/**
 * PlayAllButton Component
 *
 * Button to start/stop "Play All" adhkar playback.
 * Shows play/pause icon with text label.
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
        style={[styles.container, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={1}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause all' : 'Play all'}>
        <View style={styles.iconContainer}>
          {isPlaying ? (
            <PauseIcon size={moderateScale(16)} color={iconColor} />
          ) : (
            <PlayIcon size={moderateScale(16)} color={iconColor} />
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
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: moderateScale(14),
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
