import React, {useCallback, useRef, useEffect, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import {Surah, QuranData, Verse} from '@/types/quran';
import {VerseItem} from './VerseItem';

// Import data with type safety
const quranData = require('@/data/quran.json') as QuranData;
const surahData = require('@/data/surahData.json') as Surah[];

// Define translation data type
interface TranslationItem {
  id: number;
  resource_id: number;
  text: string;
}

interface VerseTranslation {
  id: number;
  verse_number: number;
  verse_key: string;
  translations: TranslationItem[];
}

// Define transliteration data type
interface TransliterationVerse {
  t: string; 
}

interface TransliterationData {
  [verseKey: string]: TransliterationVerse;
}

interface QuranViewProps {
  currentSurah: number;
  onVersePress: (verseKey: string) => void;
  showTranslation?: boolean;
  showTransliteration?: boolean;
}

export const QuranView: React.FC<QuranViewProps> = ({
  currentSurah,
  onVersePress,
  showTranslation = false,
  showTransliteration = false,
}) => {
  const {theme} = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const surah = surahData.find(s => s.id === currentSurah);
  const [translationData, setTranslationData] = useState<VerseTranslation[]>([]);
  const [transliterationMap, setTransliterationMap] = useState<TransliterationData>({});

  // Load translations if needed
  useEffect(() => {
    if (showTranslation && translationData.length === 0) {
      try {
        const translations = require('@/data/quran-translation.json') as VerseTranslation[];
        if (translations && translations.length > 0) {
          setTranslationData(translations);
        } else {
          console.error('Translation data format is unexpected');
        }
      } catch (error) {
        console.error('Error loading translation data:', error);
      }
    }
  }, [showTranslation, translationData.length]);

  // Load transliterations if needed
  useEffect(() => {
    if (showTransliteration && Object.keys(transliterationMap).length === 0) {
      try {
        const transliterations = require('@/data/Transliteration.json') as TransliterationData;
        if (transliterations) {
          setTransliterationMap(transliterations);
        } else {
          console.error('Transliteration data format is unexpected');
        }
      } catch (error) {
        console.error('Error loading transliteration data:', error);
      }
    }
  }, [showTransliteration, transliterationMap]);

  // Safely get verses for the current surah
  const getVersesForSurah = useCallback(() => {
    if (!quranData) {
      console.error('Quran data is not properly loaded');
      return [];
    }

    try {
      const verses = Object.values(quranData)
        .filter(verse => verse.surah_number === currentSurah)
        .sort((a, b) => a.ayah_number - b.ayah_number);

      return verses.map(verse => {
        const verseKey = `${verse.surah_number}:${verse.ayah_number}`;
        let translationText = '';
        let transliterationText = '';

        // Add translation if available and enabled
        if (showTranslation && translationData.length > 0) {
          const translation = translationData.find(t => t.verse_key === verseKey);
          if (translation && translation.translations && translation.translations.length > 0) {
            translationText = translation.translations[0].text;
          }
        }

        // Add transliteration if available and enabled
        if (showTransliteration && transliterationMap[verseKey]) {
          transliterationText = transliterationMap[verseKey].t;
        }
        
        return {
          ...verse,
          translation: translationText,
          transliteration: transliterationText,
        };
      });
      
    } catch (error) {
      console.error('Error processing verses:', error);
      return [];
    }
  }, [
    currentSurah,
    showTranslation,
    translationData,
    showTransliteration,
    transliterationMap,
  ]);

  // Reset scroll position when currentSurah changes
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({x: 0, y: 0, animated: false});
    }
  }, [currentSurah]);

  const verses = getVersesForSurah();

  if (!surah || !verses.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        nestedScrollEnabled={Platform.OS === 'android'}
        disableScrollViewPanResponder={Platform.OS === 'android'}
        scrollEventThrottle={16}>
        {/* Bismillah Header */}
        {surah.id !== 9 && (
          <View style={styles.bismillahContainer}>
            <Text style={[styles.bismillah, {color: theme.colors.text}]}>
              ﷽
            </Text>
          </View>
        )}

        {/* Verses */}
        {verses.map(verse => (
          <VerseItem
            key={verse.verse_key}
            verse={verse}
            onPress={() => onVersePress(verse.verse_key)}
            textColor={theme.colors.text}
            borderColor={theme.colors.border}
            showTranslation={showTranslation}
            showTransliteration={showTransliteration}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
    maxHeight: MAX_PLAYER_CONTENT_HEIGHT,
    marginTop: moderateScale(5),
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    borderRadius: moderateScale(15),
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
  },
  bismillahContainer: {
    width: '100%',
    paddingVertical: verticalScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bismillah: {
    fontSize: moderateScale(30),
    fontFamily: 'Uthmani',
    textAlign: 'center',
  },
});
