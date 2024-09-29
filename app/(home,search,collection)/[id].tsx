import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {LinearGradient} from 'expo-linear-gradient';
import SearchBar from '@/components/SearchBar';
import {SurahItem} from '@/components/SurahItem';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {usePlayerStore} from '@/store/playerStore';
import {ReciterImage} from '@/components/ReciterImage';
import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
import {usePlayback} from '@/hooks/usePlayback';

export default function ReciterProfile() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {id} = useLocalSearchParams();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  usePlayerStore();

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollThreshold = 250;

  const headerOpacity = scrollY.interpolate({
    inputRange: [150, scrollThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const [isHeaderVisible, setIsHeaderVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (typeof id === 'string') {
        const fetchedReciter = await getReciterById(id);
        if (fetchedReciter) {
          setReciter(fetchedReciter);
          const allSurahs = await getAllSurahs();
          const surahsMatchingReciter = allSurahs.filter(
            surah =>
              fetchedReciter.surah_list?.includes(surah.id) ||
              fetchedReciter.surah_total === 114,
          );
          setSurahs(surahsMatchingReciter);
          setFilteredSurahs(surahsMatchingReciter);
        }
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    const listener = headerOpacity.addListener(({value}) => {
      if (value === 1 && !isHeaderVisible) {
        setIsHeaderVisible(true);
      } else if (value < 1 && isHeaderVisible) {
        setIsHeaderVisible(false);
      }
    });

    return () => headerOpacity.removeListener(listener);
  }, [headerOpacity, isHeaderVisible]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const lowercaseQuery = query.toLowerCase().trim();
    const filtered = surahs.filter(
      surah =>
        surah.name.toLowerCase().includes(lowercaseQuery) ||
        surah.name_arabic.includes(query) ||
        surah.translated_name_english.toLowerCase().includes(lowercaseQuery) ||
        surah.id.toString().includes(lowercaseQuery),
    );
    setFilteredSurahs(filtered);
  };

  const {navigateToPlayer} = usePlayerNavigation();
  const {playTrack, playAll} = usePlayback();

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (reciter) {
        await playTrack(reciter, surah.id.toString());
        navigateToPlayer(reciter.image_url);
      }
    },
    [reciter, playTrack, navigateToPlayer],
  );

  const handlePlayAll = useCallback(() => {
    if (reciter) {
      playAll(reciter, filteredSurahs);
      navigateToPlayer(reciter.image_url);
    }
  }, [reciter, filteredSurahs, playAll, navigateToPlayer]);

  const handleShuffleAll = useCallback(() => {
    if (reciter) {
      playAll(reciter, filteredSurahs, true);
      navigateToPlayer(reciter.image_url);
    }
  }, [reciter, filteredSurahs, playAll, navigateToPlayer]);

  if (!reciter) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator />
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}>
        <View style={styles.headerContainer}>
          <ReciterImage
            imageUrl={reciter.image_url}
            style={styles.reciterImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.gradientOverlay}
          />
          <View style={styles.reciterInfoOverlay}>
            <Text style={styles.reciterName}>{reciter.name}</Text>
            <Text style={styles.reciterStyle}>{reciter.moshaf_name}</Text>
          </View>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="heart" type="feather" color={theme.colors.primary} />
            </TouchableOpacity>
            <View style={styles.rightAlignedButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShuffleAll}>
                <Icon name="shuffle" type="feather" color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayAll}>
                <Icon
                  name="controller-play"
                  type="entypo"
                  color={theme.colors.background}
                  size={moderateScale(40)}
                  containerStyle={styles.playButtonIcon}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder="Search Surahs"
              onChangeText={handleSearch}
              value={searchQuery}
            />
          </View>
          {filteredSurahs.map(surah => (
            <SurahItem
              key={surah.id}
              item={surah}
              onPress={() => handleSurahPress(surah)}
            />
          ))}
        </View>
      </Animated.ScrollView>
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
            paddingTop: insets.top,
          },
        ]}>
        <Text style={styles.stickyReciterName}>{reciter.name}</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.backButton,
          {
            backgroundColor: headerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(0, 0, 0, 0.2)', 'transparent'],
            }),
            top: insets.top,
            left: moderateScale(20),
          },
        ]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
