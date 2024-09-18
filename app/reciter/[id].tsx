import React, {useState, useEffect, useRef} from 'react';
import {View, Text, Image, TouchableOpacity, Animated} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {Icon} from '@rneui/themed';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {ProfileIcon} from '@/components/Icons';
import {LinearGradient} from 'expo-linear-gradient';
import SearchBar from '@/components/SearchBar';
import {SurahItem} from '@/components/SurahItem';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
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

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollThreshold = 250;

  const headerOpacity = scrollY.interpolate({
    inputRange: [150, scrollThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (typeof id === 'string') {
        const fetchedReciter = await getReciterById(id);
        if (fetchedReciter) {
          setReciter(fetchedReciter);
          const allSurahs = await getAllSurahs();
          const filteredSurahs = allSurahs.filter(
            surah =>
              fetchedReciter.surah_list?.includes(surah.id) ||
              fetchedReciter.surah_total === 114,
          );
          setSurahs(filteredSurahs);
          setFilteredSurahs(filteredSurahs);
        }
      }
    };
    fetchData();
  }, [id]);

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

  const handleSurahPress = (surah: Surah) => {
    router.push({
      pathname: '/audio-player',
      params: {
        surahId: surah.id,
        reciterId: id,
        surahName: surah.name,
        reciterName: reciter?.name || '',
        audioUrl: '', // We'll generate this in the AudioPlayer component
        // isFavorited: false,
        currentPosition: 0,
      },
    });
  };

  if (!reciter) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  const hasImage = reciter.image_url && reciter.image_url !== '';

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}>
        <View style={styles.headerContainer}>
          {hasImage ? (
            <Image
              source={{uri: reciter.image_url}}
              style={styles.reciterImage}
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <ProfileIcon
                color={theme.colors.light}
                size={moderateScale(200)}
              />
            </View>
          )}
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
              <TouchableOpacity style={styles.actionButton}>
                <Icon name="shuffle" type="feather" color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playButton}>
                <Icon
                  name="play"
                  type="feather"
                  color={theme.colors.background}
                  size={moderateScale(24)}
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
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backButton, {top: insets.top + verticalScale(10)}]}>
        <Icon
          name="arrow-left"
          type="feather"
          size={moderateScale(24)}
          color={'white'}
        />
      </TouchableOpacity>
    </View>
  );
}
