import React, {useMemo, useState} from 'react';
import {Platform, Pressable, Text, TVFocusGuideView, View} from 'react-native';
import {NowPlayingGlyph} from './NowPlayingGlyph';
import {useNowPlayingTile} from '../../hooks/useNowPlayingTile';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  /** Right-aligned by default; centred where the screen keeps a clock top right. */
  align?: 'right' | 'center';
  /**
   * The screen has its own control at the top left (the reciter page's
   * '‹ Back'): the tvOS band starts past it, so Up from below still reaches
   * that control rather than being handed to the pill.
   */
  clearTopLeft?: boolean;
};

// Apple TV only: its focus engine looks for Up in a cone, so a pill in the
// corner is out of reach from buttons lower down the left of the screen. A
// guide across the whole top band catches Up from anywhere below and hands
// it to the pill. Android's focus finder reaches the pill on its own.
const NEEDS_TOP_GUIDE = Platform.OS === 'ios' && Platform.isTV;

/**
 * The way back to the player from stacked screens, which have no sidebar
 * (a reciter's page, a playlist, the adhkar reader): a pill at the top that
 * says what is playing and opens the player. Hidden when nothing is queued.
 */
export function NowPlayingPill({
  align = 'right',
  clearTopLeft = false,
}: Props): React.ReactElement | null {
  const {tile, press} = useNowPlayingTile();
  const [focused, setFocused] = useState(false);
  const [pill, setPill] = useState<View | null>(null);
  const destinations = useMemo(() => (pill ? [pill] : undefined), [pill]);

  // A relaunch's Continue stand-in belongs to the sidebar, not here.
  if (!tile || tile.state === 'resume') return null;

  return (
    <View
      style={[styles.bar, align === 'center' && styles.barCenter]}
      pointerEvents="box-none">
      {NEEDS_TOP_GUIDE && destinations ? (
        <TVFocusGuideView
          destinations={destinations}
          style={[styles.band, clearTopLeft && styles.bandPastLeft]}
        />
      ) : null}
      <Pressable
        ref={setPill}
        onPress={press}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={tile.accessibilityLabel}
        style={[styles.pill, focused && styles.pillFocused]}>
        <NowPlayingGlyph state={tile.state} focused={focused} />
        <Text
          numberOfLines={1}
          style={[styles.label, focused && styles.labelFocused]}>
          {tile.label}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.title, focused && styles.titleFocused]}>
          {tile.title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = createScaledStyles({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    // Inside the title-safe area (tvOS insets 60 at the top).
    paddingTop: 60,
    paddingHorizontal: 80,
    alignItems: 'flex-end',
  },
  barCenter: {alignItems: 'center'},
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 156,
  },
  // Past the reciter page's '‹ Back' (left 64, about 120 wide).
  bandPastLeft: {left: 320},
  pill: {
    height: 56,
    maxWidth: 560,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(5,11,16,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pillFocused: {
    backgroundColor: colors.focusFill,
    borderColor: colors.focusFill,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 16,
  },
  labelFocused: {color: colors.onFocusSecondary},
  title: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
  },
  titleFocused: {color: colors.onFocus},
});
