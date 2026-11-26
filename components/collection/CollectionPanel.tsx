// @ai-generated
import React from 'react';
import {View} from 'react-native';
import Color from 'color';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';

/**
 * Rows of a Collection list drawn as one inset-grouped panel, with the
 * iOS list metrics: 16pt from the screen edge, the system corner radius
 * (larger on iOS 26), 48pt artwork in 64pt rows, and a hairline that
 * starts where the text starts and runs to the panel's edge.
 */

/** Side margin of the panel, matching the screen's other content. */
export const PANEL_MARGIN = moderateScale(16);
export const PANEL_RADIUS = USE_GLASS ? 26 : 12;
/** Leading and trailing padding inside a row. */
export const PANEL_ROW_PADDING = moderateScale(16);
/** Row artwork: size, corner radius and the gap before the text. */
export const PANEL_ART_SIZE = moderateScale(48);
export const PANEL_ART_RADIUS = moderateScale(8);
export const PANEL_ART_GAP = moderateScale(12);
/** Top and bottom padding of a row, so an art row is 64pt tall. */
export const PANEL_ROW_VERTICAL = moderateScale(8);
const SEPARATOR_INSET = PANEL_ROW_PADDING + PANEL_ART_SIZE + PANEL_ART_GAP;

export function usePanelColor(): string {
  const {theme} = useTheme();
  return Color(theme.colors.text)
    .alpha(theme.isDarkMode ? 0.08 : 0.05)
    .string();
}

export function PanelRow({
  first,
  last,
  children,
}: {
  first: boolean;
  last: boolean;
  children: React.ReactNode;
}) {
  const {theme} = useTheme();
  const panel = usePanelColor();
  return (
    <View
      style={{
        marginHorizontal: PANEL_MARGIN,
        backgroundColor: panel,
        overflow: 'hidden',
        borderCurve: 'continuous',
        borderTopLeftRadius: first ? PANEL_RADIUS : 0,
        borderTopRightRadius: first ? PANEL_RADIUS : 0,
        borderBottomLeftRadius: last ? PANEL_RADIUS : 0,
        borderBottomRightRadius: last ? PANEL_RADIUS : 0,
      }}>
      {children}
      {!last ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            start: SEPARATOR_INSET,
            end: 0,
            height: 0.5,
            backgroundColor: Color(theme.colors.text).alpha(0.14).string(),
          }}
        />
      ) : null}
    </View>
  );
}
