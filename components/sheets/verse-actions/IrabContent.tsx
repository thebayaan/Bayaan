/**
 * The i'rab (إعراب) drawing of Word Study (WordStudyContent): a word's
 * grammatical analysis, its morphology, and the classical i'rab books'
 * discussion of a verse.
 *
 * The Arabic words shown are always the app's own: a word referred to inside
 * an i'rab line is filled in from the app's word list. The i'rab data never
 * supplies Quran text. Like word by word, i'rab is aligned to Hafs verses.
 *
 * The building blocks (createIrabStyles, renderRefs, IrabEntryList,
 * MorphTable, IrabBooksTab): a reference to a word renders as a tappable
 * «word» only when the caller's canOpen allows it. The I'rab screen they
 * were drawn for became Word Study. @ai
 */
import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {
  splitRefs,
  type IrabBookPassages,
  type IrabEntry,
  type MorphFact,
  type WordIrab,
} from '@/services/irab/irabFormat';
import {localizeDigits} from '@/i18n/format';
import {isRTL, latinLetterSpacing} from '@/utils/rtl';
import type {WordRef} from './wordStudy'; // @ai

const ARABIC_FONT = 'ScheherazadeNew-Regular';
const ARABIC_FONT_BOLD = 'ScheherazadeNew-SemiBold';

// The i'rab is Arabic in every app language, so it sits on the physical
// right. In an RTL app React Native swaps left and right (textAlign, flex
// rows, borders), so the physical side is named per direction.
// @ai-start
export const RIGHT = isRTL ? 'left' : 'right';
export const ROW_FROM_RIGHT = isRTL ? 'row' : 'row-reverse';
// @ai-end
/** Keeps a Latin label's colon after it inside a right-to-left line. */
const LRM = String.fromCharCode(0x200e);

// @ai-start
export type IrabStyles = ReturnType<typeof createIrabStyles>;
/**
 * The caller's `sheets` translations. The blocks name the namespace on each
 * key ({ns: 'sheets'}) as well: their `t` comes from the caller, so the key
 * extractor (npm run i18n:check) cannot see which namespace it is. @ai
 */
export type IrabT = ReturnType<typeof useTranslation<'sheets'>>['t'];

/** What i'rab text needs to show the words it refers to. */
export interface IrabRefContext {
  /** The verse the text belongs to (`{{5}}` is its word 5). */
  verseKey: string;
  /** The app's text of a word, for quoting it; undefined when unknown. */
  wordTextOf: (verseKey: string, position: number) => string | undefined;
  /**
   * Whether a referred word can be opened (Word Study: a word of the
   * selection). Otherwise it is plain text with no onPress.
   */
  canOpen: (ref: WordRef) => boolean;
  onRef: (ref: WordRef) => void;
  styles: IrabStyles;
  t: IrabT;
}

/**
 * Text with its word placeholders filled in: «word» (or "word 5" when the
 * word's text is unknown), tappable when canOpen allows it.
 */
export function renderRefs(
  text: string,
  context: IrabRefContext,
): React.ReactNode[] {
  const {verseKey, wordTextOf, canOpen, onRef, styles, t} = context;
  return splitRefs(text, verseKey).map((part, i) => {
    if (part.type === 'text') return part.text;
    const ref: WordRef = {verseKey: part.verseKey, position: part.position};
    const word = wordTextOf(ref.verseKey, ref.position);
    const shown = word
      ? `«${word}»`
      : localizeDigits(t('irab.wordN', {ns: 'sheets', n: ref.position}));
    if (!canOpen(ref)) return shown;
    return (
      <Text key={i} style={styles.ref} onPress={() => onRef(ref)}>
        {shown}
      </Text>
    );
  });
}

/** The word's morphology (الصرف) as label / value rows. */
export const MorphTable: React.FC<
  IrabRefContext & {facts: readonly MorphFact[]}
> = ({facts, ...context}) => {
  const {styles, t} = context;
  return (
    <View style={styles.morph}>
      <Text style={styles.morphTitle}>
        {t('irab.morphology', {ns: 'sheets'})}
      </Text>
      {facts.map((fact, i) => (
        <View key={i} style={[styles.morphRow, i > 0 && styles.morphRowBorder]}>
          <Text style={styles.morphLabel}>{fact.label}</Text>
          <Text style={styles.morphValue}>
            {renderRefs(fact.value, context)}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** A word's i'rab entries, then the mark that both analyses agree. */
export const IrabEntryList: React.FC<
  IrabRefContext & {word: Pick<WordIrab, 'entries' | 'agreed'>}
> = ({word, ...context}) => {
  const {theme} = useTheme();
  const {styles, t} = context;
  return (
    <>
      {word.entries.map((entry, i) => (
        <EntryRow key={i} entry={entry} context={context} />
      ))}
      {word.agreed ? (
        <View style={styles.agreedRow}>
          <Feather
            name="check-circle"
            size={moderateScale(12)}
            color={theme.colors.primary}
          />
          <Text style={styles.agreedText}>
            {t('irab.agreed', {ns: 'sheets'})}
          </Text>
        </View>
      ) : null}
    </>
  );
};

const EntryRow: React.FC<{entry: IrabEntry; context: IrabRefContext}> = ({
  entry,
  context,
}) => {
  const {styles, t} = context;
  // @ai-end
  const label =
    entry.kind === 'implied'
      ? t('irab.implied', {ns: 'sheets'}) // @ai
      : entry.label || null;
  const rowStyle = [
    styles.entry,
    entry.kind === 'phrase' && styles.entryPhrase,
    entry.kind === 'alt' && styles.entryAlt,
  ];
  const textStyle = [
    styles.entryText,
    entry.kind === 'phrase' && styles.entryTextPhrase,
    entry.kind === 'implied' && styles.entryTextImplied,
  ];
  return (
    <View style={rowStyle}>
      <Text style={textStyle}>
        {label ? (
          <Text
            style={[
              styles.entryLabel,
              entry.kind === 'alt' && styles.entryLabelAlt,
            ]}>
            {label}
            {/[A-Za-z]/.test(label) ? `:${LRM} ` : ': '}
          </Text>
        ) : null}
        {renderRefs(entry.text, context) /* @ai */}
      </Text>
    </View>
  );
};

// @ai-start
/**
 * The classical i'rab books' passages on each verse. A part's caption is the
 * label shown over its books ("Hafs 1:7"), null for none.
 */
export const IrabBooksTab: React.FC<{
  parts: readonly {
    verseKey: string;
    caption: string | null;
    books: readonly IrabBookPassages[];
  }[];
  styles: IrabStyles;
  t: IrabT;
}> = ({parts, styles, t}) => {
  // @ai-end
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const anyBooks = parts.some(p => p.books.length > 0);
  return (
    <View>
      <Text style={styles.hint}>
        {t('irab.booksNote', {ns: 'sheets'}) /* @ai */}
      </Text>
      {!anyBooks && (
        <Text style={styles.message}>
          {t('irab.noBooks', {ns: 'sheets'}) /* @ai */}
        </Text>
      )}
      {parts.map(part => (
        <React.Fragment key={part.verseKey}>
          {part.caption !== null && part.books.length > 0 && (
            <Text style={styles.partCaption}>{part.caption /* @ai */}</Text>
          )}
          {part.books.map(book => (
            <View key={book.bookId} style={styles.bookCard}>
              <Text style={styles.bookTitle}>{book.nameAr}</Text>
              <Text style={styles.bookAuthor}>{book.authorAr}</Text>
              {book.passages.map((passage, i) => {
                const key = `${part.verseKey}:${book.bookId}:${i}`;
                const open = expanded.has(key);
                const long = passage.text.length > 700;
                return (
                  <View key={key} style={styles.passage}>
                    <Text style={styles.passageMeta}>
                      {localizeDigits(
                        t('irab.passageRef', {
                          ns: 'sheets', // @ai
                          part: passage.part,
                          page: passage.page,
                        }),
                      )}
                    </Text>
                    <Text style={styles.passageText}>
                      {long && !open
                        ? `${passage.text.slice(0, 700)}…`
                        : passage.text}
                    </Text>
                    {long && (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setExpanded(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }>
                        <Text style={styles.readMore}>
                          {t(open ? 'irab.readLess' : 'irab.readMore', {
                            ns: 'sheets', // @ai
                          })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </React.Fragment>
      ))}
      <Text style={styles.sources}>
        {t('irab.booksSources', {ns: 'sheets'}) /* @ai */}
      </Text>
    </View>
  );
};

// @ai-start
/** The i'rab styles, shared by the I'rab screen and Word Study. */
export const createIrabStyles = (theme: Theme) => {
  const subtle = Color(theme.colors.text).alpha(0.04).toString();
  const hairline = Color(theme.colors.text).alpha(0.08).toString();
  // Secondary text: 0.8 alpha at least (ipad-standards.md §12).
  const secondary = Color(theme.colors.textSecondary).alpha(0.8).toString();
  // @ai-end
  const phraseRule = Color(theme.colors.primary).alpha(0.45).toString();
  return StyleSheet.create({
    partCaption: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: secondary, // @ai: ipad-standards §12 (was 0.6)
      letterSpacing: latinLetterSpacing(0.3),
      marginTop: verticalScale(6),
      marginBottom: verticalScale(6),
      marginLeft: moderateScale(4),
    },
    hint: {
      flexShrink: 1,
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(11.5),
      color: secondary,
      marginBottom: verticalScale(4),
    },
    entry: {
      paddingVertical: verticalScale(3),
    },
    entryPhrase: {
      // The physical right edge (left and right are swapped in RTL).
      ...(isRTL
        ? {
            borderLeftWidth: 2,
            borderLeftColor: phraseRule,
            paddingLeft: moderateScale(8),
          }
        : {
            borderRightWidth: 2,
            borderRightColor: phraseRule,
            paddingRight: moderateScale(8),
          }),
      marginVertical: verticalScale(2),
    },
    entryAlt: {
      backgroundColor: Color(theme.colors.primary).alpha(0.07).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(8),
      marginVertical: verticalScale(3),
    },
    entryText: {
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(17),
      lineHeight: moderateScale(30),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    entryTextPhrase: {
      color: Color(theme.colors.text).alpha(0.82).toString(),
    },
    entryTextImplied: {
      color: Color(theme.colors.text).alpha(0.75).toString(),
    },
    entryLabel: {
      fontFamily: ARABIC_FONT_BOLD,
      color: theme.colors.primary,
    },
    entryLabelAlt: {
      color: theme.colors.primary,
    },
    ref: {
      fontFamily: ARABIC_FONT_BOLD,
      color: theme.colors.primary,
    },
    agreedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(5),
      marginTop: verticalScale(6),
    },
    agreedText: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(11),
      color: secondary,
    },
    morph: {
      marginTop: verticalScale(10),
      borderRadius: moderateScale(10),
      backgroundColor: subtle,
      paddingHorizontal: moderateScale(10),
      paddingVertical: verticalScale(6),
    },
    morphTitle: {
      fontFamily: ARABIC_FONT_BOLD,
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
      marginBottom: verticalScale(2),
    },
    morphRow: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'flex-start',
      paddingVertical: verticalScale(3),
      gap: moderateScale(10),
    },
    morphRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: hairline,
    },
    morphLabel: {
      width: moderateScale(96),
      fontFamily: ARABIC_FONT_BOLD,
      fontSize: moderateScale(14),
      lineHeight: moderateScale(26),
      color: theme.colors.primary,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    morphValue: {
      flex: 1,
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(15.5),
      lineHeight: moderateScale(26),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    message: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(13),
      color: secondary,
      textAlign: 'center',
      marginTop: verticalScale(24),
    },
    sources: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(11), // @ai: the caption size of the type ramp
      lineHeight: moderateScale(15),
      color: secondary, // @ai: ipad-standards §12 (was 0.55)
      marginTop: verticalScale(16),
      paddingHorizontal: moderateScale(4),
    },
    bookCard: {
      marginTop: verticalScale(10),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: hairline,
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(10),
    },
    bookTitle: {
      fontFamily: ARABIC_FONT_BOLD,
      fontSize: moderateScale(19),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    bookAuthor: {
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(14),
      color: secondary,
      textAlign: RIGHT,
      writingDirection: 'rtl',
      marginBottom: verticalScale(4),
    },
    passage: {
      borderTopWidth: 1,
      borderTopColor: hairline,
      paddingTop: verticalScale(8),
      marginTop: verticalScale(6),
    },
    passageMeta: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(10.5),
      color: secondary,
      marginBottom: verticalScale(2),
    },
    passageText: {
      fontFamily: ARABIC_FONT,
      fontSize: moderateScale(17),
      lineHeight: moderateScale(31),
      color: theme.colors.text,
      textAlign: RIGHT,
      writingDirection: 'rtl',
    },
    readMore: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(12),
      color: theme.colors.primary,
      marginTop: verticalScale(4),
    },
  });
};
