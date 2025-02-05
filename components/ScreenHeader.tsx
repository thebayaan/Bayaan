import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useRouter} from 'expo-router';

interface ScreenHeaderProps {
  title: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({title}) => {
  const {theme} = useTheme();
  const router = useRouter();
  const styles = createStyles(theme);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        activeOpacity={0.99}
        onPress={() => router.back()}
        style={styles.backButton}>
        <Icon
          name="arrow-left"
          type="feather"
          size={moderateScale(24)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      paddingVertical: verticalScale(10),
    },
    backButton: {
      padding: moderateScale(10),
      marginRight: moderateScale(10),
      borderRadius: moderateScale(20),
      color: theme.colors.text,
    },
    headerTitle: {
      fontSize: moderateScale(22),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
  });
