import React, {ReactNode} from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {RandomRecitationHero} from '@/components/hero/RandomRecitationHero';

interface HeroSectionProps {
  mainHero: ReactNode;
  randomHero?: boolean;
}

/**
 * A unified HeroSection component that standardizes the layout and spacing
 * for hero components across the app.
 */
export function HeroSection({mainHero, randomHero = true}: HeroSectionProps) {
  return (
    <View style={[styles.container, !randomHero && styles.containerNoRandom]}>
      {/* Main Hero Content */}
      {mainHero}

      {/* Standard spacing between heroes - only show when randomHero is enabled */}
      {randomHero && (
        <>
          <View style={styles.spacing} />
          <View style={styles.randomHeroContainer}>
            <RandomRecitationHero isCompact={true} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: moderateScale(16),
  },
  containerNoRandom: {
    marginBottom: 0,
  },
  spacing: {
    height: verticalScale(10),
  },
  randomHeroContainer: {
    paddingHorizontal: moderateScale(16),
  },
});
