import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from '@rneui/themed';
import SearchBar from '@/components/SearchBar';
import {RECITERS, Reciter} from '@/data/reciterData';
import {ReciterItem} from '@/components/ReciterItem';
import {Theme} from '@/utils/themeUtils';

export default function ReciterBrowseScreen() {
  const {view} = useLocalSearchParams<{
    view: string;
    surahId: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();
  const [activeView, setActiveView] = useState(view);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredReciters, setFilteredReciters] = useState<Reciter[]>(RECITERS);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    const filtered = RECITERS.filter(reciter =>
      reciter.name.toLowerCase().includes(query.toLowerCase()),
    );
    setFilteredReciters(filtered);
  }, []);

  const handleReciterSelect = useCallback((reciter: Reciter) => {
    // Implement reciter selection logic here
    console.log('Selected reciter:', reciter);
  }, []);

  return (
    <SafeAreaView
      style={[
        createStyles(theme).container,
        {backgroundColor: theme.colors.background},
      ]}>
      <View style={createStyles(theme).header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={createStyles(theme).backButton}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text
          style={[createStyles(theme).headerTitle, {color: theme.colors.text}]}>
          Browse Reciters
        </Text>
      </View>
      <View style={createStyles(theme).searchBarContainer}>
        <SearchBar
          placeholder="Search reciters..."
          onChangeText={handleSearch}
          value={searchQuery}
        />
      </View>
      <View style={createStyles(theme).toggleContainer}>
        <TouchableOpacity
          style={[
            createStyles(theme).toggleButton,
            activeView === 'all' && createStyles(theme).activeToggleButton,
          ]}
          onPress={() => setActiveView('all')}>
          <Text
            style={[
              createStyles(theme).toggleButtonText,
              activeView === 'all' &&
                createStyles(theme).activeToggleButtonText,
            ]}>
            All Reciters
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            createStyles(theme).toggleButton,
            activeView === 'favorites' &&
              createStyles(theme).activeToggleButton,
          ]}
          onPress={() => setActiveView('favorites')}>
          <Text
            style={[
              createStyles(theme).toggleButtonText,
              activeView === 'favorites' &&
                createStyles(theme).activeToggleButtonText,
            ]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredReciters}
        renderItem={({item}) => (
          <ReciterItem item={item} onPress={handleReciterSelect} />
        )}
        keyExtractor={item => item.id}
        style={createStyles(theme).reciterList}
        ListEmptyComponent={
          <Text
            style={[
              createStyles(theme).emptyText,
              {color: theme.colors.textSecondary},
            ]}>
            No reciters found
          </Text>
        }
      />
    </SafeAreaView>
  );
}

export const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      paddingVertical: verticalScale(10),
    },
    backButton: {
      padding: moderateScale(10),
      marginRight: moderateScale(10),
      borderRadius: moderateScale(20),
      color: theme.colors.text,
    },
    headerTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
    },
    searchBarContainer: {
      paddingHorizontal: moderateScale(15),
      marginBottom: verticalScale(10),
    },
    toggleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingBottom: verticalScale(10),
    },
    toggleButton: {
      paddingVertical: verticalScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(25),
      marginHorizontal: moderateScale(4),
    },
    activeToggleButton: {
      backgroundColor: theme.colors.text,
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
    },
    toggleButtonText: {
      fontSize: moderateScale(16),
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    activeToggleButtonText: {
      color: theme.colors.background,
    },
    reciterList: {
      paddingHorizontal: moderateScale(15),
    },
    emptyText: {
      fontSize: moderateScale(16),
      textAlign: 'center',
      marginTop: verticalScale(20),
    },
  });
