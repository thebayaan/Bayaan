import React from 'react';
import {View, StyleSheet} from 'react-native';
import {ScrollingHero} from '@/components/hero/ScrollingReciters';
import {HeroSection} from './HeroSection';
import {moderateScale} from 'react-native-size-matters';

/**
 * The main hero component for the RecitersView.
 * Includes ScrollingHero and RandomRecitationHero with standardized spacing.
 */
export function RecitersHero() {
  return (
    <HeroSection
      mainHero={
        // Apply the horizontal padding previously in ScrollingHero's wrapper
        <View style={styles.mainHeroWrapper}>
          <ScrollingHero />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  mainHeroWrapper: {
    paddingHorizontal: moderateScale(16),
  },
});
