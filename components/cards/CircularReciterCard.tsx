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

interface CircularReciterCardProps {
  imageUrl?: string;
  name: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  isSelected?: boolean;
  variant?: 'default' | 'add';
  addTextStyle?: StyleProp<TextStyle>;
}

export const CircularReciterCard: React.FC<CircularReciterCardProps> = ({
  imageUrl,
  name,
  onPress,
  size = 'medium',
  isSelected = false,
  variant = 'default',
  addTextStyle,
}) => {
  const {theme} = useTheme();

  const sizeMap = {
    small: 60,
    medium: 75,
    large: 90,
  };

  const imageSize = sizeMap[size];

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      marginRight: moderateScale(8),
    },
    imageContainer: {
      width: imageSize,
      height: imageSize,
      borderRadius: imageSize / 2,
      overflow: 'hidden',
      marginBottom: verticalScale(4),
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
      fontSize: moderateScale(size === 'small' ? 10 : 12),
      fontFamily: 'Manrope-SemiBold',
      textAlign: 'center',
      width: imageSize,
    },
    addText: {
      fontSize: moderateScale(size === 'small' ? 10 : 12),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      width: moderateScale(imageSize),
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
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
      <Text
        style={[
          variant === 'add' ? styles.addText : styles.name,
          variant === 'add' && addTextStyle,
        ]}
        numberOfLines={2}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};
