import React from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

/** Home's horizontal gutter; rails bleed past it so cards scroll to the edge. */
export const HOME_GUTTER = 64;

type Props = {
  title: string;
  children: React.ReactNode;
};

/**
 * A titled row on Home. The first card lines up with the hero's text and
 * the row scrolls out to the screen edge. autoFocus makes Up/Down land on
 * the row's first (or last focused) card instead of the nearest one.
 */
export function HomeRail({title, children}: Props): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <TVFocusGuideView autoFocus style={styles.bleed}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}>
          {children}
        </ScrollView>
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  section: {marginBottom: 20},
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 26,
    letterSpacing: -0.3,
  },
  bleed: {marginHorizontal: -HOME_GUTTER},
  // Room above and below for a focused card's scale and ring.
  row: {
    gap: 24,
    paddingHorizontal: HOME_GUTTER,
    paddingVertical: 18,
  },
});
