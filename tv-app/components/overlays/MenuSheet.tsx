import React from 'react';
import {StyleSheet, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusText} from '../primitives/focusContext';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type SheetProps = {
  /** Art beside the title: a portrait, a surah tile. */
  art: React.ReactNode;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * A long-press menu: a scrim over the screen and a sheet of rows in the
 * middle. The rows trap focus in every direction (TVFocusGuideView trapFocus*,
 * which both the tvOS focus engine and Android's focus search honour), so the
 * arrows can never reach the screen or the sidebar behind the scrim.
 */
export function MenuSheet({
  art,
  kicker,
  title,
  subtitle,
  children,
}: SheetProps): React.ReactElement {
  return (
    <View style={menuStyles.scrim}>
      <View style={menuStyles.sheet}>
        <View style={menuStyles.header} accessible={false}>
          {art}
          <View style={menuStyles.headerMeta}>
            <Text style={menuStyles.kicker} numberOfLines={1}>
              {kicker}
            </Text>
            <Text style={menuStyles.name} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={menuStyles.sub} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <TVFocusGuideView
          autoFocus
          trapFocusUp
          trapFocusDown
          trapFocusLeft
          trapFocusRight
          style={menuStyles.rows}>
          {children}
        </TVFocusGuideView>
      </View>
    </View>
  );
}

export type MenuRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  /** Drawn at the row's end: a check for a playlist the surah is in. */
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  /** The row's pressable view, to ask for focus when a menu page swaps. */
  ref?: React.Ref<View>;
};

/** One menu action: unfilled at rest, cream with ink text on focus. */
export function MenuRow({
  icon,
  label,
  onPress,
  hasTVPreferredFocus,
  trailing,
  accessibilityLabel,
  ref,
}: MenuRowProps): React.ReactElement {
  return (
    <FocusableButton
      ref={ref}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.03}
      style={menuStyles.row}>
      <View style={menuStyles.rowInner}>
        <View style={menuStyles.iconSlot}>{icon}</View>
        <FocusText style={menuStyles.rowLabel} numberOfLines={1}>
          {label}
        </FocusText>
        {trailing ? <View style={menuStyles.trailing}>{trailing}</View> : null}
      </View>
    </FocusableButton>
  );
}

export const menuStyles = createScaledStyles({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  sheet: {
    width: 640,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 8,
  },
  portrait: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  portraitPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  initial: {
    color: colors.text,
    fontFamily: fonts.light,
    fontSize: 38,
    fontWeight: '300',
    opacity: 0.55,
  },
  headerMeta: {flex: 1, gap: 4},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  rows: {gap: 4},
  row: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
  },
  rowInner: {flexDirection: 'row', alignItems: 'center', gap: 18},
  iconSlot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  trailing: {marginLeft: 8},
});
