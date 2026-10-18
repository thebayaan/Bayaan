import React, {useContext} from 'react';
import {
  ScrollView,
  Text,
  TVFocusGuideView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {SCREEN_GUTTER} from '../../theme/spacing';

/** Home's horizontal gutter; rails bleed past it so cards scroll to the edge. */
export const HOME_GUTTER = SCREEN_GUTTER;

/** How far above a focused rail's top Home scrolls, so its title shows. */
export const RAIL_TOP_GAP = 36;

/** Room above and below a row's cards for a focused card's scale and ring. */
const ROW_PAD_V = 18;

/**
 * Lets a card tell its rail it took focus, so Home can bring the whole rail
 * (title included) into view. Home's cards pass it to their onFocus.
 */
const RailFocusContext = React.createContext<(() => void) | undefined>(
  undefined,
);

export function useRailFocus(): (() => void) | undefined {
  return useContext(RailFocusContext);
}

type Props = {
  title: string;
  children: React.ReactNode;
  /** A card in the rail took focus. */
  onFocusRail?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * A titled row on Home. The first card lines up with the hero's text and
 * the row scrolls out to the screen edge. autoFocus makes Up/Down land on
 * the row's first (or last focused) card instead of the nearest one.
 */
export function HomeRail({
  title,
  children,
  onFocusRail,
  onLayout,
}: Props): React.ReactElement {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <TVFocusGuideView autoFocus style={styles.bleed}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}>
          <RailFocusContext.Provider value={onFocusRail}>
            {children}
          </RailFocusContext.Provider>
        </ScrollView>
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  // The empty band above each title (the row above's bottom padding plus
  // this margin) is taller than RAIL_TOP_GAP, so a rail scrolled to the top
  // never shows a clipped sliver of the row above at the screen's edge.
  section: {marginBottom: RAIL_TOP_GAP - ROW_PAD_V + 2},
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 26,
    letterSpacing: -0.3,
  },
  bleed: {marginHorizontal: -HOME_GUTTER},
  row: {
    gap: 24,
    paddingHorizontal: HOME_GUTTER,
    paddingVertical: ROW_PAD_V,
  },
});
