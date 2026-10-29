import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {FocusFrame, useFocusTint} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {HandsGlyph} from './SearchGlyphs';
import {ReciterPortrait} from '../browse/ReciterPortrait';
import {adhkarCount, type AdhkarList} from '../../services/adhkarData';
import {countLabel} from '../../services/search/adhkarArt';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {useContextMenuStore} from '../../store/contextMenuStore';
import type {Surah} from '../../../data/surahData';
import type {Reciter} from '../../types/reciter';

/** A surah as its art card, name and meaning below. */
export const SurahResultCard = React.memo(function SurahResultCard({
  surah,
  onPress,
  idPrefix,
}: {
  surah: Surah;
  onPress: (surah: Surah) => void;
  idPrefix: string;
}): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      onPress={() => onPress(surah)}
      onLongPress={() =>
        useContextMenuStore
          .getState()
          .openSurah({surahNumber: surah.id, origin: 'search'})
      }
      accessibilityLabel={`${surah.name}, surah ${surah.id}`}
      style={styles.surahCard}>
      <FocusFrame radius={16} style={styles.surahFrame}>
        <SurahArtwork
          surahNumber={surah.id}
          glyphSize={84}
          id={`${idPrefix}-${surah.id}`}
        />
      </FocusFrame>
      <FocusText
        style={styles.name}
        color={colors.text}
        focusedColor={colors.text}
        numberOfLines={1}>
        {surah.name}
      </FocusText>
      <Text style={styles.sub} numberOfLines={1}>
        {surah.translated_name_english} · {surah.id}
      </Text>
    </FocusableCard>
  );
});

/**
 * A reciter as a round portrait, name below. Without a photo the portrait is
 * the pigment monogram the Reciters tab uses, never a bare grey initial.
 */
export const PortraitCard = React.memo(function PortraitCard({
  reciter,
  onPress,
  size = 150,
  hasTVPreferredFocus,
  idPrefix = 'search-portrait',
}: {
  reciter: Reciter;
  onPress: (reciter: Reciter) => void;
  size?: number;
  hasTVPreferredFocus?: boolean;
  /** Gradient id prefix for the monogram, unique per screen. */
  idPrefix?: string;
}): React.ReactElement {
  const frame = size + 18;
  return (
    <FocusableCard
      ring={false}
      onPress={() => onPress(reciter)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={reciter.name}
      style={[styles.portraitCard, {width: scale(frame)}]}>
      <FocusFrame
        radius={size / 2}
        style={{width: scale(frame), height: scale(frame)}}>
        <ReciterPortrait reciter={reciter} size={size} idPrefix={idPrefix} />
      </FocusFrame>
      <FocusText
        style={styles.portraitName}
        color={colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={2}>
        {reciter.name}
      </FocusText>
    </FocusableCard>
  );
});

/** An adhkar list as a quiet outlined card. */
export function AdhkarResultCard({
  list,
  onPress,
}: {
  list: AdhkarList;
  onPress: (list: AdhkarList) => void;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={() => onPress(list)}
      accessibilityLabel={`${list.title} adhkar`}
      focusScale={1.04}
      style={styles.adhkarCard}>
      <AdhkarIcon />
      <View style={styles.adhkarText}>
        <FocusText style={styles.adhkarTitle} numberOfLines={1}>
          {list.title}
        </FocusText>
        <FocusText
          style={styles.adhkarSub}
          color={colors.textSecondary}
          focusedColor={colors.onFocusSecondary}
          numberOfLines={1}>
          {countLabel(adhkarCount(list.id))}
        </FocusText>
      </View>
    </FocusableButton>
  );
}

function AdhkarIcon(): React.ReactElement {
  return (
    <HandsGlyph
      color={useFocusTint(colors.accent, colors.onFocus)}
      size={scale(30)}
    />
  );
}

const SURAH_ART = 176;

const styles = createScaledStyles({
  surahCard: {width: SURAH_ART + 18, gap: 6},
  surahFrame: {width: SURAH_ART + 18, height: SURAH_ART + 18},
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 19,
    fontWeight: '600',
    paddingHorizontal: 9,
  },
  sub: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 9,
  },
  portraitCard: {alignItems: 'center', gap: 10},
  portraitName: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  adhkarCard: {
    width: 320,
    height: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  adhkarText: {flex: 1, gap: 2},
  adhkarTitle: {fontFamily: fonts.bold, fontSize: 20, fontWeight: '700'},
  adhkarSub: {fontFamily: fonts.medium, fontSize: 15, fontWeight: '500'},
});
