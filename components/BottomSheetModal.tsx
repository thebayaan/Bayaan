import React, {useCallback, useRef, useEffect} from 'react';
import {View, StyleProp, ViewStyle, Platform, BackHandler} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetHandleProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

// Custom handle component for the bottom sheet
const CustomHandle = (_props: BottomSheetHandleProps) => {
  const {theme} = useTheme();
  return (
    <View style={handleStyles.container}>
      <View
        style={[
          handleStyles.handle,
          {backgroundColor: Color(theme.colors.text).alpha(0.2).toString()},
        ]}
      />
    </View>
  );
};

// Separate styles for the handle to avoid theme dependency issues
const handleStyles = ScaledSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});

interface BottomSheetModalProps {
  isVisible: boolean;
  onClose: () => void;
  snapPoints?: string[];
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  enableContentPanningGesture?: boolean;
}

const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isVisible,
  onClose,
  snapPoints = ['40%'],
  children,
  contentContainerStyle,
  enableContentPanningGesture = true,
}) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  // Add back button handler for Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (isVisible) {
        onClose();
        return true; // Prevent default behavior
      }
      return false; // Let default behavior happen
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [isVisible, onClose]);

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

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={isVisible ? 0 : -1}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: moderateScale(25),
        borderTopRightRadius: moderateScale(25),
      }}
      enablePanDownToClose={true}
      handleComponent={CustomHandle}
      enableContentPanningGesture={Platform.OS === 'ios' && enableContentPanningGesture}
      onClose={onClose}
      style={{
        zIndex: 3000,
        elevation: 3000,
      }}>
      <BottomSheetView style={[styles(theme).contentContainer, contentContainerStyle]}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = (theme: Theme) =>
  ScaledSheet.create({
    contentContainer: {
      flex: 1,
      padding: moderateScale(20),
      backgroundColor: theme.colors.background,
    },
  });

export default BottomSheetModal;
