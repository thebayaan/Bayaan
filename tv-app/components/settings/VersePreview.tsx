import React from 'react';
import {Text, View} from 'react-native';
import {GlowBackdrop} from '../listening/GlowBackdrop';
import {SurahGlyph} from '../brand/SurahGlyph';
import {usePreviewTranslation} from '../../hooks/usePreviewTranslation';
import {getArabicVerses} from '../../services/verseData';
import {textScale, useDisplayStore} from '../../store/displayStore';
import {colors} from '../../theme/colors';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';

/** Al-Mulk opens the preview, as in the approved Settings screen. */
const PREVIEW_SURAH = 67;

type Props = {
  /** The bigger layout beside an open picker. */
  large?: boolean;
};

/**
 * A verse as the listening room would show it with the current On screen
 * choices (what shows, which translation, how big), so a change in Settings
 * can be seen before you play anything.
 */
export function VersePreview({large = false}: Props): React.ReactElement {
  const mode = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);
  const size = useDisplayStore(s => s.textSize);
  // The Arabic is bundled; the translation keeps the last one loaded while
  // a new choice loads, and says so when it can't load (offline).
  const arabic = getArabicVerses(PREVIEW_SURAH);
  const {line: translationText, offline} = usePreviewTranslation(
    PREVIEW_SURAH,
    1,
    edition,
  );
  const factor = textScale(size) * (large ? 1 : 0.72);
  const showArabic = mode === 'both' || mode === 'arabic';
  const showTranslation = mode === 'both' || mode === 'translation';
  // Inline sizes miss createScaledStyles, so they go through scale() here
  // (SurahGlyph scales its own size).
  const arabicSize = scale(52 * factor);
  const translationSize = scale((mode === 'translation' ? 34 : 24) * factor);

  return (
    <View style={[styles.box, large && styles.boxLarge]}>
      <GlowBackdrop surahNumber={PREVIEW_SURAH} dim={0.2} />
      <View style={styles.stage}>
        <SurahGlyph
          surahNumber={PREVIEW_SURAH}
          size={mode === 'calligraphy' ? 150 * factor : 70 * factor}
          color={colors.text}
        />
        {showArabic && arabic[0] ? (
          <Text
            style={[
              styles.arabic,
              quranTextFontAvailable && {fontFamily: quranTextFontFamily},
              {fontSize: arabicSize, lineHeight: arabicSize * 1.7},
            ]}>
            {arabic[0]}
          </Text>
        ) : null}
        {showTranslation && translationText ? (
          <Text
            style={
              offline
                ? styles.offline
                : [
                    styles.translation,
                    {
                      fontSize: translationSize,
                      lineHeight: translationSize * 1.45,
                    },
                  ]
            }>
            {translationText}
          </Text>
        ) : null}
        <Text style={styles.reference}>Verse 1 of 30</Text>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  box: {
    height: 520,
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxLarge: {height: 760},
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 14,
  },
  arabic: {
    color: colors.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  translation: {
    color: colors.text,
    opacity: 0.82,
    fontFamily: fonts.medium,
    fontWeight: '500',
    textAlign: 'center',
  },
  offline: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
    textAlign: 'center',
  },
  reference: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
});
