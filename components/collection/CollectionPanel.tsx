// @ai-generated
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {
  GROUPED_CARD_RADIUS,
  SETTINGS_ROW_INSET,
  groupedCardColor,
  groupedSeparatorColor,
} from '@/components/settings/SettingsList';

/**
 * Rows of a Collection list drawn as one inset-grouped panel in the
 * Settings look (components/settings/SettingsList): 16pt from the screen
 * edge, the same card fill and corner radius, 48pt artwork in 64pt rows,
 * 16pt from the panel's edges to the artwork (concentric corners),
 * and a hairline from where the text starts to the row's end inset.
 */

/** Side margin of the panel, matching the screen's other content. */
export const PANEL_MARGIN = moderateScale(16);
export const PANEL_RADIUS = GROUPED_CARD_RADIUS;
/** Leading and trailing padding inside a row. */
export const PANEL_ROW_PADDING = SETTINGS_ROW_INSET;
/** Row artwork: size, corner radius and the gap before the text. */
export const PANEL_ART_SIZE = moderateScale(48);
export const PANEL_ART_RADIUS = moderateScale(8);
export const PANEL_ART_GAP = moderateScale(12);
/** Top and bottom padding of a row, so an art row is 64pt tall. */
export const PANEL_ROW_VERTICAL = moderateScale(8);
const SEPARATOR_INSET = PANEL_ROW_PADDING + PANEL_ART_SIZE + PANEL_ART_GAP;
/** Extra space at the panel's top and bottom, so the first and last
 *  artwork sit as far from the corner's top edge as from its side, which
 *  keeps their 8pt corners concentric with the panel's 24pt ones. */
const PANEL_EDGE_EXTRA = PANEL_ROW_PADDING - PANEL_ROW_VERTICAL;

export function usePanelColor(): string {
  const {theme} = useTheme();
  return groupedCardColor(theme);
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
        paddingTop: first ? PANEL_EDGE_EXTRA : 0,
        paddingBottom: last ? PANEL_EDGE_EXTRA : 0,
      }}>
      {children}
      {!last ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            start: SEPARATOR_INSET,
            end: PANEL_ROW_PADDING,
            height: StyleSheet.hairlineWidth,
            backgroundColor: groupedSeparatorColor(theme),
          }}
        />
      ) : null}
    </View>
  );
}
