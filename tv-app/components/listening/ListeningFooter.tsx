import React from 'react';
import {Image} from 'expo-image';
import {Text, View} from 'react-native';
import {ProgressLine} from './ProgressLine';
import {getReciterArtwork} from '../../services/reciterArtwork';
import type {Reciter} from '../../types/reciter';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  reciter: Reciter | null;
  reciterName: string;
  /** "Murattal · Hafs", or empty. */
  rewayah: string;
  progress: number;
  /** Active listening settings, such as "Repeat verse 3×" or "Rain". */
  chips: string[];
  /**
   * What the recitation is doing when it isn't simply playing ("Paused",
   * "Loading"), so the room never looks like it's playing when it isn't.
   */
  state?: string | null;
};

/**
 * The quiet footer while the tray is down: who is reciting (round face, name,
 * rewayah), how far along the surah is, and small chips for whatever is
 * changing the listening (repeat, speed, ambience, sleep).
 */
export function ListeningFooter({
  reciter,
  reciterName,
  rewayah,
  progress,
  chips,
  state = null,
}: Props): React.ReactElement {
  const artwork = getReciterArtwork(reciter);
  return (
    <View style={styles.foot} pointerEvents="none">
      <View style={styles.who}>
        <View style={styles.face}>
          {artwork ? (
            <Image
              source={artwork}
              style={styles.faceImg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={styles.initial}>
              {reciterName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.whoText}>
          <Text style={styles.name} numberOfLines={1}>
            {reciterName}
          </Text>
          {rewayah ? (
            <Text style={styles.sub} numberOfLines={1}>
              {rewayah}
            </Text>
          ) : null}
        </View>
      </View>
      <ProgressLine progress={progress} />
      {state ? (
        <View style={styles.state}>
          <View style={styles.stateDot} />
          <Text style={styles.stateText} numberOfLines={1}>
            {state}
          </Text>
        </View>
      ) : null}
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map(chip => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const FACE = 64;

const styles = createScaledStyles({
  foot: {
    position: 'absolute',
    left: 96,
    right: 96,
    bottom: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
  },
  who: {flexDirection: 'row', alignItems: 'center', gap: 18, maxWidth: 460},
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceImg: {width: '100%', height: '100%'},
  initial: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 26,
  },
  whoText: {flexShrink: 1},
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 17,
    marginTop: 2,
  },
  chips: {flexDirection: 'row', gap: 10},
  // Sky, like other indicators: a dot and the word, no fill.
  state: {flexDirection: 'row', alignItems: 'center', gap: 10},
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  stateText: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(244,243,236,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.text,
    opacity: 0.85,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 16,
  },
});
