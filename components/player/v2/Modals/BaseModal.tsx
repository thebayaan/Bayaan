import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';

interface BaseModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  title: string;
  children: React.ReactNode;
  snapPoints?: string[];
}

export const BaseModal: React.FC<BaseModalProps> = ({
  bottomSheetRef,
  title,
  children,
  snapPoints = ['40%'],
}) => {
  const {theme} = useTheme();

  const renderBackdrop = React.useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      index={-1}
      backgroundStyle={[
        styles.background,
        {backgroundColor: theme.colors.card},
      ]}>
      <BottomSheetView style={styles.container}>
        <Text style={[styles.title, {color: theme.colors.text}]}>{title}</Text>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
  },
  container: {
    flex: 1,
    padding: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(22),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(16),
    textAlign: 'center',
  },
});
