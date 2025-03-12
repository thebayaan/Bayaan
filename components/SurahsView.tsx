import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from '@react-native-community/blur';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
}

interface SurahCollection {
  id: string;
  title: string;
  surahs: number[];
  description?: string;
  color: string;
}

const FEATURED_COLLECTIONS: SurahCollection[] = [
  {
    id: 'heart-of-quran',
    title: 'Heart of Quran',
    surahs: [36, 55, 56, 67, 18],
    color: '#059669', // Emerald
  },
  {
    id: 'daily-adhkar',
    title: 'Daily Adhkar Surahs',
    surahs: [112, 113, 114, 1],
    color: '#7C3AED', // Purple
  },
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    description: 'Last 37 Surahs',
    surahs: Array.from({length: 37}, (_, i) => 78 + i),
    color: '#1E40AF', // Deep Blue
  },
  {
    id: 'seven-long',
    title: 'The Seven Long Surahs',
    description: "Al-Sab' Al-Tiwal",
    surahs: [2, 3, 4, 5, 6, 7, 9],
    color: '#DC2626', // Red
  },
];

const BY_THEME: SurahCollection[] = [
  {
    id: 'prophets',
    title: 'Stories of the Prophets',
    surahs: [12, 19, 28, 71, 21, 14],
    color: '#EA580C', // Orange
  },
  {
    id: 'mercy',
    title: 'Mercy and Forgiveness',
    surahs: [55, 40, 39, 9],
    color: '#0891B2', // Cyan
  },
  {
    id: 'faith',
    title: 'Faith and Belief',
    surahs: [112, 109, 103, 2],
    color: '#BE185D', // Pink
  },
];

const BY_LENGTH: SurahCollection[] = [
  {
    id: 'short',
    title: 'Short Surahs',
    description: 'Less than 20 verses',
    surahs: [108, 112, 103, 110],
    color: '#4F46E5', // Indigo
  },
  {
    id: 'medium',
    title: 'Medium Surahs',
    description: '20-100 verses',
    surahs: [36, 55, 56],
    color: '#B45309', // Amber
  },
  {
    id: 'long',
    title: 'Long Surahs',
    description: 'More than 100 verses',
    surahs: [2, 3, 4],
    color: '#047857', // Dark Emerald
  },
];

const BY_PERIOD: SurahCollection[] = [
  {
    id: 'meccan',
    title: 'Notable Meccan Surahs',
    surahs: [96, 74, 73, 93],
    color: '#9333EA', // Bright Purple
  },
  {
    id: 'medinan',
    title: 'Notable Medinan Surahs',
    surahs: [2, 8, 24, 49],
    color: '#EA580C', // Orange
  },
];

const SPECIAL_CATEGORIES: SurahCollection[] = [
  {
    id: 'most-loved',
    title: 'Most Loved by Community',
    surahs: [55, 36, 18, 56, 67],
    color: '#DC2626', // Red
  },
  {
    id: 'most-recited',
    title: 'Most Recited',
    surahs: [1, 2, 36, 67, 18],
    color: '#1E40AF', // Deep Blue
  },
];

const GRADIENT_COLORS = [
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Emerald
  '#DC2626', // Red
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#BE185D', // Pink
  '#4F46E5', // Indigo
  '#B45309', // Amber
  '#047857', // Dark Emerald
] as const;

const getRandomColors = (): readonly [string, string, string] => {
  // Fisher-Yates shuffle
  const shuffled = [...GRADIENT_COLORS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return [shuffled[0], shuffled[1], shuffled[2]] as const;
};

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const HeroSection = ({
  surah,
  onPress,
}: {
  surah: Surah;
  onPress: (surah: Surah) => void;
}) => {
  const {theme} = useTheme();
  const handlePress = React.useCallback(() => onPress(surah), [surah, onPress]);

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const gradientColors = React.useMemo((): readonly [
    string,
    string,
    string,
  ] => {
    const colors = getRandomColors();
    return [
      Color(colors[0]).alpha(0.9).toString(),
      Color(colors[1]).alpha(0.8).toString(),
      Color(colors[2]).alpha(0.7).toString(),
    ] as const;
  }, []);

  const styles = StyleSheet.create({
    hero: {
      marginHorizontal: moderateScale(16),
      marginBottom: moderateScale(16),
      borderRadius: moderateScale(25),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    content: {
      padding: moderateScale(16),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(16),
    },
    leftSection: {
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    heroGlyph: {
      fontSize: moderateScale(48),
      fontFamily: 'SurahNames',
      color: '#e8e8e8',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 4,
    },
    rightSection: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: verticalScale(4),
    },
    heroTitle: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      color: '#e8e8e8',
      letterSpacing: 1,
    },
    revelationPlace: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      backgroundColor: Color('#e8e8e8').alpha(0.1).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(6),
    },
    revelationText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      color: '#e8e8e8',
      textTransform: 'uppercase',
    },
    heroSurahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: '#e8e8e8',
      marginBottom: verticalScale(2),
    },
    translatedName: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: '#e8e8e8',
      marginBottom: verticalScale(8),
    },
    statsRow: {
      flexDirection: 'row',
      gap: moderateScale(16),
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Color('#e8e8e8').alpha(0.1).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(6),
    },
    statValue: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Bold',
      color: '#e8e8e8',
      marginRight: moderateScale(4),
    },
    statLabel: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: '#e8e8e8',
      textTransform: 'uppercase',
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Color(theme.colors.background).alpha(0.05).toString(),
    },
  });

  const revelationPlace = surah.revelation_place.toLowerCase();

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.7}
      style={[styles.hero, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0.8}}
        end={{x: 1, y: 0.2}}
        style={StyleSheet.absoluteFill}
      />
      <BlurView
        style={styles.blurOverlay}
        blurType={theme.isDarkMode ? 'dark' : 'light'}
        blurAmount={20}
      />
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={styles.heroGlyph}>{surahGlyphMap[surah.id]}</Text>
        </View>
        <View style={styles.rightSection}>
          <View style={styles.topRow}>
            <Text style={styles.heroTitle}>SURAH OF THE DAY</Text>
            <View style={styles.revelationPlace}>
              {revelationPlace === 'makkah' ? (
                <MakkahIcon size={moderateScale(12)} color="#e8e8e8" />
              ) : (
                <MadinahIcon size={moderateScale(12)} color="#e8e8e8" />
              )}
            </View>
          </View>
          <Text style={styles.heroSurahName}>{surah.name}</Text>
          <Text style={styles.translatedName}>
            {surah.translated_name_english}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.verses_count}</Text>
              <Text style={styles.statLabel}>Verses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.id}</Text>
              <Text style={styles.statLabel}>Number</Text>
            </View>
          </View>
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
};

const ItemSeparator = () => <View style={{width: moderateScale(8)}} />;

const CollectionSection = ({
  title,
  collection,
  onSurahPress,
}: {
  title: string;
  collection: SurahCollection;
  onSurahPress: (surah: Surah) => void;
}) => {
  const {theme} = useTheme();
  const styles = StyleSheet.create({
    section: {
      marginBottom: moderateScale(16),
    },
    sectionHeader: {
      marginBottom: moderateScale(8),
      paddingHorizontal: moderateScale(16),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: Color(collection.color).isDark()
        ? theme.colors.text
        : collection.color,
      marginBottom: verticalScale(2),
    },
    description: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      marginTop: verticalScale(2),
    },
    sectionContent: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(4),
    },
  });

  const surahs = collection.surahs.map(id => SURAHS[id - 1]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {collection.description && (
          <Text style={styles.description}>{collection.description}</Text>
        )}
      </View>
      <FlatList
        data={surahs}
        renderItem={({item}) => (
          <SurahCard
            id={item.id}
            name={item.name}
            translatedName={item.translated_name_english}
            versesCount={item.verses_count}
            revelationPlace={item.revelation_place}
            onPress={() => onSurahPress(item)}
            color={collection.color}
          />
        )}
        keyExtractor={item => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.sectionContent,
          {paddingRight: moderateScale(15) + moderateScale(8)},
        ]}
        snapToInterval={moderateScale(148)}
        decelerationRate="fast"
        snapToAlignment="start"
        ItemSeparatorComponent={ItemSeparator}
      />
    </View>
  );
};

export default function SurahsView({onSurahPress}: SurahsViewProps) {
  useTheme();
  const surahOfTheDay = React.useMemo(() => getSurahOfTheDay(), []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: verticalScale(32),
      }}
      showsVerticalScrollIndicator={false}>
      <HeroSection surah={surahOfTheDay} onPress={onSurahPress} />

      {SPECIAL_CATEGORIES.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={onSurahPress}
        />
      ))}

      {FEATURED_COLLECTIONS.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={onSurahPress}
        />
      ))}

      {BY_THEME.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={onSurahPress}
        />
      ))}

      {BY_LENGTH.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={onSurahPress}
        />
      ))}

      {BY_PERIOD.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={onSurahPress}
        />
      ))}
    </ScrollView>
  );
}
