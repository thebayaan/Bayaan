import React from 'react';
import {Text, View} from 'react-native';
import {SurahGlyph} from '../brand/SurahGlyph';
import {getBasmala} from '../../services/verseData';
import {colors} from '../../theme/colors';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import type {OnScreenMode} from '../../store/displayStore';
import {PANEL_WIDTH} from './SidePanel';

type Props = {
  surahNumber: number;
  surahName: string;
  /** Verse being recited, 0 for the opening, null when the recitation isn't synced. */
  ayah: number | null;
  arabic: string[];
  translation: string[] | null;
  /**
   * The translation couldn't be fetched (offline, nothing cached). Shown on
   * its own, the stage says so rather than show only the calligraphy.
   */
  translationUnavailable?: boolean;
  /** Smaller, dimmer layout while the controls tray is up. */
  compact: boolean;
  /** Extra line under the verse reference, such as the repeat count. */
  note?: string | null;
  /** What to show: Arabic, translation, both, or the calligraphy alone. */
  show?: OnScreenMode;
  /** Text size multiplier from the On screen panel. */
  textScale?: number;
  /** Moves the text left of a settings panel so changes preview beside it. */
  besidePanel?: boolean;
};

// Long verses step the Arabic size down so one never spills off a 10-foot
// screen; Al-Baqarah 282 is the longest at about 1,100 characters.
function arabicSize(text: string, compact: boolean, factor: number): number {
  const base = (compact ? 44 : 64) * factor;
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
  translationUnavailable = false,
  compact,
  note,
  show = 'both',
  textScale = 1,
  besidePanel = false,
}: Props): React.ReactElement {
  const total = arabic.length;
  let arabicText: string | null = null;
  let translationText: string | null = null;
  let reference: string | null = null;

  if (ayah !== null && ayah > 0) {
    arabicText = arabic[ayah - 1] ?? null;
    translationText = translation?.[ayah - 1] ?? null;
    // Named in letters too: the calligraphy above is the only other name.
    reference = `${surahName} · Verse ${ayah} of ${total}`;
  } else if (ayah === 0 && surahNumber !== 9) {
    // The opening before verse 1. Al-Fatihah's first verse is the basmala
    // itself, and At-Tawbah has none.
    arabicText = surahNumber === 1 ? null : getBasmala();
    translationText =
      surahNumber === 1
        ? null
        : 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
  }

  if (show === 'translation' || show === 'calligraphy') arabicText = null;
  if (show === 'arabic' || show === 'calligraphy') translationText = null;
  // On its own, the translation takes the Arabic's place and size.
  const translationAlone = show === 'translation';

  // Inline sizes go through scale() like the static styles, or Android TV
  // (a 960x540 dp screen) would draw them twice the intended size.
  const fontSize = arabicText
    ? scale(arabicSize(arabicText, compact, textScale))
    : 0;
  // With the tray up, a translation under the Arabic shrinks to a short
  // line or two rather than vanish, so "Arabic + translation" still holds.
  const translationSize = scale(
    (translationAlone ? 40 : compact ? 22 : 30) * textScale,
  );
  const hasText = arabicText !== null || (translationAlone && translationText);
  const missingNote =
    translationAlone &&
    !translationText &&
    translationUnavailable &&
    ayah !== null &&
    ayah > 0;

  return (
    <View
      style={[
        styles.stage,
        compact && styles.stageCompact,
        besidePanel && styles.stageBesidePanel,
      ]}
      pointerEvents="none">
      {!compact || !hasText ? (
        <SurahGlyph
          surahNumber={surahNumber}
          size={hasText ? 84 : 150}
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
      {translationText ? (
        <Text
          numberOfLines={compact && !translationAlone ? 2 : undefined}
          style={[
            styles.translation,
            {fontSize: translationSize, lineHeight: translationSize * 1.45},
            compact && styles.dim,
          ]}>
          {translationText}
        </Text>
      ) : null}
      {missingNote ? (
        <Text style={styles.missing}>
          Translation unavailable offline · trying again
        </Text>
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
  // Left of the settings panel on the right.
  stageBesidePanel: {left: 80, right: PANEL_WIDTH + 80},
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
  missing: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 22,
  },
  surahName: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 26,
  },
  // "VERSE 2 OF 7" in sky small caps, an indicator rather than text to read.
  reference: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    marginTop: 10,
  },
});
