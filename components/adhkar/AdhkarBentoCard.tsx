import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {SuperCategory} from '@/types/adhkar';
import {ADHKAR_CATEGORY_IMAGES} from '@/constants/adhkarImages';
import {Link} from 'expo-router';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';

interface AdhkarBentoCardProps {
  category: SuperCategory;
  onPress?: () => void;
  width: number;
  height: number;
}

// Label typography constants. Also used below to size the image panel so
// a caller-supplied `height` is treated as the card's TOTAL footprint
// (image + label), matching the spacing the card had before the title
// was moved outside. That keeps sections vertically consistent with
// their neighbors.
const LABEL_LINE_HEIGHT = moderateScale(16);
const LABEL_MARGIN_TOP = moderateScale(4);
const LABEL_FONT_SIZE = moderateScale(13);
const LABEL_OVERHEAD = LABEL_LINE_HEIGHT + LABEL_MARGIN_TOP;

export const AdhkarBentoCard = React.memo(function AdhkarBentoCard({
  category,
  width,
  height,
}: AdhkarBentoCardProps) {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const isDarkMode = theme.isDarkMode;

  // Subtle gradient incorporating the category's color (same pattern as ExploreView)
  const baseColor = Color(category.color);
  const gradientColors = [
    baseColor.alpha(0.15).toString(),
    baseColor.alpha(0.25).toString(),
  ] as const;

  const imageHeight = Math.max(0, height - LABEL_OVERHEAD);
  const styles = createStyles(theme, width, imageHeight);

  const imageSet = ADHKAR_CATEGORY_IMAGES[category.id];

  const cardContent = imageSet ? (
    <Image
      source={isDarkMode ? imageSet.dark : imageSet.light}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
    />
  ) : (
    <LinearGradient
      colors={gradientColors}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={StyleSheet.absoluteFill}
    />
  );

  const label = (
    <Text style={styles.title} numberOfLines={2}>
      {category.title}
    </Text>
  );

  const linkProps = {
    href: {
      pathname: '/(tabs)/(a.home)/adhkar/[superId]' as const,
      params: {superId: category.id},
    },
    asChild: true as const,
  };

  if (USE_GLASS) {
    return (
      <Link {...linkProps}>
        <Pressable style={styles.wrapper}>
          <Link.AppleZoom>
            <GlassView
              style={styles.glassInner}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}>
              {cardContent}
            </GlassView>
          </Link.AppleZoom>
          {label}
        </Pressable>
      </Link>
    );
  }

  return (
    <Link {...linkProps}>
      <Pressable style={styles.wrapper}>
        <View style={styles.container}>{cardContent}</View>
        {label}
      </Pressable>
    </Link>
  );
});

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  width: number,
  height: number,
) =>
  StyleSheet.create({
    wrapper: {
      width,
    },
    container: {
      width,
      height,
      borderRadius: moderateScale(5),
      overflow: 'hidden',
    },
    glassInner: {
      width,
      height,
      borderRadius: moderateScale(5),
      overflow: 'hidden' as const,
    },
    title: {
      fontSize: LABEL_FONT_SIZE,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      lineHeight: LABEL_LINE_HEIGHT,
      textAlign: 'left',
      marginTop: LABEL_MARGIN_TOP,
      paddingHorizontal: moderateScale(2),
    },
  });

export default AdhkarBentoCard;
