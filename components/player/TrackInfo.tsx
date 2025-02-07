import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerColors} from '@/hooks/usePlayerColors';

interface TrackInfoProps {
  surahName: string;
  reciterName: string;
  onReciterPress?: () => void;
}

const TrackInfo: React.FC<TrackInfoProps> = ({
  surahName,
  reciterName,
  onReciterPress,
}) => {
  const {theme} = useTheme();
  const playerColors = usePlayerColors();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.surahName,
          {color: playerColors?.text || theme.colors.text},
        ]}
        numberOfLines={1}>
        {surahName}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onReciterPress}
        disabled={!onReciterPress}>
        <Text
          style={[
            styles.reciterName,
            {
              color: playerColors?.text || theme.colors.text,
              opacity: 0.7,
            },
          ]}
          numberOfLines={1}>
          {reciterName}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  surahName: {
    fontSize: moderateScale(22),
    fontWeight: '600',
    marginBottom: moderateScale(4),
    textAlign: 'center',
  },
  reciterName: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default TrackInfo;
