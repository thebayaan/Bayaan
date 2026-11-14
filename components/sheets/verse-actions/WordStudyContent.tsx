// @ai-generated
/**
 * Word Study (دراسة الكلمات): the `words` screen of the verse actions sheet.
 * It replaces the I'rab screen (docs/plans/2026-11-14-word-study, README
 * decisions and 01 §1–§5).
 *
 * Words tab: the word-by-word grid of the verse holding the current word,
 * then the current word's card (WordCard); a fixed bar at the bottom steps
 * through every word of the selection, across verses, in reading order.
 * A selection of several verses gets verse chips. Whole-verse mode lists
 * every word of the verse with its i'rab instead of one card. I'rab books
 * tab: the classical books' passages on the selected verses, loaded the
 * first time it opens.
 *
 * Another rewayah's selection steps through the Hafs words of its verses
 * (word-by-word, i'rab, gharib, rasm and word audio are Hafs data), cut to
 * the words the selection holds; the card's Readings show how the rewayah
 * reads each word.
 *
 * Navigation over the Quran text follows the text in both app languages:
 * the bar's Next is on the physical left, as the reader's arrow keys
 * (ipad-standards §7.3), and the chips run from the right. The arrow keys
 * step words on iPad.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import {ScrollView} from 'react-native-actions-sheet';
import {useReducedMotion} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {WBWVerseView} from '@/components/player/v2/PlayerContent/QuranView/WBWVerseView';
import type {ReadyVerseSelection} from '@/components/share/rewayahVerseSelection';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useHover} from '@/hooks/useHover';
import {useKeyCommands} from '@/hooks/useKeyCommands';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useResponsive} from '@/hooks/useResponsive';
import {useTheme} from '@/hooks/useTheme';
import {localizeDigits} from '@/i18n/format';
import {
  keyCommandsSupported,
  type KeyBinding,
} from '@/services/keyboard/keyCommands';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {wordReadingsService} from '@/services/mushaf/WordReadingsService';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {createIrabStyles, IrabBooksTab, ROW_FROM_RIGHT} from './IrabContent';
import {
  useIrabBooks,
  useVerseWordStudy,
  useWordStudyData,
  type PartData,
} from './useWordStudyData';
import {selectionWordParts, type WordStudyPart} from './verseUnitScreens';
import {
  CompactWordCard,
  DEFAULT_CARD_SECTIONS,
  WordCard,
  type CardSection,
} from './WordCard';
import {indexOfWord, type StudyWord, type WordRef} from './wordStudy';

export interface WordStudyContentProps {
  selection: ReadyVerseSelection;
  /**
   * The word to open on (the payload's word, or a long-press in Word by
   * Word); the first word when it is not in the selection.
   */
  initialWord?: WordRef;
  /**
   * Root search (the root as the data writes it, the lemma, and the word
   * shown, so Back can return to it); absent, the root is plain text.
   */
  onRootPress?: (root: string, lemma: string | null, word: WordRef) => void; // @ai
}

type Tab = 'words' | 'books';

const NO_WORDS: readonly StudyWord[] = [];
/** Space kept above the card when a step scrolls back to it. */
const CARD_SCROLL_MARGIN = 8;
/** A step waits this long for the card's new place before scrolling to it. */
const SCROLL_SETTLE_MS = 500;

/** The label of a part's verse: "2:3", or "Hafs 1:7" for another rewayah. */
function partLabel(
  part: WordStudyPart,
  t: ReturnType<typeof useTranslation<'sheets'>>['t'],
): string {
  return localizeDigits(
    part.caption === 'hafsVerse'
      ? t('irab.hafsVerse', {verse: part.verseKey})
      : part.verseKey,
  );
}

export const WordStudyContent: React.FC<WordStudyContentProps> = ({
  selection,
  initialWord,
  onRootPress,
}) => {
  const {t} = useTranslation(['sheets', 'common']);
  const {t: sheetsT} = useTranslation('sheets');
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  const styles = useMemo(
    () => createStyles(theme, isTablet),
    [theme, isTablet],
  );
  const irabStyles = useMemo(() => createIrabStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  const parts = useMemo(() => selectionWordParts(selection), [selection]);
  const data = useWordStudyData(parts);
  const verseKeys = useMemo(() => parts.map(p => p.verseKey), [parts]);

  const [tab, setTab] = useState<Tab>('words');
  const [booksOpened, setBooksOpened] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // A word reference, so it survives a sequence built anew.
  const [selected, setSelected] = useState<WordRef | null>(initialWord ?? null);
  // A chip of a verse with no words: shown, with nothing to step through.
  const [emptyPart, setEmptyPart] = useState<number | null>(null);
  // Open sections: kept while the screen is open, reset when it opens.
  const [expanded, setExpanded] = useState<Record<CardSection, boolean>>(
    () => ({...DEFAULT_CARD_SECTIONS}),
  );
  const books = useIrabBooks(verseKeys, booksOpened);

  const ready = data.status === 'ready' ? data : null;
  const sequence = ready ? ready.sequence : NO_WORDS;
  const found = indexOfWord(sequence, selected);
  const index = found >= 0 ? found : 0;
  const current: StudyWord | null = sequence[index] ?? null;
  const partIndex = emptyPart ?? current?.part ?? 0;
  const partData: PartData | undefined = ready?.parts[partIndex];
  const partWords = useMemo(
    () => sequence.filter(w => w.part === partIndex),
    [sequence, partIndex],
  );
  const study = useVerseWordStudy(current?.verseKey ?? null);

  const textByVerse = useMemo(
    () => new Map(ready?.parts.map(p => [p.part.verseKey, p.wordText]) ?? []),
    [ready],
  );
  const wordTextOf = useCallback(
    (verseKey: string, position: number) =>
      textByVerse.get(verseKey)?.get(position),
    [textByVerse],
  );

  // Readings of the next verse, so stepping into it finds them loaded (the
  // card's section asks for the current one itself).
  const nextVerse = ready?.parts[partIndex + 1]?.part.verseKey;
  useEffect(() => {
    if (nextVerse) wordReadingsService.request(nextVerse);
  }, [nextVerse]);

  // --- Scrolling back to the card after a step ---
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const cardY = useRef<number | null>(null);
  const revealUntil = useRef(0);
  const revealCard = useCallback(() => {
    const y = cardY.current;
    if (y === null || Date.now() > revealUntil.current) return;
    if (y < scrollY.current) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - CARD_SCROLL_MARGIN),
        animated: !reduceMotion,
      });
    }
  }, [reduceMotion]);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onCardLayout = useCallback(
    (e: LayoutChangeEvent) => {
      cardY.current = e.nativeEvent.layout.y;
      revealCard();
    },
    [revealCard],
  );
  useEffect(() => {
    revealCard();
  }, [current, revealCard]);

  // --- Choosing words ---
  const selectWord = useCallback((word: StudyWord) => {
    setSelected({verseKey: word.verseKey, position: word.position});
    setEmptyPart(null);
  }, []);

  const step = useCallback(
    (delta: 1 | -1) => {
      const next = sequence[index + delta];
      if (!next) return;
      revealUntil.current = Date.now() + SCROLL_SETTLE_MS;
      selectWord(next);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          localizeDigits(
            t('wordView.announce', {
              word: next.text,
              n: next.index + 1,
              total: sequence.length,
            }),
          ),
        );
      }
    },
    [sequence, index, selectWord, t],
  );
  const canPrevious = index > 0;
  const canNext = index < sequence.length - 1;

  const onGridWord = useCallback(
    (position: number) => {
      const verseKey = partData?.part.verseKey;
      if (!verseKey) return;
      const at = indexOfWord(sequence, {verseKey, position});
      if (at < 0) return;
      selectWord(sequence[at]);
      setShowAll(false);
    },
    [partData, sequence, selectWord],
  );

  const onChip = useCallback(
    (part: number) => {
      const first = sequence.find(w => w.part === part);
      if (first) selectWord(first);
      else setEmptyPart(part);
    },
    [sequence, selectWord],
  );

  const canOpen = useCallback(
    (ref: WordRef) => indexOfWord(sequence, ref) >= 0,
    [sequence],
  );
  const onRef = useCallback(
    (ref: WordRef) => {
      const at = indexOfWord(sequence, ref);
      if (at < 0) return;
      selectWord(sequence[at]);
      setShowAll(false);
    },
    [sequence, selectWord],
  );
  const onStudy = useCallback(
    (word: StudyWord) => {
      selectWord(word);
      setShowAll(false);
    },
    [selectWord],
  );
  const onToggle = useCallback((section: CardSection) => {
    setExpanded(prev => ({...prev, [section]: !prev[section]}));
  }, []);

  const openTab = useCallback((next: Tab) => {
    setTab(next);
    if (next === 'books') setBooksOpened(true);
  }, []);

  // --- Arrow keys on iPad: ← is the next word, as in the reader ---
  const stepping =
    tab === 'words' && !showAll && ready !== null && sequence.length > 0;
  const keyBindings = useMemo<KeyBinding[]>(
    () => [
      {
        key: 'left',
        title: t('wordView.nextWord'),
        menu: 'reader',
        enabled: canNext,
        run: () => step(1),
      },
      {
        key: 'right',
        title: t('wordView.previousWord'),
        menu: 'reader',
        enabled: canPrevious,
        run: () => step(-1),
      },
    ],
    [t, canNext, canPrevious, step],
  );
  useKeyCommands(keyBindings, keyCommandsSupported() && stepping);

  // --- The grid's Quran text settings (as the Word by Word screen) ---
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColorSetting = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  // The grid memoizes the Hafs words per verse: remount it once they are
  // in memory (as the I'rab and Word by Word screens do).
  const hafsWordsReady = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    () => digitalKhattDataService.isRewayahReady('hafs'),
  );
  const isDK =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;
  const noop = useCallback(() => undefined, []);

  // The current word's own Hafs slots (two for بَعْدَ مَا), for its header.
  const currentSlots = useMemo(() => {
    const own = current ? ready?.parts[current.part] : undefined;
    if (!current || !own) return [];
    const positions = current.slots.map(slot => Number(slot.split(':')[2]));
    return own.words.dk.filter(w => positions.includes(w.wordPositionInVerse));
  }, [current, ready]);

  const renderWords = () => {
    if (data.status === 'loading') {
      return (
        <ActivityIndicator style={styles.loading} color={theme.colors.text} />
      );
    }
    if (data.status === 'error') {
      return (
        <View style={styles.failed}>
          <Text style={styles.message}>{t('wordView.loadFailed')}</Text>
          <TextButton
            label={t('common:actions.tryAgain')}
            onPress={data.retry}
            styles={styles}
          />
        </View>
      );
    }
    if (!partData) {
      return <Text style={styles.message}>{t('wordView.noWords')}</Text>;
    }
    const {part} = partData;
    const inPart = current !== null && current.part === partIndex;
    const verseName = partLabel(part, sheetsT);
    return (
      <>
        {parts.length > 1 ? (
          <View style={styles.chips} accessibilityRole="tablist">
            {parts.map((p, i) => (
              <Chip
                key={p.verseKey}
                label={partLabel(p, sheetsT)}
                selected={i === partIndex}
                onPress={() => onChip(i)}
                styles={styles}
              />
            ))}
          </View>
        ) : part.caption === 'hafsVerse' ? (
          <Text style={styles.partCaption}>{partLabel(part, sheetsT)}</Text>
        ) : null}
        {partWords.length === 0 ? (
          <Text style={styles.message}>{t('wordView.noWords')}</Text>
        ) : (
          <>
            <View
              style={styles.grid}
              accessible
              accessibilityLabel={t('wordView.gridLabel', {verse: verseName})}
              accessibilityHint={showAll ? undefined : t('wordView.gridHint')}>
              <WBWVerseView
                key={`${part.verseKey}:${hafsWordsReady ? 'ready' : 'loading'}`}
                verseKey={part.verseKey}
                wordRange={part.wordRange}
                rewayah={selection.rewayah}
                textColor={theme.colors.text}
                arabicFontSize={arabicFontSize}
                dkFontFamily={getDkFontFamily(mushafRenderer, 'hafs')}
                fontMgr={fontMgr}
                showTranslation={false}
                showTransliteration={false}
                onWordPress={onGridWord}
                selectedWordPosition={
                  !showAll && inPart && current ? current.position : null
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
            <View style={styles.modeRow}>
              <Text style={styles.hint}>{t('wordView.tapWord')}</Text>
              <TextButton
                label={t(showAll ? 'irab.showWord' : 'irab.showAll')}
                onPress={() => setShowAll(v => !v)}
                styles={styles}
                pill
              />
            </View>
            {showAll ? (
              <>
                {partData.irab === null ? (
                  <Text style={styles.message}>{t('irab.loadFailed')}</Text>
                ) : null}
                {partWords.map(word => (
                  <CompactWordCard
                    key={`${word.verseKey}:${word.position}`}
                    word={word}
                    wbw={partData.words.wbw.find(
                      w => w.position === word.position,
                    )}
                    irab={partData.irab?.find(
                      w => w.position === word.position,
                    )}
                    wordTextOf={wordTextOf}
                    canOpen={canOpen}
                    onRef={onRef}
                    onStudy={onStudy}
                  />
                ))}
              </>
            ) : inPart && current ? (
              <View onLayout={onCardLayout}>
                <WordCard
                  word={current}
                  slots={currentSlots}
                  wbw={partData.words.wbw.find(
                    w => w.position === current.position,
                  )}
                  irab={
                    partData.irab === null
                      ? null
                      : partData.irab.find(w => w.position === current.position)
                  }
                  rewayah={selection.rewayah}
                  study={study}
                  wordTextOf={wordTextOf}
                  canOpen={canOpen}
                  onRef={onRef}
                  // @ai-start
                  onRootPress={
                    onRootPress &&
                    ((root, lemma) =>
                      onRootPress(root, lemma, {
                        verseKey: current.verseKey,
                        position: current.position,
                      }))
                  }
                  // @ai-end
                  expanded={expanded}
                  onToggle={onToggle}
                  fontMgr={fontMgr}
                />
              </View>
            ) : null}
          </>
        )}
        <Text style={styles.sources}>{t('irab.sources')}</Text>
      </>
    );
  };

  const renderBooks = () => {
    if (books.status === 'error') {
      return (
        <View style={styles.failed}>
          <Text style={styles.message}>{t('irab.loadFailed')}</Text>
          <TextButton
            label={t('common:actions.tryAgain')}
            onPress={books.retry}
            styles={styles}
          />
        </View>
      );
    }
    if (books.status !== 'ready') {
      return (
        <ActivityIndicator style={styles.loading} color={theme.colors.text} />
      );
    }
    return (
      <IrabBooksTab
        parts={parts.map(p => ({
          verseKey: p.verseKey,
          caption:
            parts.length > 1 || p.caption === 'hafsVerse'
              ? partLabel(p, sheetsT)
              : null,
          books: books.books.get(p.verseKey) ?? [],
        }))}
        styles={irabStyles}
        t={sheetsT}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['words', 'books'] as const).map(key => (
            <TabButton
              key={key}
              label={t(key === 'words' ? 'wordView.tabWords' : 'irab.tabBooks')}
              selected={tab === key}
              onPress={() => openTab(key)}
              styles={styles}
            />
          ))}
        </View>
        {tab === 'words' ? renderWords() : renderBooks()}
      </ScrollView>
      {stepping ? (
        // In the Quran's direction in both app languages: Previous on the
        // physical right, Next on the left, chevrons never mirrored.
        <View style={styles.stepBar}>
          <StepButton
            label={t('wordView.previous')}
            accessibilityLabel={t('wordView.previousWord')}
            icon="chevron-right"
            disabled={!canPrevious}
            onPress={() => step(-1)}
            styles={styles}
          />
          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {localizeDigits(
              t('irab.wordOf', {n: index + 1, total: sequence.length}),
            )}
          </Text>
          <StepButton
            label={t('wordView.next')}
            accessibilityLabel={t('wordView.nextWord')}
            icon="chevron-left"
            disabled={!canNext}
            onPress={() => step(1)}
            styles={styles}
          />
        </View>
      ) : null}
    </View>
  );
};

type Styles = ReturnType<typeof createStyles>;

const TabButton: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: Styles;
}> = ({label, selected, onPress, styles}) => {
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected}}
      onPress={onPress}
      hitSlop={{top: 4, bottom: 4}}
      {...hoverProps}
      style={[
        styles.tab,
        selected && styles.tabSelected,
        hovered && !selected && styles.hovered,
      ]}>
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
};

/** A verse of the selection; selecting it shows its words. */
const Chip: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: Styles;
}> = ({label, selected, onPress, styles}) => {
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected}}
      onPress={onPress}
      hitSlop={{top: 4, bottom: 4}}
      {...hoverProps}
      style={({pressed}) => [
        styles.chip,
        selected && styles.chipSelected,
        (pressed || hovered) && !selected && styles.hovered,
      ]}>
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected]}
        maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Try again, and the whole verse / one word pill. */
const TextButton: React.FC<{
  label: string;
  onPress: () => void;
  styles: Styles;
  pill?: boolean;
}> = ({label, onPress, styles, pill}) => {
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={pill ? {top: 6, bottom: 6} : undefined}
      {...hoverProps}
      style={({pressed}) => [
        pill ? styles.pill : styles.textButton,
        (pressed || hovered) && styles.hovered,
      ]}>
      <Text style={styles.textButtonText}>{label}</Text>
    </Pressable>
  );
};

const StepButton: React.FC<{
  label: string;
  accessibilityLabel: string;
  icon: 'chevron-left' | 'chevron-right';
  disabled: boolean;
  onPress: () => void;
  styles: Styles;
}> = ({label, accessibilityLabel, icon, disabled, onPress, styles}) => {
  const {theme} = useTheme();
  const {hovered, hoverProps} = useHover();
  const color = disabled
    ? Color(theme.colors.text).alpha(0.35).toString()
    : theme.colors.text;
  const chevron = (
    <Feather name={icon} size={moderateScale(18)} color={color} />
  );
  const text = <Text style={[styles.stepText, {color}]}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      {...hoverProps}
      style={({pressed}) => [
        styles.stepButton,
        (pressed || hovered) && !disabled && styles.hovered,
      ]}>
      {/* The chevron on the outer side: › Previous on the right, ‹ Next on the left. */}
      {icon === 'chevron-right' ? (
        <>
          {chevron}
          {text}
        </>
      ) : (
        <>
          {text}
          {chevron}
        </>
      )}
    </Pressable>
  );
};

function createStyles(theme: Theme, isTablet: boolean) {
  // The type ramp (ipad-standards §4.1).
  const callout = isTablet ? 15 : 14;
  const footnote = 13;
  // Secondary text at 0.8 alpha or more (§12).
  const secondary = Color(theme.colors.text).alpha(0.8).toString();
  const subtle = Color(theme.colors.text).alpha(0.04).toString();
  const hover = Color(theme.colors.text).alpha(0.06).toString();
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      paddingHorizontal: moderateScale(4),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(24),
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: subtle,
      borderRadius: moderateScale(10),
      padding: 3,
      marginBottom: moderateScale(10),
    },
    tab: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: moderateScale(8),
    },
    tabSelected: {
      backgroundColor: theme.colors.background,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: {width: 0, height: 1},
      elevation: 1,
    },
    tabText: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(footnote),
      color: secondary,
    },
    tabTextSelected: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    hovered: {
      backgroundColor: hover,
    },
    chips: {
      flexDirection: ROW_FROM_RIGHT,
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: moderateScale(10),
    },
    chip: {
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: moderateScale(12),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    chipSelected: {
      backgroundColor: theme.colors.text,
      borderColor: theme.colors.text,
    },
    chipText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(footnote),
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: theme.colors.background,
    },
    partCaption: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(footnote),
      color: secondary,
      marginBottom: moderateScale(6),
      marginHorizontal: moderateScale(4),
      textAlign: 'left',
    },
    grid: {
      backgroundColor: subtle,
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(8),
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: moderateScale(8),
      paddingHorizontal: moderateScale(4),
    },
    hint: {
      flexShrink: 1,
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(footnote),
      color: secondary,
      textAlign: 'left',
    },
    pill: {
      minHeight: 32,
      minWidth: 44,
      paddingHorizontal: moderateScale(12),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    textButton: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    textButtonText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(callout),
      color: theme.colors.text,
    },
    loading: {
      marginTop: moderateScale(32),
    },
    failed: {
      alignItems: 'center',
      gap: 12,
      marginTop: moderateScale(24),
    },
    message: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(footnote),
      lineHeight: moderateScale(footnote * 1.45),
      color: secondary,
      textAlign: 'center',
      marginVertical: moderateScale(8),
    },
    sources: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(12),
      lineHeight: moderateScale(17),
      color: secondary,
      marginTop: moderateScale(16),
      paddingHorizontal: moderateScale(4),
      textAlign: 'left',
    },
    stepBar: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: moderateScale(8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.08).toString(),
      backgroundColor: theme.colors.background,
    },
    stepButton: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: moderateScale(10),
      borderRadius: moderateScale(10),
    },
    stepText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(callout),
    },
    counter: {
      flexShrink: 1,
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(footnote),
      color: secondary,
      textAlign: 'center',
    },
  });
}
