import React, {useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint,
} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  AmbientIcon,
} from '@/components/Icons';
import {Ionicons} from '@expo/vector-icons';
import {useAmbientStore} from '@/store/ambientStore';
import Color from 'color';
// @ai-start
import {localizeDigits} from '@/i18n/format';
import {usePlayerA11y} from '@/hooks/usePlayerA11y'; // @ai
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import {PlaybackSpeedMenu, SleepTimerMenu} from '../../ListeningMenus';
// @ai-end

interface ControlButtonsProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onQueuePress: () => void;
  showQueue: boolean;
  onMushafLayoutPress?: () => void;
  onAmbientPress: () => void;
  onFollowAlongPress: () => void;
  followAlongActive: boolean;
  followAlongAvailable: boolean;
}

type Styles = {
  wrapper: ViewStyle;
  button: ViewStyle;
  glassButton: ViewStyle;
  glassButtonInner: ViewStyle;
  speedButtonText: TextStyle;
};

// @ai-start
export const ControlButtons: React.FC<ControlButtonsProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onQueuePress,
  showQueue,
  onMushafLayoutPress,
  onAmbientPress,
  onFollowAlongPress,
  followAlongActive,
  followAlongAvailable,
}) => {
  const {theme} = useTheme();
  const a11y = usePlayerA11y(); // @ai
  const glassColorScheme = useGlassColorScheme();
  const glassTint = useGlassTint(); // @ai
  const {updateSettings} = usePlayerActions();
  const playbackRate = usePlayerStore(s => s.playback.rate);
  const settings = usePlayerStore(s => s.settings);
  const ambientEnabled = useAmbientStore(s => s.isEnabled);

  const handleMushafLayoutPress = useCallback(() => {
    if (onMushafLayoutPress) {
      onMushafLayoutPress();
    }
  }, [onMushafLayoutPress]);

  const handleRepeatPress = () => {
    const nextMode = {
      none: 'queue',
      queue: 'track',
      track: 'none',
    }[settings.repeatMode] as 'none' | 'queue' | 'track';

    updateSettings({repeatMode: nextMode});
  };

  // Check if timer is active based on sleepTimerEnd
  const isTimerActive =
    settings.sleepTimerEnd !== null && settings.sleepTimerEnd > Date.now();

  const activeBackgroundColor = Color(theme.colors.text).alpha(0.08).toString();
  const defaultIconColor = theme.colors.text;
  const activeIconColor = theme.colors.text;

  const PillWrapper = USE_GLASS ? GlassView : FrostedView;
  const pillProps = USE_GLASS
    ? {
        glassEffectStyle: 'regular' as const,
        colorScheme: glassColorScheme,
        tintColor: glassTint,
        isInteractive: true,
      }
    : {};

  return (
    <View style={styles.wrapper}>
      {onMushafLayoutPress && (
        <PillWrapper style={styles.glassButton} {...pillProps}>
          <Pressable
            onPress={handleMushafLayoutPress}
            {...a11y.displayOptions}
            style={styles.glassButtonInner}>
            <Ionicons
              name="options-outline"
              size={moderateScale(20)}
              color={defaultIconColor}
            />
          </Pressable>
        </PillWrapper>
      )}

      {/* @ai-start */}
      <PlaybackSpeedMenu
        accessibilityLabel={a11y.speed(playbackRate).accessibilityLabel}>
        <Pressable
          onPress={nativeMenusAvailable ? undefined : onSpeedPress}
          {...a11y.speed(playbackRate)}
          style={[
            styles.button,
            playbackRate !== 1 && {backgroundColor: activeBackgroundColor},
          ]}>
          <Text
            style={[
              styles.speedButtonText,
              {
                color: playbackRate !== 1 ? activeIconColor : defaultIconColor,
              },
            ]}>
            {localizeDigits(`${playbackRate}x`)}
          </Text>
        </Pressable>
      </PlaybackSpeedMenu>
      {/* @ai-end */}

      <Pressable
        onPress={handleRepeatPress}
        {...a11y.repeat(settings.repeatMode)}
        style={[
          styles.button,
          settings.repeatMode !== 'none' && {
            backgroundColor: activeBackgroundColor,
          },
        ]}>
        {settings.repeatMode === 'track' ? (
          <RepeatOneIcon size={moderateScale(20)} color={activeIconColor} />
        ) : (
          <RepeatIcon
            size={moderateScale(20)}
            color={
              settings.repeatMode === 'queue'
                ? activeIconColor
                : defaultIconColor
            }
          />
        )}
      </Pressable>

      {/* @ai-start */}
      <SleepTimerMenu
        accessibilityLabel={
          a11y.sleepTimer(!!isTimerActive).accessibilityLabel
        }>
        <Pressable
          onPress={nativeMenusAvailable ? undefined : onSleepTimerPress}
          {...a11y.sleepTimer(!!isTimerActive)}
          style={[
            styles.button,
            isTimerActive && {backgroundColor: activeBackgroundColor},
          ]}>
          <TimerIcon
            color={isTimerActive ? activeIconColor : defaultIconColor}
            size={moderateScale(20)}
            filled={!!isTimerActive}
          />
        </Pressable>
      </SleepTimerMenu>
      {/* @ai-end */}

      <Pressable
        onPress={onAmbientPress}
        {...a11y.ambient(ambientEnabled)}
        style={[
          styles.button,
          ambientEnabled && {backgroundColor: activeBackgroundColor},
        ]}>
        <AmbientIcon
          color={ambientEnabled ? activeIconColor : defaultIconColor}
          size={moderateScale(20)}
          filled={ambientEnabled}
        />
      </Pressable>

      <Pressable
        onPress={onFollowAlongPress}
        {...a11y.followAlong(followAlongAvailable && followAlongActive)}
        style={[
          styles.button,
          followAlongAvailable &&
            followAlongActive && {backgroundColor: activeBackgroundColor},
          !followAlongAvailable && {opacity: 0.35},
        ]}>
        <Ionicons
          name="locate-outline"
          size={moderateScale(20)}
          color={
            followAlongAvailable && followAlongActive
              ? activeIconColor
              : defaultIconColor
          }
        />
      </Pressable>

      <PillWrapper style={styles.glassButton} {...pillProps}>
        <Pressable
          onPress={onQueuePress}
          {...a11y.queue(false)}
          style={styles.glassButtonInner}>
          <QueueIcon
            size={moderateScale(20)}
            color={showQueue ? activeIconColor : defaultIconColor}
          />
        </Pressable>
      </PillWrapper>
    </View>
  );
};
// @ai-end

const styles = StyleSheet.create<Styles>({
  wrapper: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
    width: '100%',
  },
  button: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(14),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    overflow: 'hidden',
  },
  glassButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButtonText: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
  },
});
