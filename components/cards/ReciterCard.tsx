import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';

interface ReciterCardProps {
  imageUrl?: string;
  name: string;
  onPress: () => void;
}

export const ReciterCard: React.FC<ReciterCardProps> = ({
  imageUrl,
  name,
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
      marginBottom: verticalScale(5),
      overflow: 'hidden',
    },
    name: {
      fontSize: moderateScale(14),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    reciterImage: {
      width: moderateScale(120),
      height: moderateScale(120),
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <View style={styles.imageContainer}>
        <ReciterImage
          imageUrl={imageUrl}
          reciterName={name}
          style={styles.reciterImage}
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};
