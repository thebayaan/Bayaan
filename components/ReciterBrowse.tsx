import React, {useState, useCallback, useEffect, useMemo} from 'react';
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
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';

interface ReciterBrowseProps {
  initialView?: string;
  surahId?: string;
}

const ReciterBrowse = ({surahId, initialView = 'all'}: ReciterBrowseProps) => {
  const router = useRouter();
  const {theme} = useTheme();
  const [activeView, setActiveView] = useState(initialView);
  const [searchQuery, setSearchQuery] = useState('');
  const {isFavoriteReciter} = useFavoriteReciters();
  const insets = useSafeAreaInsets();
  const [_surahName, setSurahName] = useState<string>('');
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();

  const filteredReciters = useMemo(() => {
    let filtered = RECITERS;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        reciter =>
          reciter.name.toLowerCase().includes(query) ||
          reciter.rewayat.some(
            rewayat =>
              rewayat.name.toLowerCase().includes(query) ||
              rewayat.style.toLowerCase().includes(query),
          ),
      );
    }

    if (surahId) {
      const surahNumber = parseInt(surahId, 10);
      if (!isNaN(surahNumber)) {
        filtered = filtered.filter(reciter =>
          reciter.rewayat.some(rewayat =>
            rewayat.surah_list?.includes(surahNumber),
          ),
        );
      }
    }

    if (activeView === 'favorites') {
      filtered = filtered.filter(reciter => isFavoriteReciter(reciter.id));
    }

    return filtered;
  }, [activeView, isFavoriteReciter, searchQuery, surahId]);

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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleToggleView = useCallback((view: string) => {
    setActiveView(view);
  }, []);

  const handleReciterSelect = useCallback(
    async (reciter: Reciter) => {
      if (!surahId) {
        console.error('Missing surahId');
        return;
      }

      const surahNumber = parseInt(surahId, 10);
      if (
        !reciter.rewayat.some(rewayat =>
          rewayat.surah_list?.includes(surahNumber),
        )
      ) {
        console.error('Reciter does not have this surah');
        return;
      }

      try {
        const surah = await getSurahById(surahNumber);
        if (!surah) return;

        // Create track for the selected surah
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          reciter.rewayat[0]?.id,
        );

        // Update queue and start playing
        await updateQueue(tracks, 0);
        await play();

        // Add to recently played list
        await addRecentTrack(reciter, surah, 0, 0);

        // Set current reciter for batch loading
        queueContext.setCurrentReciter(reciter);

        router.back();
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [surahId, updateQueue, play, queueContext, router, addRecentTrack],
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
          activeOpacity={0.99}
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
          keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="none"
        />
      </View>
      <View style={createStyles(theme).toggleContainer}>
        <TouchableOpacity
          activeOpacity={0.99}
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
          activeOpacity={0.99}
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
        keyboardShouldPersistTaps="handled"
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
