import React, {useCallback} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface SleepTimerModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onTimerChange: (minutes: number | 'END_OF_SURAH') => void;
  onTurnOffTimer: () => void;
  sleepTimer: NodeJS.Timeout | null;
  remainingTime: number | null;
  currentTimer: number | 'END_OF_SURAH' | null;
}

const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  bottomSheetRef,
  onTimerChange,
  onTurnOffTimer,
  sleepTimer,
  remainingTime,
  currentTimer,
}) => {
  const {theme} = useTheme();
  const showRemoveTimer = sleepTimer !== null;
  const title =
    remainingTime !== null
      ? `Sleep timer - ${remainingTime} min left`
      : 'Sleep timer';
  const END_OF_SURAH = 'END_OF_SURAH';
  const timers = [
    {label: '5 minutes', value: 5},
    {label: '10 minutes', value: 10},
    {label: '15 minutes', value: 15},
    {label: '30 minutes', value: 30},
    {label: '45 minutes', value: 45},
    {label: '1 hour', value: 60},
    {label: 'End of Surah', value: END_OF_SURAH},
  ];

  const renderBackdrop = useCallback(
    (
      props: React.JSX.IntrinsicAttributes & BottomSheetDefaultBackdropProps,
    ) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleTimerPress = (value: number | 'END_OF_SURAH') => {
    if (value === currentTimer) {
      onTurnOffTimer();
    } else {
      onTimerChange(value);
    }
    bottomSheetRef.current?.close();
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['80%', '60%']}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{backgroundColor: theme.colors.card}}
      handleIndicatorStyle={{backgroundColor: theme.colors.card}}>
      <View style={styles(theme).container}>
        <View style={styles(theme).headerContainer}>
          <Text style={[styles(theme).title, {color: theme.colors.text}]}>
            {title}
          </Text>
        </View>
        <View style={styles(theme).contentContainer}>
          {timers.map(timer => (
            <TouchableOpacity
              activeOpacity={0.99}
              key={timer.value}
              style={[
                styles(theme).timerButton,
                currentTimer === timer.value && styles(theme).selectedTimer,
              ]}
              onPress={() =>
                handleTimerPress(timer.value as number | 'END_OF_SURAH')
              }>
              <Text
                style={[
                  styles(theme).timerButtonText,
                  currentTimer === timer.value &&
                    styles(theme).selectedTimerText,
                ]}>
                {timer.label}
              </Text>
              {currentTimer === timer.value && (
                <MaterialCommunityIcons
                  name="check"
                  size={moderateScale(24)}
                  color={theme.colors.primary}
                  style={styles(theme).checkIcon}
                />
              )}
            </TouchableOpacity>
          ))}
          {showRemoveTimer && (
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles(theme).timerButton}
              onPress={() => {
                onTurnOffTimer();
                bottomSheetRef.current?.close();
              }}>
              <Text style={styles(theme).timerButtonText}>Turn off timer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
    },
    headerContainer: {
      paddingHorizontal: moderateScale(15),
      paddingVertical: moderateScale(5),
      borderBottomWidth: moderateScale(1),
      borderBottomColor: theme.colors.border,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    title: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
    },
    timerButton: {
      paddingVertical: moderateScale(15),
      borderRadius: moderateScale(5),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectedTimer: {},
    timerButtonText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    selectedTimerText: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    checkIcon: {
      marginLeft: moderateScale(10),
    },
  });

export default SleepTimerModal;
