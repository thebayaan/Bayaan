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
    small: 80,
    medium: 100,
    large: 120,
  };

  const imageSize = sizeMap[size];

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      marginRight: moderateScale(15),
    },
    imageContainer: {
      width: moderateScale(imageSize),
      height: moderateScale(imageSize),
      borderRadius: moderateScale(imageSize / 2),
      overflow: 'hidden',
      marginBottom: verticalScale(5),
      borderWidth: variant === 'add' ? 0 : isSelected ? 4 : 0,
      borderColor:
        variant === 'add' ? theme.colors.border : theme.colors.primary,
      backgroundColor: variant === 'add' ? theme.colors.card : undefined,
      justifyContent: variant === 'add' ? 'center' : undefined,
      alignItems: variant === 'add' ? 'center' : undefined,
    },
    name: {
      fontSize: moderateScale(size === 'small' ? 10 : 12),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      width: moderateScale(imageSize),
    },
    addText: {
      fontSize: moderateScale(size === 'small' ? 10 : 12),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      width: moderateScale(imageSize),
    },
    reciterImage: {
      width: moderateScale(imageSize),
      height: moderateScale(imageSize),
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.primary,
      opacity: 0.3,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
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
