import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/styles/theme';

interface ToggleProps {
  options: ['Reciters', 'Surahs'];
  selectedOption: 'Reciters' | 'Surahs';
  onToggle: (option: 'Reciters' | 'Surahs') => void;
}

const Toggle: React.FC<ToggleProps> = ({options, selectedOption, onToggle}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.toggleContainer}>
      {options.map(option => (
        <TouchableOpacity
          key={option}
          style={[
            styles.toggleButton,
            selectedOption === option && styles.activeToggleButton,
          ]}
          onPress={() => onToggle(option)}>
          <Text
            style={[
              styles.toggleButtonText,
              selectedOption === option && styles.activeToggleButtonText,
            ]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    toggleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingBottom: verticalScale(10),
    },
    toggleButton: {
      paddingVertical: verticalScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(25),
      marginHorizontal: moderateScale(4),
    },
    activeToggleButton: {
      backgroundColor: theme.colors.card,
      borderWidth: moderateScale(1),
      borderColor: theme.colors.border,
    },
    toggleButtonText: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    activeToggleButtonText: {
      color: theme.colors.text,
    },
  });

export default Toggle;
