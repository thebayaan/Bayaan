import React, {useEffect, useState} from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from '@/utils/scale';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
// @ai-start
import {useTranslation} from 'react-i18next';
import {getReciterDisplayName} from '@/i18n/format';
// @ai-end
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface ReciterDownloadsStackCardProps {
  reciterId: string;
  downloadCount: number;
  onPress: () => void;
  width?: number;
  height?: number;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

// @ai-start
export const ReciterDownloadsStackCard: React.FC<
  ReciterDownloadsStackCardProps
> = ({reciterId, downloadCount, onPress, width, height}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const [reciter, setReciter] = useState<Reciter | null>(null);

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
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

  useEffect(() => {
    let mounted = true;
    const loadReciter = async () => {
      try {
        const data = await getReciterById(reciterId);
        if (mounted && data) {
          setReciter(data);
        }
      } catch (error) {
        console.error('Error loading reciter:', error);
      }
    };
    loadReciter();
    return () => {
      mounted = false;
    };
  }, [reciterId]);

  // Use provided dimensions or fall back to default
  const cardWidth = width || moderateScale(120);
  const cardHeight = height || moderateScale(120);

  const styles = StyleSheet.create({
    container: {
      width: cardWidth,
    },
    imageContainer: {
      width: cardWidth,
      height: cardHeight,
      borderRadius: moderateScale(5),
      overflow: 'hidden',
      marginBottom: verticalScale(5),
    },
    reciterImage: {
      width: '100%',
      height: '100%',
    },
    name: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
  });

  if (!reciter) return null;

  return (
    <AnimatedTouchableOpacity
      activeOpacity={1}
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <View style={styles.imageContainer}>
        <ReciterImage
          reciterName={reciter.name}
          imageUrl={reciter.image_url || undefined}
          style={styles.reciterImage}
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {getReciterDisplayName(reciter)}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {t('cards.downloadedCount', {count: downloadCount})}
      </Text>
    </AnimatedTouchableOpacity>
  );
};
// @ai-end
