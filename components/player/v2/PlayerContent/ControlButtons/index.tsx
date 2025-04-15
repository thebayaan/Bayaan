import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import BottomSheet from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PlaybackSpeedModal} from '../../Modals/PlaybackSpeedModal';
import {SleepTimerModal} from '../../Modals/SleepTimerModal';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  QuranIcon,
} from '@/components/Icons';

// Key for AsyncStorage
const ASYNC_STORAGE_KEY = 'hasInteractedWithQuranOptions';

interface ControlButtonsProps {
  speedBottomSheetRef: React.RefObject<BottomSheet>;
  sleepBottomSheetRef: React.RefObject<BottomSheet>;
  onQueuePress: () => void;
  showQueue: boolean;
  onMushafLayoutPress?: () => void;
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
  mushafLayoutButton: ViewStyle;
  sideButtonsContainer: ViewStyle;
  controlsContainer: ViewStyle;
  sideButton: ViewStyle;
  pulseBackground: ViewStyle;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  speedBottomSheetRef,
  sleepBottomSheetRef,
  onQueuePress,
  showQueue,
  onMushafLayoutPress,
}) => {
  const {theme} = useTheme();
  const {playback, setRate, settings, updateSettings} = useUnifiedPlayer();
  const [isNewFeature, setIsNewFeature] = useState(true);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Check AsyncStorage on mount
  useEffect(() => {
    const checkInteraction = async () => {
      try {
        const value = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
        if (value === 'true') {
          setIsNewFeature(false);
        }
      } catch (e) {
        console.error('Failed to read AsyncStorage key:', ASYNC_STORAGE_KEY, e);
      }
    };
    checkInteraction();
  }, []);

  // Start/stop animation based on isNewFeature
  useEffect(() => {
    if (isNewFeature) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }

    return () => pulseAnim.stopAnimation();
  }, [isNewFeature, pulseAnim]);

  const handleMushafLayoutPress = useCallback(async () => {
    if (onMushafLayoutPress) {
      onMushafLayoutPress();
    }
    if (isNewFeature) {
      setIsNewFeature(false);
      try {
        await AsyncStorage.setItem(ASYNC_STORAGE_KEY, 'true');
      } catch (e) {
        console.error(
          'Failed to write AsyncStorage key:',
          ASYNC_STORAGE_KEY,
          e,
        );
      }
    }
  }, [onMushafLayoutPress, isNewFeature]);

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

  const animatedPulseStyle = {
    opacity: pulseAnim,
  };

  return (
    <View style={styles.wrapper}>
      {onMushafLayoutPress && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleMushafLayoutPress}
          style={[styles.sideButton, styles.mushafLayoutButton]}>
          {isNewFeature && (
            <Animated.View
              style={[styles.pulseBackground, animatedPulseStyle]}
            />
          )}
          <QuranIcon size={moderateScale(22)} color={theme.colors.text} />
        </TouchableOpacity>
      )}

      <View
        style={[
          styles.controlsContainer,
          {
            backgroundColor: theme.colors.card,
            shadowColor: theme.colors.shadow,
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.9}
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
          activeOpacity={0.9}
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
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
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

      <TouchableOpacity
        activeOpacity={0.9}
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
      </TouchableOpacity>

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
    overflow: 'hidden',
  },
  pulseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 122, 255, 0.4)',
    zIndex: -1,
  },
});
