import React, {createContext, useContext, useEffect} from 'react';
import {useColorScheme} from 'react-native';
import {useThemeStore} from '@/store/themeStore';
import {ThemeMode, PrimaryColor, Theme} from '@/utils/themeUtils';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  primaryColor: PrimaryColor;
  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: PrimaryColor) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined,
);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const deviceTheme = useColorScheme();
  const {themeMode, primaryColor, setThemeMode, setPrimaryColor, theme} =
    useThemeStore();

  useEffect(() => {
    if (themeMode === 'system') {
      setThemeMode(deviceTheme || 'light');
    }
  }, [deviceTheme, themeMode, setThemeMode]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        primaryColor,
        setThemeMode,
        setPrimaryColor,
      }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
