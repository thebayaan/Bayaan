import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {SearchView} from '@/components/search/SearchView';
import {SearchViewV2} from '@/components/search/v2/SearchViewV2';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useFeatureFlag} from '@/utils/featureFlags';
import type {RankedResult} from '@/services/search/types';

export default function SearchScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const router = useRouter();
  const flagOn = useFeatureFlag('search.v2', false);

  const handleV2ResultPress = (r: RankedResult): void => {
    switch (r.payload.kind) {
      case 'reciter':
        router.push({
          pathname: '/(tabs)/(b.search)/reciter/[id]',
          params: {id: r.payload.reciter.id, name: r.payload.reciter.name},
        });
        return;
      case 'surah':
        router.push({
          pathname: '/mushaf',
          params: {surah: r.payload.surah.id.toString()},
        });
        return;
      case 'rewayat':
        console.warn(
          '[search.v2] rewayat route not implemented yet',
          r.payload.rewayat.id,
        );
        return;
      case 'adhkar_category':
        console.warn(
          '[search.v2] adhkar_category route not implemented yet',
          r.payload.categoryId,
        );
        return;
      case 'name_of_allah':
        console.warn(
          '[search.v2] name_of_allah route not implemented yet',
          r.payload.index,
        );
        return;
      case 'playlist':
        console.warn(
          '[search.v2] playlist route not implemented yet',
          r.payload.playlistId,
        );
        return;
      case 'numeric_ref': {
        const ref = r.payload.ref;
        const params =
          ref.kind === 'verse'
            ? {surah: ref.surah, ayah: ref.ayah}
            : ref.kind === 'page'
              ? {page: ref.page}
              : ref.kind === 'juz'
                ? {juz: ref.juz}
                : {surah: ref.surah};
        router.push({pathname: '/mushaf', params});
        return;
      }
    }
  };

  const handleCancel = () => {
    setQuery('');
    setIsSearchActive(false);
    Keyboard.dismiss();
    inputRef.current?.blur();
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {USE_GLASS && (
        <Stack.SearchBar
          placement="automatic"
          placeholder="Search surahs or reciters"
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
                placeholder="Search surahs or reciters"
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
                  Cancel
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {flagOn ? (
        <SearchViewV2
          query={query}
          isSearchActive={isSearchActive}
          onResultPress={handleV2ResultPress}
        />
      ) : (
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
      )}
    </View>
  );
}

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
