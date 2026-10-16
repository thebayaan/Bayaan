import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/styles/theme';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface ToggleProps {
  options: ['Reciters', 'Surahs'];
  selectedOption: 'Reciters' | 'Surahs';
  onToggle: (option: 'Reciters' | 'Surahs') => void;
}

// @ai-start
const Toggle: React.FC<ToggleProps> = ({options, selectedOption, onToggle}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const styles = createStyles(theme);

  return (
    <View style={styles.toggleContainer}>
      {options.map(option => (
        <TouchableOpacity
          activeOpacity={0.99}
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
            {option === 'Reciters'
              ? t('common:terms.reciters')
              : t('common:terms.surahs')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    toggleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingBottom: verticalScale(5),
    },
    toggleButton: {
      paddingVertical: verticalScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(25),
      marginHorizontal: moderateScale(4),
    },
    activeToggleButton: {
      backgroundColor: theme.colors.card,
      // borderWidth: moderateScale(0.3),
      borderColor: theme.colors.border,
    },
    toggleButtonText: {
      fontSize: moderateScale(14),
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    activeToggleButtonText: {
      color: theme.colors.text,
    },
  });

export default Toggle;
