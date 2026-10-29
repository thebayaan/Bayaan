import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {ReciterPortrait} from '../browse/ReciterPortrait';
import {HeartIcon} from '../../../components/Icons';
import {progressOf} from '../../services/libraryFormat';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

/** Square artwork side, in design px (six across at 1920). */
export const SHELF_ART = 238;
/** Ring width plus the ink gap FocusFrame reserves on each side. */
export const SHELF_RING = 9;
const FRAME = SHELF_ART + SHELF_RING * 2;
const ART_RADIUS = 22;
const BADGE = 50;

type SurahProps = {
  surahNumber: number;
  surahName: string;
  /** The voice, for the face badge; null while the catalog has no match. */
  reciter: Reciter | null;
  caption: string;
  loved: boolean;
  /** Listening progress for an unfinished surah, else null. */
  progress: {positionSeconds: number; durationSeconds: number} | null;
  onPress: () => void;
  onLongPress?: () => void;
  hasTVPreferredFocus?: boolean;
  /** Smaller tiles (the first-run starter row) pass their art size. */
  art?: number;
  idPrefix: string;
  accessibilityLabel: string;
};

/**
 * A surah in one voice: the R2 surah card, the reciter's face in the top
 * right corner, a sky progress line when unfinished, and two lines below
 * (name; voice, time left, a heart when loved).
 */
function ShelfSurahTileImpl({
  surahNumber,
  surahName,
  reciter,
  caption,
  loved,
  progress,
  onPress,
  onLongPress,
  hasTVPreferredFocus,
  art = SHELF_ART,
  idPrefix,
  accessibilityLabel,
}: SurahProps): React.ReactElement {
  const ratio = art / SHELF_ART;
  const badge = Math.round(BADGE * ratio);
  const inset = Math.round(12 * ratio);
  const fraction = progress ? progressOf(progress) : 0;
  return (
    <FocusableCard
      ring={false}
      style={{width: scale(art + SHELF_RING * 2)}}
      onPress={onPress}
      onLongPress={onLongPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={accessibilityLabel}>
      <FocusFrame
        radius={Math.round(ART_RADIUS * ratio)}
        style={{
          width: scale(art + SHELF_RING * 2),
          height: scale(art + SHELF_RING * 2),
        }}>
        <SurahArtwork
          surahNumber={surahNumber}
          glyphSize={Math.round(96 * ratio)}
          id={`${idPrefix}-${surahNumber}-${reciter?.id ?? 'x'}`}
        />
        {reciter ? (
          <View
            style={[
              styles.badge,
              {
                top: scale(inset),
                right: scale(inset),
                width: scale(badge),
                height: scale(badge),
                borderRadius: scale(badge / 2),
              },
            ]}>
            <ReciterPortrait
              reciter={reciter}
              size={badge}
              idPrefix={`${idPrefix}-badge`}
            />
          </View>
        ) : null}
        {progress ? (
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${fraction * 100}%`}]} />
          </View>
        ) : null}
      </FocusFrame>
      <TileLabels title={surahName} caption={caption} heart={loved} />
    </FocusableCard>
  );
}

export const ShelfSurahTile = React.memo(ShelfSurahTileImpl);

type ReciterProps = {
  reciter: Reciter;
  caption: string;
  onPress: () => void;
  onLongPress?: () => void;
  hasTVPreferredFocus?: boolean;
};

/** A reciter as a round portrait, the same size as the surah tiles. */
function ShelfReciterTileImpl({
  reciter,
  caption,
  onPress,
  onLongPress,
  hasTVPreferredFocus,
}: ReciterProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`${reciter.name}, ${caption}`}>
      <FocusFrame radius={SHELF_ART / 2} style={styles.frame}>
        <ReciterPortrait
          reciter={reciter}
          size={SHELF_ART}
          idPrefix="lib-reciter"
        />
      </FocusFrame>
      <TileLabels title={reciter.name} caption={caption} />
    </FocusableCard>
  );
}

export const ShelfReciterTile = React.memo(ShelfReciterTileImpl);

/** The two lines under a tile; brighter while the tile has focus. */
export function TileLabels({
  title,
  caption,
  heart,
  small,
}: {
  title: string;
  caption: string;
  heart?: boolean;
  small?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.labels}>
      <FocusText
        numberOfLines={1}
        style={[styles.title, small && styles.titleSmall]}
        color={colors.text}
        focusedColor={colors.text}>
        {title}
      </FocusText>
      {caption || heart ? (
        <View style={styles.captionRow}>
          {heart ? (
            <HeartIcon
              filled
              color={colors.textSecondary}
              size={scale(small ? 15 : 17)}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[styles.caption, small && styles.captionSmall]}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = createScaledStyles({
  card: {width: FRAME},
  frame: {width: FRAME, height: FRAME},
  badge: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(5,11,16,0.85)',
    backgroundColor: colors.surfaceElevated,
  },
  track: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(244,243,236,0.24)',
  },
  fill: {height: '100%', borderRadius: 3, backgroundColor: colors.accent},
  labels: {paddingHorizontal: SHELF_RING, marginTop: 9, gap: 4},
  title: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 25,
    letterSpacing: -0.2,
  },
  titleSmall: {fontSize: 23},
  captionRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  caption: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  captionSmall: {fontSize: 19},
});
