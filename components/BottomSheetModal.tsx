import React, {useCallback, useRef, useEffect} from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import {BottomSheetHandle} from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

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
      backgroundStyle={{backgroundColor: theme.colors.background}}
      enablePanDownToClose={true}
      handleComponent={BottomSheetHandle}
      handleIndicatorStyle={{backgroundColor: theme.colors.text}}
      onClose={onClose}>
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
