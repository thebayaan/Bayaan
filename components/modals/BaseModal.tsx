import React, {useEffect} from 'react';
import {Text, StyleSheet, Platform, View, BackHandler} from 'react-native';
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
  snapPoints?: (string | number)[];
  titleAlign?: 'left' | 'center';
  onChange?: (index: number) => void;
  index?: number;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  bottomSheetRef,
  title,
  children,
  snapPoints = ['40%'],
  titleAlign = 'center',
  onChange,
  index = -1,
}) => {
  const {theme} = useTheme();

  // Add back button handler for Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (bottomSheetRef.current) {
        // Check if the bottom sheet is open by attempting to close it
        try {
          bottomSheetRef.current.close();
          return true; // Prevent default behavior
        } catch (error) {
          console.warn('Error closing bottom sheet:', error);
        }
      }
      return false; // Let default behavior happen
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [bottomSheetRef]);

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
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      index={index}
      onChange={onChange}
      style={styles.modal}
      handleComponent={CustomHandle}
      enableContentPanningGesture
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
