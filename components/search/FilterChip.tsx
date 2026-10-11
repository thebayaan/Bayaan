/**
 * FilterChip — RFC-020 shared chip primitive for the Search filter composer.
 *
 * Visual idiom lifted from the existing chip surfaces so the composer
 * introduces no parallel aesthetic: `BrowseReciters`' `filterChip*` styles
 * (the RFC-012 v1 strip) for colors/metrics, and the reanimated
 * FadeIn/FadeOut/LinearTransition treatment for enter/exit.
 *
 * Renders: label + optional live count + (when `onRemove` is provided) a
 * visible ✕ remove affordance with its own accessibility label — RFC-020's
 * "every pre-applied filter must read as editable" mitigation.
 */
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

export interface FilterChipProps {
  label: string;
  /** Optional live count rendered after the label (e.g. dimension chips). */
  count?: number;
  /** Renders the active/selected visual state. */
  selected?: boolean;
  /** Optional leading Feather icon (e.g. `plus` on "Add a filter"). */
  icon?: React.ComponentProps<typeof Feather>['name'];
  /** Press on the chip body (open/edit). */
  onPress?: () => void;
  /**
   * When provided, a ✕ affordance renders after the label and pressing it
   * fires this (independently of `onPress`).
   */
  onRemove?: () => void;
  /** Overrides the chip body's accessibility label (defaults to `label`). */
  accessibilityLabel?: string;
}

export default function FilterChip({
  label,
  count,
  selected = false,
  icon,
  onPress,
  onRemove,
  accessibilityLabel,
}: FilterChipProps) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const mutedColor = Color(theme.colors.textSecondary).alpha(0.5).toString();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(300)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{selected}}
        disabled={!onPress}
        style={({pressed}) => [
          styles.chip,
          selected && styles.chipActive,
          pressed && styles.chipPressed,
        ]}
        onPress={onPress}>
        {icon ? (
          <Feather
            name={icon}
            size={moderateScale(12)}
            color={selected ? theme.colors.text : mutedColor}
          />
        ) : null}
        <Text style={[styles.chipText, selected && styles.chipTextActive]}>
          {label}
        </Text>
        {count !== undefined ? (
          <Text style={styles.chipCount}>{count}</Text>
        ) : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label} filter`}
            hitSlop={moderateScale(8)}
            style={({pressed}) => [
              styles.removeButton,
              pressed && styles.removePressed,
            ]}
            onPress={onRemove}>
            <Feather
              name="x"
              size={moderateScale(12)}
              color={selected ? theme.colors.text : mutedColor}
            />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    // Mirrors BrowseReciters' filterChip* styles (RFC-012 v1 strip) so the
    // composer chips are visually indistinguishable from the bespoke ones.
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(2),
    },
    chipActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    chipPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    chipText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    chipTextActive: {
      color: theme.colors.text,
      fontFamily: theme.fonts.semiBold,
    },
    chipCount: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    removeButton: {
      marginLeft: moderateScale(2),
      padding: moderateScale(2),
      borderRadius: moderateScale(8),
    },
    removePressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
  });
}
