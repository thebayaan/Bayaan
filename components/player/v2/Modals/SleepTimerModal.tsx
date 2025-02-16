import React from 'react';
import {TouchableOpacity, Text, StyleSheet, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';

interface SleepTimerModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onTimerChange: (minutes: number) => void;
  onTurnOffTimer: () => void;
  sleepTimer: number | NodeJS.Timeout;
  remainingTime: number | null;
}

const TIMER_OPTIONS = [5, 15, 30, 45, 60];

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  bottomSheetRef,
  onTimerChange,
  onTurnOffTimer,
  sleepTimer,
  remainingTime,
}) => {
  const {theme} = useTheme();

  const handleTimerSelect = (minutes: number) => {
    onTimerChange(minutes);
    bottomSheetRef.current?.close();
  };

  const handleTurnOff = () => {
    onTurnOffTimer();
    bottomSheetRef.current?.close();
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      title={
        remainingTime
          ? `Sleep Timer - ${remainingTime} min left`
          : 'Sleep Timer'
      }
      snapPoints={['50%']}>
      <View style={styles.container}>
        <View style={styles.optionsContainer}>
          {TIMER_OPTIONS.map(minutes => (
            <TouchableOpacity
              key={minutes}
              style={[
                styles.option,
                {borderColor: theme.colors.text},
                typeof sleepTimer === 'number' &&
                  sleepTimer === minutes && [
                    styles.selectedOption,
                    {backgroundColor: theme.colors.text},
                  ],
              ]}
              onPress={() => handleTimerSelect(minutes)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.optionText,
                  {color: theme.colors.text},
                  typeof sleepTimer === 'number' &&
                    sleepTimer === minutes && {
                      color: theme.colors.card,
                    },
                ]}>
                {minutes} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {(typeof sleepTimer === 'object' || sleepTimer > 0) && (
          <TouchableOpacity
            style={styles.turnOffButton}
            onPress={handleTurnOff}
            activeOpacity={0.7}>
            <Text style={[styles.turnOffText, {color: theme.colors.text}]}>
              Turn Off Timer
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  remainingTime: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    marginBottom: moderateScale(24),
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: moderateScale(12),
    marginBottom: moderateScale(24),
  },
  option: {
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(20),
  },
  selectedOption: {
    borderColor: 'transparent',
  },
  optionText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
  },
  turnOffButton: {
    paddingVertical: moderateScale(12),
  },
  turnOffText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
    opacity: 0.7,
  },
});
