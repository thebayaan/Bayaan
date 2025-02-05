import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
// Light Indigo

interface SurahCardProps {
  id: number;
  name: string;
  translatedName: string;
  versesCount: number;
  revelationPlace: string;
  onPress: () => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({
  id,
  name,
  translatedName,
  versesCount,
  revelationPlace,
  onPress,
}) => {
  const {theme} = useTheme();

  const getGradientColors = (): [string, string] => {
    const baseColor = theme.colors.primary;
    return [
      Color(baseColor).alpha(0.1).toString(),
      Color(baseColor).alpha(0.05).toString(),
    ];
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(160),
      height: moderateScale(200),
      borderRadius: moderateScale(20),
      marginRight: moderateScale(12),
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      padding: moderateScale(16),
      justifyContent: 'space-between',
    },
    topSection: {
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
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: moderateScale(4),
    },
    translatedName: {
      fontSize: moderateScale(12),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(8),
    },
    revelationIcon: {
      marginLeft: moderateScale(4),
    },
    infoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: moderateScale(8),
      paddingTop: moderateScale(8),
    },
    infoGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoText: {
      fontSize: moderateScale(11),
      color: theme.colors.textSecondary,
    },
    iconOverlay: {
      position: 'absolute',
      right: moderateScale(-30),
      bottom: moderateScale(-30),
      opacity: 0.05,
      transform: [{rotate: '-15deg'}],
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <LinearGradient
        colors={getGradientColors()}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconOverlay}>
        {revelationPlace.toLowerCase() === 'makkah' ? (
          <MakkahIcon size={moderateScale(120)} color={theme.colors.primary} />
        ) : (
          <MadinahIcon size={moderateScale(120)} color={theme.colors.primary} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.arabicName}>{surahGlyphMap[id]}</Text>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.translatedName}>{translatedName}</Text>
          </View>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>{versesCount} verses</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
