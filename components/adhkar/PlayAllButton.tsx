/**
 * PlayAllButton Component
 *
 * Button to start/stop "Play All" adhkar playback.
 * Matches the play button style from AdhkarAudioControls.
 */

import React, {useMemo} from 'react';
import {TouchableOpacity} from 'react-native';
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

    return (
      <TouchableOpacity
        style={[styles.button, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={1}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause all' : 'Play all'}>
        {isPlaying ? (
          <PauseIcon
            size={moderateScale(14)}
            color={theme.colors.background}
          />
        ) : (
          <PlayIcon size={moderateScale(14)} color={theme.colors.background} />
        )}
      </TouchableOpacity>
    );
  },
);

PlayAllButton.displayName = 'PlayAllButton';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    button: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(10),
      backgroundColor: theme.colors.text,
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: moderateScale(2), // Visual centering for play icon
    },
    disabled: {
      opacity: 0.5,
    },
  });
