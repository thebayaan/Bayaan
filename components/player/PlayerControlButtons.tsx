import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

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
              playbackSpeed !== 1 && {color: theme.colors.primary},
            ]}>
            {`${playbackSpeed}x`}
          </Text>
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                playbackSpeed !== 1 ? theme.colors.primary : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onRepeatPress}>
          <MaterialCommunityIcons
            name={repeatMode === 'once' ? 'repeat-once' : 'repeat'}
            size={moderateScale(24)}
            color={
              repeatMode === 'off' ? theme.colors.text : theme.colors.primary
            }
          />
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                repeatMode !== 'off' ? theme.colors.primary : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onSleepTimerPress}>
          <MaterialCommunityIcons
            name={sleepTimer || isEndOfSurahTimer ? 'timer' : 'timer-outline'}
            size={moderateScale(24)}
            color={
              sleepTimer || isEndOfSurahTimer
                ? theme.colors.primary
                : theme.colors.text
            }
          />
        </TouchableOpacity>
        <View
          style={[
            styles.activeDot,
            {
              backgroundColor:
                sleepTimer || isEndOfSurahTimer
                  ? theme.colors.primary
                  : 'transparent',
            },
          ]}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity onPress={onQueuePress}>
          <MaterialCommunityIcons
            name="playlist-music"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
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
    },
    buttonWrapper: {
      alignItems: 'center',
    },
    speedButtonText: {
      color: theme.colors.text,
      fontSize: moderateScale(20),
      fontWeight: 'bold',
    },
    activeDot: {
      width: moderateScale(4),
      height: moderateScale(4),
      borderRadius: moderateScale(2),
      backgroundColor: theme.colors.primary,
      marginTop: moderateScale(4),
    },
  });

export default PlayerControlButtons;
