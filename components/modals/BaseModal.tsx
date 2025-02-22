import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';

interface BaseModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  title?: string;
  children: React.ReactNode;
  snapPoints?: string[];
  titleAlign?: 'left' | 'center';
  onChange?: (index: number) => void;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  bottomSheetRef,
  title,
  children,
  snapPoints = ['40%'],
  titleAlign = 'center',
  onChange,
}) => {
  const {theme} = useTheme();

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
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
      onChange={onChange}
      style={styles.modal}
      handleStyle={styles.handle}
      backgroundStyle={[
        styles.background,
        {backgroundColor: theme.colors.backgroundSecondary},
      ]}>
      <BottomSheetView style={styles.container}>
        {title && (
          <Text
            style={[
              styles.title,
              {color: theme.colors.text},
              {textAlign: titleAlign},
            ]}>
            {title}
          </Text>
        )}
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  modal: {
    zIndex: 1000,
    elevation: 1000,
  },
  handle: {
    zIndex: 1001,
    elevation: 1001,
  },
  background: {
    borderTopLeftRadius: moderateScale(45),
    borderTopRightRadius: moderateScale(45),
  },
  container: {
    flex: 1,
    padding: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(22),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(16),
  },
});
