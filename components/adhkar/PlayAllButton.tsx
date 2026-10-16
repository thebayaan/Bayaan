/**
 * PlayAllButton Component
 *
 * The list header's Play All button. "Play All" with no session for the
 * list, "Pause" while it plays, "Resume" while it is paused. It never ends
 * the session.
 */

import React, {useMemo} from 'react';
import {TouchableOpacity, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import type {PlayAllState} from '@/services/adhkar/playback/sessionReducer';
import {PlayIcon, PauseIcon} from '@/components/Icons';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface PlayAllButtonProps {
  onPress: () => void;
  state?: PlayAllState;
  disabled?: boolean;
}

// @ai-start
export const PlayAllButton: React.FC<PlayAllButtonProps> = React.memo(
  function PlayAllButton({onPress, state = 'idle', disabled = false}) {
    const {theme} = useTheme();
    const {t} = useTranslation(['player', 'common']);
    const styles = useMemo(() => createStyles(theme), [theme]);

    const iconColor = disabled ? theme.colors.textSecondary : theme.colors.text;
    const isPlaying = state === 'playing';
    const label =
      state === 'playing'
        ? t('common:actions.pause')
        : state === 'paused'
          ? t('adhkar.resume')
          : t('adhkar.playAll');
    const a11yLabel =
      state === 'playing'
        ? t('adhkar.a11y.pauseAll')
        : state === 'paused'
          ? t('adhkar.a11y.resumeAll')
          : t('adhkar.a11y.playAll');

    return (
      <TouchableOpacity
        style={[styles.container, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={1}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}>
        <View style={styles.iconContainer}>
          {isPlaying ? (
            <PauseIcon size={moderateScale(16)} color={iconColor} />
          ) : (
            <PlayIcon size={moderateScale(16)} color={iconColor} />
          )}
        </View>
        <Text style={[styles.text, disabled && styles.textDisabled]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  },
);
// @ai-end

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
