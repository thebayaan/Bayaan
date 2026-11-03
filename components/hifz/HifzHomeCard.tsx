import React from 'react';
import {Platform, Pressable, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {flipX} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';

/** Home row: the way into hifz (today's plan, quizzes, look-alike drills). */
export function HifzHomeCard(): React.JSX.Element | null {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const router = useRouter();
  if (Platform.isTV) return null;
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/(a.home)/hifz')}
      accessibilityRole="button"
      style={{
        marginHorizontal: moderateScale(16),
        marginVertical: moderateScale(8),
        padding: moderateScale(16),
        borderRadius: moderateScale(14),
        borderWidth: 1,
        borderColor: Color(theme.colors.text).alpha(0.06).toString(),
        backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(12),
      }}>
      <Feather
        name="book-open"
        size={moderateScale(22)}
        color={theme.colors.text}
      />
      <View style={{flex: 1, gap: 2}}>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: 'Manrope-SemiBold',
            fontSize: moderateScale(16),
          }}>
          {t('hifz.title')}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontFamily: 'Manrope-Regular',
            fontSize: moderateScale(13),
          }}>
          {t('hifz.homeSubtitle')}
        </Text>
      </View>
      <Feather
        name="chevron-right"
        size={moderateScale(18)}
        color={Color(theme.colors.text).alpha(0.4).toString()}
        style={flipX}
      />
    </Pressable>
  );
}
