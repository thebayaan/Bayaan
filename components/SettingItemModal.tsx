import React from 'react';
import {Text, TouchableOpacity, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

interface SettingItemModalProps {
  title: string;
  options: {label: string; value: string; onPress: () => void}[];
  onClose: () => void;
}

export const SettingItemModal: React.FC<SettingItemModalProps> = ({
  options,
  onClose,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.option}
            onPress={() => {
              option.onPress();
              onClose();
            }}>
            <Text style={styles.optionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    optionsContainer: {
      paddingHorizontal: moderateScale(16),
    },
    option: {
      paddingVertical: moderateScale(12),
    },
    optionText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
  });
