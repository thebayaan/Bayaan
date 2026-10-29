import React from 'react';
import {Pressable, ViewStyle, StyleProp} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useNavigation} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
// @ai-start
import {flipX, isRTL} from '@/utils/rtl';
// @ai-end

interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

// @ai-start
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
      style={[
        styles.backButton,
        style,
        {marginStart: isRTL ? insets.right : insets.left},
      ]}
      onPress={handlePress}>
      <Feather
        name="arrow-left"
        color={theme.colors.text}
        size={moderateScale(iconSize)}
        style={flipX}
      />
    </Pressable>
  );
};
// @ai-end

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
