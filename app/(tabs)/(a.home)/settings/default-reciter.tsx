import React, {useState, useCallback, useMemo} from 'react';
import {View, Text, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {SearchInput} from '@/components/SearchInput';
import {RECITERS, Reciter} from '@/data/reciterData';
import {ReciterItem} from '@/components/ReciterItem';
import {useReciterStore} from '@/store/reciterStore';
import {useRouter} from 'expo-router';
import {ReciterImage} from '@/components/ReciterImage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';

export default function DefaultReciterScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Reciter[]>([]);
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const setDefaultReciter = useReciterStore(state => state.setDefaultReciter);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const hasCompleteQuran = useCallback((reciter: Reciter) => {
    return reciter.rewayat.some(
      r => r.surah_list?.filter(id => id !== null).length === 114,
    );
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim() === '') {
        setSearchResults([]);
      } else {
        const filtered = RECITERS.filter(
          reciter =>
            hasCompleteQuran(reciter) &&
            reciter.name.toLowerCase().includes(query.toLowerCase()),
        );
        setSearchResults(filtered);
      }
    },
    [hasCompleteQuran],
  );

  const handleReciterSelect = useCallback(
    (reciter: Reciter) => {
      setDefaultReciter(reciter);
      router.back();
    },
    [router, setDefaultReciter],
  );

  const renderItem = useCallback(
    ({item}: {item: Reciter}) => {
      if (!hasCompleteQuran(item)) {
        return null;
      }

      return (
        <ReciterItem
          item={item}
          onPress={() => handleReciterSelect(item)}
          isSelected={defaultReciter?.id === item.id}
        />
      );
    },
    [handleReciterSelect, hasCompleteQuran, defaultReciter],
  );

  return (
    <View style={styles.container}>
      <Header title="Default Reciter" onBack={() => router.back()} />

      <View
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}>
        {defaultReciter && (
          <View style={styles.currentReciterContainer}>
            <View style={styles.currentReciterContent}>
              <ReciterImage
                imageUrl={defaultReciter.image_url || undefined}
                reciterName={defaultReciter.name}
                style={styles.currentReciterImage}
              />
              <View style={styles.currentReciterInfo}>
                <Text style={styles.currentReciterName}>
                  {defaultReciter.name}
                </Text>
                <Text style={styles.currentReciterMoshaf}>
                  {defaultReciter.rewayat[0].name}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchSection}>
          <Text style={styles.searchLabel}>CHANGE DEFAULT RECITER</Text>
          <SearchInput
            placeholder="Search reciters..."
            value={searchQuery}
            onChangeText={handleSearch}
            showCancelButton={false}
            iconColor={theme.colors.text}
            iconOpacity={0.25}
            placeholderTextColor={Color(theme.colors.text)
              .alpha(0.35)
              .toString()}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
            borderColor={Color(theme.colors.text).alpha(0.06).toString()}
            containerStyle={{paddingHorizontal: 0}}
          />
        </View>

        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.reciterList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim() === ''
                ? 'Only reciters with complete Quran are shown'
                : 'No reciters found'}
            </Text>
          }
        />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: moderateScale(16),
    },
    currentReciterContainer: {
      padding: moderateScale(16),
      marginBottom: verticalScale(16),
      borderRadius: moderateScale(14),
      marginHorizontal: moderateScale(15),
      marginTop: moderateScale(15),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    currentReciterContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    currentReciterImage: {
      width: moderateScale(72),
      height: moderateScale(72),
      borderRadius: moderateScale(10),
      marginRight: moderateScale(15),
    },
    currentReciterInfo: {
      flex: 1,
    },
    currentReciterName: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: verticalScale(4),
    },
    currentReciterMoshaf: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
    },
    searchSection: {
      paddingHorizontal: moderateScale(15),
    },
    searchLabel: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(8),
      marginLeft: moderateScale(2),
    },
    reciterList: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    emptyText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textAlign: 'center',
      paddingVertical: moderateScale(15),
    },
  });
