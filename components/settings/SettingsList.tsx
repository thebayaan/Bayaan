// @ai-generated
import React, {useMemo} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {GlassView} from 'expo-glass-effect';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {moderateScale} from '@/utils/scale';
import {flipX} from '@/utils/rtl';
import type {Theme} from '@/utils/themeUtils';

/**
 * The Settings list parts every Settings screen is built from: a section
 * (sentence-case header, rounded card, optional footnote), and rows with an
 * outline icon, a title, an optional subtitle or trailing value, and a
 * trailing chevron, arrow, check or control. Separators start at the title.
 */

export type SettingsIconName = React.ComponentProps<typeof Feather>['name'];

export const SETTINGS_ICON_SIZE = moderateScale(21);
/** Row padding; section headers line up with the icons at this inset. */
export const SETTINGS_ROW_INSET = moderateScale(18);
const ICON_GAP = moderateScale(16);
const CHEVRON_SIZE = moderateScale(18);
/** Card bottom to the next section's header. */
const SECTION_GAP = moderateScale(22);
/** Header to its card. */
const HEADER_GAP = moderateScale(8);

export function useSettingsStyles(): SettingsStyles {
  const {theme} = useTheme();
  return useMemo(() => createStyles(theme), [theme]);
}

type SettingsStyles = ReturnType<typeof createStyles>;

/** A section: header, card, footnote. Children are rows. */
export function SettingsSection({
  title,
  footer,
  children,
  separatorInset = 'icon',
  style,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  /** Where separators start: under the title of icon rows, or flush. */
  separatorInset?: 'icon' | 'text' | 'none';
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const styles = useSettingsStyles();
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.header}>{title}</Text> : null}
      <SettingsCard separatorInset={separatorInset}>{children}</SettingsCard>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

/** The rounded card; puts a separator between its children. */
export function SettingsCard({
  children,
  separatorInset = 'icon',
  style,
}: {
  children: React.ReactNode;
  separatorInset?: 'icon' | 'text' | 'none';
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const styles = useSettingsStyles();
  const glassColorScheme = useGlassColorScheme();
  const items = React.Children.toArray(children).filter(Boolean);
  const separatorStyle =
    separatorInset === 'icon'
      ? styles.separatorIcon
      : separatorInset === 'text'
        ? styles.separatorText
        : null;
  const content = items.map((child, index) => (
    <React.Fragment key={index}>
      {index > 0 && separatorStyle ? (
        <View style={[styles.separator, separatorStyle]} />
      ) : null}
      {child}
    </React.Fragment>
  ));
  return USE_GLASS ? (
    <GlassView
      style={[styles.card, style]}
      glassEffectStyle="regular"
      colorScheme={glassColorScheme}>
      {content}
    </GlassView>
  ) : (
    <View style={[styles.card, style]}>{content}</View>
  );
}

export type SettingsAccessory =
  | 'chevron'
  | 'external'
  | 'check'
  | 'none'
  | React.ReactElement;

/** One row. Pass `onPress` for a tappable row. */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  accessory = 'none',
  onPress,
  selected,
  destructive,
  disabled,
  accessibilityRole,
  accessibilityHint,
}: {
  icon?: SettingsIconName | React.ReactElement;
  title: string;
  subtitle?: string;
  value?: string;
  accessory?: SettingsAccessory;
  onPress?: () => void;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'link' | 'radio' | 'switch';
  accessibilityHint?: string;
}): React.JSX.Element {
  const {theme} = useTheme();
  const styles = useSettingsStyles();
  const tone = destructive ? theme.colors.error : theme.colors.text;

  const leading =
    icon === undefined ? null : (
      <View style={styles.icon}>
        {typeof icon === 'string' ? (
          <Feather name={icon} size={SETTINGS_ICON_SIZE} color={tone} />
        ) : (
          icon
        )}
      </View>
    );

  const trailing =
    accessory === 'chevron' ? (
      <Feather
        name="chevron-right"
        size={CHEVRON_SIZE}
        color={styles.chevron.color}
        style={flipX}
      />
    ) : accessory === 'external' ? (
      <Feather
        name="arrow-up-right"
        size={CHEVRON_SIZE}
        color={styles.chevron.color}
      />
    ) : accessory === 'check' ? (
      selected ? (
        <Feather name="check" size={CHEVRON_SIZE} color={theme.colors.text} />
      ) : null
    ) : accessory === 'none' ? null : (
      accessory
    );

  const body = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text
          style={[
            styles.title,
            {color: tone},
            selected && accessory === 'check' && styles.titleSelected,
          ]}
          numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, disabled && styles.disabled]}
        accessible={accessibilityRole !== undefined}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({pressed}) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={
        accessibilityRole === 'radio' ? {checked: !!selected} : undefined
      }
      accessibilityHint={accessibilityHint}>
      {body}
    </Pressable>
  );
}

/** Explanatory text above a screen's first section. */
export function SettingsIntro({text}: {text: string}): React.JSX.Element {
  const styles = useSettingsStyles();
  return <Text style={styles.intro}>{text}</Text>;
}

function createStyles(theme: Theme) {
  const isDark = theme.isDarkMode;
  const muted = Color(theme.colors.text).alpha(0.55).toString();
  return StyleSheet.create({
    /** Padding for a Settings screen's scroll content. */
    page: {
      paddingHorizontal: moderateScale(16),
    },
    section: {
      marginBottom: SECTION_GAP,
    },
    header: {
      textAlign: 'left',
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      color: muted,
      marginBottom: HEADER_GAP,
      marginStart: SETTINGS_ROW_INSET,
    },
    footer: {
      textAlign: 'left',
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.5).toString(),
      marginTop: HEADER_GAP,
      marginHorizontal: SETTINGS_ROW_INSET,
      lineHeight: moderateScale(18),
    },
    intro: {
      textAlign: 'left',
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.5).toString(),
      marginHorizontal: SETTINGS_ROW_INSET,
      marginBottom: SECTION_GAP,
      lineHeight: moderateScale(20),
    },
    card: {
      backgroundColor: USE_GLASS
        ? undefined
        : isDark
          ? Color('#ffffff').alpha(0.07).toString()
          : '#ffffff',
      borderRadius: moderateScale(24),
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: moderateScale(56),
      paddingHorizontal: SETTINGS_ROW_INSET,
      paddingVertical: moderateScale(10),
      gap: ICON_GAP,
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    disabled: {
      opacity: 0.45,
    },
    icon: {
      width: SETTINGS_ICON_SIZE,
      alignItems: 'center',
    },
    texts: {
      flex: 1,
      gap: moderateScale(2),
    },
    title: {
      textAlign: 'left',
      fontSize: moderateScale(16.5),
      fontFamily: 'Manrope-Regular',
    },
    titleSelected: {
      fontFamily: 'Manrope-SemiBold',
    },
    subtitle: {
      textAlign: 'left',
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.5).toString(),
      lineHeight: moderateScale(18),
    },
    value: {
      maxWidth: '45%',
      fontSize: moderateScale(15.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.5).toString(),
    },
    chevron: {
      color: Color(theme.colors.text).alpha(0.35).toString(),
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.14).toString(),
      marginEnd: SETTINGS_ROW_INSET,
    },
    separatorIcon: {
      marginStart: SETTINGS_ROW_INSET + SETTINGS_ICON_SIZE + ICON_GAP,
    },
    separatorText: {
      marginStart: SETTINGS_ROW_INSET,
    },
  });
}
