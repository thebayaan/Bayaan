import React from 'react';
import {View, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface TrackInfoProps {
  surahName: string;
  reciterName: string;
}

const TrackInfo: React.FC<TrackInfoProps> = ({surahName, reciterName}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.surahName}>{surahName}</Text>
      <Text style={styles.reciterName}>{reciterName}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      alignItems: 'center',
      width: '100%',
    },
    surahName: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(4),
    },
    reciterName: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
    },
  });

export default TrackInfo;
