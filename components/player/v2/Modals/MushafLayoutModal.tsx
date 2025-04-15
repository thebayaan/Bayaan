import React from 'react';
import {View, Text, StyleSheet, Switch} from 'react-native';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';

interface MushafLayoutModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  showTranslation: boolean;
  toggleTranslation: () => void;
  showTransliteration: boolean;
  toggleTransliteration: () => void;
}

export const MushafLayoutModal: React.FC<MushafLayoutModalProps> = ({
  bottomSheetRef,
  showTranslation,
  toggleTranslation,
  showTransliteration,
  toggleTransliteration,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const trackColor = {
    false: Color(theme.colors.textSecondary).alpha(0.3).toString(),
    true: theme.colors.primary,
  };

  const snapPoints = React.useMemo(() => ['40%'], []);

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      title="Mushaf Layout Options"
      snapPoints={snapPoints}>
      <BottomSheetScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Show Translation</Text>
          <Switch
            trackColor={trackColor}
            thumbColor={theme.colors.card}
            ios_backgroundColor={trackColor.false}
            onValueChange={toggleTranslation}
            value={showTranslation}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Show Transliteration</Text>
          <Switch
            trackColor={trackColor}
            thumbColor={theme.colors.card}
            ios_backgroundColor={trackColor.false}
            onValueChange={toggleTransliteration}
            value={showTransliteration}
          />
        </View>

        {/* Add more options here in the future */}
      </BottomSheetScrollView>
    </BaseModal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContainer: {
      paddingBottom: verticalScale(20),
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
    },
    optionLabel: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      flex: 1,
      marginRight: moderateScale(10),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: verticalScale(8),
    },
  });
