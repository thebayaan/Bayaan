import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import Color from 'color';

interface TrackInfoProps {
  surahName: string;
  reciterName: string;
  onReciterPress?: () => void;
}

const TrackInfo: React.FC<TrackInfoProps> = ({
  surahName,
  reciterName,
  onReciterPress,
}) => {
  const {theme} = useTheme();
  const {gradientColors} = usePlayerBackground(theme, theme.isDarkMode);

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2)
    : baseColor.lighten(4.8).saturate(0.2);

  const secondaryColor = baseColor.isLight()
    ? baseColor.darken(0.5).saturate(0.1)
    : baseColor.lighten(2.5).saturate(0.1);

  return (
    <View style={styles.container}>
      <Text
        style={[styles.surahName, {color: contrastColor.string()}]}
        numberOfLines={1}>
        {surahName}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onReciterPress}
        disabled={!onReciterPress}>
        <Text
          style={[styles.reciterName, {color: secondaryColor.string()}]}
          numberOfLines={1}>
          {reciterName}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  surahName: {
    fontSize: moderateScale(22),
    fontWeight: '600',
    marginBottom: moderateScale(4),
    textAlign: 'center',
  },
  reciterName: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    opacity: 0.9,
    textAlign: 'center',
  },
});

export default TrackInfo;
