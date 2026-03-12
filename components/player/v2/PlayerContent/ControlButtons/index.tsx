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
import {moderateScale} from 'react-native-size-matters';
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

interface Styles {
  wrapper: ViewStyle;
  button: ViewStyle;
  glassButton: ViewStyle;
  glassButtonInner: ViewStyle;
  speedButtonText: TextStyle;
}

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

  return (
    <View style={styles.wrapper}>
      {onMushafLayoutPress && (
        <GlassView
          style={styles.glassButton}
          glassEffectStyle="regular"
          isInteractive>
          <Pressable
            onPress={handleMushafLayoutPress}
            style={styles.glassButtonInner}>
            <Ionicons
              name="options-outline"
              size={moderateScale(20)}
              color={defaultIconColor}
            />
          </Pressable>
        </GlassView>
      )}

      <Pressable
        onPress={onSpeedPress}
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
          {`${playbackRate}x`}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleRepeatPress}
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

      <Pressable
        onPress={onSleepTimerPress}
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

      <Pressable
        onPress={onAmbientPress}
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

      <GlassView
        style={styles.glassButton}
        glassEffectStyle="regular"
        isInteractive>
        <Pressable onPress={onQueuePress} style={styles.glassButtonInner}>
          <QueueIcon
            size={moderateScale(20)}
            color={showQueue ? activeIconColor : defaultIconColor}
          />
        </Pressable>
      </GlassView>
    </View>
  );
};

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
