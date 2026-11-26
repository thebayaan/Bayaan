// @ai-generated
// RFC-025 — the "update available" card at the top of the Listen tab.
//
// An icon, a title, one line of text, a filled "Update" button at the trailing
// edge, and a close button that hides the card for 7 days. It never blocks
// the screen, and it renders nothing unless `branding.updateSource` reports a
// build newer than the installed one.
//
// The container is `accessible={false}`: it holds two controls, and a single
// accessibility element would hide them from VoiceOver and TalkBack.
import React, {useCallback, useMemo} from 'react';
import {LayoutAnimation, Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import branding from '@/config/branding';
import {useTheme} from '@/hooks/useTheme';
import {useUpdateCheck} from '@/hooks/useUpdateCheck';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

/** The Update button is 36 pt tall; the hit slop makes its touch area 52 pt. */
const UPDATE_HIT_SLOP = {top: 8, bottom: 8, left: 8, right: 8};

/** `#rrggbb` (or `#rgb`) at an alpha, as `rgba()`. Other values pass through. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(c => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function UpdateAvailableCard() {
  const {visible, openStore, dismiss} = useUpdateCheck();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const appName = branding.appName;

  const onDismiss = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    dismiss();
  }, [dismiss]);

  if (!visible) return null;

  return (
    <View style={styles.card} accessible={false} testID="update-available-card">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Feather
            name="arrow-up-circle"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.title} accessibilityRole="header">
            {t('updateCard.title')}
          </Text>
          <Text style={styles.body}>{t('updateCard.body', {appName})}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('updateCard.dismiss')}
          onPress={onDismiss}
          testID="update-available-card-dismiss"
          style={styles.closeButton}>
          <Feather
            name="x"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('updateCard.updateA11y', {appName})}
        hitSlop={UPDATE_HIT_SLOP}
        onPress={openStore}
        testID="update-available-card-update"
        style={({pressed}) => [styles.updateButton, pressed && styles.pressed]}>
        <Text style={styles.updateLabel}>{t('updateCard.update')}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      marginHorizontal: moderateScale(16),
      marginTop: moderateScale(4),
      marginBottom: moderateScale(12),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.text, 0.06),
      backgroundColor: withAlpha(theme.colors.text, 0.04),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(14),
      paddingStart: moderateScale(14),
      paddingEnd: moderateScale(4),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    icon: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(18),
      marginTop: moderateScale(2),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(theme.colors.text, 0.06),
    },
    textColumn: {
      flex: 1,
      minWidth: 0,
      marginStart: moderateScale(12),
    },
    title: {
      marginTop: moderateScale(2),
      fontSize: moderateScale(14),
      lineHeight: moderateScale(18),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    body: {
      marginTop: moderateScale(2),
      fontSize: moderateScale(12),
      lineHeight: moderateScale(18),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    closeButton: {
      width: 44,
      height: 44,
      marginTop: -6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateButton: {
      alignSelf: 'flex-end',
      marginTop: moderateScale(14),
      marginEnd: moderateScale(10),
      height: moderateScale(36),
      paddingHorizontal: moderateScale(18),
      borderRadius: moderateScale(14),
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
    pressed: {
      opacity: 0.8,
    },
    updateLabel: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.background,
    },
  });
}
