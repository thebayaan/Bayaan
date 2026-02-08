import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

interface InputProps extends TextInputProps {
  label?: string;
  showIcon?: boolean;
  iconName?: string;
  error?: string;
  helperText?: string;
  showCharacterCount?: boolean;
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  showIcon = false,
  iconName = 'edit-3',
  error,
  helperText,
  showCharacterCount = false,
  maxLength,
  value,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  ...textInputProps
}) => {
  const {theme, isDarkMode} = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label with optional icon */}
      {label && (
        <View style={styles.labelRow}>
          {showIcon && (
            <Feather
              name={iconName as any}
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          )}
          <Text
            style={[
              styles.label,
              {
                color: theme.colors.text,
                marginLeft: showIcon ? moderateScale(8) : 0,
              },
            ]}>
            {label}
          </Text>
        </View>
      )}

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.card,
            borderColor: error
              ? '#EF4444'
              : Color(theme.colors.border).alpha(0.3).toString(),
          },
          inputContainerStyle,
        ]}>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.text,
            },
            inputStyle,
          ]}
          placeholderTextColor={Color(theme.colors.textSecondary)
            .alpha(0.5)
            .toString()}
          keyboardAppearance={isDarkMode ? 'dark' : 'light'}
          maxLength={maxLength}
          value={value}
          {...textInputProps}
        />
      </View>

      {/* Footer (Error/Helper Text and Character Count) */}
      {(error || helperText || (showCharacterCount && maxLength)) && (
        <View style={styles.footer}>
          {(error || helperText) && (
            <Text
              style={[
                styles.helperText,
                {
                  color: error ? '#EF4444' : theme.colors.textSecondary,
                },
              ]}>
              {error || helperText}
            </Text>
          )}
          {showCharacterCount && maxLength && (
            <Text
              style={[
                styles.characterCount,
                {
                  color:
                    (value?.length || 0) > maxLength * 0.9
                      ? '#EF4444'
                      : theme.colors.textSecondary,
                },
              ]}>
              {value?.length || 0}/{maxLength} characters
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: moderateScale(24),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  label: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 0.2,
  },
  inputContainer: {
    borderWidth: 1.5,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
  },
  footer: {
    marginTop: moderateScale(8),
    paddingHorizontal: moderateScale(4),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
    flex: 1,
  },
  characterCount: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
  },
});
