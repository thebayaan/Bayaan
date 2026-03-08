import React from 'react';
import {ViewStyle} from 'react-native';
import {Surah} from '@/data/surahData';
import {SurahHeroSection} from '@/components/hero/SurahsHero';

interface SurahOfTheDayProps {
  surah: Surah;
  onLongPress?: (surah: Surah) => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A component that displays the Surah of the Day card
 * with zoom transition to mushaf.
 */
export function SurahOfTheDay({surah, onLongPress, style}: SurahOfTheDayProps) {
  return (
    <SurahHeroSection
      surah={surah}
      onLongPress={onLongPress}
      title="SURAH OF THE DAY"
      isCompact={true}
      style={style}
    />
  );
}
