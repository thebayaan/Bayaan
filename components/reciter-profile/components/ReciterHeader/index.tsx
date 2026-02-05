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
    <View style={styles.gradientContainer}>
      <View
        style={[
          styles.headerContainer,
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
          profileIconSize={moderateScale(40)}
        />
        <View style={styles.reciterInfo}>
          <Text style={styles.reciterName} numberOfLines={2}>
            {reciter.name}
          </Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    gradientContainer: {
      paddingHorizontal: moderateScale(5),
      paddingBottom: moderateScale(10),
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      gap: moderateScale(15),
      backgroundColor: theme.colors.background,
    },
    reciterImage: {
      width: moderateScale(100),
      height: moderateScale(100),
      borderRadius: moderateScale(12),
      alignSelf: 'flex-start',
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
      minHeight: moderateScale(100),
      paddingTop: moderateScale(4),
    },
    reciterName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      lineHeight: moderateScale(18),
    },
  });
