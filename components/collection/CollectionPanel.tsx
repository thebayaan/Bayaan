// @ai-generated
import React from 'react';
import {View} from 'react-native';
import Color from 'color';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {GRID_PADDING} from '@/components/collection/CollectionGridTile';

/**
 * Rows of a Collection list drawn as one rounded panel: inset from the
 * screen edge, the first and last rows round the corners, and a hairline
 * between rows that starts after the artwork.
 */

export const PANEL_RADIUS = moderateScale(18);
/** Where the separator starts: row padding + 50pt art + its margin. */
const SEPARATOR_INSET =
  moderateScale(18) + moderateScale(50) + moderateScale(12);

export function usePanelColor(): string {
  const {theme} = useTheme();
  return Color(theme.colors.text)
    .alpha(theme.isDarkMode ? 0.07 : 0.045)
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
        marginHorizontal: GRID_PADDING,
        backgroundColor: panel,
        overflow: 'hidden',
        borderTopLeftRadius: first ? PANEL_RADIUS : 0,
        borderTopRightRadius: first ? PANEL_RADIUS : 0,
        borderBottomLeftRadius: last ? PANEL_RADIUS : 0,
        borderBottomRightRadius: last ? PANEL_RADIUS : 0,
        paddingTop: first ? moderateScale(4) : 0,
        paddingBottom: last ? moderateScale(4) : 0,
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
            backgroundColor: Color(theme.colors.text).alpha(0.12).string(),
          }}
        />
      ) : null}
    </View>
  );
}
