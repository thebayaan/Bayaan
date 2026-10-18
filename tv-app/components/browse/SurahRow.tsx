import React from 'react';
import {View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText, useFocusTint} from '../primitives/focusContext';
import {SurahGlyph} from '../brand/SurahGlyph';
import {CheckIcon} from '../../../components/Icons';
import {surahGlyphsAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Surah} from '../../types/reciter';

type Props = {
  surah: Surah;
  /** Listening progress 0-1, or 0 when not started. */
  progress?: number;
  onSelect: (surahNumber: number) => void;
  /** Hold OK: the surah's menu. */
  onLongPress?: (surahNumber: number) => void;
  hasTVPreferredFocus?: boolean;
};

export const SURAH_ROW_HEIGHT = 88;

function Glyph({surahNumber}: {surahNumber: number}): React.ReactElement {
  const color = useFocusTint(colors.text, colors.onFocus);
  return (
    <SurahGlyph
      surahNumber={surahNumber}
      size={36}
      color={color}
      style={styles.glyph}
    />
  );
}

/**
 * A surah as a row on the reciter page: number, name, meaning and verse
 * count, the name in calligraphy on the right. Focus fills the row cream.
 */
function SurahRowImpl({
  surah,
  progress = 0,
  onSelect,
  onLongPress,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const completed = progress >= 0.97;
  const inProgress = progress > 0.02 && !completed;
  return (
    <FocusableButton
      onPress={() => onSelect(surah.id)}
      onLongPress={onLongPress ? () => onLongPress(surah.id) : undefined}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`${surah.name}, ${surah.translated_name_english}, ${surah.verses_count} verses`}
      focusScale={1.03}
      style={styles.row}>
      {focused => (
        <>
          <FocusText
            style={styles.num}
            color={colors.textTertiary}
            focusedColor={colors.onFocusSecondary}>
            {surah.id}
          </FocusText>
          <View style={styles.text}>
            <FocusText style={styles.name} numberOfLines={1}>
              {surah.name}
            </FocusText>
            <FocusText
              style={styles.sub}
              numberOfLines={1}
              color={colors.textSecondary}
              focusedColor={colors.onFocusSecondary}>
              {surah.translated_name_english} · {surah.verses_count} verses
            </FocusText>
          </View>
          {completed ? (
            <FocusIcon icon={CheckIcon} color={colors.accent} size={20} />
          ) : null}
          {surahGlyphsAvailable ? <Glyph surahNumber={surah.id} /> : null}
          {inProgress ? (
            <View style={[styles.track, focused && styles.trackFocused]}>
              <View
                style={[
                  styles.fill,
                  focused && styles.fillFocused,
                  {width: `${progress * 100}%`},
                ]}
              />
            </View>
          ) : null}
        </>
      )}
    </FocusableButton>
  );
}

export const SurahRow = React.memo(SurahRowImpl);

const styles = createScaledStyles({
  row: {
    height: SURAH_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingLeft: 22,
    paddingRight: 20,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  num: {
    width: 40,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    fontWeight: '600',
  },
  text: {flex: 1, gap: 3},
  name: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 15,
    fontWeight: '500',
  },
  glyph: {textAlign: 'right'},
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(244,243,236,0.12)',
  },
  trackFocused: {backgroundColor: 'rgba(6,21,28,0.18)'},
  fill: {height: '100%', backgroundColor: colors.accent},
  fillFocused: {backgroundColor: colors.onFocus},
});
