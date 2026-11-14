// @ai-generated
/**
 * The card of one word in Word Study (docs/plans/2026-11-14-word-study,
 * README decisions and 01 §3), top to bottom:
 *  - header: the mushaf's own word (WordHeaderText), its transliteration and
 *    English meaning (always shown here, whatever the grid settings), Play,
 *    and its reference; for another rewayah a Hafs chip and a note that the
 *    word's data is Hafs;
 *  - Readings: how the 8 rewayat read the word (WordReadingsSection);
 *  - I'rab, then Morphology: the root (a chip when root search is wired),
 *    the lemma, and Show more for the other facts in data order;
 *  - Arabic meaning (GharibSection) and Rasm (RasmSection).
 * A section with nothing to show is not drawn. I'rab and Morphology open and
 * close, and the screen keeps the choice while it is open; the Readings,
 * Arabic meaning and Rasm sections draw their own titles and states.
 *
 * Every word datum is Hafs (word-by-word, i'rab, gharib, rasm and word audio
 * are keyed by Hafs verse and word-by-word position); only Readings speaks
 * of the other rewayat.
 *
 * CompactWordCard is one word of the whole-verse list: the word, its
 * meaning, its number and its i'rab; a tap studies it.
 */
import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useHover} from '@/hooks/useHover';
import {useResponsive} from '@/hooks/useResponsive';
import {useTheme} from '@/hooks/useTheme';
import {useWordAudio, type WordAudioState} from '@/hooks/useWordAudio';
import {localizeDigits} from '@/i18n/format';
import {
  MORPH_LEMMA_LABEL,
  MORPH_ROOT_LABEL,
  type MorphFact,
  type WordIrab,
} from '@/services/irab/irabFormat';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {READINGS_REWAYAT} from '@/services/mushaf/wordReadingsFormat';
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import type {WBWWord} from '@/services/wbw/WBWDataService';
import {wordAudioUrl} from '@/services/wbw/wordAudio';
import {
  gharibForWord,
  rasmForWord,
  type VerseWordStudy,
} from '@/services/wordStudy/wordStudyFormat';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {isRTL} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {
  createIrabStyles,
  IrabEntryList,
  renderRefs,
  ROW_FROM_RIGHT,
  type IrabRefContext,
  type IrabStyles,
} from './IrabContent';
import {WordReadingsSection} from './WordReadingsSection';
import {GharibSection} from './word-study/GharibSection';
import {RasmSection} from './word-study/RasmSection';
import {WordHeaderText} from './WordHeaderText';
import {
  rnQuranFontFamily,
  summarizeMorph,
  type StudyWord,
  type WordRef,
} from './wordStudy';

/** The parts of the card that open and close. */
export type CardSection = 'irab' | 'morphology' | 'morphologyMore';

/** Open: I'rab and Morphology (root and lemma); the other facts closed. */
export const DEFAULT_CARD_SECTIONS: Readonly<Record<CardSection, boolean>> = {
  irab: true,
  morphology: true,
  morphologyMore: false,
};

/** The header word: 1.4x the reading size (36pt at the default 26). */
const HEADER_SCALE = 1.4;
/** A word of the whole-verse list: 0.85x the reading size. */
const COMPACT_SCALE = 0.85;

/** What the i'rab text of a word needs from the screen. */
interface RefProps {
  /** The mushaf text of a word, for quoting it; undefined when unknown. */
  wordTextOf: (verseKey: string, position: number) => string | undefined;
  /** Whether a referred word is in the selection (it can be opened). */
  canOpen: (ref: WordRef) => boolean;
  onRef: (ref: WordRef) => void;
}

export interface WordCardProps extends RefProps {
  word: StudyWord;
  /** The word's own Hafs DigitalKhatt slots (the header). */
  slots: readonly DKWordInfo[];
  /** Its word-by-word word: transliteration and meaning. */
  wbw: WBWWord | undefined;
  /** Its i'rab; null when the verse's i'rab failed to load. */
  irab: WordIrab | undefined | null;
  /** The selection's rewayah: the Hafs chip and note, Current in Readings. */
  rewayah: RewayahId;
  /** Gharib and rasm of the word's verse; null until they load. */
  study: VerseWordStudy | null;
  /** Root search; absent, the root is plain text (no chip). */
  onRootPress?: (root: string, lemma: string | null) => void;
  expanded: Readonly<Record<CardSection, boolean>>;
  onToggle: (section: CardSection) => void;
  fontMgr: SkTypefaceFontProvider | null;
}

/** "2:255", or "Hafs 1:7" when the sheet shows another rewayah. */
function useVerseLabel(): (verseKey: string, rewayah: RewayahId) => string {
  const {t} = useTranslation('sheets');
  return (verseKey, rewayah) =>
    localizeDigits(
      rewayah === 'hafs' ? verseKey : t('irab.hafsVerse', {verse: verseKey}),
    );
}

export const WordCard: React.FC<WordCardProps> = ({
  word,
  slots,
  wbw,
  irab,
  rewayah,
  study,
  wordTextOf,
  canOpen,
  onRef,
  onRootPress,
  expanded,
  onToggle,
  fontMgr,
}) => {
  const {t} = useTranslation(['sheets', 'common']);
  const {t: sheetsT} = useTranslation('sheets');
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  const styles = useMemo(
    () => createCardStyles(theme, isTablet),
    [theme, isTablet],
  );
  const irabStyles = useMemo(() => createIrabStyles(theme), [theme]);
  const verseLabel = useVerseLabel();

  const refContext: IrabRefContext = {
    verseKey: word.verseKey,
    wordTextOf,
    canOpen,
    onRef,
    styles: irabStyles,
    t: sheetsT,
  };
  const morph = irab ? summarizeMorph(irab.morph) : null;
  const gharib = study ? gharibForWord(study, word.position) : [];
  const rasm = study ? rasmForWord(study, word.position) : null;
  const rasmText = rasm
    ? unitText(rasm.from, rasm.to, p => wordTextOf(word.verseKey, p))
    : undefined;
  const otherRewayah = rewayah !== 'hafs';
  const readingsCover = (READINGS_REWAYAT as readonly string[]).includes(
    rewayah,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {otherRewayah ? (
          <View style={styles.hafsChip}>
            <Text style={styles.hafsChipText} maxFontSizeMultiplier={1.3}>
              {getShortLabel('hafs')}
            </Text>
          </View>
        ) : null}
        <HeaderWord word={word} slots={slots} fontMgr={fontMgr} />
        {wbw ? (
          <Text style={styles.gloss}>
            {wbw.transliteration ? (
              <Text style={styles.transliteration}>{wbw.transliteration}</Text>
            ) : null}
            {wbw.transliteration && wbw.translation ? ' · ' : null}
            {wbw.translation ? `“${wbw.translation}”` : null}
          </Text>
        ) : null}
        <View style={styles.headerRow}>
          <PlayPill
            verseKey={word.verseKey}
            position={word.position}
            styles={styles}
          />
          <Text style={styles.reference}>
            {localizeDigits(
              t('wordView.wordRef', {
                verse: verseLabel(word.verseKey, rewayah),
                n: word.position,
              }),
            )}
          </Text>
        </View>
        {otherRewayah ? (
          <Text style={styles.hafsNote}>
            {readingsCover
              ? t('wordView.hafsNoteReadings', {
                  rewayah: getShortLabel(rewayah),
                })
              : t('wordView.hafsNote')}
          </Text>
        ) : null}
      </View>

      <WordReadingsSection
        verseKey={word.verseKey}
        wbwPosition={word.position}
        currentRewayah={rewayah}
      />

      {irab === null ||
      (irab !== undefined && (irab.entries.length > 0 || irab.agreed)) ? (
        <SectionShell
          title={t('verseActions.irab')}
          open={expanded.irab}
          onToggle={() => onToggle('irab')}
          styles={styles}>
          {irab === null ? (
            <Text style={styles.message}>{t('irab.loadFailed')}</Text>
          ) : (
            <IrabEntryList word={irab} {...refContext} />
          )}
        </SectionShell>
      ) : null}

      {morph && (morph.root || morph.lemma || morph.rest.length > 0) ? (
        <SectionShell
          title={t('irab.morphology')}
          open={expanded.morphology}
          onToggle={() => onToggle('morphology')}
          styles={styles}>
          <MorphologyBody
            root={morph.root}
            lemma={morph.lemma}
            rest={morph.rest}
            more={expanded.morphologyMore}
            onMore={() => onToggle('morphologyMore')}
            onRootPress={onRootPress}
            refContext={refContext}
            styles={styles}
          />
        </SectionShell>
      ) : null}

      <GharibSection
        entries={gharib}
        position={word.position}
        wordTextOf={p => wordTextOf(word.verseKey, p)}
      />
      <RasmSection rasm={rasm} uthmani={rasmText} />
    </View>
  );
};

/** The app's text of words from..to of a verse; undefined if one is unknown. */
function unitText(
  from: number,
  to: number,
  textOf: (position: number) => string | undefined,
): string | undefined {
  const words: string[] = [];
  for (let p = from; p <= to; p++) {
    const text = textOf(p);
    if (!text) return undefined;
    words.push(text);
  }
  return words.join(' ');
}

/** The header word, with the grid's Quran text settings. */
const HeaderWord: React.FC<{
  word: StudyWord;
  slots: readonly DKWordInfo[];
  fontMgr: SkTypefaceFontProvider | null;
}> = ({word, slots, fontMgr}) => {
  const {theme} = useTheme();
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showAllahNameHighlight = useMushafSettingsStore(
    s => s.showAllahNameHighlight,
  );
  const allahNameHighlightColor = useMushafSettingsStore(
    s => s.allahNameHighlightColor,
  );
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  return (
    <WordHeaderText
      verseKey={word.verseKey}
      slots={slots}
      fontMgr={fontMgr}
      fontFamily={getDkFontFamily(renderer, 'hafs')}
      rnFontFamily={rnQuranFontFamily(renderer, 'hafs')}
      fontSize={Math.round(arabicFontSize * HEADER_SCALE)}
      color={theme.colors.text}
      showTajweed={showTajweed}
      indexedTajweedData={indexedTajweedData}
      arabicTextWeight={arabicTextWeight}
      allahNameHighlightColor={
        showAllahNameHighlight
          ? getAllahNameHighlightColorHex(
              allahNameHighlightColor,
              theme.isDarkMode,
            )
          : undefined
      }
    />
  );
};

/** Plays the word's recording (Quran.com word audio, Hafs). */
const PlayPill: React.FC<{
  verseKey: string;
  position: number;
  styles: CardStyles;
}> = ({verseKey, position, styles}) => {
  const {t} = useTranslation(['sheets', 'common']);
  const {theme} = useTheme();
  const {hovered, hoverProps} = useHover();
  const url = wordAudioUrl(verseKey, position);
  const {state, toggle} = useWordAudio(url || null);
  if (!url) return null;
  const labels: Record<WordAudioState, string> = {
    idle: t('common:actions.play'),
    loading: t('common:status.loading'),
    playing: t('common:actions.pause'),
    error: t('wordView.audioFailed'),
  };
  const label = labels[state];
  const iconSize = moderateScale(13);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('wordView.playWord')}
      accessibilityValue={{text: label}}
      accessibilityState={{busy: state === 'loading'}}
      onPress={toggle}
      {...hoverProps}
      style={({pressed}) => [
        styles.playPill,
        (pressed || hovered) && styles.playPillActive,
      ]}>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={theme.colors.text} />
      ) : state === 'playing' ? (
        <PauseIcon size={iconSize} color={theme.colors.text} />
      ) : (
        <PlayIcon size={iconSize} color={theme.colors.text} />
      )}
      <Text style={styles.playPillText}>{label}</Text>
    </Pressable>
  );
};

/** A titled part of the card that opens and closes. */
const SectionShell: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  styles: CardStyles;
  children: React.ReactNode;
}> = ({title, open, onToggle, styles, children}) => {
  const {theme} = useTheme();
  const {hovered, hoverProps} = useHover();
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{expanded: open}}
        onPress={onToggle}
        {...hoverProps}
        style={({pressed}) => [
          styles.sectionHeader,
          (pressed || hovered) && styles.sectionHeaderActive,
        ]}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={moderateScale(16)}
          color={Color(theme.colors.text).alpha(0.7).toString()}
        />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
};

/**
 * The root and lemma, then the other facts behind Show more. A word with
 * neither (a particle) shows its facts at once.
 */
const MorphologyBody: React.FC<{
  root: string | null;
  lemma: string | null;
  rest: readonly MorphFact[];
  more: boolean;
  onMore: () => void;
  onRootPress?: (root: string, lemma: string | null) => void;
  refContext: IrabRefContext;
  styles: CardStyles;
}> = ({root, lemma, rest, more, onMore, onRootPress, refContext, styles}) => {
  const {t} = useTranslation(['sheets', 'common']);
  const {hovered, hoverProps} = useHover();
  const irabStyles: IrabStyles = refContext.styles;
  const headed = root !== null || lemma !== null;
  const shownRest = !headed || more ? rest : [];
  const rows: {key: string; label: string; value: React.ReactNode}[] = [];
  if (root !== null) {
    rows.push({
      key: 'root',
      label: MORPH_ROOT_LABEL,
      value: onRootPress ? (
        <View style={styles.rootValue}>
          <RootChip
            root={root}
            onPress={() => onRootPress(root, lemma)}
            styles={styles}
          />
        </View>
      ) : (
        <Text style={irabStyles.morphValue}>{root}</Text>
      ),
    });
  }
  if (lemma !== null) {
    rows.push({
      key: 'lemma',
      label: MORPH_LEMMA_LABEL,
      value: (
        <Text style={irabStyles.morphValue}>
          {renderRefs(lemma, refContext)}
        </Text>
      ),
    });
  }
  shownRest.forEach((fact, i) => {
    rows.push({
      key: `fact-${i}`,
      label: fact.label,
      value: (
        <Text style={irabStyles.morphValue}>
          {renderRefs(fact.value, refContext)}
        </Text>
      ),
    });
  });
  return (
    <View>
      <View style={irabStyles.morph}>
        {rows.map((row, i) => (
          <View
            key={row.key}
            style={[irabStyles.morphRow, i > 0 && irabStyles.morphRowBorder]}>
            <Text style={irabStyles.morphLabel}>{row.label}</Text>
            {row.value}
          </View>
        ))}
      </View>
      {headed && rest.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: more}}
          onPress={onMore}
          hitSlop={{top: 8, bottom: 8}}
          {...hoverProps}
          style={({pressed}) => [
            styles.more,
            (pressed || hovered) && styles.sectionHeaderActive,
          ]}>
          <Text style={styles.moreText}>
            {t(more ? 'common:actions.showLess' : 'common:actions.showMore')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** The root, as a chip that searches it. */
const RootChip: React.FC<{
  root: string;
  onPress: () => void;
  styles: CardStyles;
}> = ({root, onPress, styles}) => {
  const {t} = useTranslation('sheets');
  const {theme} = useTheme();
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('wordView.morphology.searchRoot', {root})}
      onPress={onPress}
      hitSlop={{top: 6, bottom: 6}}
      {...hoverProps}
      style={({pressed}) => [
        styles.rootChip,
        (pressed || hovered) && styles.rootChipActive,
      ]}>
      <Text style={styles.rootChipText}>{root}</Text>
      <Feather
        name="search"
        size={moderateScale(13)}
        color={Color(theme.colors.text).alpha(0.7).toString()}
      />
    </Pressable>
  );
};

export interface CompactWordCardProps extends RefProps {
  word: StudyWord;
  wbw: WBWWord | undefined;
  /** Its i'rab; undefined when there is none (or it failed to load). */
  irab: WordIrab | undefined;
  /** Opens one-word mode at this word. */
  onStudy: (word: StudyWord) => void;
}

/** One word of the whole-verse list. */
export const CompactWordCard: React.FC<CompactWordCardProps> = ({
  word,
  wbw,
  irab,
  wordTextOf,
  canOpen,
  onRef,
  onStudy,
}) => {
  const {t} = useTranslation('sheets');
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  const styles = useMemo(
    () => createCardStyles(theme, isTablet),
    [theme, isTablet],
  );
  const irabStyles = useMemo(() => createIrabStyles(theme), [theme]);
  const {hovered, hoverProps} = useHover();
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const fontSize = Math.round(arabicFontSize * COMPACT_SCALE);
  // The mushaf's own text of the word, as the grid draws it.
  const text = word.text;
  return (
    <Pressable
      accessibilityRole="button"
      // The card's own text (the word and its i'rab) is its label; the hint
      // says what a press does. @ai
      accessibilityHint={t('wordView.studyWord', {word: text})}
      onPress={() => onStudy(word)}
      {...hoverProps}
      style={({pressed}) => [
        styles.compact,
        (pressed || hovered) && styles.sectionHeaderActive,
      ]}>
      <View style={styles.compactHeader}>
        <Text
          style={[
            styles.compactWord,
            {
              fontFamily: rnQuranFontFamily(renderer, 'hafs'),
              fontSize,
              lineHeight: fontSize * 2,
            },
          ]}>
          {text}
        </Text>
        <View style={styles.compactMeta}>
          {wbw?.translation ? (
            <Text style={styles.compactMeaning}>{wbw.translation}</Text>
          ) : null}
          <Text style={styles.reference}>
            {localizeDigits(t('irab.wordN', {n: word.position}))}
          </Text>
        </View>
      </View>
      {irab ? (
        <IrabEntryList
          word={irab}
          verseKey={word.verseKey}
          wordTextOf={wordTextOf}
          canOpen={canOpen}
          onRef={onRef}
          styles={irabStyles}
          t={t}
        />
      ) : null}
    </Pressable>
  );
};

type CardStyles = ReturnType<typeof createCardStyles>;

function createCardStyles(theme: Theme, isTablet: boolean) {
  // The type ramp (ipad-standards §4.1): callout for titles and buttons,
  // footnote for metadata, caption for tags.
  const callout = isTablet ? 15 : 14;
  const footnote = 13;
  const caption = isTablet ? 12 : 11;
  // Secondary text at 0.8 alpha or more (§12).
  const secondary = Color(theme.colors.text).alpha(0.8).toString();
  const subtle = Color(theme.colors.text).alpha(0.04).toString();
  const hairline = Color(theme.colors.text).alpha(0.08).toString();
  const pressed = Color(theme.colors.text).alpha(0.06).toString();
  return StyleSheet.create({
    card: {
      marginTop: moderateScale(8),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: hairline,
      paddingHorizontal: moderateScale(14),
      paddingTop: moderateScale(10),
      paddingBottom: moderateScale(14),
    },
    header: {
      alignItems: 'center',
      gap: moderateScale(6),
    },
    hafsChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    hafsChipText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(caption),
      color: theme.colors.text,
    },
    gloss: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(callout),
      lineHeight: moderateScale(callout * 1.45),
      color: theme.colors.text,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    transliteration: {
      fontFamily: 'Manrope-Regular',
      fontStyle: 'italic',
      color: secondary,
    },
    headerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(12),
    },
    playPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: moderateScale(14),
      borderRadius: 999,
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    playPillActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.14).toString(),
    },
    playPillText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(callout),
      color: theme.colors.text,
    },
    reference: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(footnote),
      color: secondary,
    },
    hafsNote: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(footnote),
      lineHeight: moderateScale(footnote * 1.45),
      color: secondary,
      textAlign: 'center',
    },
    section: {
      marginTop: moderateScale(12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: hairline,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      borderRadius: moderateScale(8),
    },
    sectionHeaderActive: {
      backgroundColor: pressed,
    },
    sectionTitle: {
      flexShrink: 1,
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(callout),
      color: theme.colors.text,
      textAlign: 'left',
    },
    sectionBody: {
      paddingBottom: moderateScale(4),
    },
    message: {
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(footnote),
      color: secondary,
      textAlign: 'left',
    },
    more: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      minHeight: 28,
      paddingHorizontal: moderateScale(8),
      marginTop: moderateScale(6),
      borderRadius: moderateScale(8),
    },
    moreText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(footnote),
      color: theme.colors.text,
    },
    // The chip sits on the physical right, beside its Arabic label.
    rootValue: {
      flex: 1,
      alignItems: isRTL ? 'flex-start' : 'flex-end',
    },
    rootChip: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'center',
      gap: moderateScale(6),
      minHeight: 32,
      minWidth: 44,
      paddingHorizontal: moderateScale(10),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      backgroundColor: subtle,
    },
    rootChipActive: {
      backgroundColor: pressed,
    },
    rootChipText: {
      fontFamily: 'ScheherazadeNew-SemiBold',
      fontSize: moderateScale(15.5),
      lineHeight: moderateScale(26),
      color: theme.colors.text,
      writingDirection: 'rtl',
    },
    compact: {
      marginTop: moderateScale(8),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: hairline,
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
      minHeight: 44,
    },
    compactHeader: {
      flexDirection: ROW_FROM_RIGHT,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: moderateScale(12),
    },
    compactWord: {
      color: theme.colors.text,
      writingDirection: 'rtl',
    },
    compactMeta: {
      flexShrink: 1,
      alignItems: 'flex-start',
      gap: moderateScale(2),
    },
    compactMeaning: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(footnote),
      color: theme.colors.text,
      writingDirection: 'ltr',
    },
  });
}
