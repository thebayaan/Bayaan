import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import BottomSheet from '@gorhom/bottom-sheet';
import {PlaybackSpeedModal} from '../../Modals/PlaybackSpeedModal';
import {SleepTimerModal} from '../../Modals/SleepTimerModal';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
} from '@/components/Icons';

interface ControlButtonsProps {
  speedBottomSheetRef: React.RefObject<BottomSheet>;
  sleepBottomSheetRef: React.RefObject<BottomSheet>;
  queueBottomSheetRef: React.RefObject<BottomSheet>;
  onQueuePress: () => void;
  showQueue: boolean;
  onQuranPress?: () => void;
  showQuran?: boolean;
}

interface Styles {
  wrapper: ViewStyle;
  button: ViewStyle;
  speedButton: ViewStyle;
  sleepButton: ViewStyle;
  middleButton: ViewStyle;
  activeButton: ViewStyle;
  speedButtonText: TextStyle;
  activeText: TextStyle;
  speedX: TextStyle;
  mediumButton: ViewStyle;
  expandedButton: ViewStyle;
  queueButton: ViewStyle;
  quranButton: ViewStyle;
  sideButtonsContainer: ViewStyle;
  controlsContainer: ViewStyle;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  speedBottomSheetRef,
  sleepBottomSheetRef,
  onQueuePress,
  showQueue,
}) => {
  const {theme} = useTheme();
  const {playback, setRate, settings, updateSettings} = useUnifiedPlayer();

  const handleSpeedPress = () => {
    speedBottomSheetRef.current?.expand();
  };

  const handleSpeedChange = (speed: number) => {
    setRate(speed);
  };

  const handleRepeatPress = () => {
    const nextMode = {
      none: 'queue',
      queue: 'track',
      track: 'none',
    }[settings.repeatMode] as 'none' | 'queue' | 'track';

    updateSettings({repeatMode: nextMode});
  };

  const handleSleepPress = () => {
    sleepBottomSheetRef.current?.expand();
  };

  const handleSleepTimerChange = (minutes: number) => {
    updateSettings({sleepTimer: minutes});
  };

  const handleTurnOffTimer = () => {
    updateSettings({sleepTimer: 0});
  };

  // Check if timer is active based on sleepTimerEnd
  const isTimerActive =
    settings.sleepTimerEnd !== null && settings.sleepTimerEnd > Date.now();

  // Calculate remaining time for display
  const remainingTime =
    isTimerActive && settings.sleepTimerEnd
      ? Math.ceil((settings.sleepTimerEnd - Date.now()) / (60 * 1000))
      : null;

  // Create subtle active background color with opacity
  const activeBackgroundColor = `${theme.colors.text}20`; // 20% opacity

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.controlsContainer,
          {
            backgroundColor: theme.colors.card,
            shadowColor: theme.colors.shadow,
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={handleSpeedPress}
          style={[
            styles.button,
            styles.speedButton,
            playback.rate !== 1 && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
            (playback.rate === 0.5 || playback.rate === 1.5) &&
              styles.mediumButton,
            (playback.rate === 0.75 ||
              playback.rate === 1.25 ||
              playback.rate === 1.75) &&
              styles.expandedButton,
          ]}>
          <Text
            style={[
              styles.speedButtonText,
              {color: theme.colors.text},
              playback.rate !== 1 && {fontWeight: '700'},
            ]}>
            {`${playback.rate}`}
            <Text style={styles.speedX}>x</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.99}
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
            <RepeatIcon size={moderateScale(25)} color={theme.colors.text} />
          )}
          {settings.repeatMode === 'queue' && (
            <RepeatIcon size={moderateScale(25)} color={theme.colors.text} />
          )}
          {settings.repeatMode === 'track' && (
            <RepeatOneIcon size={moderateScale(25)} color={theme.colors.text} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.99}
          onPress={handleSleepPress}
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
        </TouchableOpacity>
      </View>

      <View style={styles.queueButton}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onQueuePress}
          style={[
            styles.button,
            showQueue && [
              styles.activeButton,
              {backgroundColor: activeBackgroundColor},
            ],
          ]}>
          <QueueIcon size={moderateScale(25)} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <PlaybackSpeedModal
        bottomSheetRef={speedBottomSheetRef}
        onSpeedChange={handleSpeedChange}
        currentSpeed={playback.rate}
      />

      <SleepTimerModal
        bottomSheetRef={sleepBottomSheetRef}
        onTimerChange={handleSleepTimerChange}
        onTurnOffTimer={handleTurnOffTimer}
        sleepTimer={remainingTime || 0}
        remainingTime={remainingTime}
      />
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
  quranButton: {
    position: 'absolute',
    left: moderateScale(16),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(12),
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1,
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
    // Now using a subtle background with opacity defined inline
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
  sideButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
