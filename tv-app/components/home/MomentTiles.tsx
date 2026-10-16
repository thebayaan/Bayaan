import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {GradientFill} from '../brand/GradientFill';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

const TILE_W = 236;
const TILE_H = 176;
const RADIUS = 16;

type SurahTileProps = {
  surahNumber: number;
  surahName: string;
  onSelect: (surahNumber: number) => void;
};

/** A surah as its artwork card with the name below (moments, quick picks). */
function SurahTileImpl({
  surahNumber,
  surahName,
  onSelect,
}: SurahTileProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.tile}
      onPress={() => onSelect(surahNumber)}
      accessibilityLabel={`Play ${surahName}`}>
      <FocusFrame radius={RADIUS} style={styles.frame}>
        <SurahArtwork
          surahNumber={surahNumber}
          glyphSize={84}
          id={`home-tile-${surahNumber}`}
        />
      </FocusFrame>
      <FocusText
        style={styles.label}
        color={colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={1}>
        {surahName}
      </FocusText>
    </FocusableCard>
  );
}

export const SurahTile = React.memo(SurahTileImpl);

type AdhkarTileProps = {
  listId: string;
  title: string;
  arabicTitle: string;
  color: string;
  meta: string;
  onSelect: (listId: string) => void;
};

/**
 * An adhkar list among the surah tiles: its colour fading into ink, the
 * Arabic title in the corner, and title, count and minutes below.
 */
function AdhkarTileImpl({
  listId,
  title,
  arabicTitle,
  color,
  meta,
  onSelect,
}: AdhkarTileProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.adhkarTile}
      onPress={() => onSelect(listId)}
      accessibilityLabel={`${title} adhkar, ${meta}`}>
      <FocusFrame radius={RADIUS} style={styles.adhkarFrame}>
        <GradientFill
          colors={[colors.surfaceElevated, color]}
          id={`home-adhkar-${listId}`}
        />
        <View style={styles.adhkarScrim} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.arabic,
            quranTextFontAvailable && {fontFamily: quranTextFontFamily},
          ]}>
          {arabicTitle}
        </Text>
        <View style={styles.adhkarText}>
          <Text style={styles.adhkarTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.adhkarMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </FocusFrame>
    </FocusableCard>
  );
}

export const AdhkarTile = React.memo(AdhkarTileImpl);

const FRAME_PAD = 18; // FocusFrame ring 4 + gap 5, both sides

const styles = createScaledStyles({
  tile: {width: TILE_W + FRAME_PAD, gap: 10},
  frame: {width: TILE_W + FRAME_PAD, height: TILE_H + FRAME_PAD},
  label: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    paddingHorizontal: 12,
  },
  adhkarTile: {width: 320 + FRAME_PAD},
  adhkarFrame: {width: 320 + FRAME_PAD, height: TILE_H + FRAME_PAD},
  adhkarScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(5,11,16,0.35)',
  },
  arabic: {
    position: 'absolute',
    top: 10,
    right: 18,
    maxWidth: 220,
    color: colors.text,
    fontSize: 40,
    lineHeight: 64,
    writingDirection: 'rtl',
  },
  adhkarText: {position: 'absolute', left: 20, right: 20, bottom: 18, gap: 4},
  adhkarTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
  },
  adhkarMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
  },
});
