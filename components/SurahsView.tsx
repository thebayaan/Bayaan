import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';

import {SurahHeroSection} from '@/components/SurahHeroSection';
import {BrowseAllHeroSection} from '@/components/BrowseAllHeroSection';
import {getRandomColors} from '@/utils/gradientColors';

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

// Cache for gradient colors to prevent recalculating on every render

interface ThemeType {
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    background: string;
    backgroundSecondary: string;
  };
  isDarkMode: boolean;
  fonts: {
    regular: string;
    medium: string;
    bold: string;
    semiBold: string;
  };
}

// Helper function to actually generate the colors

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

// Create the AnimatedTouchableOpacity component once, outside of render functions

// Create a function to generate collection styles based on theme and collection color
const createCollectionStyles = (theme: ThemeType, collectionColor: string) =>
  StyleSheet.create({
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
      color: Color(collectionColor).isDark()
        ? theme.colors.text
        : collectionColor,
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
  // Use the extracted styles with memoization
  const styles = React.useMemo(
    () => createCollectionStyles(theme, collection.color),
    [theme, collection.color],
  );

  // Memoize the surahs array to avoid recreating on each render
  const surahs = React.useMemo(
    () => collection.surahs.map(id => SURAHS[id - 1]),
    [collection.surahs],
  );

  // Memoize the renderItem function to avoid recreating on each render
  const renderItem = React.useCallback(
    ({item}: {item: Surah}) => (
      <SurahCard
        id={item.id}
        name={item.name}
        translatedName={item.translated_name_english}
        versesCount={item.verses_count}
        revelationPlace={item.revelation_place}
        onPress={() => onSurahPress(item)}
        color={collection.color}
      />
    ),
    [collection.color, onSurahPress],
  );

  // Memoize the keyExtractor function
  const keyExtractor = React.useCallback(
    (item: Surah) => `surah-${item.id}`,
    [],
  );

  // Memoize the content container style
  const contentContainerStyle = React.useMemo(
    () => [
      styles.sectionContent,
      {paddingRight: moderateScale(15) + moderateScale(8)},
    ],
    [styles.sectionContent],
  );

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
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        snapToInterval={moderateScale(148)}
        decelerationRate="fast"
        snapToAlignment="start"
        ItemSeparatorComponent={ItemSeparator}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
      />
    </View>
  );
};

// Main component styles
const mainStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: verticalScale(0),
    paddingBottom: verticalScale(100),
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: verticalScale(8),
  },
  sectionHeader: {
    fontSize: moderateScale(22),
    fontFamily: 'Manrope-Bold',
    marginVertical: verticalScale(8),
    paddingHorizontal: moderateScale(16),
  },
});

// Simple section header component
const SectionHeader = React.memo(({title}: {title: string}) => {
  const {theme} = useTheme();
  return (
    <Text style={[mainStyles.sectionHeader, {color: theme.colors.text}]}>
      {title}
    </Text>
  );
});

SectionHeader.displayName = 'SectionHeader';

// Custom function to create subtler gradient colors for both light and dark modes
function createSubtleGradientColors(
  baseColors: readonly [string, string, string],
  isDarkMode: boolean,
): [string, string, string] {
  // Use current alpha values for dark mode, but lower them for light mode
  const alpha1 = isDarkMode ? 0.4 : 0.3; // Light mode: reduced from 0.6 to 0.3
  const alpha2 = isDarkMode ? 0.25 : 0.2; // Light mode: reduced from 0.4 to 0.2
  const alpha3 = isDarkMode ? 0.15 : 0.1; // Light mode: reduced from 0.2 to 0.1

  return [
    Color(baseColors[0]).alpha(alpha1).toString(),
    Color(baseColors[1]).alpha(alpha2).toString(),
    Color(baseColors[2]).alpha(alpha3).toString(),
  ];
}

export default function SurahsView({onSurahPress}: SurahsViewProps) {
  const {width: windowWidth} = useWindowDimensions();
  const {theme} = useTheme();

  // Memoize the surah of the day to prevent recalculation
  const surahOfTheDay = React.useMemo(() => getSurahOfTheDay(), []);

  // Generate shared gradient colors for both hero sections
  const sharedColorsBase = useMemo(() => getRandomColors(), []);

  // Create themed gradient colors for each section with custom alpha values
  const surahHeroColors = useMemo(
    () => createSubtleGradientColors(sharedColorsBase, theme.isDarkMode),
    [sharedColorsBase, theme.isDarkMode],
  );

  const browseAllColors = useMemo(() => {
    // Use a slight variation of the same colors for the browse all section
    // by shifting the hue slightly
    const shiftedColors = sharedColorsBase.map(colorStr => {
      const color = Color(colorStr);
      return color.rotate(30).hex(); // Rotate hue by 30 degrees
    }) as [string, string, string];

    return createSubtleGradientColors(shiftedColors, theme.isDarkMode);
  }, [sharedColorsBase, theme.isDarkMode]);

  // Calculate item dimensions based on screen width - similar to BrowseGrid
  const heroGridDimensions = useMemo(() => {
    const horizontalPadding = moderateScale(16); // 16px padding on each side
    const gapBetweenItems = moderateScale(16); // 16px gap between cards
    const availableWidth =
      windowWidth - horizontalPadding * 2 - gapBetweenItems;
    const itemWidth = availableWidth / 2;

    return {
      width: itemWidth,
      gap: gapBetweenItems,
      paddingHorizontal: horizontalPadding,
    };
  }, [windowWidth]);

  // Create card style based on calculated dimensions
  const cardStyle = useMemo(() => {
    return {
      width: heroGridDimensions.width,
      marginBottom: moderateScale(8), // Reduced from 16 for a more compact layout
    };
  }, [heroGridDimensions.width]);

  // Memoize the onSurahPress handler to prevent recreation on each render
  const handleSurahPress = React.useCallback(
    (surah: Surah) => {
      onSurahPress(surah);
    },
    [onSurahPress],
  );

  // Memoize the category renderers
  const renderSpecialCategories = React.useMemo(
    () =>
      SPECIAL_CATEGORIES.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={handleSurahPress}
        />
      )),
    [handleSurahPress],
  );

  const renderFeaturedCollections = React.useMemo(
    () =>
      FEATURED_COLLECTIONS.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={handleSurahPress}
        />
      )),
    [handleSurahPress],
  );

  const renderThemeCollections = React.useMemo(
    () =>
      BY_THEME.map(collection => (
        <CollectionSection
          key={collection.id}
          title={collection.title}
          collection={collection}
          onSurahPress={handleSurahPress}
        />
      )),
    [handleSurahPress],
  );

  return (
    <ScrollView
      style={mainStyles.container}
      contentContainerStyle={mainStyles.contentContainer}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      scrollEventThrottle={16}>
      <View
        style={[
          mainStyles.heroRow,
          {
            paddingHorizontal: heroGridDimensions.paddingHorizontal,
            gap: heroGridDimensions.gap,
          },
        ]}>
        <SurahHeroSection
          surah={surahOfTheDay}
          onPress={handleSurahPress}
          isCompact={true}
          style={cardStyle}
          gradientColors={surahHeroColors}
        />
        <BrowseAllHeroSection
          isCompact={true}
          style={cardStyle}
          gradientColors={browseAllColors}
        />
      </View>

      {renderSpecialCategories}

      <SectionHeader title="Featured Collections" />
      {renderFeaturedCollections}

      <SectionHeader title="By Theme" />
      {renderThemeCollections}
    </ScrollView>
  );
}
