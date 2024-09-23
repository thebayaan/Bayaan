import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import BottomSheetModal from '@/components/BottomSheetModal';

interface SleepTimerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTimerChange: (minutes: number | 'END_OF_SURAH') => void;
  onTurnOffTimer: () => void;
  sleepTimer: NodeJS.Timeout | null;
  remainingTime: number | null;
}

const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isVisible,
  onClose,
  onTimerChange,
  onTurnOffTimer,
  sleepTimer,
  remainingTime,
}) => {
  const {theme} = useTheme();
  const showRemoveTimer = sleepTimer !== null;
  const title =
    remainingTime !== null
      ? `Sleep Timer - ${remainingTime} min left`
      : 'Sleep Timer';
  const END_OF_SURAH = 'END_OF_SURAH';
  const timers = [
    {label: '5 mins', value: 5},
    {label: '10 mins', value: 10},
    {label: '15 mins', value: 15},
    {label: '30 mins', value: 30},
    {label: '45 mins', value: 45},
    {label: '1 hour', value: 60},
    {label: 'End of Surah', value: END_OF_SURAH},
  ];

  return (
    <BottomSheetModal
      isVisible={isVisible}
      onClose={onClose}
      snapPoints={['80%']}>
      <Text style={[styles(theme).title, {color: theme.colors.text}]}>
        {title}
      </Text>
      {timers.map(timer => (
        <TouchableOpacity
          key={timer.value}
          style={styles(theme).timerButton}
          onPress={() => {
            onTimerChange(timer.value as number | 'END_OF_SURAH');
            onClose();
          }}>
          <Text style={styles(theme).timerButtonText}>{timer.label}</Text>
        </TouchableOpacity>
      ))}
      {showRemoveTimer && (
        <TouchableOpacity
          style={styles(theme).timerButton}
          onPress={() => {
            onTurnOffTimer();
            onClose();
          }}>
          <Text style={styles(theme).timerButtonText}>Turn off timer</Text>
        </TouchableOpacity>
      )}
    </BottomSheetModal>
  );
};

const styles = (theme: Theme) =>
  ScaledSheet.create({
    title: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      marginBottom: moderateScale(20),
    },
    timerButton: {
      padding: moderateScale(15),
      borderRadius: moderateScale(5),
      marginTop: moderateScale(10),
      backgroundColor: theme.colors.background,
    },
    timerButtonText: {
      fontSize: moderateScale(16),
      textAlign: 'center',
      color: theme.colors.text,
    },
  });

export default SleepTimerModal;
