import React, {forwardRef} from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  View,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  onPressIn?: () => void;
  onPressOut?: () => void;
}

export type ButtonRef = React.ComponentRef<typeof TouchableOpacity>;

export const Button = forwardRef<ButtonRef, ButtonProps>(({
  title,
  onPress,
  style,
  textStyle,
  backgroundColor,
  textColor,
  size = 'medium',
  borderRadius,
  borderWidth,
  borderColor,
  disabled = false,
  icon,
  loading = false,
  onPressIn,
  onPressOut,
  ...props
}, ref) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const buttonStyle = [
    styles.button,
    styles[size],
    backgroundColor && {backgroundColor},
    borderRadius !== undefined && {borderRadius},
    borderWidth !== undefined && {borderWidth},
    borderColor && {borderColor},
    disabled && styles.disabledButton,
    style,
  ].filter(Boolean) as StyleProp<ViewStyle>;

  const buttonTextStyle = [
    styles.buttonText,
    styles[`${size}Text` as keyof typeof styles],
    textColor && {color: textColor},
    disabled && styles.disabledButtonText,
    textStyle,
  ].filter(Boolean) as StyleProp<TextStyle>;

  return (
    <TouchableOpacity
      ref={ref}
      activeOpacity={0.99}
      style={buttonStyle}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      {...props}>
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            color={theme.colors.background}
            style={styles.loadingIndicator}
          />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={buttonTextStyle}>{title}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    button: {
      backgroundColor: theme.colors.primary,
      padding: moderateScale(12),
      borderRadius: moderateScale(8),
      marginTop: moderateScale(12),
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: moderateScale(24),
    },
    iconContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(8),
    },
    loadingIndicator: {
      marginHorizontal: moderateScale(8),
    },
    buttonText: {
      color: 'white',
      fontFamily: theme.fonts.regular,
      fontSize: moderateScale(20),
    },
    small: {
      padding: moderateScale(8),
      minWidth: moderateScale(100),
    },
    medium: {
      padding: moderateScale(10),
      minWidth: moderateScale(150),
    },
    large: {
      padding: moderateScale(16),
      minWidth: moderateScale(200),
    },
    smallText: {
      fontSize: moderateScale(14),
    },
    mediumText: {
      fontSize: moderateScale(16),
    },
    largeText: {
      fontSize: moderateScale(18),
    },
    disabledButton: {
      opacity: 0.5,
    },
    disabledButtonText: {
      color: theme.colors.light,
    },
  });
