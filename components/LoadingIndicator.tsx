import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {ThemeProvider} from '@/contexts/ThemeContext';

export const LoadingIndicator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <ThemeProvider>
      <View style={styles.container}>
        <ActivityIndicator size={moderateScale(30)} color={theme.colors.text} />
      </View>
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
