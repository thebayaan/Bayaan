import React, {useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  QuranIcon,
  AmbientIcon,
} from '@/components/Icons';
import {useAmbientStore} from '@/store/ambientStore';

interface ControlButtonsProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onQueuePress: () => void;
  showQueue: boolean;
  onMushafLayoutPress?: () => void;
  onAmbientPress: () => void;
}

interface Styles {
  wrapper: ViewStyle;
  button: ViewStyle;
  speedButton: ViewStyle;
  sleepButton: ViewStyle;
  ambientButton: ViewStyle;
  middleButton: ViewStyle;
  activeButton: ViewStyle;
  speedButtonText: TextStyle;
  activeText: TextStyle;
  speedX: TextStyle;
  mediumButton: ViewStyle;
  expandedButton: ViewStyle;
  queueButton: ViewStyle;
  mushafLayoutButton: ViewStyle;
  sideButtonsContainer: ViewStyle;
  controlsContainer: ViewStyle;
  sideButton: ViewStyle;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onQueuePress,
  showQueue,
  onMushafLayoutPress,
  onAmbientPress,
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

  // Create subtle active background color with opacity
  const activeBackgroundColor = `${theme.colors.text}20`; // 20% opacity

  return (
    <View style={styles.wrapper}>
      {onMushafLayoutPress && (
        <Pressable
          onPress={handleMushafLayoutPress}
          style={[styles.sideButton, styles.mushafLayoutButton]}>
          <QuranIcon size={moderateScale(28)} color={theme.colors.text} />
        </Pressable>
      )}

      <View
        style={[
          styles.controlsContainer,
          {
            backgroundColor: theme.colors.card,
            shadowColor: theme.colors.shadow,
          },
        ]}>
        <Pressable
          onPress={onSpeedPress}
          style={[
            styles.button,
            styles.speedButton,
            playbackRate !== 1 && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
            (playbackRate === 0.5 || playbackRate === 1.5) &&
              styles.mediumButton,
            (playbackRate === 0.75 ||
              playbackRate === 1.25 ||
              playbackRate === 1.75) &&
              styles.expandedButton,
          ]}>
          <Text
            style={[
              styles.speedButtonText,
              {color: theme.colors.text},
              playbackRate !== 1 && {fontWeight: '700'},
            ]}>
            {`${playbackRate}`}
            <Text style={styles.speedX}>x</Text>
          </Text>
        </Pressable>

        <Pressable
          onPress={handleRepeatPress}
          style={[
            styles.button,
            styles.middleButton,
            settings.repeatMode !== 'none' && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
          ]}>
          {settings.repeatMode === 'none' && (
            <RepeatIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
          {settings.repeatMode === 'queue' && (
            <RepeatIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
          {settings.repeatMode === 'track' && (
            <RepeatOneIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
        </Pressable>

        <Pressable
          onPress={onSleepTimerPress}
          style={[
            styles.button,
            styles.sleepButton,
            isTimerActive && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
          ]}>
          <TimerIcon
            color={theme.colors.text}
            size={moderateScale(22)}
            filled={!!isTimerActive}
          />
        </Pressable>

        <Pressable
          onPress={onAmbientPress}
          style={[
            styles.button,
            styles.ambientButton,
            ambientEnabled && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
          ]}>
          <AmbientIcon
            color={theme.colors.text}
            size={moderateScale(22)}
            filled={ambientEnabled}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onQueuePress}
        style={[
          styles.sideButton,
          styles.queueButton,
          showQueue && [
            styles.activeButton,
            {backgroundColor: activeBackgroundColor},
          ],
        ]}>
        <QueueIcon size={moderateScale(24)} color={theme.colors.text} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create<Styles>({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    width: '100%',
    position: 'relative',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mushafLayoutButton: {
    position: 'absolute',
    left: moderateScale(16),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(12),
  },
  queueButton: {
    position: 'absolute',
    right: moderateScale(16),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(12),
  },
  button: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(12),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButton: {
    borderRadius: moderateScale(12),
  },
  middleButton: {
    borderRadius: moderateScale(12),
    marginHorizontal: moderateScale(6),
  },
  activeButton: {
    // No specific style needed here anymore, background applied inline
  },
  speedButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  activeText: {
    // No longer needed as we're not changing text color
  },
  speedX: {
    fontSize: moderateScale(14),
  },
  mediumButton: {
    width: moderateScale(42),
    paddingHorizontal: moderateScale(3),
  },
  expandedButton: {
    width: moderateScale(48),
    paddingHorizontal: moderateScale(4),
  },
  sleepButton: {
    marginLeft: 0,
    borderRadius: moderateScale(12),
  },
  ambientButton: {
    marginLeft: moderateScale(6),
    borderRadius: moderateScale(12),
  },
  sideButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButton: {
    position: 'absolute',
    top: moderateScale(10),
    bottom: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
});
