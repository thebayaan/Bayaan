import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
import {MakkahIcon, MadinahIcon, HeartIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface SurahCardProps {
  id: number;
  name: string;
  translatedName: string;
  versesCount: number;
  revelationPlace: string;
  color: string;
  onPress: () => void;
  onOptionsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  isLoved?: boolean;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const SurahCard: React.FC<SurahCardProps> = ({
  id,
  name,
  translatedName,
  revelationPlace,
  color,
  onPress,
  onOptionsPress,
  style,
  isLoved = false,
}) => {
  const {theme} = useTheme();

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const getGradientColors = (): [string, string] => {
    const baseColor = Color(color);
    const gradientStart = baseColor.alpha(0.15).toString();
    const gradientEnd = baseColor.alpha(0.05).toString();
    return [gradientStart, gradientEnd];
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(color).alpha(0.15).toString(),
    },
    content: {
      flex: 1,
      padding: moderateScale(6),
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    arabicName: {
      fontSize: moderateScale(26),
      color: theme.colors.text,
      fontFamily: 'SurahNames',
      marginBottom: moderateScale(2),
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 2,
    },
    nameContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(3),
      width: '100%',
    },
    textBlock: {
      alignItems: 'center',
    },
    name: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    translatedName: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      opacity: 0.9,
      letterSpacing: 0.1,
    },
    placeIcon: {
      position: 'absolute',
      top: moderateScale(4),
      right: moderateScale(4),
      opacity: 0.8,
      padding: moderateScale(3),
      backgroundColor: Color(theme.isDarkMode ? '#ffffff' : color)
        .alpha(0.08)
        .toString(),
      borderRadius: moderateScale(10),
      borderWidth: 0.5,
      borderColor: Color(color).alpha(0.2).toString(),
      shadowColor: theme.isDarkMode ? 'transparent' : 'rgba(0,0,0,0.1)',
      shadowOffset: {width: 0, height: 1},
      shadowRadius: 2,
      shadowOpacity: 0.5,
      elevation: 1,
    },
    numberBadge: {
      position: 'absolute',
      top: moderateScale(4),
      left: moderateScale(4),
      backgroundColor: Color(theme.isDarkMode ? '#ffffff' : color)
        .alpha(0.08)
        .toString(),
      paddingHorizontal: moderateScale(4),
      paddingVertical: 0,
      height: moderateScale(16),
      minWidth: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: moderateScale(8),
      borderWidth: 0.5,
      borderColor: Color(color).alpha(0.2).toString(),
      shadowColor: theme.isDarkMode ? 'transparent' : 'rgba(0,0,0,0.1)',
      shadowOffset: {width: 0, height: 1},
      shadowRadius: 2,
      shadowOpacity: 0.5,
      elevation: 1,
    },
    numberText: {
      fontSize: moderateScale(8),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    divider: {
      height: 1,
      width: '30%',
      backgroundColor: Color(color).alpha(0.15).toString(),
      marginVertical: moderateScale(2),
    },
    heartIconContainer: {
      position: 'absolute',
      bottom: verticalScale(5),
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    optionsButton: {
      position: 'absolute',
      bottom: moderateScale(4),
      right: moderateScale(4),
      padding: moderateScale(5),
      borderRadius: moderateScale(15),
      backgroundColor: Color(theme.colors.card).alpha(0.7).toString(),
    },
  });

  const handleOptionsPressWrapper = (e: GestureResponderEvent) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOptionsPress?.();
  };

  const handleLongPressWrapper = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOptionsPress?.();
  };

  return (
    <AnimatedTouchableOpacity
      activeOpacity={1}
      style={[styles.container, animatedStyle, style]}
      onPress={handleCardPress}
      onLongPress={onOptionsPress ? handleLongPressWrapper : undefined}
      delayLongPress={500}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <LinearGradient
        colors={getGradientColors() as [string, string]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.placeIcon}>
        {revelationPlace.toLowerCase() === 'makkah' ? (
          <MakkahIcon
            size={moderateScale(15)}
            color={Color(theme.colors.text).alpha(0.9).toString()}
            secondaryColor={theme.colors.background}
          />
        ) : (
          <MadinahIcon
            size={moderateScale(15)}
            color={Color(theme.colors.text).alpha(0.9).toString()}
          />
        )}
      </View>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{id}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.arabicName}>{surahGlyphMap[id]}</Text>
        <View style={styles.divider} />
        <View style={styles.nameContainer}>
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {name}
            </Text>
            <Text
              style={styles.translatedName}
              numberOfLines={1}
              ellipsizeMode="tail">
              {translatedName}
            </Text>
          </View>
        </View>

        <View style={styles.heartIconContainer}>
          {isLoved && (
            <HeartIcon
              size={moderateScale(14)}
              color={theme.colors.text}
              filled={true}
            />
          )}
        </View>
      </View>

      {onOptionsPress && (
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={handleOptionsPressWrapper}
          activeOpacity={0.7}>
          <Icon
            name="more-horizontal"
            type="feather"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </AnimatedTouchableOpacity>
  );
};
