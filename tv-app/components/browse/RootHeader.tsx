import React from 'react';
import {Text, View} from 'react-native';
import {HomeClock} from '../home/HomeClock';
import {useClock} from '../../hooks/useClock';
import {colors} from '../../theme/colors';
import {
  SCREEN_CLOCK_RIGHT,
  SCREEN_CLOCK_TOP,
  SCREEN_GUTTER,
} from '../../theme/spacing';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

/**
 * The title type of every root place (Surahs, Reciters, Library, Adhkar),
 * so switching places in the sidebar never changes the title's size, weight
 * or line. Spread it into a title style; color and placement are the
 * screen's (RootTitle places it on the gutter).
 */
export const ROOT_TITLE_TEXT = {
  fontFamily: fonts.bold,
  fontWeight: '700',
  fontSize: 66,
  letterSpacing: -1.6,
} as const;

/** Where a root place's first row (its tabs or chips) starts below the title. */
export const ROOT_TITLE_GAP = 18;

type TitleProps = {
  title: string;
  /** A quiet line beside the title: how to reach what isn't on screen. */
  hint?: string;
};

/** A root place's title on the gutter, with an optional hint beside it. */
export function RootTitle({title, hint}: TitleProps): React.ReactElement {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The time and weekday, top right of a root place. Place it last in the
 * screen's full-size container, so it sits above the content; it never
 * takes focus.
 */
export function RootClock(): React.ReactElement {
  const now = useClock();
  return (
    <View style={styles.clock} pointerEvents="none">
      <HomeClock now={now} />
    </View>
  );
}

const styles = createScaledStyles({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 28,
    marginTop: 58,
    paddingLeft: SCREEN_GUTTER,
    // Clear of the clock.
    paddingRight: 260,
  },
  title: {color: colors.text, ...ROOT_TITLE_TEXT},
  hint: {
    flexShrink: 1,
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
  },
  clock: {
    position: 'absolute',
    top: SCREEN_CLOCK_TOP,
    right: SCREEN_CLOCK_RIGHT,
  },
});
