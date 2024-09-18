import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
// Light Indigo

interface SurahCardProps {
  id: number;
  name: string;
  translatedName: string;
  onPress: () => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({
  id,
  name,
  translatedName,
  onPress,
}) => {
  const {theme, isDarkMode} = useTheme();

  // Add these constants at the top of your file, outside the component
  const DARKEST_COLOR = theme.colors.card; // Deep Indigo
  const LIGHTEST_COLOR = theme.colors.card;

  const getGradientColors = () => {
    const baseColor = theme.colors.primary;
    const startColor = Color(baseColor)
      .mix(
        Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR),
        isDarkMode ? 0.89 : 0.89,
      )
      .rgb()
      .string();
    const endColor = Color(startColor)
      .mix(
        Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR),
        isDarkMode ? 1.4 : 0.999,
      )
      .rgb()
      .string();
    return [startColor, endColor];
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(2),
      borderWidth: moderateScale(0.3),
      borderColor: theme.colors.border,
      marginRight: moderateScale(10),
      marginTop: moderateScale(10),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    content: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    arabicName: {
      fontSize: moderateScale(25),
      color: theme.colors.text,
      textAlign: 'center',
      fontFamily: 'SurahNames',
      marginBottom: moderateScale(10),
    },
    name: {
      fontSize: moderateScale(10),
      color: theme.colors.text,
      textAlign: 'center',
    },
    translatedName: {
      fontSize: moderateScale(8),
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  const [gradientStart, gradientEnd] = getGradientColors();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Text style={styles.arabicName}>{surahGlyphMap[id]}</Text>
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.translatedName}>{translatedName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
