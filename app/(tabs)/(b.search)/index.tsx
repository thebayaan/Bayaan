import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
} from 'react-native';
import {Stack, useFocusEffect} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {SearchView} from '@/components/search/SearchView';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {USE_GLASS} from '@/hooks/useGlassProps';

// @ai-start
export default function SearchScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // iOS 27 only renders the search tab as the detached trailing pill while
  // `automaticallyActivatesSearch` is set on it (see app/(tabs)/_layout.tsx).
  // That same flag makes UIKit focus a native search bar the instant the tab
  // is selected, dropping the user straight into the keyboard instead of this
  // browse screen. UIKit performs that check once, at selection, and never
  // re-checks, so mounting the search bar from the screen's focus effect
  // leaves nothing for it to activate: the tab keeps its detached placement
  // and the keyboard stays down until the user taps the field. Mounting in
  // the effect rather than behind a timer keeps the bar part of the tab
  // transition, so it animates in with the screen instead of popping in.
  const [searchBarMounted, setSearchBarMounted] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setSearchBarMounted(true);
      return () => setSearchBarMounted(false);
    }, []),
  );

  const handleCancel = () => {
    setQuery('');
    setIsSearchActive(false);
    Keyboard.dismiss();
    inputRef.current?.blur();
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {USE_GLASS && searchBarMounted && (
        <Stack.SearchBar
          placement="automatic"
          placeholder={t('search.placeholder')}
          onChangeText={e => setQuery(e.nativeEvent.text)}
          onFocus={() => setIsSearchActive(true)}
          onCancelButtonPress={() => {
            setQuery('');
            setIsSearchActive(false);
          }}
          onClose={() => {
            setQuery('');
            setIsSearchActive(false);
          }}
          onBlur={() => {
            if (query.length === 0) {
              setIsSearchActive(false);
            }
          }}
          hideNavigationBar
        />
      )}
      {!USE_GLASS && (
        <View
          style={[
            styles.androidSearchContainer,
            {paddingTop: insets.top + moderateScale(12)},
          ]}>
          <View style={styles.androidSearchRow}>
            <View
              style={[
                styles.androidSearchBar,
                {
                  backgroundColor: Color(theme.colors.text)
                    .alpha(0.06)
                    .toString(),
                },
              ]}>
              <Feather
                name="search"
                size={moderateScale(18)}
                color={Color(theme.colors.text).alpha(0.4).toString()}
              />
              <TextInput
                ref={inputRef}
                style={[styles.androidSearchInput, {color: theme.colors.text}]}
                placeholder={t('search.placeholder')}
                placeholderTextColor={Color(theme.colors.text)
                  .alpha(0.35)
                  .toString()}
                value={query}
                onChangeText={text => {
                  setQuery(text);
                  if (text.length > 0) setIsSearchActive(true);
                }}
                onFocus={() => setIsSearchActive(true)}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Feather
                    name="x"
                    size={moderateScale(16)}
                    color={Color(theme.colors.text).alpha(0.4).toString()}
                  />
                </Pressable>
              )}
            </View>
            {isSearchActive && (
              <Pressable onPress={handleCancel} hitSlop={4}>
                <Text style={[styles.cancelText, {color: theme.colors.text}]}>
                  {t('common:actions.cancel')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      <SearchView
        visible={true}
        onClose={() => {
          setQuery('');
          setIsSearchActive(false);
        }}
        query={query}
        isSearchActive={isSearchActive}
        skipTopInset={!USE_GLASS}
      />
    </View>
  );
}
// @ai-end

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  androidSearchContainer: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(8),
  },
  androidSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  androidSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    height: moderateScale(42),
    gap: moderateScale(8),
  },
  androidSearchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-Regular',
    padding: 0,
  },
  cancelText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
  },
});
