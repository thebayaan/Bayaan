import React from 'react';
import {TouchableOpacity, Text, StyleSheet, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';

interface SleepTimerModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onTimerChange: (minutes: number) => void;
  onTurnOffTimer: () => void;
  sleepTimer: number;
  remainingTime: number | null;
}

// Reverted back to original timer options
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
      title="Sleep Timer"
      snapPoints={['50%']}>
      <View style={styles.container}>
        {remainingTime !== null && remainingTime > 0 && (
          <Text style={[styles.remainingTime, {color: theme.colors.text}]}>
            {remainingTime < 1
              ? `${Math.round(remainingTime * 60)} seconds`
              : `${Math.round(remainingTime)} ${remainingTime === 1 ? 'minute' : 'minutes'}`}{' '}
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
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.option,
                  {borderColor: theme.colors.text},
                  isSelected
                    ? [
                        styles.selectedTimer,
                        {backgroundColor: theme.colors.text},
                      ]
                    : undefined,
                ]}
                onPress={() => handleTimerSelect(minutes)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.timerText,
                    {color: theme.colors.text},
                    isSelected ? {color: theme.colors.card} : undefined,
                  ]}>
                  {minutes} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {(sleepTimer > 0 || remainingTime !== null) && (
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
  },
  remainingTime: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
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
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(20),
  },
  selectedTimer: {
    borderColor: 'transparent',
  },
  timerText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
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
  },
});
