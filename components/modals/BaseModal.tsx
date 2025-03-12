import React from 'react';
import {Text, StyleSheet, Platform, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

// Custom handle component for the bottom sheet
const CustomHandle = (_props: BottomSheetHandleProps) => {
  const {theme} = useTheme();
  return (
    <View style={styles.handleContainer}>
      <View
        style={[
          styles.handle,
          {backgroundColor: Color(theme.colors.text).alpha(0.2).toString()},
        ]}
      />
    </View>
  );
};

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
      handleComponent={CustomHandle}
      enableContentPanningGesture={Platform.OS === 'ios'}
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
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
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
  },
});
