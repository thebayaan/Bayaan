import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';
import {Icon} from '@rneui/themed';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface CircularReciterCardProps {
  imageUrl?: string;
  name: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  isSelected?: boolean;
  variant?: 'default' | 'add';
  addTextStyle?: StyleProp<TextStyle>;
  width?: number;
  height?: number;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const CircularReciterCard: React.FC<CircularReciterCardProps> = ({
  imageUrl,
  name,
  onPress,
  size = 'medium',
  isSelected = false,
  variant = 'default',
  addTextStyle,
  width,
  height,
}) => {
  const {theme} = useTheme();

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.92, {
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

  // Size mapping for backward compatibility
  const sizeMap = {
    small: 60,
    medium: 75,
    large: 90,
  };

  // Use custom dimensions if provided, otherwise fall back to size prop
  const imageSize = width || sizeMap[size];
  const calculatedHeight = height || imageSize;

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      width: imageSize,
    },
    imageContainer: {
      width: imageSize,
      height: calculatedHeight,
      borderRadius: calculatedHeight / 2, // Keep it circular even if custom dimensions
      overflow: 'hidden',
      marginBottom: verticalScale(5),
      alignItems: 'center', // For the plus icon
      justifyContent: 'center', // For the plus icon
    },
    reciterImage: {
      width: '100%',
      height: '100%',
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: {
      color: theme.colors.text,
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      width: imageSize,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      width: imageSize,
    },
    addText: {
      fontSize: moderateScale(12),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      width: imageSize,
      marginTop: verticalScale(4),
    },
  });

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.99}
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <View style={styles.imageContainer}>
        {variant === 'default' ? (
          <>
            <ReciterImage
              imageUrl={imageUrl}
              reciterName={name}
              style={styles.reciterImage}
            />
            {isSelected && <View style={styles.selectedOverlay} />}
          </>
        ) : (
          <Icon
            name="plus"
            type="feather"
            size={moderateScale(imageSize * 0.3)}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
      {variant === 'add' ? (
        <Text style={[styles.addText, addTextStyle]} numberOfLines={2}>
          {name}
        </Text>
      ) : (
        <>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Reciter
          </Text>
        </>
      )}
    </AnimatedTouchableOpacity>
  );
};
