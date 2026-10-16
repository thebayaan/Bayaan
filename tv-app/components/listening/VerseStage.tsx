import React from 'react';
import {Text, View} from 'react-native';
import {SurahGlyph} from '../brand/SurahGlyph';
import {getBasmala} from '../../services/verseData';
import {colors} from '../../theme/colors';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  surahNumber: number;
  surahName: string;
  /** Verse being recited, 0 for the opening, null when the recitation isn't synced. */
  ayah: number | null;
  arabic: string[];
  translation: string[] | null;
  /** Smaller, dimmer layout while the controls tray is up. */
  compact: boolean;
  /** Extra line under the verse reference, such as the repeat count. */
  note?: string | null;
};

// Long verses step the Arabic size down so one never spills off a 10-foot
// screen; Al-Baqarah 282 is the longest at about 1,100 characters.
function arabicSize(text: string, compact: boolean): number {
  const base = compact ? 44 : 64;
  if (text.length > 600) return base * 0.5;
  if (text.length > 360) return base * 0.62;
  if (text.length > 200) return base * 0.78;
  return base;
}

/**
 * The verse being recited in Arabic with its translation, under the surah's
 * calligraphy. Recitations without verse timings show the calligraphy and the
 * surah's name only, rather than guess which verse is playing.
 */
export function VerseStage({
  surahNumber,
  surahName,
  ayah,
  arabic,
  translation,
  compact,
  note,
}: Props): React.ReactElement {
  const total = arabic.length;
  let arabicText: string | null = null;
  let translationText: string | null = null;
  let reference: string | null = null;

  if (ayah !== null && ayah > 0) {
    arabicText = arabic[ayah - 1] ?? null;
    translationText = translation?.[ayah - 1] ?? null;
    reference = `Verse ${ayah} of ${total}`;
  } else if (ayah === 0 && surahNumber !== 9) {
    // The opening before verse 1. Al-Fatihah's first verse is the basmala
    // itself, and At-Tawbah has none.
    arabicText = surahNumber === 1 ? null : getBasmala();
    translationText =
      surahNumber === 1
        ? null
        : 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
  }

  const fontSize = arabicText ? arabicSize(arabicText, compact) : 0;

  return (
    <View
      style={[styles.stage, compact && styles.stageCompact]}
      pointerEvents="none">
      {!compact || !arabicText ? (
        <SurahGlyph
          surahNumber={surahNumber}
          size={arabicText ? 84 : 150}
          color={colors.text}
          style={styles.glyph}
        />
      ) : null}
      {arabicText ? (
        <Text
          style={[
            styles.arabic,
            quranTextFontAvailable && {fontFamily: quranTextFontFamily},
            {fontSize, lineHeight: fontSize * 1.75},
            compact && styles.dim,
          ]}>
          {arabicText}
        </Text>
      ) : null}
      {translationText && !compact ? (
        <Text style={styles.translation}>{translationText}</Text>
      ) : null}
      {ayah === null ? <Text style={styles.surahName}>{surahName}</Text> : null}
      {reference ? (
        <Text style={styles.reference}>
          {note ? `${reference} · ${note}` : reference}
        </Text>
      ) : null}
    </View>
  );
}

const styles = createScaledStyles({
  stage: {
    position: 'absolute',
    left: 160,
    right: 160,
    top: 0,
    bottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  stageCompact: {bottom: 330},
  glyph: {opacity: 0.9, marginBottom: 6},
  arabic: {
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
    maxWidth: 1500,
  },
  dim: {opacity: 0.75},
  translation: {
    color: colors.text,
    opacity: 0.82,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 30,
    lineHeight: 44,
    textAlign: 'center',
    maxWidth: 1240,
  },
  surahName: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 26,
  },
  reference: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 20,
    letterSpacing: 1,
    marginTop: 6,
  },
});
