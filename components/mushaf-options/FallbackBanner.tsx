// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {chooseMushafRewayah} from '@/components/sheets/rewayahSelection';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {FadeInView} from './motion';
import {SECTION_GAP} from './optionStyles';

const AMBER = '#A86A00';

/**
 * At the top of the sheet while Hafs stands in for a saved rewayah that
 * could not be loaded (settings store `rewayahFallbackFrom`): offers to try
 * it again or to keep Hafs. Renders nothing otherwise.
 */
export function FallbackBanner(): React.JSX.Element | null {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('settings');
  const failed = useMushafSettingsStore(s => s.rewayahFallbackFrom);
  const [busy, setBusy] = useState(false);

  const choose = useCallback(
    async (value: RewayahId) => {
      if (busy) return;
      setBusy(true);
      try {
        await chooseMushafRewayah(value);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  if (!failed) return null;
  const name = getRewayahShortLabel(failed);
  return (
    <FadeInView style={styles.banner}>
      <View accessibilityRole="alert" style={styles.top}>
        <Feather
          name="alert-triangle"
          size={moderateScale(18)}
          color={styles.icon.color}
        />
        <View style={styles.texts}>
          <Text style={styles.title}>
            {t('mushafSettings.fallback.title', {rewayah: name})}
          </Text>
          <Text style={styles.body}>
            {t('mushafSettings.fallback.body', {rewayah: name})}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => choose(failed)}
          disabled={busy}
          style={({pressed}) => [
            styles.button,
            styles.primary,
            pressed && styles.primaryPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('mushafSettings.fallback.retryLabel', {
            rewayah: name,
          })}
          accessibilityState={{disabled: busy, busy}}
          testID="mushaf-options-fallback-retry">
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <Text style={[styles.buttonText, styles.primaryText]}>
              {t('mushafSettings.fallback.retry')}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => choose('hafs')}
          disabled={busy}
          style={({pressed}) => [
            styles.button,
            styles.secondary,
            pressed && styles.secondaryPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('mushafSettings.fallback.keepLabel')}
          accessibilityState={{disabled: busy}}
          testID="mushaf-options-fallback-keep">
          <Text style={styles.buttonText}>
            {t('mushafSettings.fallback.keep')}
          </Text>
        </Pressable>
      </View>
    </FadeInView>
  );
}

function createStyles(theme: Theme) {
  const text = Color(theme.colors.text);
  const amber = Color(AMBER);
  return StyleSheet.create({
    banner: {
      borderRadius: moderateScale(20),
      backgroundColor: amber.alpha(theme.isDarkMode ? 0.2 : 0.14).toString(),
      borderWidth: 1,
      borderColor: amber.alpha(0.3).toString(),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(14),
      marginBottom: SECTION_GAP,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: moderateScale(10),
    },
    icon: {
      color: theme.isDarkMode ? amber.lighten(0.6).toString() : '#8a5600',
    },
    texts: {
      flex: 1,
      gap: moderateScale(2),
    },
    title: {
      textAlign: 'left',
      fontSize: theme.typography.mediumSize,
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    body: {
      textAlign: 'left',
      fontSize: theme.typography.smallSize,
      fontFamily: 'Manrope-Regular',
      color: text.alpha(0.7).toString(),
      lineHeight: theme.typography.smallSize * 1.4,
    },
    actions: {
      flexDirection: 'row',
      gap: moderateScale(8),
      marginTop: moderateScale(12),
      paddingStart: moderateScale(28),
    },
    button: {
      minHeight: moderateScale(34),
      minWidth: moderateScale(88),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(14),
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: theme.colors.text,
    },
    primaryPressed: {
      backgroundColor: text.alpha(0.8).toString(),
    },
    secondary: {
      backgroundColor: text.alpha(0.08).toString(),
    },
    secondaryPressed: {
      backgroundColor: text.alpha(0.14).toString(),
    },
    buttonText: {
      fontSize: theme.typography.smallSize,
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    primaryText: {
      color: theme.colors.background,
    },
  });
}
