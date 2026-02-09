import React from 'react';
import {View, Text} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {ReciterHeaderProps} from '@/components/reciter-profile/types';

export const ReciterHeader: React.FC<ReciterHeaderProps> = ({
  reciter,
  showSearch,
  insets,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: showSearch
            ? moderateScale(15)
            : insets.top + moderateScale(50),
        },
      ]}>
      <ReciterImage
        reciterName={reciter.name}
        imageUrl={reciter.image_url || undefined}
        style={styles.reciterImage}
        profileIconSize={moderateScale(48)}
      />
      <Text style={styles.reciterName} numberOfLines={2}>
        {reciter.name}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(6),
      backgroundColor: theme.colors.background,
    },
    reciterImage: {
      width: moderateScale(110),
      height: moderateScale(110),
      borderRadius: moderateScale(14),
    },
    reciterName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(10),
      lineHeight: moderateScale(26),
    },
  });
