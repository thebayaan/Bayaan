// @ai-start
import React, {type ReactNode} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {SymbolView} from 'expo-symbols';
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

/** Height of every tinted header item: the back button and the action pill. */
export const HEADER_ITEM_SIZE = moderateScale(40);
/** The action pill's inset on each side of its buttons. */
export const HEADER_PILL_PADDING = moderateScale(10);

/** Our tinted glass capsule for header buttons. */
export function GlassHeaderPill({
  children,
  round = false,
}: {
  children: ReactNode;
  /** A circle the size of HEADER_ITEM_SIZE (the back button). */
  round?: boolean;
}) {
  const glassTint = useGlassTint();
  const colorScheme = useGlassColorScheme();
  return (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={colorScheme}
      tintColor={glassTint}
      isInteractive
      style={[styles.pill, round && styles.round]}>
      {children}
    </GlassView>
  );
}

function TintedBackButton() {
  const router = useRouter();
  const {theme} = useTheme();
  const {t} = useTranslation('common');
  return (
    <GlassHeaderPill round>
      <Pressable
        // Opened first (restored, or from a link), there is nothing to go
        // back to: go to Home instead of leaving the reader stuck.
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/')
        }
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('actions.back')}>
        {/* SF chevron.backward. The fixed-direction names keep it pointing
            the right way whatever layout direction the bar reports. */}
        <SymbolView
          name={isRTL ? 'chevron.right' : 'chevron.left'}
          size={moderateScale(20)}
          tintColor={theme.colors.text}
          weight="medium"
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

/**
 * tintedBackOptions for screens that can be the first screen (restored, or
 * opened from a link): the back button always shows. `leadingWidth` widens
 * the left item to match a right item, so the title centers on screen.
 */
export function tintedRootBackOptions(
  leadingWidth: number = HEADER_ITEM_SIZE,
): Partial<NativeStackNavigationOptions> {
  if (!USE_GLASS) return {};
  return {
    headerBackVisible: false,
    unstable_headerLeftItems: () => [
      {
        type: 'custom',
        hidesSharedBackground: true,
        element: (
          <View style={[styles.leading, {width: leadingWidth}]}>
            <TintedBackButton />
          </View>
        ),
      },
    ],
  };
}

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
    borderRadius: HEADER_ITEM_SIZE / 2,
    minWidth: HEADER_ITEM_SIZE,
    height: HEADER_ITEM_SIZE,
    paddingHorizontal: HEADER_PILL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  round: {
    width: HEADER_ITEM_SIZE,
    paddingHorizontal: 0,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
// @ai-end
