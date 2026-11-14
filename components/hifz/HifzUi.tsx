import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {flipX} from '@/utils/rtl';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

// Small building blocks shared by the hifz screens, in the app's card style
// (CONTRIBUTING.md "Card pattern").

export function useHifzStyles() {
  const {theme} = useTheme();
  return {theme, styles: createStyles(theme)};
}

export function SectionHeader({title}: {title: string}): React.JSX.Element {
  const {styles} = useHifzStyles();
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function Card({children}: {children: React.ReactNode}) {
  const {styles} = useHifzStyles();
  return <View style={styles.card}>{children}</View>;
}

export function LinkRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  const {styles, theme} = useHifzStyles();
  return (
    <Pressable
      style={styles.linkRow}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={styles.linkText}>{label}</Text>
      <Feather
        name="chevron-right"
        size={moderateScale(18)}
        color={Color(theme.colors.text).alpha(0.4).toString()}
        style={flipX}
      />
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}): React.JSX.Element {
  const {styles} = useHifzStyles();
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{selected}}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  const {styles, theme} = useHifzStyles();
  return (
    <Pressable
      style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
      onPress={onPress}
      accessibilityRole="button">
      <Text
        style={[styles.primaryButtonText, {color: theme.colors.background}]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  decreaseLabel,
  increaseLabel,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
}): React.JSX.Element {
  const {styles, theme} = useHifzStyles();
  const color = theme.colors.text;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.linkText}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          hitSlop={8}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}>
          <Feather name="minus" size={moderateScale(16)} color={color} />
        </Pressable>
        <Text style={styles.stepperValue}>{format(value)}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          hitSlop={8}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}>
          <Feather name="plus" size={moderateScale(16)} color={color} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sectionHeader: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      textTransform: 'uppercase',
      marginTop: moderateScale(8),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      padding: moderateScale(14),
      gap: moderateScale(10),
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(12),
    },
    linkText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    chip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    chipSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    chipText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    primaryButton: {
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(6),
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    stepperButton: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    stepperValue: {
      minWidth: moderateScale(36),
      textAlign: 'center',
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
