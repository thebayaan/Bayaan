/**
 * I'rab (إعراب) of a verse: every word's grammatical analysis, and the
 * classical i'rab books' discussion of the verse.
 *
 * The Arabic words shown are always the app's own: the grid is the word-by-
 * word view (the mushaf's words), and a word referred to inside an i'rab
 * line is filled in from the app's word list. The i'rab data never supplies
 * Quran text. Like word by word, i'rab is aligned to Hafs verses.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ScrollView} from 'react-native-actions-sheet';
import {moderateScale, verticalScale} from '@/utils/scale';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {WBWVerseView} from '@/components/player/v2/PlayerContent/QuranView/WBWVerseView';
import {
  getDkFontFamily,
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useTajweedStore} from '@/store/tajweedStore';
import {wbwDataService} from '@/services/wbw/WBWDataService';
import {irabDataService} from '@/services/irab/IrabDataService';
import {
  quotableWord,
  splitRefs,
  type IrabBookPassages,
  type IrabEntry,
  type MorphFact,
  type WordIrab,
} from '@/services/irab/irabFormat';
import {localizeDigits} from '@/i18n/format';
import {isRTL, latinLetterSpacing} from '@/utils/rtl';
import {wbwParts, type UnitStart} from './verseUnitScreens';

interface IrabContentProps {
  surahNumber: number;
  ayahNumber: number;
  /** Rewayah of the verse the sheet was opened for (Hafs notice only). */
  rewayah?: RewayahId;
  /** Another rewayah's verse: one view per Hafs verse holding its words. */
  unitStart?: UnitStart;
  onBack: () => void;
}

type Tab = 'words' | 'books';

interface VerseData {
  words: WordIrab[];
  /** The app's word text per position (for references), damaged ones out. */
  wordText: Map<number, string>;
}

const ARABIC_FONT = 'ScheherazadeNew-Regular';
const ARABIC_FONT_BOLD = 'ScheherazadeNew-SemiBold';

// The i'rab is Arabic in every app language, so it sits on the physical
// right. In an RTL app React Native swaps left and right (textAlign, flex
// rows, borders), so the physical side is named per direction.
const RIGHT = isRTL ? 'left' : 'right';
const ROW_FROM_RIGHT = isRTL ? 'row' : 'row-reverse';
/** Keeps a Latin label's colon after it inside a right-to-left line. */
const LRM = String.fromCharCode(0x200e);

export const IrabContent: React.FC<IrabContentProps> = ({
  surahNumber,
  ayahNumber,
  rewayah,
  unitStart,
}) => {
  const {t} = useTranslation('sheets');
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const parts = useMemo(
    () => wbwParts(verseKey, unitStart),
    [verseKey, unitStart],
  );

  const [tab, setTab] = useState<Tab>('words');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<{
    verseKey: string;
    position: number;
  }>({verseKey: parts[0].verseKey, position: 1});
  const [data, setData] = useState<Map<string, VerseData> | null>(null);
  const [books, setBooks] = useState<Map<string, IrabBookPassages[]> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSelected({verseKey: parts[0].verseKey, position: 1});
    setData(null);
    setBooks(null);
    setFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const map = new Map<string, VerseData>();
        const bookMap = new Map<string, IrabBookPassages[]>();
        for (const part of parts) {
          const [words, appWords, verseBooks] = await Promise.all([
            irabDataService.getVerse(part.verseKey),
            wbwDataService.getVerseWords(part.verseKey),
            irabDataService.getBooks(part.verseKey),
          ]);
          const wordText = new Map<number, string>();
          for (const w of appWords) {
            if (w.textUthmani && !w.textUthmani.includes('�')) {
              wordText.set(w.position, quotableWord(w.textUthmani));
            }
          }
          map.set(part.verseKey, {words, wordText});
          bookMap.set(part.verseKey, verseBooks);
        }
        if (!cancelled) {
          setData(map);
          setBooks(bookMap);
        }
      } catch (error) {
        console.error('[IrabContent] load failed:', error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parts]);

  // Word-by-word grid settings (same as the word by word screen).
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );
  const dkFontFamily = getDkFontFamily(mushafRenderer, 'hafs');
  const hafsWordsReady = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    () => digitalKhattDataService.isRewayahReady('hafs'),
  );
  const isDK =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  const wordPressHandlers = useMemo(
    () =>
      new Map(
        parts.map(part => [
          part.verseKey,
          (position: number) => {
            setSelected({verseKey: part.verseKey, position});
            setShowAll(false);
          },
        ]),
      ),
    [parts],
  );
  const noop = useCallback(() => undefined, []);

  const selectRef = useCallback(
    (refVerseKey: string, position: number) => {
      if (parts.some(p => p.verseKey === refVerseKey)) {
        setSelected({verseKey: refVerseKey, position});
        setShowAll(false);
      }
    },
    [parts],
  );

  const renderWordCard = (partKey: string, word: WordIrab) => {
    const verse = data?.get(partKey);
    const total = verse?.words.length ?? 0;
    const text = verse?.wordText.get(word.position);
    return (
      <View key={`${partKey}:${word.position}`} style={styles.card}>
        <View style={styles.cardHeader}>
          {text ? <Text style={styles.cardWord}>{text}</Text> : null}
          <Text style={styles.cardCounter}>
            {localizeDigits(t('irab.wordOf', {n: word.position, total}))}
          </Text>
        </View>
        {word.entries.map((entry, i) => (
          <EntryRow
            key={i}
            entry={entry}
            verseKey={partKey}
            wordTextOf={(vk, pos) => data?.get(vk)?.wordText.get(pos)}
            onRef={selectRef}
            styles={styles}
            t={t}
          />
        ))}
        {word.agreed ? (
          <View style={styles.agreedRow}>
            <Feather
              name="check-circle"
              size={moderateScale(12)}
              color={theme.colors.primary}
            />
            <Text style={styles.agreedText}>{t('irab.agreed')}</Text>
          </View>
        ) : null}
        {!showAll && word.morph.length > 0 ? (
          <MorphTable
            facts={word.morph}
            verseKey={partKey}
            wordTextOf={(vk, pos) => data?.get(vk)?.wordText.get(pos)}
            onRef={selectRef}
            styles={styles}
            t={t}
          />
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <View style={styles.tabs}>
        {(['words', 'books'] as const).map(key => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{selected: tab === key}}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {t(key === 'words' ? 'irab.tabWords' : 'irab.tabBooks')}
            </Text>
          </Pressable>
        ))}
      </View>

      {failed ? (
        <Text style={styles.message}>{t('irab.loadFailed')}</Text>
      ) : !data ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.text} />
      ) : tab === 'words' ? (
        <>
          {parts.map(part => {
            const verse = data.get(part.verseKey);
            const shown = showAll
              ? (verse?.words ?? [])
              : (verse?.words ?? []).filter(
                  w =>
                    selected.verseKey === part.verseKey &&
                    w.position === selected.position,
                );
            return (
              <React.Fragment key={part.verseKey}>
                {part.caption !== null && (
                  <Text style={styles.partCaption}>
                    {localizeDigits(
                      t('irab.hafsVerse', {verse: part.verseKey}),
                    )}
                  </Text>
                )}
                <View style={styles.wbwWrapper}>
                  <WBWVerseView
                    key={`${part.verseKey}:${hafsWordsReady ? 'ready' : 'loading'}`}
                    verseKey={part.verseKey}
                    rewayah={rewayah}
                    textColor={theme.colors.text}
                    arabicFontSize={arabicFontSize}
                    dkFontFamily={dkFontFamily}
                    fontMgr={fontMgr}
                    showTranslation={false}
                    showTransliteration={false}
                    onWordPress={wordPressHandlers.get(part.verseKey) ?? noop}
                    selectedWordPosition={
                      !showAll && selected.verseKey === part.verseKey
                        ? selected.position
                        : null
                    }
                    showTajweed={showTajweed}
                    indexedTajweedData={indexedTajweedData}
                    arabicTextWeight={arabicTextWeight}
                    showAllahNameHighlight={showAllahNameHighlight}
                    allahNameHighlightColor={allahNameHighlightColor}
                    onTap={noop}
                    selectOnTap
                  />
                </View>
                {part === parts[0] && (
                  <View style={styles.modeRow}>
                    <Text style={styles.hint}>{t('irab.tapWord')}</Text>
                    <Pressable
                      onPress={() => setShowAll(v => !v)}
                      hitSlop={8}
                      style={styles.modeButton}>
                      <Text style={styles.modeButtonText}>
                        {t(showAll ? 'irab.showWord' : 'irab.showAll')}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {shown.map(word => renderWordCard(part.verseKey, word))}
              </React.Fragment>
            );
          })}
          <Text style={styles.sources}>{t('irab.sources')}</Text>
        </>
      ) : (
        <BooksTab
          parts={parts.map(p => ({
            verseKey: p.verseKey,
            caption: p.caption,
            books: books?.get(p.verseKey) ?? [],
          }))}
          styles={styles}
          t={t}
        />
      )}
    </ScrollView>
  );
};

type Styles = ReturnType<typeof createStyles>;
type T = ReturnType<typeof useTranslation<'sheets'>>['t'];

/** Text with its word placeholders filled in as tappable words. */
function renderRefs(
  text: string,
  verseKey: string,
  wordTextOf: (verseKey: string, position: number) => string | undefined,
  onRef: (verseKey: string, position: number) => void,
  styles: Styles,
  t: T,
): React.ReactNode[] {
  return splitRefs(text, verseKey).map((part, i) => {
    if (part.type === 'text') return part.text;
    const word = wordTextOf(part.verseKey, part.position);
    const shown = word
      ? `«${word}»`
      : localizeDigits(t('irab.wordN', {n: part.position}));
    return (
      <Text
        key={i}
        style={styles.ref}
        onPress={() => onRef(part.verseKey, part.position)}>
        {shown}
      </Text>
    );
  });
}

/** The word's morphology (الصرف) as label / value rows. */
const MorphTable: React.FC<{
  facts: MorphFact[];
  verseKey: string;
  wordTextOf: (verseKey: string, position: number) => string | undefined;
  onRef: (verseKey: string, position: number) => void;
  styles: Styles;
  t: T;
}> = ({facts, verseKey, wordTextOf, onRef, styles, t}) => (
  <View style={styles.morph}>
    <Text style={styles.morphTitle}>{t('irab.morphology')}</Text>
    {facts.map((fact, i) => (
      <View key={i} style={[styles.morphRow, i > 0 && styles.morphRowBorder]}>
        <Text style={styles.morphLabel}>{fact.label}</Text>
        <Text style={styles.morphValue}>
          {renderRefs(fact.value, verseKey, wordTextOf, onRef, styles, t)}
        </Text>
      </View>
    ))}
  </View>
);

const EntryRow: React.FC<{
  entry: IrabEntry;
  verseKey: string;
  wordTextOf: (verseKey: string, position: number) => string | undefined;
  onRef: (verseKey: string, position: number) => void;
  styles: Styles;
  t: T;
}> = ({entry, verseKey, wordTextOf, onRef, styles, t}) => {
  const label =
    entry.kind === 'implied' ? t('irab.implied') : entry.label || null;
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
        {renderRefs(entry.text, verseKey, wordTextOf, onRef, styles, t)}
      </Text>
    </View>
  );
};

const BooksTab: React.FC<{
  parts: {
    verseKey: string;
    caption: string | null;
    books: IrabBookPassages[];
  }[];
  styles: Styles;
  t: T;
}> = ({parts, styles, t}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const anyBooks = parts.some(p => p.books.length > 0);
  return (
    <View>
      <Text style={styles.hint}>{t('irab.booksNote')}</Text>
      {!anyBooks && <Text style={styles.message}>{t('irab.noBooks')}</Text>}
      {parts.map(part => (
        <React.Fragment key={part.verseKey}>
          {part.caption !== null && part.books.length > 0 && (
            <Text style={styles.partCaption}>
              {localizeDigits(t('irab.hafsVerse', {verse: part.verseKey}))}
            </Text>
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
                          {t(open ? 'irab.readLess' : 'irab.readMore')}
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
      <Text style={styles.sources}>{t('irab.booksSources')}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const subtle = Color(theme.colors.text).alpha(0.04).toString();
  const hairline = Color(theme.colors.text).alpha(0.08).toString();
  const secondary = Color(theme.colors.textSecondary).alpha(0.75).toString();
  const phraseRule = Color(theme.colors.primary).alpha(0.45).toString();
  return StyleSheet.create({
    container: {
      paddingHorizontal: moderateScale(4),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(32),
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: subtle,
      borderRadius: moderateScale(10),
      padding: moderateScale(3),
      marginBottom: verticalScale(10),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: verticalScale(7),
      borderRadius: moderateScale(8),
    },
    tabActive: {
      backgroundColor: theme.colors.background,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: {width: 0, height: 1},
      elevation: 1,
    },
    tabText: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(13),
      color: secondary,
    },
    tabTextActive: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    partCaption: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      letterSpacing: latinLetterSpacing(0.3),
      marginTop: verticalScale(6),
      marginBottom: verticalScale(6),
      marginLeft: moderateScale(4),
    },
    wbwWrapper: {
      backgroundColor: subtle,
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      paddingHorizontal: moderateScale(10),
      paddingVertical: verticalScale(8),
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: verticalScale(8),
      marginBottom: verticalScale(4),
      paddingHorizontal: moderateScale(4),
    },
    hint: {
      flexShrink: 1,
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(11.5),
      color: secondary,
      marginBottom: verticalScale(4),
    },
    modeButton: {
      paddingHorizontal: moderateScale(10),
      paddingVertical: verticalScale(4),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.primary).alpha(0.12).toString(),
    },
    modeButtonText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(12),
      color: theme.colors.primary,
    },
    card: {
      marginTop: verticalScale(8),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: hairline,
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(10),
    },
    cardHeader: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: verticalScale(4),
    },
    cardWord: {
      fontFamily: ARABIC_FONT_BOLD,
      fontSize: moderateScale(24),
      color: theme.colors.text,
      writingDirection: 'rtl',
    },
    cardCounter: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(11),
      color: secondary,
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
    loading: {
      marginTop: verticalScale(32),
    },
    sources: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(10.5),
      lineHeight: moderateScale(15),
      color: Color(theme.colors.textSecondary).alpha(0.55).toString(),
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
