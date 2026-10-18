import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {useContextMenuStore} from '../../store/contextMenuStore';

type Props = {
  surahNumber: number;
  name: string;
  /** Listening progress 0-1 for a started surah, else 0. */
  progress?: number;
  onSelect: (surahNumber: number) => void;
  hasTVPreferredFocus?: boolean;
};

export const SURAH_TILE_WIDTH = 252;
const ART_HEIGHT = 168;

/** A surah's artwork card with a cream ring on focus and its number in the corner. */
function SurahTileImpl({
  surahNumber,
  name,
  progress = 0,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const started = progress > 0.02 && progress < 0.97;
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(surahNumber)}
      onLongPress={() =>
        useContextMenuStore
          .getState()
          .openSurah({surahNumber, origin: 'surahs'})
      }
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Play ${name}, surah ${surahNumber}`}>
      <FocusFrame radius={14} style={styles.frame}>
        <SurahArtwork
          surahNumber={surahNumber}
          glyphSize={64}
          id={`surah-tile-${surahNumber}`}
        />
        {/* The card carries the name; the number sits in its corner. */}
        <Text style={styles.num}>{surahNumber}</Text>
        {started ? (
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${progress * 100}%`}]} />
          </View>
        ) : null}
      </FocusFrame>
    </FocusableCard>
  );
}

export const SurahTile = React.memo(SurahTileImpl);

const styles = createScaledStyles({
  card: {width: SURAH_TILE_WIDTH},
  frame: {width: SURAH_TILE_WIDTH, height: ART_HEIGHT},
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 5,
    backgroundColor: 'rgba(5,11,16,0.55)',
  },
  fill: {height: '100%', backgroundColor: colors.accent},
  num: {
    position: 'absolute',
    top: 10,
    left: 14,
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
});
