import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {HeartIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  reciterId?: string;
  isLoved?: boolean;
  onOptionsPress?: (item: Surah) => void;
}

// Create Animated component
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({item, onPress, isLoved = false, onOptionsPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    // Animation value
    const scale = useSharedValue(1);

    const handlePress = React.useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(item);
    }, [item, onPress]);

    const handleOptionsPress = React.useCallback(
      (e?: GestureResponderEvent) => {
        e?.stopPropagation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onOptionsPress) {
          requestAnimationFrame(() => {
            onOptionsPress(item);
          });
        }
      },
      [item, onOptionsPress],
    );

    const handleLongPressWrapper = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handleOptionsPress();
    };

    // Animation handlers
    const handlePressIn = () => {
      scale.value = withSpring(0.98, {
        damping: 15,
        stiffness: 400,
        mass: 0.5,
      });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 400,
        mass: 0.5,
      });
    };

    // Animated style
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{scale: scale.value}],
    }));

    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    return (
      <AnimatedTouchableOpacity
        activeOpacity={0.99}
        style={[styles.surahItem, animatedStyle]}
        onPress={handlePress}
        onLongPress={onOptionsPress ? handleLongPressWrapper : undefined}
        delayLongPress={500}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Surah ${item.name}, ${item.translated_name_english}, ${item.verses_count} verses`}
        accessibilityHint={
          onOptionsPress
            ? 'Tap to view Surah. Long press or tap options button for more actions.'
            : 'Tap to view Surah.'
        }>
        <View
          style={styles.surahGlyphContainer}
          accessibilityElementsHidden={true}>
          <Text
            style={styles.surahGlyph}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {surahGlyphMap[item.id]}
          </Text>
        </View>
        <View
          style={styles.surahInfoContainer}
          accessibilityElementsHidden={true}>
          <View style={styles.nameContainer}>
            <Text style={styles.surahName}>{`${item.id}. ${item.name}`}</Text>
            {isLoved && (
              <HeartIcon
                size={moderateScale(14)}
                color={theme.colors.text}
                filled={true}
              />
            )}
          </View>
          <Text style={styles.surahSecondaryInfo}>
            {item.translated_name_english}
          </Text>
          <View
            style={[
              styles.locationIndicator,
              {backgroundColor: Color(theme.colors.card).alpha(0.8).toString()},
            ]}>
            {revelationPlace === 'makkah' ? (
              <MakkahIcon
                size={moderateScale(15)}
                color={theme.colors.textSecondary}
                secondaryColor={Color(theme.colors.card).alpha(0.8).toString()}
              />
            ) : (
              <MadinahIcon
                size={moderateScale(15)}
                color={theme.colors.textSecondary}
              />
            )}
            <Text style={styles.locationText}>
              {revelationPlace.charAt(0).toUpperCase() +
                revelationPlace.slice(1)}
            </Text>
          </View>
        </View>
        {onOptionsPress && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={handleOptionsPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="More options"
            accessibilityHint="Opens menu with additional actions for this Surah">
            <Icon
              name="more-horizontal"
              type="feather"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        )}
      </AnimatedTouchableOpacity>
    );
  },
);

SurahItem.displayName = 'SurahItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(15),
      backgroundColor: theme.colors.background,
      position: 'relative',
    },
    surahGlyphContainer: {
      width: moderateScale(70),
      height: moderateScale(50),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(5),
    },
    surahInfoContainer: {
      flex: 1,
      marginLeft: moderateScale(5),
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    surahName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    surahSecondaryInfo: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(4),
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'center',
      width: '100%',
    },
    locationIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(2),
      borderRadius: moderateScale(4),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      alignSelf: 'flex-start',
    },
    locationText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    optionsButton: {
      padding: moderateScale(8),
      marginLeft: moderateScale(8),
    },
  });
