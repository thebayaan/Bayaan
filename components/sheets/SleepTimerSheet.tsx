import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import Color from 'color';

const TIMER_OPTIONS = [5, 15, 30, 45, 60];

export const SleepTimerSheet = (props: SheetProps<'sleep-timer'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const payload = props.payload;
  const sleepTimer = payload?.sleepTimer ?? 0;
  const remainingTime = payload?.remainingTime ?? null;
  const onTimerChange = payload?.onTimerChange;
  const onTurnOffTimer = payload?.onTurnOffTimer;

  const handleTimerSelect = (minutes: number) => {
    if (onTimerChange) {
      onTimerChange(minutes);
    }
    SheetManager.hide('sleep-timer');
  };

  const handleTurnOff = () => {
    if (onTurnOffTimer) {
      onTurnOffTimer();
    }
    SheetManager.hide('sleep-timer');
  };

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Sleep Timer</Text>
      </View>
      <View style={styles.container}>
        {remainingTime !== null && remainingTime > 0 && (
          <Text style={styles.remainingTime}>
            {remainingTime < 1
              ? `${Math.round(remainingTime * 60)} seconds`
              : `${Math.round(remainingTime)} ${
                  remainingTime === 1 ? 'minute' : 'minutes'
                }`}{' '}
            remaining
          </Text>
        )}
        <View style={styles.optionsContainer}>
          {TIMER_OPTIONS.map(minutes => {
            const timeToCompare =
              remainingTime !== null && remainingTime > 0
                ? remainingTime
                : sleepTimer;

            const isSelected =
              timeToCompare > 0 && Math.abs(timeToCompare - minutes) <= 2;

            return (
              <Pressable
                key={minutes}
                style={({pressed}) => [
                  styles.option,
                  isSelected && styles.selectedTimer,
                  pressed && !isSelected && styles.optionPressed,
                ]}
                onPress={() => handleTimerSelect(minutes)}>
                <Text
                  style={[
                    styles.timerText,
                    isSelected && styles.selectedTimerText,
                  ]}>
                  {minutes} min
                </Text>
              </Pressable>
            );
          })}
        </View>
        {(sleepTimer > 0 || remainingTime !== null) && (
          <Pressable
            style={({pressed}) => [
              styles.turnOffButton,
              pressed && styles.optionPressed,
            ]}
            onPress={handleTurnOff}>
            <Text style={styles.turnOffText}>Turn Off Timer</Text>
          </Pressable>
        )}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(24),
      paddingBottom: moderateScale(40),
    },
    remainingTime: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(16),
    },
    optionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: moderateScale(12),
    },
    option: {
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    selectedTimer: {
      backgroundColor: theme.colors.text,
    },
    timerText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    selectedTimerText: {
      color: theme.colors.background,
    },
    turnOffButton: {
      marginTop: moderateScale(24),
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(24),
      borderRadius: moderateScale(25),
      alignSelf: 'center',
    },
    turnOffText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
