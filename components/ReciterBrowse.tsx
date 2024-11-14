import React, {useState, useCallback, useEffect} from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import SearchBar from '@/components/SearchBar';
import {RECITERS, Reciter} from '@/data/reciterData';
import {ReciterItem} from '@/components/ReciterItem';
import {Theme} from '@/utils/themeUtils';
import {getSurahById} from '@/services/dataService';
import {usePlayerStore} from '@/store/playerStore';
import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
import {usePlayback} from '@/hooks/usePlayback';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface ReciterBrowseProps {
  initialView?: string;
  surahId?: string;
}

const ReciterBrowse: React.FC<ReciterBrowseProps> = ({
  initialView = 'all',
  surahId,
}) => {
  const router = useRouter();
  const {theme} = useTheme();
  const [activeView, setActiveView] = useState(initialView);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredReciters, setFilteredReciters] = useState<Reciter[]>(RECITERS);
  const [, setSurahName] = useState<string>('');
  usePlayerStore();
  const {favoriteReciters} = useFavoriteReciters();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchSurahName = async () => {
      if (surahId) {
        const surahIdNumber = parseInt(surahId, 10);
        if (!isNaN(surahIdNumber)) {
          const surah = await getSurahById(surahIdNumber);
          if (surah) {
            setSurahName(surah.name);
          }
        }
      }
    };
    fetchSurahName();
  }, [surahId]);

  const applyFilters = useCallback(
    (query: string, showFavorites: boolean) => {
      let filtered = RECITERS;
      if (showFavorites) {
        filtered = filtered.filter(reciter =>
          favoriteReciters.some(fav => fav.id === reciter.id),
        );
      }
      if (query) {
        filtered = filtered.filter(reciter =>
          reciter.name.toLowerCase().includes(query.toLowerCase()),
        );
      }
      setFilteredReciters(filtered);
    },
    [favoriteReciters],
  );

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      applyFilters(query, activeView === 'favorites');
    },
    [applyFilters, activeView],
  );

  const handleToggleView = useCallback(
    (view: string) => {
      setActiveView(view);
      applyFilters(searchQuery, view === 'favorites');
    },
    [applyFilters, searchQuery],
  );

  const {navigateToPlayer} = usePlayerNavigation();
  const {playTrack} = usePlayback();

  const handleReciterSelect = useCallback(
    async (reciter: Reciter) => {
      if (!surahId) {
        console.error('Missing surahId');
        return;
      }
      playTrack(reciter, surahId);
      navigateToPlayer(reciter.image_url);
    },
    [surahId, playTrack, navigateToPlayer],
  );

  return (
    <View
      style={[
        createStyles(theme).container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
      ]}>
      <View style={createStyles(theme).header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={createStyles(theme).backButton}>
          <Icon
            name="chevron-thin-left"
            type="entypo"
            size={moderateScale(20)}
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
          onPress={() => handleToggleView('all')}>
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
          onPress={() => handleToggleView('favorites')}>
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
    </View>
  );
};

export default ReciterBrowse;

const createStyles = (theme: Theme) =>
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
