import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale, verticalScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useRouter} from 'expo-router';
// @ai-start
import {flipX} from '@/utils/rtl';
// @ai-end

interface ScreenHeaderProps {
  title: string;
}

// @ai-start
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({title}) => {
  const {theme} = useTheme();
  const router = useRouter();
  const styles = createStyles(theme);

  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Feather
          name="arrow-left"
          size={moderateScale(24)}
          color={theme.colors.text}
          style={flipX}
        />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
};
// @ai-end

// @ai-start
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
      marginEnd: moderateScale(10),
      borderRadius: moderateScale(20),
      color: theme.colors.text,
    },
    headerTitle: {
      fontSize: moderateScale(22),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
  });
// @ai-end
