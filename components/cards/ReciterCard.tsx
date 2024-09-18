import React from 'react';
import {
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
  View,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ProfileIcon} from '@/components/Icons';

interface ReciterCardProps {
  image: ImageSourcePropType;
  name: string;
  moshafName: string;
  onPress: () => void;
}

export const ReciterCard: React.FC<ReciterCardProps> = ({
  image,
  name,
  moshafName,
  onPress,
}) => {
  const {theme} = useTheme();

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(120),
      marginRight: moderateScale(10),
    },
    imageContainer: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(2),
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      marginBottom: verticalScale(5),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    name: {
      fontSize: moderateScale(14),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    moshafName: {
      fontSize: moderateScale(12),
      color: theme.colors.textSecondary,
    },
  });

  const hasImage = image && (image as {uri?: string}).uri !== '';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        {hasImage ? (
          <Image source={image} style={styles.image} />
        ) : (
          <ProfileIcon color={theme.colors.light} size={moderateScale(75)} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.moshafName} numberOfLines={1}>
        {moshafName}
      </Text>
    </TouchableOpacity>
  );
};
