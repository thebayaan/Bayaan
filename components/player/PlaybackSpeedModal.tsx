import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import BottomSheetModal from '@/components/BottomSheetModal';

interface PlaybackSpeedModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSpeedChange: (speed: number) => void;
}

const PlaybackSpeedModal: React.FC<PlaybackSpeedModalProps> = ({
  isVisible,
  onClose,
  onSpeedChange,
}) => {
  const {theme} = useTheme();
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <BottomSheetModal
      isVisible={isVisible}
      onClose={onClose}
      snapPoints={['80%']}>
      <Text style={[styles(theme).title, {color: theme.colors.text}]}>
        Speed
      </Text>
      {speeds.map(speed => (
        <TouchableOpacity
          key={speed}
          style={styles(theme).speedButton}
          onPress={() => {
            onSpeedChange(speed);
            onClose();
          }}>
          <Text style={styles(theme).speedButtonText}>
            {speed === 1 ? 'Normal' : `${speed}x`}
          </Text>
        </TouchableOpacity>
      ))}
    </BottomSheetModal>
  );
};

const styles = (theme: Theme) =>
  ScaledSheet.create({
    title: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      marginBottom: moderateScale(10),
    },
    speedButton: {
      padding: moderateScale(15),
      borderRadius: moderateScale(5),
      marginTop: moderateScale(10),
      backgroundColor: theme.colors.background,
    },
    speedButtonText: {
      fontSize: moderateScale(16),
      textAlign: 'center',
      color: theme.colors.text,
    },
  });

export default PlaybackSpeedModal;
