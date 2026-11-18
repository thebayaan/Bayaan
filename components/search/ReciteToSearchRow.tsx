import React from 'react';
import {Keyboard, Pressable, StyleSheet, Text, View} from 'react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {RECITATION_AVAILABLE} from '@/services/recitation/recitationAvailability';
import {moderateScale} from '@/utils/scale';

/**
 * "Recite to search": for readers who cannot type Arabic. Opens Which ayah?,
 * which listens and names the ayah.
 */
export function ReciteToSearchRow(): React.JSX.Element | null {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const subtle = Color(theme.colors.text).alpha(0.06).toString();

  function open(): void {
    Keyboard.dismiss();
    SheetManager.show('which-ayah');
  }

  if (!RECITATION_AVAILABLE) return null;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={({pressed}) => [
        styles.row,
        {backgroundColor: pressed ? subtle : 'transparent'},
      ]}>
      <View style={[styles.icon, {backgroundColor: subtle}]}>
        <Feather
          name="mic"
          size={moderateScale(18)}
          color={theme.colors.text}
        />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, {color: theme.colors.text}]}>
          {t('search.reciteToSearch')}
        </Text>
        <Text style={[styles.hint, {color: theme.colors.textSecondary}]}>
          {t('search.reciteToSearchHint')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  icon: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: moderateScale(2),
  },
  title: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
  },
  hint: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
  },
});
