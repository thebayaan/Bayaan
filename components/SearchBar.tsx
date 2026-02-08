import React, {useState, useImperativeHandle, forwardRef, useRef} from 'react';
import {Pressable, Text, TextInput, Animated, View} from 'react-native';
import {Feather, AntDesign} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {MotiView} from 'moti';

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  keyboardAppearance?: 'default' | 'light' | 'dark';
  autoCorrect?: boolean;
  autoComplete?: 'off' | 'name' | 'email' | 'password';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export interface SearchBarRef {
  focusSearchBar: () => void;
}

const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      placeholder,
      value,
      onChangeText,
      onFocus,
      onBlur,
      keyboardAppearance,
      autoCorrect = false,
      autoComplete = 'off',
      autoCapitalize = 'none',
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const iconRotation = useRef(new Animated.Value(0)).current;

    const handleFocus = () => {
      setIsFocused(true);
      if (onFocus) onFocus();
      Animated.spring(iconRotation, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const handleBlur = () => {
      setIsFocused(false);
      if (onBlur) onBlur();
      Animated.spring(iconRotation, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    };

    const handleCancel = () => {
      onChangeText('');
      inputRef.current?.blur();
    };

    useImperativeHandle(ref, () => ({
      focusSearchBar: () => inputRef.current?.focus(),
    }));

    const spin = iconRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <MotiView
        style={styles.container}
        animate={{
          width: isFocused ? '95%' : '100%',
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 300,
        }}>
        <MotiView
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
          ]}
          animate={{
            scale: isFocused ? 1.02 : 1,
          }}>
          <Animated.View
            style={[
              styles.searchIcon,
              {
                transform: [{rotate: spin}],
              },
            ]}>
            <Pressable onPress={() => inputRef.current?.focus()}>
              <Feather
                name="search"
                size={moderateScale(20)}
                color={
                  isFocused ? theme.colors.text : theme.colors.textSecondary
                }
              />
            </Pressable>
          </Animated.View>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            value={value}
            onChangeText={text => {
              const sanitizedText = text
                .slice(0, 100)
                .replace(/[^\w\s\u0600-\u06FF-]/gi, '');
              onChangeText(sanitizedText);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            returnKeyType="search"
            maxLength={100}
            keyboardAppearance={
              keyboardAppearance || (theme.isDarkMode ? 'dark' : 'light')
            }
            autoCorrect={autoCorrect}
            autoComplete={autoComplete}
            autoCapitalize={autoCapitalize}
          />
          {value.length > 0 && (
            <MotiView
              from={{opacity: 0, scale: 0}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0}}>
              <Pressable onPress={() => onChangeText('')}>
                <View style={styles.clearIcon}>
                  <AntDesign
                    name="close"
                    size={moderateScale(20)}
                    color={theme.colors.text}
                  />
                </View>
              </Pressable>
            </MotiView>
          )}
        </MotiView>
        {isFocused && (
          <MotiView
            from={{opacity: 0, translateX: 20}}
            animate={{opacity: 1, translateX: 0}}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </MotiView>
        )}
      </MotiView>
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
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(15),
      borderWidth: 1,
      borderColor: 'transparent',
      height: moderateScale(45),
    },
    inputContainerFocused: {
      borderWidth: 0.1,
      borderColor: theme.colors.textSecondary,
      shadowColor: theme.colors.textSecondary,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    searchIcon: {
      marginRight: moderateScale(10),
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: theme.typography.bodySize,
      fontFamily: theme.fonts.regular,
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
