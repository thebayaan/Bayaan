import React, {useCallback, useRef, useEffect} from 'react';
import {View, StyleProp, ViewStyle, Platform, BackHandler} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
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
}

const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isVisible,
  onClose,
  snapPoints = ['40%'],
  children,
  contentContainerStyle,
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
    (props: BottomSheetBackdropProps) => {
      // gorhom's BottomSheetBackdrop mounts with pointerEvents:'auto' (a
      // full-screen, opacity-0-but-hit-testable Tap GestureDetector) and only
      // flips to 'none' via a reanimated useAnimatedReaction -> runOnJS ->
      // setState chain gated on its internal animatedIndex settling to -1. On
      // slow Android CPUs the closed-sheet layout race delays that settle, so
      // the backdrop keeps eating every touch while the sheet is LOGICALLY
      // closed -> the entire host screen goes touch-dead until the next
      // re-render. Gate on the logical `isVisible` prop so the backdrop never
      // renders while closed, immune to gorhom's racing animatedIndex. Same
      // touch-eater fix shipped for the PlayerSheet backdrop in #308.
      if (!isVisible) {
        return null;
      }
      return (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      );
    },
    [isVisible],
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
      enableDynamicSizing={false}
      handleComponent={CustomHandle}
      enableContentPanningGesture
      onClose={onClose}
      // The elevated BottomSheet Body is a SEPARATE sibling from the backdrop
      // above; gorhom drops its touch-interactivity asynchronously too, so on
      // slow CPUs it can still swallow touches while the sheet is logically
      // closed. Gate its pointerEvents on `isVisible` as well — the proven fix
      // is BOTH siblings gated (matches the PlayerSheet guard in #308).
      style={[
        {zIndex: 3000, elevation: 3000},
        !isVisible && {pointerEvents: 'none' as const},
      ]}>
      <View style={[styles(theme).contentContainer, contentContainerStyle]}>
        {children}
      </View>
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
