import React from 'react';
import {
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';

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
    image: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(2),
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      marginBottom: verticalScale(5),
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

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image source={image} style={styles.image} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.moshafName} numberOfLines={1}>
        {moshafName}
      </Text>
    </TouchableOpacity>
  );
};
