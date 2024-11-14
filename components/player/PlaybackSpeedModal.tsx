import React, {useCallback} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface PlaybackSpeedModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onSpeedChange: (speed: number) => void;
  currentSpeed: number;
}

const PlaybackSpeedModal: React.FC<PlaybackSpeedModalProps> = ({
  bottomSheetRef,
  onSpeedChange,
  currentSpeed,
}) => {
  const {theme} = useTheme();
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

  const handleSpeedPress = (speed: number) => {
    onSpeedChange(speed);
    bottomSheetRef.current?.close();
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['50%']}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{backgroundColor: theme.colors.background}}
      handleIndicatorStyle={{backgroundColor: theme.colors.background}}>
      <View style={styles(theme).container}>
        <View style={styles(theme).headerContainer}>
          <Text style={[styles(theme).title, {color: theme.colors.text}]}>
            Playback Speed
          </Text>
        </View>
        <View style={styles(theme).contentContainer}>
          {speeds.map(speed => (
            <TouchableOpacity
              key={speed}
              style={[
                styles(theme).speedButton,
                currentSpeed === speed && styles(theme).selectedSpeed,
              ]}
              onPress={() => handleSpeedPress(speed)}>
              <Text
                style={[
                  styles(theme).speedButtonText,
                  currentSpeed === speed && styles(theme).selectedSpeedText,
                ]}>
                {speed === 1 ? 'Normal' : `${speed}x`}
              </Text>
              {currentSpeed === speed && (
                <MaterialCommunityIcons
                  name="check"
                  size={moderateScale(24)}
                  color={theme.colors.primary}
                  style={styles(theme).checkIcon}
                />
              )}
            </TouchableOpacity>
          ))}
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
    speedButton: {
      paddingVertical: moderateScale(15),
      borderRadius: moderateScale(5),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectedSpeed: {},
    speedButtonText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    selectedSpeedText: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    checkIcon: {
      marginLeft: moderateScale(10),
    },
  });

export default PlaybackSpeedModal;
