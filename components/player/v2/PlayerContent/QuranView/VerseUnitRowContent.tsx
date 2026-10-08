// @ai-generated
/**
 * Hafs-aligned content of a rewayah verse row (VerseItem with a `unitRow`,
 * decision 3): translations, transliterations, the shared-translation notes
 * and the word-by-word grids are Hafs data, shown per Hafs verse the row
 * holds (verseUnitRows.ts):
 *  - a Hafs verse's translation once, under the first row holding it, with
 *    its own footnotes; a Hafs verse the rewayah divides between rows has
 *    its note under every one of those rows;
 *  - the transliteration only under Hafs text: it spells the Hafs reading
 *    and would read as the rewayah's under another rewayah's verse;
 *  - word by word: per Hafs verse, the Hafs words of the row's own slots,
 *    with a disclosure naming the Hafs verse when it is not the row's verse;
 *  - the RFC-018 community reflections (Hafs-keyed) of each Hafs verse the
 *    row owns.
 */
import React, {memo, useCallback, useMemo} from 'react';
import {Text, View, type StyleProp, type TextStyle} from 'react-native';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {AyahCommunityReflections} from '@/components/mushaf/AyahCommunityReflections';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';
import {WBWVerseView} from './WBWVerseView';
import {
  wordByWordNotice,
  type VerseRowPart,
  type VerseUnitRow,
} from './verseUnitRows';

// ── Translations and notes ─────────────────────────────────────────────────

interface PartTranslationProps {
  part: VerseRowPart;
  baseStyle: StyleProp<TextStyle>;
  onFootnotePress: (
    hafsKey: string,
    footnoteId: string,
    footnoteNumber: string,
  ) => void;
}

const PartTranslation = memo<PartTranslationProps>(
  ({part, baseStyle, onFootnotePress}) => {
    const hafsKey = part.hafsKey;
    const handleFootnote = useCallback(
      (footnoteId: string, footnoteNumber: string) =>
        onFootnotePress(hafsKey, footnoteId, footnoteNumber),
      [onFootnotePress, hafsKey],
    );
    return (
      <FormattedTextRenderer
        text={part.translation}
        baseStyle={baseStyle}
        onFootnotePress={handleFootnote}
      />
    );
  },
);
PartTranslation.displayName = 'PartTranslation';

interface UnitRowTranslationsProps {
  row: VerseUnitRow;
  showTranslation: boolean;
  /** Only shown for a Hafs verse row: a transliteration spells the Hafs
   *  reading, never shown under another rewayah's text. */
  showTransliteration: boolean;
  translationStyle: StyleProp<TextStyle>;
  transliterationStyle: StyleProp<TextStyle>;
  translationSourceStyle: StyleProp<TextStyle>;
  /** Style of the shared-translation notes. */
  noteStyle: StyleProp<TextStyle>;
  translationName?: string;
  onFootnotePress: (
    hafsKey: string,
    footnoteId: string,
    footnoteNumber: string,
  ) => void;
}

export const UnitRowTranslations = memo<UnitRowTranslationsProps>(
  ({
    row,
    showTranslation,
    showTransliteration,
    translationStyle,
    transliterationStyle,
    translationSourceStyle,
    noteStyle,
    translationName,
    onFootnotePress,
  }) => {
    const transliteration =
      showTransliteration && row.rewayah === 'hafs'
        ? row.parts
            .filter(p => p.owned && p.transliteration)
            .map(p => p.transliteration)
            .join(' ')
        : '';
    const hasTranslation =
      showTranslation && row.parts.some(p => p.owned && p.translation);
    const hasNote = showTranslation && row.parts.some(p => p.note);
    if (!transliteration && !hasTranslation && !hasNote) return null;
    return (
      <View testID="unit-row-translations">
        {transliteration ? (
          <FormattedTextRenderer
            text={transliteration}
            baseStyle={transliterationStyle}
          />
        ) : null}
        {showTranslation &&
          row.parts.map(part => (
            <React.Fragment key={part.hafsKey}>
              {part.owned && part.translation ? (
                <PartTranslation
                  part={part}
                  baseStyle={translationStyle}
                  onFootnotePress={onFootnotePress}
                />
              ) : null}
              {part.note ? (
                <Text style={noteStyle} testID="shared-translation-note">
                  {part.note}
                </Text>
              ) : null}
            </React.Fragment>
          ))}
        {hasTranslation ? (
          <Text style={translationSourceStyle}>
            {translationName ?? 'Saheeh International'}
          </Text>
        ) : null}
      </View>
    );
  },
);
UnitRowTranslations.displayName = 'UnitRowTranslations';

// ── Community reflections ──────────────────────────────────────────────────

interface VerseRowReflectionsProps {
  /** A verse row of a rewayah; omitted for a Hafs verse row. */
  unitRow?: VerseUnitRow;
  /** The Hafs verse of a Hafs verse row (ignored with `unitRow`). */
  surahNumber: number;
  ayahNumber: number;
}

/**
 * The RFC-018 reflections slot of a verse row. Reflections are keyed by Hafs
 * verse: a Hafs verse row shows its own verse's, exactly as before; a verse
 * row of a rewayah shows those of each Hafs verse it owns (the first row
 * holding it), so a list never repeats them and never asks for the Hafs
 * verse that merely shares the rewayah verse's number.
 */
export function VerseRowReflections({
  unitRow,
  surahNumber,
  ayahNumber,
}: VerseRowReflectionsProps) {
  if (!unitRow) {
    return (
      <AyahCommunityReflections
        surahNumber={surahNumber}
        ayahNumber={ayahNumber}
      />
    );
  }
  return (
    <>
      {unitRow.parts
        .filter(part => part.owned)
        .map(part => (
          <AyahCommunityReflections
            key={part.hafsKey}
            surahNumber={part.hafsSurah}
            ayahNumber={part.hafsAyah}
          />
        ))}
    </>
  );
}

// ── Word by word ───────────────────────────────────────────────────────────

/** A word of a row's word-by-word grids: its Hafs verse and WBW position. */
export interface UnitRowWord {
  hafsKey: string;
  position: number;
}

interface WordByWordProps {
  textColor: string;
  arabicFontSize: number;
  dkFontFamily: string;
  fontMgr: SkTypefaceFontProvider | null;
  showTranslation: boolean;
  showTransliteration: boolean;
  showTajweed: boolean;
  indexedTajweedData: IndexedTajweedData | null;
  arabicTextWeight?: MushafArabicTextWeight;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
  onTap?: () => void;
  onLongPress?: () => void;
}

interface PartWordByWordProps extends WordByWordProps {
  row: VerseUnitRow;
  part: VerseRowPart;
  selectedWord: UnitRowWord | null;
  onWordPress: (word: UnitRowWord) => void;
}

const PartWordByWord = memo<PartWordByWordProps>(
  ({row, part, selectedWord, onWordPress, ...rest}) => {
    const hafsKey = part.hafsKey;
    const handleWordPress = useCallback(
      (position: number) => onWordPress({hafsKey, position}),
      [onWordPress, hafsKey],
    );
    const wordRange = useMemo(
      () =>
        part.wholeVerse
          ? undefined
          : {first: part.firstWord, last: part.lastWord},
      [part],
    );
    return (
      <WBWVerseView
        {...rest}
        verseKey={hafsKey}
        wordRange={wordRange}
        hafsNotice={wordByWordNotice(row, part)}
        rewayah={row.rewayah}
        onWordPress={handleWordPress}
        selectedWordPosition={
          selectedWord?.hafsKey === hafsKey ? selectedWord.position : null
        }
      />
    );
  },
);
PartWordByWord.displayName = 'PartWordByWord';

interface UnitRowWordByWordProps extends WordByWordProps {
  row: VerseUnitRow;
  selectedWord: UnitRowWord | null;
  onWordPress: (word: UnitRowWord) => void;
}

/** One Hafs word-by-word grid per Hafs verse the row holds, in order. */
export const UnitRowWordByWord = memo<UnitRowWordByWordProps>(
  ({row, ...rest}) => (
    <>
      {row.parts.map(part => (
        <PartWordByWord key={part.hafsKey} row={row} part={part} {...rest} />
      ))}
    </>
  ),
);
UnitRowWordByWord.displayName = 'UnitRowWordByWord';
