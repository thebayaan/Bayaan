import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {ThemeProvider} from '@/contexts/ThemeContext';
import {Theme} from '@/utils/themeUtils';

export const LoadingIndicator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <ThemeProvider>
      <View style={createStyles(theme).container}>
        <ActivityIndicator size={moderateScale(30)} color={theme.colors.text} />
      </View>
    </ThemeProvider>
  );
};

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
  });
