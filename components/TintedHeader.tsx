// @ai-start
import React, {type ReactNode} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {Ionicons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import type {NativeStackNavigationOptions} from 'expo-router/native-stack';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint,
} from '@/hooks/useGlassProps';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {isRTL} from '@/utils/rtl';

// iOS draws its own untinted glass behind header buttons. These helpers hide
// that glass and draw ours instead, tinted with the shared glass tint (and
// its dial), like the Mushaf title pill.

/** Our tinted glass capsule for header buttons. */
export function GlassHeaderPill({children}: {children: ReactNode}) {
  const glassTint = useGlassTint();
  const colorScheme = useGlassColorScheme();
  return (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={colorScheme}
      tintColor={glassTint}
      isInteractive
      style={styles.pill}>
      {children}
    </GlassView>
  );
}

function TintedBackButton() {
  const router = useRouter();
  const {theme} = useTheme();
  const {t} = useTranslation('common');
  return (
    <GlassHeaderPill>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('actions.back')}>
        <Ionicons
          name={isRTL ? 'chevron-forward' : 'chevron-back'}
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      </Pressable>
    </GlassHeaderPill>
  );
}

/**
 * Screen options that swap iOS's back button for ours in tinted glass.
 * Screens with their own left items or no back button override
 * `unstable_headerLeftItems` themselves.
 */
export const tintedBackOptions: Partial<NativeStackNavigationOptions> =
  USE_GLASS
    ? {
        headerBackVisible: false,
        unstable_headerLeftItems: ({canGoBack}) =>
          canGoBack
            ? [
                {
                  type: 'custom',
                  hidesSharedBackground: true,
                  element: <TintedBackButton />,
                },
              ]
            : [],
      }
    : {};

/** `headerRight`, drawn in our tinted glass on glass devices. */
export function tintedHeaderRight(
  render: (() => ReactNode) | undefined,
): Partial<NativeStackNavigationOptions> {
  if (!USE_GLASS || !render) return {headerRight: render};
  return {
    headerRight: undefined,
    unstable_headerRightItems: () => [
      {
        type: 'custom',
        hidesSharedBackground: true,
        element: <GlassHeaderPill>{render()}</GlassHeaderPill>,
      },
    ],
  };
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    minWidth: moderateScale(40),
    minHeight: moderateScale(40),
    paddingHorizontal: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
// @ai-end
