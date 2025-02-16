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
import {QueueModal} from '../../Modals/QueueModal';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  QuranIcon,
} from '@/components/Icons';

interface ControlButtonsProps {
  speedBottomSheetRef: React.RefObject<BottomSheet>;
  sleepBottomSheetRef: React.RefObject<BottomSheet>;
  queueBottomSheetRef: React.RefObject<BottomSheet>;
  onQueuePress: () => void;
  showQueue: boolean;
  onQuranPress: () => void;
  showQuran: boolean;
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
  queueBottomSheetRef,
  onQueuePress,
  showQueue,
  onQuranPress,
  showQuran,
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

  const handleQueueClose = () => {
    queueBottomSheetRef.current?.close();
  };

  const sleepTimerValue =
    typeof settings.sleepTimer === 'number' ? settings.sleepTimer : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.quranButton}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onQuranPress}
          style={[
            styles.button,
            showQuran && [
              styles.activeButton,
              {backgroundColor: theme.colors.text},
            ],
          ]}>
          <QuranIcon
            size={moderateScale(24)}
            color={showQuran ? theme.colors.card : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

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
              {backgroundColor: theme.colors.text},
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
              playback.rate !== 1 && {color: theme.colors.card},
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
              {backgroundColor: theme.colors.text},
            ],
          ]}>
          {settings.repeatMode === 'none' && (
            <RepeatIcon size={moderateScale(25)} color={theme.colors.text} />
          )}
          {settings.repeatMode === 'queue' && (
            <RepeatIcon size={moderateScale(25)} color={theme.colors.card} />
          )}
          {settings.repeatMode === 'track' && (
            <RepeatOneIcon size={moderateScale(25)} color={theme.colors.card} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.99}
          onPress={handleSleepPress}
          style={[
            styles.button,
            styles.sleepButton,
            sleepTimerValue > 0 && [
              styles.activeButton,
              {backgroundColor: theme.colors.text},
            ],
          ]}>
          <TimerIcon
            color={sleepTimerValue > 0 ? theme.colors.card : theme.colors.text}
            size={moderateScale(22)}
            filled={sleepTimerValue > 0}
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
              {backgroundColor: theme.colors.text},
            ],
          ]}>
          <QueueIcon
            size={moderateScale(25)}
            color={showQueue ? theme.colors.card : theme.colors.text}
          />
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
        sleepTimer={sleepTimerValue}
        remainingTime={null}
      />

      <QueueModal
        bottomSheetRef={queueBottomSheetRef}
        onClose={handleQueueClose}
      />
    </View>
  );
};

const styles = StyleSheet.create<Styles>({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(25),
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
    left: moderateScale(15),
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(25),
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
    right: moderateScale(15),
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(25),
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1,
  },
  button: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(20),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButton: {
    borderTopRightRadius: moderateScale(8),
    borderBottomRightRadius: moderateScale(8),
    borderTopLeftRadius: moderateScale(20),
    borderBottomLeftRadius: moderateScale(20),
  },
  middleButton: {
    borderRadius: moderateScale(8),
    marginHorizontal: moderateScale(3),
  },
  activeButton: {
    backgroundColor: 'transparent', // Will be overridden inline
  },
  speedButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  activeText: {
    color: 'transparent', // Will be overridden inline
  },
  speedX: {
    fontSize: moderateScale(14),
  },
  mediumButton: {
    width: moderateScale(42),
    paddingHorizontal: moderateScale(3),
  },
  expandedButton: {
    width: moderateScale(50),
    paddingHorizontal: moderateScale(4),
  },
  sleepButton: {
    marginLeft: 0,
    borderTopRightRadius: moderateScale(15),
    borderBottomRightRadius: moderateScale(15),
    borderTopLeftRadius: moderateScale(8),
    borderBottomLeftRadius: moderateScale(8),
  },
  sideButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
