import React from 'react';
import {View, StyleSheet} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';

// Define CustomHandle outside the main component
interface CustomHandleProps extends BottomSheetHandleProps {
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const CustomHandle = ({theme, styles}: CustomHandleProps) => {
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

interface MushafLayoutModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
}

export const MushafLayoutModal: React.FC<MushafLayoutModalProps> = ({
  bottomSheetRef,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const snapPoints = React.useMemo(() => ['60%'], []);

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

  const handleComponent = React.useCallback(
    (props: BottomSheetHandleProps) => (
      <CustomHandle {...props} theme={theme} styles={styles} />
    ),
    [theme, styles],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      handleComponent={handleComponent}
      backgroundStyle={[
        styles.background,
        {backgroundColor: theme.colors.backgroundSecondary},
      ]}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        <MushafSettingsContent showTitle={true} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContainer: {
      paddingBottom: moderateScale(40),
      marginBottom: moderateScale(40),
    },
    handleContainer: {
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(8),
      alignItems: 'center',
    },
    handle: {
      width: moderateScale(40),
      height: moderateScale(5),
      borderRadius: moderateScale(3),
      backgroundColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    background: {
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      backgroundColor: theme.colors.backgroundSecondary,
    },
  });
