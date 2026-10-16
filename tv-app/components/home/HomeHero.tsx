import React from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {SurahGlyph} from '../brand/SurahGlyph';
import {PlayIcon} from '../../../components/Icons';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, quranTextFontFamily} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

export type HeroArt =
  | {kind: 'surah'; surahNumber: number}
  | {kind: 'arabic'; text: string};

type Props = {
  kicker: string;
  title: string;
  sentence: string;
  art: HeroArt;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
};

/**
 * The moment at the top of Home: kicker, big title, one sentence, a primary
 * action (outlined squircle, cream on focus) and a quiet secondary, with
 * the surah's or list's calligraphy large on the right. The primary takes
 * the screen's first focus.
 */
export function HomeHero({
  kicker,
  title,
  sentence,
  art,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props): React.ReactElement {
  return (
    <View style={styles.hero}>
      <View style={styles.art} pointerEvents="none" accessible={false}>
        {art.kind === 'surah' ? (
          <SurahGlyph surahNumber={art.surahNumber} size={300} />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.arabic,
              quranTextFontAvailable && {fontFamily: quranTextFontFamily},
            ]}>
            {art.text}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sentence} numberOfLines={3}>
          {sentence}
        </Text>
        {/* autoFocus: coming up from the rails lands on these buttons (the
            last one focused), never on whatever is geometrically nearest. */}
        <TVFocusGuideView autoFocus style={styles.actions}>
          <FocusableButton
            onPress={onPrimary}
            hasTVPreferredFocus
            outlined
            accessibilityLabel={`${primaryLabel} ${title}`}
            style={styles.button}>
            <View style={styles.buttonInner}>
              <FocusIcon icon={PlayIcon} size={20} />
              <FocusText style={styles.buttonText}>{primaryLabel}</FocusText>
            </View>
          </FocusableButton>
          <FocusableButton
            onPress={onSecondary}
            accessibilityLabel={secondaryLabel}
            style={styles.button}>
            <FocusText style={styles.buttonText}>{secondaryLabel}</FocusText>
          </FocusableButton>
        </TVFocusGuideView>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  hero: {height: 430, justifyContent: 'center'},
  art: {
    position: 'absolute',
    right: 40,
    // Below the clock, which sits over the top right corner.
    top: 60,
    bottom: 0,
    width: 820,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  arabic: {
    color: colors.text,
    fontSize: 150,
    lineHeight: 250,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  text: {width: 820, gap: 14},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2.6,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 72,
    letterSpacing: -1.4,
  },
  sentence: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 24,
    lineHeight: 36,
    maxWidth: 720,
  },
  actions: {flexDirection: 'row', gap: 16, marginTop: 18},
  button: {paddingHorizontal: 30, paddingVertical: 15, borderRadius: 16},
  buttonInner: {flexDirection: 'row', alignItems: 'center', gap: 12},
  buttonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 21},
});
