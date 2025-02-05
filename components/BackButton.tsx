import React from 'react';
import {TouchableOpacity, ViewStyle, StyleProp} from 'react-native';
import {Icon} from '@rneui/themed';
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
    <TouchableOpacity
      activeOpacity={0.99}
      style={[styles.backButton, style, {marginLeft: insets.left}]}
      onPress={handlePress}>
      <Icon
        name="arrow-left"
        type="feather"
        color={theme.colors.text}
        size={moderateScale(iconSize)}
      />
    </TouchableOpacity>
  );
};

const styles = ScaledSheet.create({
  backButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
