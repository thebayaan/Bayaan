import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
} from '@/components/Icons';

interface PlayerControlButtonsProps {
  playbackSpeed: number;
  repeatMode: 'off' | 'all' | 'once';
  sleepTimer: NodeJS.Timeout | null;
  isEndOfSurahTimer: boolean;
  onSpeedPress: () => void;
  onRepeatPress: () => void;
  onSleepTimerPress: () => void;
  onQueuePress: () => void;
}

const PlayerControlButtons: React.FC<PlayerControlButtonsProps> = ({
  playbackSpeed,
  repeatMode,
  sleepTimer,
  isEndOfSurahTimer,
  onSpeedPress,
  onRepeatPress,
  onSleepTimerPress,
  onQueuePress,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onSpeedPress}>
          <Text
            style={[
              styles.speedButtonText,
              playbackSpeed !== 1 && {color: theme.colors.text},
            ]}>
            {`${playbackSpeed}x`}
          </Text>
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                playbackSpeed !== 1 ? theme.colors.text : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onRepeatPress}>
          {repeatMode === 'off' && (
            <RepeatIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
          {repeatMode === 'all' && (
            <RepeatIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
          {repeatMode === 'once' && (
            <RepeatOneIcon size={moderateScale(24)} color={theme.colors.text} />
          )}
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                repeatMode !== 'off' ? theme.colors.text : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onSleepTimerPress}>
          <TimerIcon
            color={
              sleepTimer || isEndOfSurahTimer
                ? theme.colors.text
                : theme.colors.text
            }
            size={moderateScale(24)}
            filled={!!(sleepTimer || isEndOfSurahTimer)}
          />
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                sleepTimer || isEndOfSurahTimer
                  ? theme.colors.text
                  : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onQueuePress}>
          <QueueIcon size={moderateScale(24)} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      width: '100%',
      paddingVertical: moderateScale(16),
    },
    buttonWrapper: {
      alignItems: 'center',
      width: moderateScale(60),
      height: moderateScale(40),
    },
    speedButtonText: {
      color: theme.colors.text,
      fontSize: moderateScale(20),
      fontWeight: '500',
    },
    activeDot: {
      width: moderateScale(4),
      height: moderateScale(4),
      borderRadius: moderateScale(2),
      backgroundColor: theme.colors.text,
      marginTop: moderateScale(4),
    },
  });

export default PlayerControlButtons;
