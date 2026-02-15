import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';

export const EDGE_BORDER_RADIUS = 40;
export const EDGE_LINE_SPACING = 4;
export const EDGE_HORIZONTAL_INSET = 4;
export const EDGE_INNERMOST_OFFSET = EDGE_LINE_SPACING * 2;
export const EDGE_INNERMOST_RADIUS = EDGE_BORDER_RADIUS - 8;

interface PageEdgeDecorationProps {
  isRightPage: boolean;
  borderColor: string;
  pageColor: string;
}

const PageEdgeDecoration: React.FC<PageEdgeDecorationProps> = ({
  isRightPage,
  borderColor,
  pageColor,
}) => {
  const insets = useSafeAreaInsets();
  const bw = 1;

  // Derive slightly darker shades from the page color for between-line fill strips
  const stripColors = useMemo(() => {
    const base = Color(pageColor);
    return [
      base.darken(0.08).toString(), // between outermost & middle
      base.darken(0.04).toString(), // between middle & innermost
    ];
  }, [pageColor]);

  const edgeLines = [
    {offset: 0, radius: EDGE_BORDER_RADIUS},
    {offset: EDGE_LINE_SPACING, radius: EDGE_BORDER_RADIUS},
    {offset: EDGE_INNERMOST_OFFSET, radius: EDGE_BORDER_RADIUS},
  ];

  // Fill strips sit between consecutive border lines on the outer edge only
  const fillStrips = [
    {
      outerOffset: EDGE_HORIZONTAL_INSET,
      innerOffset: EDGE_HORIZONTAL_INSET + EDGE_LINE_SPACING,
      color: stripColors[0],
      radius: EDGE_BORDER_RADIUS,
    },
    {
      outerOffset: EDGE_HORIZONTAL_INSET + EDGE_LINE_SPACING,
      innerOffset: EDGE_HORIZONTAL_INSET + EDGE_INNERMOST_OFFSET,
      color: stripColors[1],
      radius: EDGE_BORDER_RADIUS,
    },
  ];

  return (
    <>
      {/* Clipping container for fill strips — matches outermost border shape */}
      <View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: insets.top,
            bottom: insets.top,
            overflow: 'hidden',
          },
          isRightPage
            ? {
                right: EDGE_HORIZONTAL_INSET,
                borderTopRightRadius: EDGE_BORDER_RADIUS,
                borderBottomRightRadius: EDGE_BORDER_RADIUS,
              }
            : {
                left: EDGE_HORIZONTAL_INSET,
                borderTopLeftRadius: EDGE_BORDER_RADIUS,
                borderBottomLeftRadius: EDGE_BORDER_RADIUS,
              },
        ]}
        pointerEvents="none">
        {fillStrips.map(({outerOffset, innerOffset, color}, i) => (
          <View
            key={`fill-${i}`}
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                backgroundColor: color,
                width: innerOffset - outerOffset,
              },
              isRightPage
                ? {right: outerOffset - EDGE_HORIZONTAL_INSET}
                : {left: outerOffset - EDGE_HORIZONTAL_INSET},
            ]}
          />
        ))}
      </View>
      {/* Border lines */}
      {edgeLines.map(({offset, radius}, i) => (
        <View
          key={`line-${i}`}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: insets.top,
              bottom: insets.top,
              borderTopWidth: bw,
              borderTopColor: borderColor,
              borderBottomWidth: bw,
              borderBottomColor: borderColor,
            },
            isRightPage
              ? {
                  right: offset + EDGE_HORIZONTAL_INSET,
                  borderRightWidth: bw,
                  borderRightColor: borderColor,
                  borderTopRightRadius: radius,
                  borderBottomRightRadius: radius,
                }
              : {
                  left: offset + EDGE_HORIZONTAL_INSET,
                  borderLeftWidth: bw,
                  borderLeftColor: borderColor,
                  borderTopLeftRadius: radius,
                  borderBottomLeftRadius: radius,
                },
          ]}
          pointerEvents="none"
        />
      ))}
    </>
  );
};

export default React.memo(PageEdgeDecoration);
