import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';

interface SurahCardProps {
  id: number;
  name: string;
  translatedName: string;
  versesCount: number;
  revelationPlace: string;
  color: string;
  onPress: () => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({
  id,
  name,
  translatedName,
  revelationPlace,
  color,
  onPress,
}) => {
  const {theme} = useTheme();

  const getGradientColors = (): [string, string] => {
    const baseColor = Color(color);
    const gradientStart = baseColor.alpha(0.15).toString();
    const gradientEnd = baseColor.alpha(0.05).toString();
    return [gradientStart, gradientEnd];
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(140),
      height: moderateScale(140),
      borderRadius: moderateScale(16),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(color).alpha(0.2).toString(),
    },
    content: {
      flex: 1,
      padding: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
    },
    arabicName: {
      fontSize: moderateScale(32),
      color: theme.colors.text,
      fontFamily: 'SurahNames',
      marginBottom: moderateScale(8),
    },
    nameContainer: {
      alignItems: 'center',
    },
    name: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: moderateScale(2),
    },
    translatedName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    placeIcon: {
      position: 'absolute',
      top: moderateScale(8),
      right: moderateScale(8),
      opacity: 0.5,
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.container}
      onPress={onPress}>
      <LinearGradient
        colors={getGradientColors() as readonly string[]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.placeIcon}>
        {revelationPlace.toLowerCase() === 'makkah' ? (
          <MakkahIcon size={moderateScale(16)} color={theme.colors.text} />
        ) : (
          <MadinahIcon size={moderateScale(16)} color={theme.colors.text} />
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.arabicName}>{surahGlyphMap[id]}</Text>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.translatedName}>{translatedName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
