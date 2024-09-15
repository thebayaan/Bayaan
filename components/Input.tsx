import React from 'react';
import {TextInput, View, TextInputProps, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {TextStyle} from 'react-native';

interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  rightIcon?: string;
  onRightIconPress?: () => void;
  iconColor?: string;
}

export const Input: React.FC<InputProps> = ({
  icon,
  style,
  rightIcon,
  onRightIconPress,
  iconColor,
  ...props
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const inputStyle = [
    styles.input,
    icon && styles.inputWithIcon,
    rightIcon && styles.inputWithRightIcon,
    style,
  ].filter(Boolean) as TextStyle[];

  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <TextInput
        style={inputStyle}
        placeholderTextColor={iconColor || theme.colors.light}
        {...props}
      />
      {rightIcon && (
        <TouchableOpacity
          style={styles.rightIconContainer}
          onPress={onRightIconPress}>
          <Icon
            type="antdesign"
            name={rightIcon}
            size={moderateScale(20)}
            color={iconColor || theme.colors.light}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      width: '100%',
      marginBottom: moderateScale(15),
    },
    input: {
      height: moderateScale(50),
      borderWidth: moderateScale(0.5),
      borderColor: theme.colors.border,
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(10),
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    inputWithIcon: {
      paddingLeft: moderateScale(40),
    },
    inputWithRightIcon: {
      paddingRight: moderateScale(40),
    },
    iconContainer: {
      position: 'absolute',
      left: moderateScale(15),
      top: moderateScale(13),
      zIndex: 1,
    },
    rightIconContainer: {
      position: 'absolute',
      right: moderateScale(15),
      top: moderateScale(13),
      zIndex: 1,
    },
    placeholderColor: {
      color: theme.colors.light,
    },
    rightIcon: {
      color: theme.colors.light,
    },
  });
