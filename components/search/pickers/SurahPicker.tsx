/**
 * SurahPicker — RFC-020 value picker for the `has-surah` dimension.
 *
 * Content-only single-select body: a searchable list of the 114 `SURAHS`
 * (number + transliterated name), a plain FlatList behind a filter TextInput
 * (deliberately no FlashList/LegendList — static 114-row list). Reports the
 * pick as `(String(Surah.id), Surah.name)`. Per-surah reciter counts are
 * intentionally omitted here — result counts are the destination's job, not
 * the picker's. Rendered inside `SearchFilters`' single persistent
 * `PickerSheet` Modal (one instance, content swaps), and only while its sheet
 * is open (lazy mounting).
 */
import React, {useCallback, useMemo, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SURAHS, type Surah} from '@/data/surahData';

export interface SurahPickerProps {
  onSelect: (value: string, displayName: string) => void;
}

export default function SurahPicker({onSelect}: SurahPickerProps) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const filteredSurahs = useMemo<Surah[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      surah =>
        String(surah.id) === q ||
        surah.name.toLowerCase().includes(q) ||
        surah.translated_name_english.toLowerCase().includes(q),
    );
  }, [query]);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<Surah>) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onSelect(String(item.id), item.name)}
        accessibilityRole="button"
        accessibilityLabel={`${item.id}. ${item.name}`}
        activeOpacity={0.7}>
        <Text style={styles.rowText}>
          {item.id}. {item.name}
        </Text>
      </TouchableOpacity>
    ),
    [styles, onSelect],
  );

  return (
    <>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search surahs"
          placeholderTextColor={Color(theme.colors.textSecondary)
            .alpha(0.6)
            .toString()}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search surahs"
        />
      </View>
      <FlatList
        data={filteredSurahs}
        keyExtractor={surah => String(surah.id)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + moderateScale(24),
        }}
        renderItem={renderItem}
      />
    </>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    searchWrap: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(4),
    },
    searchInput: {
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
    },
    row: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    rowText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
  });
}
