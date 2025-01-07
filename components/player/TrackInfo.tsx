import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';

interface TrackInfoProps {
  surahName: string;
  reciterName: string;
  onReciterPress: () => void;
}

const TrackInfo: React.FC<TrackInfoProps> = ({
  surahName,
  reciterName,
  onReciterPress,
}) => {
  const {theme} = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.surahName, {color: theme.colors.text}]}>
        {surahName}
      </Text>
      <TouchableOpacity activeOpacity={0.99} onPress={onReciterPress}>
        <Text style={[styles.reciterName, {color: theme.colors.textSecondary}]}>
          {reciterName}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  surahName: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    marginBottom: moderateScale(4),
  },
  reciterName: {
    fontSize: moderateScale(14),
  },
});

export default TrackInfo;
