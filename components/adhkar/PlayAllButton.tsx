/**
 * PlayAllButton Component
 *
 * Button to start/stop "Play All" adhkar playback.
 * Matches the play button style from AdhkarAudioControls with text label.
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

    return (
      <TouchableOpacity
        style={[styles.container, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={1}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause all' : 'Play all'}>
        <View style={styles.button}>
          {isPlaying ? (
            <PauseIcon
              size={moderateScale(14)}
              color={theme.colors.background}
            />
          ) : (
            <PlayIcon
              size={moderateScale(14)}
              color={theme.colors.background}
            />
          )}
        </View>
        <Text style={styles.text}>{isPlaying ? 'Pause' : 'Play All'}</Text>
      </TouchableOpacity>
    );
  },
);

PlayAllButton.displayName = 'PlayAllButton';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      // Fixed width container to prevent header title from shifting
      width: moderateScale(90),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: moderateScale(6),
      marginRight: moderateScale(4),
    },
    button: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(10),
      backgroundColor: theme.colors.text,
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: moderateScale(2), // Visual centering for play icon
    },
    text: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    disabled: {
      opacity: 0.5,
    },
  });
