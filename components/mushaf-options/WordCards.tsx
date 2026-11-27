// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {moderateScale} from '@/utils/scale';
import {forceLTR} from '@/utils/rtl';
import type {Theme} from '@/utils/themeUtils';
import {FoldHeader, Separator, SwitchRow} from './OptionRows';
import {Collapsible, FadeInView} from './motion';
import {QuranText} from './QuranText';
import {ROW_INSET, textAlpha, useOptionStyles} from './optionStyles';

type VerseExtra = 'translation' | 'transliteration' | 'wordByWord';
const VERSE_EXTRAS: readonly VerseExtra[] = [
  'translation',
  'transliteration',
  'wordByWord',
];

/** What shows under each verse in List view. */
export function UnderVerseCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const store = useMushafSettingsStore();
  const on: Record<VerseExtra, boolean> = {
    translation: store.showTranslation,
    transliteration: store.showTransliteration,
    wordByWord: store.showWBW,
  };
  const toggles: Record<VerseExtra, () => void> = {
    translation: store.toggleTranslation,
    transliteration: store.toggleTransliteration,
    wordByWord: store.toggleWBW,
  };
  const chosen = VERSE_EXTRAS.filter(extra => on[extra]).map(extra =>
    t(`mushafOptions.verse.${extra}`),
  );
  const summary =
    chosen.length > 0
      ? chosen.join(t('mushafOptions.listSeparator'))
      : t('mushafOptions.verse.nothing');

  return (
    <View style={[styles.card, styles.section]}>
      <FoldHeader
        title={t('mushafOptions.verse.title')}
        summary={summary}
        open={open}
        onPress={onToggle}
        testID="mushaf-options-card-verse"
      />
      <Collapsible open={open}>
        <View style={local.body}>
          <View style={local.chips}>
            {VERSE_EXTRAS.map(extra => (
              <Chip
                key={extra}
                label={t(`mushafOptions.verse.${extra}`)}
                checked={on[extra]}
                onPress={toggles[extra]}
                testID={`mushaf-options-verse-${extra}`}
              />
            ))}
          </View>
          <Text style={[styles.subtitle, local.note]}>
            {t('mushafOptions.verse.help')}
          </Text>
        </View>
      </Collapsible>
    </View>
  );
}

/** A chip that can be combined with others: a checkbox. */
function Chip({
  label,
  checked,
  onPress,
  testID,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  testID?: string;
}): React.JSX.Element {
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        local.chip,
        checked && local.chipOn,
        pressed && !checked && local.chipPressed,
        pressed && checked && local.chipOnPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{checked}}
      testID={testID}>
      {checked ? (
        <Feather
          name="check"
          size={moderateScale(14)}
          color={theme.colors.background}
        />
      ) : null}
      <Text style={[local.chipText, checked && local.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function useWordDetailsSummary(): string {
  const {t} = useTranslation('sheets');
  const meaning = useMushafSettingsStore(s => s.wbwShowTranslation);
  const translit = useMushafSettingsStore(s => s.wbwShowTransliteration);
  const parts = [
    meaning && t('mushafOptions.words.meaning'),
    translit && t('mushafOptions.words.transliteration'),
  ].filter((part): part is string => typeof part === 'string');
  return parts.length > 0
    ? parts.join(t('mushafOptions.listSeparator'))
    : t('mushafOptions.words.off');
}

/** The two words the preview shows, in reading order (right to left). */
const SAMPLE_WORDS = [
  {key: 'allah', text: 'ٱللَّهِ'},
  {key: 'rahim', text: 'ٱلرَّحِيمِ'},
] as const;

/** What a tapped word shows, and what Word by word shows under each word. */
export function WordDetailsCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const summary = useWordDetailsSummary();
  const meaning = useMushafSettingsStore(s => s.wbwShowTranslation);
  const translit = useMushafSettingsStore(s => s.wbwShowTransliteration);
  const toggleMeaning = useMushafSettingsStore(s => s.toggleWBWTranslation);
  const toggleTranslit = useMushafSettingsStore(
    s => s.toggleWBWTransliteration,
  );
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const weight = useMushafSettingsStore(s => s.arabicTextWeight);
  // Word-by-word data is Hafs, so its preview is too.
  const fontFamily = getDkFontFamily(renderer, 'hafs');

  return (
    <View style={[styles.card, styles.section]}>
      <FoldHeader
        title={t('mushafOptions.words.title')}
        summary={summary}
        open={open}
        onPress={onToggle}
        testID="mushaf-options-card-words"
      />
      <Collapsible open={open}>
        <View style={local.body}>
          <View
            style={[styles.preview, local.wordPreview]}
            accessible
            accessibilityLabel={t('mushafOptions.words.previewLabel')}>
            {SAMPLE_WORDS.map(word => (
              <View key={word.key} style={local.word}>
                <QuranText
                  text={word.text}
                  fontFamily={fontFamily}
                  fontSize={moderateScale(21)}
                  color={theme.colors.text}
                  weight={weight}
                />
                {/* The glosses are English, set left to right. */}
                <View style={forceLTR}>
                  {meaning ? (
                    <FadeInView>
                      <Text style={local.gloss}>
                        {t(`mushafOptions.words.sample.${word.key}.meaning`)}
                      </Text>
                    </FadeInView>
                  ) : null}
                  {translit ? (
                    <FadeInView>
                      <Text style={local.translit}>
                        {t(`mushafOptions.words.sample.${word.key}.translit`)}
                      </Text>
                    </FadeInView>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <SwitchRow
            title={t('mushafOptions.words.meaning')}
            value={meaning}
            onValueChange={toggleMeaning}
            testID="mushaf-options-wbw-meaning"
          />
          <Separator />
          <SwitchRow
            title={t('mushafOptions.words.transliteration')}
            value={translit}
            onValueChange={toggleTranslit}
            testID="mushaf-options-wbw-translit"
          />
          <Text style={[styles.subtitle, local.note]}>
            {t('mushafOptions.words.help')}
          </Text>
        </View>
      </Collapsible>
    </View>
  );
}

function createStyles(theme: Theme) {
  const small = theme.typography.smallSize;
  return StyleSheet.create({
    body: {
      paddingBottom: moderateScale(14),
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(8),
      paddingHorizontal: ROW_INSET,
      paddingTop: moderateScale(2),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      minHeight: moderateScale(36),
      paddingHorizontal: moderateScale(12),
      borderRadius: moderateScale(18),
      borderWidth: 1.5,
      borderColor: textAlpha(theme, 0.16),
    },
    chipOn: {
      backgroundColor: theme.colors.text,
      borderColor: theme.colors.text,
    },
    chipPressed: {
      backgroundColor: textAlpha(theme, 0.06),
    },
    chipOnPressed: {
      backgroundColor: textAlpha(theme, 0.8),
    },
    chipText: {
      fontSize: small,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    chipTextOn: {
      color: theme.colors.background,
    },
    note: {
      marginTop: moderateScale(10),
      paddingHorizontal: ROW_INSET,
    },
    // Right to left whatever the app's language: Quran reading order.
    wordPreview: {
      flexDirection: 'row',
      direction: 'rtl',
      justifyContent: 'center',
      gap: moderateScale(24),
      marginBottom: moderateScale(4),
    },
    word: {
      minWidth: moderateScale(90),
      alignItems: 'center',
    },
    gloss: {
      textAlign: 'center',
      fontSize: small,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    translit: {
      textAlign: 'center',
      fontSize: theme.typography.captionSize,
      fontFamily: 'Manrope-Regular',
      fontStyle: 'italic',
      color: textAlpha(theme, 0.55),
    },
  });
}
