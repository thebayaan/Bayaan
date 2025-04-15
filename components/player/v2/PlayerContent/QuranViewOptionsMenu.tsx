import React from 'react';
import {View, Text, StyleSheet, Switch} from 'react-native';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

interface QuranViewOptionsMenuProps {
  showTranslation: boolean;
  toggleTranslation: () => void;
  showTransliteration: boolean;
  toggleTransliteration: () => void;
}

export const QuranViewOptionsMenu: React.FC<QuranViewOptionsMenuProps> = ({
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

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Quran View Options</Text>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Show Translation</Text>
        <Switch
          trackColor={trackColor}
          thumbColor={theme.colors.card} // Match thumb to card background
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
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: moderateScale(16),
      paddingBottom: verticalScale(30), // Add padding for safe area
    },
    title: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: verticalScale(16),
      textAlign: 'center',
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
      flex: 1, // Allow label to take space
      marginRight: moderateScale(10),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: verticalScale(8),
    },
  }); 