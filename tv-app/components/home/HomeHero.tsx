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
import {RAIL_TOP_GAP} from './HomeRail';

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
  /** Which button takes focus: the primary on arrival, the secondary when
      returning from its picker, neither when "Now playing" leads. */
  preferredFocus: 'primary' | 'secondary' | null;
  /** Any of the hero's buttons took focus. */
  onFocus: () => void;
  /** The primary button, for Home to focus when a rail it was in empties. */
  primaryRef?: React.Ref<View>;
  /** Drawn above the kicker ("Now playing"). */
  header?: React.ReactNode;
  /** Drawn in the top right corner, scrolling with the hero (the clock). */
  corner?: React.ReactNode;
};

/**
 * The moment at the top of Home: kicker, big title, one sentence, a primary
 * action (outlined squircle, cream on focus) and a quiet secondary, with
 * the surah's or list's calligraphy large on the right, under the clock.
 * The primary takes the screen's first focus unless "Now playing" leads.
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
  preferredFocus,
  onFocus,
  primaryRef,
  header,
  corner,
}: Props): React.ReactElement {
  return (
    <View style={styles.hero}>
      <View style={styles.art} pointerEvents="none" accessible={false}>
        {art.kind === 'surah' ? (
          <SurahGlyph surahNumber={art.surahNumber} size={260} />
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
      {corner ? (
        <View style={styles.corner} pointerEvents="none">
          {corner}
        </View>
      ) : null}
      <View style={styles.text}>
        {header}
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sentence} numberOfLines={2}>
          {sentence}
        </Text>
        {/* autoFocus: coming up from the rails lands on these buttons (the
            last one focused), never on whatever is geometrically nearest. */}
        <TVFocusGuideView autoFocus style={styles.actions}>
          <FocusableButton
            ref={primaryRef}
            onPress={onPrimary}
            onFocus={onFocus}
            hasTVPreferredFocus={preferredFocus === 'primary'}
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
            onFocus={onFocus}
            hasTVPreferredFocus={preferredFocus === 'secondary'}
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
  // Grows past 440 when "Now playing" sits above the kicker, instead of
  // pushing the strip into the top overscan and the buttons onto the first
  // rail. The padding keeps the buttons clear of the screen's top edge when
  // Home scrolls to that rail (RAIL_TOP_GAP), and leaves the hero without
  // the strip exactly as it was (its content is shorter than 440 - 2 * 44).
  hero: {
    minHeight: 440,
    paddingVertical: RAIL_TOP_GAP + 8,
    justifyContent: 'center',
  },
  corner: {position: 'absolute', top: 12, right: 0},
  art: {
    position: 'absolute',
    right: 40,
    // Clear of the clock block in the top right corner.
    top: 120,
    bottom: 0,
    width: 760,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  arabic: {
    color: colors.text,
    fontSize: 130,
    lineHeight: 220,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  text: {width: 820, gap: 12},
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
