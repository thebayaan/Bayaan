import React from 'react';
import {Text, TextStyle, StyleProp} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import {LinearGradient} from 'expo-linear-gradient';
import {getRandomColors} from '@/utils/gradientColors';

interface GradientTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  surahId: number;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  style,
  surahId,
}) => {
  const gradientColors = React.useMemo(
    () => getRandomColors(surahId),
    [surahId],
  );

  return (
    <MaskedView
      maskElement={
        <Text style={[style, {backgroundColor: 'transparent'}]}>
          {children}
        </Text>
      }>
      <LinearGradient
        colors={[gradientColors[0], gradientColors[1]]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}>
        <Text style={[style, {opacity: 0}]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
};
