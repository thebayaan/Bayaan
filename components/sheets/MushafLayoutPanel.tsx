// @ai-generated
import React from 'react';
import {
  StyleSheet,
  ScrollView as RNScrollView,
  type ScrollViewProps,
} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {
  MushafOptionsContent,
  type MushafOptionsContext,
} from '@/components/mushaf-options/MushafOptionsContent'; // @ai

export type MushafLayoutContext = MushafOptionsContext; // @ai

/**
 * The Reading options (components/mushaf-options). Fills its parent: the
 * sheet, or the iPad popover (which gives it a height). @ai
 */
export function MushafLayoutPanel({
  context,
  ScrollComponent = RNScrollView,
  onClose,
  onGrow,
  onShrink,
  inLibrarySheet = false,
}: {
  context?: MushafLayoutContext;
  /** The sheet passes its own ScrollView so drags scroll before closing. */
  ScrollComponent?: React.ComponentType<ScrollViewProps>;
  // @ai-start
  /** Closes the popover; the sheet hides itself. */
  onClose?: () => void;
  /** Snaps the React Native sheet to its top point. */
  onGrow?: () => void;
  /** Snaps it back to its opening point. */
  onShrink?: () => void;
  /** On react-native-actions-sheet, whose background is drawn here. */
  inLibrarySheet?: boolean;
  // @ai-end
}) {
  return (
    <MushafOptionsContent
      context={context}
      ScrollComponent={ScrollComponent}
      onClose={onClose}
      onGrow={onGrow}
      onShrink={onShrink}
      crossfadeBackground={inLibrarySheet}
    />
  );
}

/** The phone sheet's height, as a share of the window. @ai */
export const MUSHAF_SHEET_HEIGHT_RATIO = 0.82;

export const createStyles = (theme: Theme, windowHeight: number) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
      height: windowHeight * MUSHAF_SHEET_HEIGHT_RATIO, // @ai
    },
    // @ai: the sheet's content area
    fill: {
      flex: 1,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
  });
