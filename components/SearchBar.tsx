import React, {useState, useImperativeHandle, forwardRef, useRef} from 'react';
import {TouchableOpacity, Text, TextInput, Animated} from 'react-native';
import {Icon} from '@rneui/themed';
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
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color={isFocused ? theme.colors.text : theme.colors.textSecondary}
              onPress={() => inputRef.current?.focus()}
            />
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
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            maxLength={100}
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          />
          {value.length > 0 && (
            <MotiView
              from={{opacity: 0, scale: 0}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0}}>
              <TouchableOpacity
                activeOpacity={0.99}
                onPress={() => onChangeText('')}>
                <Icon
                  name="close"
                  type="antdesign"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                  containerStyle={styles.clearIcon}
                />
              </TouchableOpacity>
            </MotiView>
          )}
        </MotiView>
        {isFocused && (
          <MotiView
            from={{opacity: 0, translateX: 20}}
            animate={{opacity: 1, translateX: 0}}>
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles.cancelButton}
              onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
