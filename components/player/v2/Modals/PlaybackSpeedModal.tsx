import React from 'react';
import {TouchableOpacity, Text, StyleSheet, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';

interface PlaybackSpeedModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onSpeedChange: (speed: number) => void;
  currentSpeed: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const PlaybackSpeedModal: React.FC<PlaybackSpeedModalProps> = ({
  bottomSheetRef,
  onSpeedChange,
  currentSpeed,
}) => {
  const {theme} = useTheme();

  const handleSpeedSelect = (speed: number) => {
    onSpeedChange(speed);
    bottomSheetRef.current?.close();
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      title="Playback Speed"
      snapPoints={['50%']}>
      <View style={styles.speedContainer}>
        {SPEEDS.map(speed => (
          <TouchableOpacity
            key={speed}
            style={[
              styles.speedButton,
              {borderColor: theme.colors.text},
              currentSpeed === speed && [
                styles.selectedSpeed,
                {backgroundColor: theme.colors.text},
              ],
            ]}
            onPress={() => handleSpeedSelect(speed)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.speedText,
                {color: theme.colors.text},
                currentSpeed === speed && {color: theme.colors.card},
              ]}>
              {speed}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  speedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: moderateScale(12),
  },
  speedButton: {
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(20),
    // borderWidth: 1,
  },
  selectedSpeed: {
    borderColor: 'transparent',
  },
  speedText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
  },
});
