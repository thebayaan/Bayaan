import {useContext} from 'react';
import {ThemeContext} from '@/contexts/ThemeContext';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  const isDarkMode =
    context.themeMode === 'dark' ||
    (context.themeMode === 'system' &&
      context.theme.colors.background === '#121212');

  return {...context, isDarkMode};
};
