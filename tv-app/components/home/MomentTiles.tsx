import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {GradientFill} from '../brand/GradientFill';
import {useRailFocus} from './HomeRail';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

const TILE_W = 236;
const WIDE_W = 320;
const TILE_H = 176;
const RADIUS = 16;

type SurahTileProps = {
  surahNumber: number;
  surahName: string;
  /**
   * The line under the card. The artwork already names the surah, so this
   * says something new: its length, or the voice it plays in.
   */
  caption: string;
  onSelect: (surahNumber: number) => void;
  /** Long press: the surah menu. */
  onLongPress?: (surahNumber: number) => void;
  /** Unique per rail, for the artwork's gradient id. */
  idPrefix: string;
};

/** A surah as its artwork card with a caption below. */
function SurahTileImpl({
  surahNumber,
  surahName,
  caption,
  onSelect,
  onLongPress,
  idPrefix,
}: SurahTileProps): React.ReactElement {
  const onFocusRail = useRailFocus();
  return (
    <FocusableCard
      ring={false}
      style={styles.tile}
      onPress={() => onSelect(surahNumber)}
      onLongPress={onLongPress ? () => onLongPress(surahNumber) : undefined}
      onFocus={onFocusRail}
      accessibilityLabel={`Play ${surahName}, ${caption}`}>
      <FocusFrame radius={RADIUS} style={styles.frame}>
        <SurahArtwork
          surahNumber={surahNumber}
          glyphSize={84}
          id={`home-${idPrefix}-${surahNumber}`}
        />
      </FocusFrame>
      <Caption text={caption} />
    </FocusableCard>
  );
}

export const SurahTile = React.memo(SurahTileImpl);

type ColorTileProps = {
  /** Unique on Home, for the gradient id. */
  id: string;
  title: string;
  /** A second line inside the card, under the title. */
  subtitle?: string;
  /** Arabic title in the top corner (adhkar lists). */
  arabic?: string;
  /** The line under the card, level with the surah tiles' captions. */
  caption: string;
  color: string;
  onSelect: () => void;
  accessibilityLabel: string;
};

/**
 * A wide card in a colour fading into ink, for adhkar lists, collections,
 * playlists and "All ..." tiles: the title inside, a caption below so the
 * row's baseline matches the surah tiles beside it.
 */
function ColorTileImpl({
  id,
  title,
  subtitle,
  arabic,
  caption,
  color,
  onSelect,
  accessibilityLabel,
}: ColorTileProps): React.ReactElement {
  const onFocusRail = useRailFocus();
  return (
    <FocusableCard
      ring={false}
      style={styles.wideTile}
      onPress={onSelect}
      onFocus={onFocusRail}
      accessibilityLabel={accessibilityLabel}>
      <FocusFrame radius={RADIUS} style={styles.wideFrame}>
        <GradientFill
          colors={[colors.surfaceElevated, color]}
          id={`home-tile-${id}`}
        />
        <View style={styles.scrim} />
        {arabic ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.arabic,
              quranTextFontAvailable && {fontFamily: quranTextFontFamily},
            ]}>
            {arabic}
          </Text>
        ) : null}
        <View style={styles.wideText}>
          <Text style={styles.wideTitle} numberOfLines={subtitle ? 1 : 2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.wideSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </FocusFrame>
      <Caption text={caption} />
    </FocusableCard>
  );
}

export const ColorTile = React.memo(ColorTileImpl);

type AdhkarTileProps = {
  listId: string;
  title: string;
  arabicTitle: string;
  color: string;
  meta: string;
  onSelect: (listId: string) => void;
};

/** An adhkar list: its colour, the Arabic title, and count and minutes below. */
function AdhkarTileImpl({
  listId,
  title,
  arabicTitle,
  color,
  meta,
  onSelect,
}: AdhkarTileProps): React.ReactElement {
  return (
    <ColorTile
      id={`adhkar-${listId}`}
      title={title}
      arabic={arabicTitle}
      caption={meta}
      color={color}
      onSelect={() => onSelect(listId)}
      accessibilityLabel={`${title} adhkar, ${meta}`}
    />
  );
}

export const AdhkarTile = React.memo(AdhkarTileImpl);

function Caption({text}: {text: string}): React.ReactElement {
  return (
    <FocusText
      style={styles.caption}
      color={colors.textSecondary}
      focusedColor={colors.text}
      numberOfLines={1}>
      {text}
    </FocusText>
  );
}

const FRAME_PAD = 18; // FocusFrame ring 4 + gap 5, both sides

const styles = createScaledStyles({
  tile: {width: TILE_W + FRAME_PAD, gap: 10},
  frame: {width: TILE_W + FRAME_PAD, height: TILE_H + FRAME_PAD},
  caption: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 17,
    paddingHorizontal: 12,
  },
  wideTile: {width: WIDE_W + FRAME_PAD, gap: 10},
  wideFrame: {width: WIDE_W + FRAME_PAD, height: TILE_H + FRAME_PAD},
  scrim: {
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
  wideText: {position: 'absolute', left: 20, right: 20, bottom: 18, gap: 4},
  wideTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
  },
  wideSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
  },
});
