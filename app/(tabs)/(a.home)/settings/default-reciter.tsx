import React, {useState, useCallback} from 'react';
import {View, Text, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import SearchBar from '@/components/SearchBar';
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
  const styles = createStyles(theme);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const setDefaultReciter = useReciterStore(state => state.setDefaultReciter);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Helper function to check if a reciter has complete Quran
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
                <Text
                  style={[
                    styles.currentReciterName,
                    {color: theme.colors.text},
                  ]}>
                  {defaultReciter.name}
                </Text>
                <Text
                  style={[
                    styles.currentReciterMoshaf,
                    {color: theme.colors.textSecondary},
                  ]}>
                  {defaultReciter.rewayat[0].name}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchSection}>
          <Text style={[styles.searchLabel, {color: theme.colors.text}]}>
            Change Default Reciter
          </Text>
          <View style={styles.searchContainer}>
            <SearchBar
              placeholder="Search reciters..."
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
        </View>

        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.reciterList}
          ListEmptyComponent={
            <Text
              style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
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
      padding: moderateScale(20),
      marginBottom: verticalScale(20),
      borderRadius: moderateScale(12),
      marginHorizontal: moderateScale(15),
      marginTop: moderateScale(15),
    },
    currentReciterContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    currentReciterImage: {
      width: moderateScale(80),
      height: moderateScale(80),
      borderRadius: moderateScale(10),
      marginRight: moderateScale(15),
    },
    currentReciterInfo: {
      flex: 1,
    },
    currentReciterName: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      marginBottom: verticalScale(4),
    },
    currentReciterMoshaf: {
      fontSize: moderateScale(14),
    },
    searchSection: {
      paddingHorizontal: moderateScale(15),
    },
    searchLabel: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      marginBottom: verticalScale(10),
    },
    searchContainer: {
      marginBottom: verticalScale(15),
    },
    reciterList: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    emptyText: {
      fontSize: moderateScale(16),
      textAlign: 'center',
      paddingVertical: moderateScale(15),
    },
  });
