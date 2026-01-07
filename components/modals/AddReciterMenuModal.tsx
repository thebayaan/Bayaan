import React, {useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {BaseModal} from './BaseModal';

interface AddReciterMenuModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onClose: () => void;
  onAddReciter: () => void;
}

export const AddReciterMenuModal: React.FC<AddReciterMenuModalProps> = ({
  bottomSheetRef,
  onClose,
  onAddReciter,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const handleAddReciter = () => {
    onClose();
    // Small timeout to allow the menu modal to close before opening the full add modal
    setTimeout(() => {
      onAddReciter();
    }, 300);
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      title=""
      snapPoints={['25%']} // Height similar to surah options modal
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.option}
          onPress={handleAddReciter}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Icon
              name="plus-circle"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </View>
          <Text style={styles.optionText}>Add New Reciter</Text>
        </TouchableOpacity>
        
        {/* You can add more options here if needed, like "Import from..." */}
      </View>
    </BaseModal>
  );
};

const createStyles = (theme: any) =>
  ScaledSheet.create({
    container: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(10),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(15),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border, // Optional separator
    },
    iconContainer: {
      marginRight: moderateScale(15),
      width: moderateScale(30),
      alignItems: 'center',
    },
    optionText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      fontFamily: 'Manrope-Medium',
    },
  });

