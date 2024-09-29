import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';

interface ReciterCardProps {
  imageUrl?: string;
  name: string;
  moshafName: string;
  onPress: () => void;
}

export const ReciterCard: React.FC<ReciterCardProps> = ({
  imageUrl,
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
      marginBottom: verticalScale(5),
      overflow: 'hidden',
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
    reciterImage: {
      width: moderateScale(120),
      height: moderateScale(120),
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        <ReciterImage imageUrl={imageUrl} style={styles.reciterImage} />
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
