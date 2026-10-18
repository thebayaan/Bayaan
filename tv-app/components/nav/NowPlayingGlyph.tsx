import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Text, View} from 'react-native';
import type {TileState} from '../../services/nowPlayingTile';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {PlayIcon, RepeatIcon} from '../../../components/Icons';

type Props = {
  state: TileState;
  /** On the cream focus fill the glyph turns ink. */
  focused: boolean;
};

// Resting heights of the three bars, as a fraction of the glyph.
const BARS = [0.55, 1, 0.75];

/**
 * The now-playing tile's glyph, drawn at nav-icon size: sky level bars that
 * move while the recitation plays and hold still when it is paused or
 * loading, a ring with "!" after a failure, Play to continue, and Repeat
 * once the queue has finished. Sky marks state only; focus turns it ink.
 */
export function NowPlayingGlyph({state, focused}: Props): React.ReactElement {
  const tint = focused ? colors.onFocus : colors.accent;
  if (state === 'error') {
    return (
      <View style={[styles.ring, {borderColor: tint}]}>
        <Text style={[styles.mark, {color: tint}]}>!</Text>
      </View>
    );
  }
  if (state === 'resume') return <PlayIcon color={tint} size={scale(24)} />;
  if (state === 'finished') return <RepeatIcon color={tint} size={scale(26)} />;
  // Still bars are plain views: a stopped native-driver loop writes its
  // last value back after any reset, which froze them at whatever height
  // they stopped on (often three dots, read as "more", not "paused").
  if (state !== 'playing') {
    return <StillBars dim={state === 'loading'} tint={tint} />;
  }
  return <MovingBars tint={tint} />;
}

function StillBars({
  dim,
  tint,
}: {
  dim: boolean;
  tint: string;
}): React.ReactElement {
  return (
    <View style={[styles.bars, dim && styles.dim]}>
      {BARS.map((h, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {backgroundColor: tint, transform: [{scaleY: h}]},
          ]}
        />
      ))}
    </View>
  );
}

function MovingBars({tint}: {tint: string}): React.ReactElement {
  const values = useRef(BARS.map(h => new Animated.Value(h))).current;

  useEffect(() => {
    // Each bar rises and falls on its own period, so together they never
    // fall into step.
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 0.3,
            duration: 380 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 1,
            duration: 420 + i * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [values]);

  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {backgroundColor: tint, transform: [{scaleY: v}]},
          ]}
        />
      ))}
    </View>
  );
}

const styles = createScaledStyles({
  bars: {
    width: 26,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {width: 6, height: 24, borderRadius: 3},
  dim: {opacity: 0.5},
  ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 18,
  },
});
