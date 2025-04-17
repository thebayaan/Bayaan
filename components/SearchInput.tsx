import React, {forwardRef} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import Color from 'color';

export interface SearchInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onCancel?: () => void;
  onClose?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showCancelButton?: boolean;
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  iconColor: string;
  placeholderTextColor?: string;
  textColor: string;
  cancelButtonStyle?: ViewStyle;
  cancelButtonTextStyle?: TextStyle;
  cancelButtonText?: string;
  iconSize?: number;
  iconOpacity?: number;
  backgroundColor: string;
  borderColor: string;
  keyboardAppearance?: 'default' | 'light' | 'dark';
  autoCorrect?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}

export const SearchInput = forwardRef<TextInput, SearchInputProps>(
  (
    {
      value,
      onChangeText,
      onCancel,
      onClose,
      placeholder = 'Search',
      showCancelButton = true,
      containerStyle,
      inputStyle,
      iconColor,
      placeholderTextColor,
      textColor,
      cancelButtonStyle,
      cancelButtonTextStyle,
      cancelButtonText = 'Cancel',
      iconSize = moderateScale(16),
      iconOpacity = 0.8,
      backgroundColor,
      borderColor,
      style,
      keyboardAppearance,
      autoCorrect = false,
      autoCapitalize = 'none',
      ...props
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    return (
      <View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor,
              borderColor,
            },
            style,
          ]}>
          <View style={styles.searchIconContainer}>
            <Icon
              name="search"
              type="feather"
              size={iconSize}
              color={iconColor}
              style={{opacity: iconOpacity}}
            />
          </View>
          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: textColor,
              },
              inputStyle,
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={
              placeholderTextColor || Color(textColor).alpha(0.6).toString()
            }
            returnKeyType="search"
            keyboardAppearance={
              keyboardAppearance || (theme.isDarkMode ? 'dark' : 'light')
            }
            autoCorrect={autoCorrect}
            autoCapitalize={autoCapitalize}
            {...props}
            autoFocus={false}
          />
        </View>
        {showCancelButton && onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.7}
            style={[styles.cancelButton, cancelButtonStyle]}>
            <Text
              style={[
                styles.cancelText,
                {color: textColor},
                cancelButtonTextStyle,
              ]}>
              {cancelButtonText}
            </Text>
          </TouchableOpacity>
        )}
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}>
            <Icon
              name="x"
              type="feather"
              size={moderateScale(24)}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

SearchInput.displayName = 'SearchInput';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(4),
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      borderWidth: 1,
      paddingHorizontal: moderateScale(12),
      height: moderateScale(40),
    },
    searchIconContainer: {
      paddingHorizontal: moderateScale(8),
    },
    input: {
      flex: 1,
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      paddingVertical: 0,
      textAlignVertical: 'center',
      height: moderateScale(40),
    },
    cancelButton: {
      paddingVertical: moderateScale(4),
    },
    cancelText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      opacity: 0.8,
    },
    closeButton: {
      marginLeft: moderateScale(12),
      padding: moderateScale(10),
      width: moderateScale(44),
      height: moderateScale(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
