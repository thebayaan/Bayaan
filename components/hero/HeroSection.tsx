import React, {ReactNode} from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {RandomRecitationHero} from '@/components/hero/RandomRecitationHero';
import {useResponsive} from '@/hooks/useResponsive'; // @ai

interface HeroSectionProps {
  mainHero: ReactNode;
  randomHero?: boolean;
}

/**
 * A unified HeroSection component that standardizes the layout and spacing
 * for hero components across the app.
 */
export function HeroSection({mainHero, randomHero = true}: HeroSectionProps) {
  const {isTablet} = useResponsive(); // @ai

  // @ai-start
  // iPad: the two heroes sit side by side, 2:1, at the main hero's height.
  if (isTablet && randomHero) {
    return (
      <View style={[styles.container, styles.tabletRow]}>
        <View style={styles.tabletMain}>{mainHero}</View>
        <View style={styles.tabletRandom}>
          <RandomRecitationHero isCompact={true} style={styles.fill} />
        </View>
      </View>
    );
  }
  // @ai-end

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
  // @ai-start
  tabletRow: {
    flexDirection: 'row',
  },
  tabletMain: {
    flex: 2,
  },
  // The main hero pads both sides, so this one only pads the trailing edge.
  tabletRandom: {
    flex: 1,
    paddingEnd: moderateScale(16),
  },
  fill: {
    flex: 1,
  },
  // @ai-end
});
