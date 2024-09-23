import React, {useState, useImperativeHandle, forwardRef, useRef} from 'react';
import {View, TouchableOpacity, Text, TextInput} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SearchBarRef {
  focusSearchBar: () => void;
}

const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  ({placeholder, value, onChangeText, onFocus, onBlur}, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const handleFocus = () => {
      setIsFocused(true);
      if (onFocus) onFocus();
    };

    const handleBlur = () => {
      setIsFocused(false);
      if (onBlur) onBlur();
    };

    const handleCancel = () => {
      onChangeText('');
      inputRef.current?.blur();
    };

    useImperativeHandle(ref, () => ({
      focusSearchBar: () => inputRef.current?.focus(),
    }));

    return (
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <Icon
            name="search"
            type="feather"
            size={moderateScale(20)}
            color={theme.colors.textSecondary}
            containerStyle={styles.searchIcon}
            onPress={() => inputRef.current?.focus()}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText('')}>
              <Icon
                name="close"
                type="antdesign"
                size={moderateScale(20)}
                color={theme.colors.text}
                containerStyle={styles.clearIcon}
              />
            </TouchableOpacity>
          )}
        </View>
        {isFocused && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

SearchBar.displayName = 'SearchBar';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: moderateScale(20),
      paddingHorizontal: moderateScale(15),
      borderWidth: moderateScale(0.3),
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: moderateScale(10),
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: theme.typography.bodySize,
      fontFamily: theme.fonts.regular,
      height: moderateScale(33),
    },
    clearIcon: {
      marginLeft: moderateScale(10),
    },
    cancelButton: {
      marginLeft: moderateScale(10),
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: theme.typography.bodySize,
      fontFamily: theme.fonts.regular,
    },
  });

export default SearchBar;
