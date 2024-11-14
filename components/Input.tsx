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
  sanitize?: boolean; // Add this prop to control sanitization
}

const sanitizeInput = (text: string): string => {
  // Remove any HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Remove special characters that could be used for XSS
  text = text.replace(/[&<>"'`=\\/]/g, '');

  // Trim whitespace
  text = text.trim();

  return text;
};

export const Input: React.FC<InputProps> = ({
  icon,
  style,
  rightIcon,
  onRightIconPress,
  iconColor,
  sanitize = true, // Default to true for security
  onChangeText,
  ...props
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const handleChangeText = (text: string) => {
    if (sanitize) {
      text = sanitizeInput(text);
    }
    onChangeText?.(text);
  };

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
        placeholderTextColor={iconColor || theme.colors.textSecondary}
        onChangeText={handleChangeText}
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
            color={iconColor || theme.colors.textSecondary}
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
      // borderWidth: moderateScale(0.5),
      borderColor: theme.colors.border,
      borderRadius: moderateScale(20),
      paddingHorizontal: moderateScale(15),
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
