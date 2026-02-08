import React from 'react';
import {Pressable, ViewStyle, StyleProp} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  style,
  iconSize = 24,
}) => {
  const {theme} = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <Pressable
      style={[styles.backButton, style, {marginLeft: insets.left}]}
      onPress={handlePress}>
      <Feather
        name="arrow-left"
        color={theme.colors.text}
        size={moderateScale(iconSize)}
      />
    </Pressable>
  );
};

const styles = ScaledSheet.create({
  backButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(10),
  },
});
