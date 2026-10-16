import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {surahGradient} from '../../theme/surahColors';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {ContinueEntry} from '../../services/continueListeningStore';
import type {LovedSurah} from '../../services/lovedSurahsStore';
import {progressOf, timeLeftLabel} from '../../services/libraryFormat';

type ContinueProps = {
  entry: ContinueEntry;
  surahName: string;
  reciterName: string;
  onSelect: (entry: ContinueEntry) => void;
  hasTVPreferredFocus?: boolean;
};

/**
 * An unfinished surah as a wide card: the surah's pigment and calligraphy,
 * its name, the reciter and the time left, with progress along the bottom.
 */
export function ContinueWideCard({
  entry,
  surahName,
  reciterName,
  onSelect,
  hasTVPreferredFocus,
}: ContinueProps): React.ReactElement {
  const id = `lib-continue-${entry.reciterId}-${entry.surahNumber}`;
  return (
    <FocusableCard
      style={styles.wide}
      focusScale={1.03}
      onPress={() => onSelect(entry)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Resume ${surahName} by ${reciterName}, ${timeLeftLabel(entry)}`}>
      <View style={styles.wideBody}>
        <View style={styles.thumb}>
          <GradientFill colors={surahGradient(entry.surahNumber)} id={id} />
          <SurahGlyph surahNumber={entry.surahNumber} size={58} />
        </View>
        <View style={styles.wideText}>
          <Text style={styles.wideTitle} numberOfLines={1}>
            {surahName}
          </Text>
          <Text style={styles.wideMeta} numberOfLines={1}>
            {reciterName ? `${reciterName} · ` : ''}
            {timeLeftLabel(entry)}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${progressOf(entry) * 100}%`}]} />
      </View>
    </FocusableCard>
  );
}

type FavoriteProps = {
  loved: LovedSurah;
  surahName: string;
  reciterName: string;
  onSelect: (loved: LovedSurah) => void;
  hasTVPreferredFocus?: boolean;
};

/** A favorite surah: its artwork card, with its name and voice below. */
export function FavoriteSurahCard({
  loved,
  surahName,
  reciterName,
  onSelect,
  hasTVPreferredFocus,
}: FavoriteProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.fav}
      onPress={() => onSelect(loved)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Play ${surahName}${reciterName ? ` by ${reciterName}` : ''}`}>
      <FocusFrame radius={16} style={styles.favFrame}>
        <SurahArtwork
          surahNumber={loved.surahNumber}
          glyphSize={78}
          id={`lib-fav-${loved.surahNumber}`}
        />
      </FocusFrame>
      <View style={styles.favText}>
        <FocusText
          style={styles.favTitle}
          color={colors.text}
          focusedColor={colors.text}
          numberOfLines={1}>
          {surahName}
        </FocusText>
        {reciterName ? (
          <Text style={styles.favMeta} numberOfLines={1}>
            {reciterName}
          </Text>
        ) : null}
      </View>
    </FocusableCard>
  );
}

const THUMB = 104;
const FAV_W = 280;

const styles = createScaledStyles({
  wide: {
    width: 540,
    height: 156,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
  },
  wideBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 22,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideText: {flex: 1, gap: 6},
  wideTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 26,
    letterSpacing: -0.3,
  },
  wideMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 18,
  },
  track: {
    height: 5,
    backgroundColor: 'rgba(244,243,236,0.14)',
  },
  fill: {height: '100%', backgroundColor: colors.accent},
  fav: {width: FAV_W, gap: 12},
  favFrame: {width: FAV_W, height: 190},
  favText: {paddingHorizontal: 9, gap: 3},
  favTitle: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 21},
  favMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
  },
});
