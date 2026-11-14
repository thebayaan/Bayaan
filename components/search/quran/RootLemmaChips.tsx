// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useHover} from '@/hooks/useHover';
import {useTheme} from '@/hooks/useTheme';
import {localizeDigits} from '@/i18n/format';
import type {
  QuranLemma,
  QuranRoot,
} from '@/services/search/QuranSearchDataService';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

export interface RootLemmaChipsProps {
  root: QuranRoot;
  /** Most words first; lemma null holds the words without one. */
  lemmas: readonly QuranLemma[];
  /** The chosen lemma's id; null for all forms. */
  selected: number | null;
  onSelect: (lemmaId: number | null) => void;
}

interface ChipProps {
  label: string;
  /** Drawn in the Uthmani font: a lemma is Quranic text. */
  quranic: boolean;
  count: number;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function Chip({
  label,
  quranic,
  count,
  accessibilityLabel,
  selected,
  onPress,
  styles,
}: ChipProps) {
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{selected}}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{top: 5, bottom: 5}}
      {...hoverProps}
      style={[
        styles.chip,
        hovered && !selected && styles.chipHovered,
        selected && styles.chipSelected,
      ]}>
      <Text
        style={[
          quranic ? styles.lemma : styles.chipText,
          selected && styles.textSelected,
        ]}>
        {label}
      </Text>
      <Text
        style={[
          styles.chipText,
          styles.count,
          selected && styles.textSelected,
        ]}>
        {localizeDigits(count)}
      </Text>
    </Pressable>
  );
}

/**
 * The lemma chips of a root search: "All forms" with the root's word count,
 * then each lemma with its own (in the Uthmani font), then "Other forms" for
 * the root's words without a lemma. Choosing one filters the ayahs.
 */
export const RootLemmaChips: React.FC<RootLemmaChipsProps> = ({
  root,
  lemmas,
  selected,
  onSelect,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chipLabel = (name: string, words: number) =>
    t('quranSearch.lemmaChip', {
      lemma: name,
      words: t('quranSearch.wordCount', {count: words}),
    });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      contentContainerStyle={styles.row}>
      <Chip
        label={t('quranSearch.allForms')}
        quranic={false}
        count={root.words}
        accessibilityLabel={chipLabel(t('quranSearch.allForms'), root.words)}
        selected={selected === null}
        onPress={() => onSelect(null)}
        styles={styles}
      />
      {lemmas.map(lemma => {
        const name = lemma.lemma ?? t('quranSearch.otherForms');
        return (
          <Chip
            key={lemma.id}
            label={name}
            quranic={lemma.lemma !== null}
            count={lemma.words}
            accessibilityLabel={chipLabel(name, lemma.words)}
            selected={selected === lemma.id}
            onPress={() => onSelect(lemma.id)}
            styles={styles}
          />
        );
      })}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(4),
    },
    chip: {
      minHeight: moderateScale(34),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(17),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    chipHovered: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    chipSelected: {
      backgroundColor: theme.colors.text,
    },
    chipText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    lemma: {
      fontSize: moderateScale(18),
      fontFamily: 'Uthmani',
      color: theme.colors.text,
    },
    count: {
      fontFamily: theme.fonts.medium,
      color: Color(theme.colors.text).alpha(0.8).toString(),
    },
    textSelected: {
      color: theme.colors.background,
    },
  });
