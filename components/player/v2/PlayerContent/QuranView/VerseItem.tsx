import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {
  StyleSheet,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {moderateScale, verticalScale} from '@/utils/scale';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {Verse} from '@/types/quran';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useTajweedStore} from '@/store/tajweedStore';
import {
  selectUnitAnnotations, // @ai
  useVerseAnnotationsStore,
} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {SheetManager} from 'react-native-actions-sheet';
import {mediumHaptics} from '@/utils/haptics';
import {tajweedColors} from '@/constants/tajweedColors';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import type {RewayahWordsStatus} from '@/hooks/useRewayahWords'; // @ai
import SkiaVerseText from './SkiaVerseText';
import {WBWVerseView} from './WBWVerseView';
// @ai-start
import {unitVerseActionsPayload, type VerseUnitRow} from './verseUnitRows';
import {
  UnitRowTranslations,
  UnitRowWordByWord,
  VerseRowReflections,
  type UnitRowWord,
} from './VerseUnitRowContent';
// @ai-end
import {
  isBundledTranslation,
  getBundledFootnotes,
} from '@/utils/translationLookup';

// Type for processed word data from store
interface ProcessedTajweedWord {
  word_index: number;
  location: string;
  segments: {
    text: string;
    rule: string | null;
  }[];
}

// Interface for footnote data
interface FootnoteData {
  id: string;
  number: string;
  content?: string;
}

// Type for the Saheeh International JSON structure
interface SaheehFootnoteEntry {
  t: string; // Translation text
  f?: {[key: string]: string}; // Optional footnotes object
}

interface SaheehData {
  [verseKey: string]: SaheehFootnoteEntry;
}

// Shown in place of the Arabic line when the rewayah's words fail to load. @ai
const TEXT_UNAVAILABLE_MESSAGE = "Verse text couldn't be loaded.";

// Load Saheeh data at module scope (require() is cached — zero cost since QuranView already loaded it)
const saheehDataForFootnotes =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as SaheehData;

interface VerseItemProps {
  verse: Verse & {translation?: string; transliteration?: string};
  onVersePress: (verseKey: string) => void;
  textColor: string;
  borderColor: string;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  showTajweed: boolean;
  arabicFontFamily: 'Uthmani';
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
  fontMgr: SkTypefaceFontProvider | null;
  dkFontFamily: string;
  /** Font of the word-by-word grid, which always shows Hafs words (defaults
   *  to dkFontFamily). @ai */
  wbwFontFamily?: string;
  indexedTajweedData: IndexedTajweedData | null;
  isActive?: boolean;
  translationName?: string;
  translationId?: string;
  source?: 'player' | 'mushaf';
  showWBW?: boolean;
  wbwShowTranslation?: boolean;
  wbwShowTransliteration?: boolean;
  /** Rewayah the Arabic text is rendered in. Player context: passes the
   *  currently-playing track's rewayah. Mushaf context: can be omitted to
   *  follow the active mushaf rewayah automatically. */
  rewayah?: import('@/store/mushafSettingsStore').RewayahId;
  // @ai-start
  /**
   * Decision 3: the row is this rewayah verse (or the unnumbered Fatiha
   * basmala) from buildVerseUnitRows; pass the same object as `verse`. Its
   * label, text, selection, bookmark / note dots and verse-actions payload
   * follow the rewayah's own verse, and its translation, notes and word by
   * word come per Hafs verse it holds. The basmala row has no number and no
   * actions. Omitted: a Hafs verse row, exactly as before.
   */
  unitRow?: VerseUnitRow;
  // @ai-end
}

/**
 * Pre-render optimized tajweed segment
 * This component is memoized to prevent re-renders when parent re-renders
 */
const TajweedSegment = memo(({text, color}: {text: string; color: string}) => (
  <Text style={{color}}>{text}</Text>
));
TajweedSegment.displayName = 'TajweedSegment';

export const VerseItem = memo<VerseItemProps>(
  ({
    verse,
    onVersePress,
    textColor,
    borderColor,
    showTranslation,
    showTransliteration,
    showTajweed,
    arabicFontFamily,
    transliterationFontSize,
    translationFontSize,
    arabicFontSize,
    fontMgr,
    dkFontFamily,
    wbwFontFamily, // @ai
    indexedTajweedData,
    isActive,
    translationName,
    translationId,
    source,
    showWBW,
    wbwShowTranslation,
    wbwShowTransliteration,
    rewayah,
    unitRow, // @ai
  }) => {
    const {theme} = useTheme();
    const verseKey = verse.verse_key;
    const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
    const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
    // @ai-start
    // The QPC fallback below can only show Hafs text. In a non-Hafs context
    // (a rewayah track in the player, a rewayah mushaf's verse list) it is
    // never shown, not even for the first frame before the row is measured:
    // a neutral placeholder holds the place until DigitalKhatt draws the
    // rewayah's own text.
    const isHafsText =
      (unitRow?.rewayah ?? rewayah ?? mushafRewayah) === 'hafs';
    // A verse row of a rewayah: keys and numbers are that rewayah's
    // (verseKey is its unit key); null `unit` is the unnumbered basmala.
    const textRewayah = unitRow?.rewayah ?? rewayah;
    const isUnnumbered = unitRow !== undefined && unitRow.unit === null;
    // @ai-end
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

    // Per-verse-key annotation selectors — Zustand skips re-render when
    // THIS verse's specific value didn't change
    // @ai-start
    // A selected key means something only in its numbering: a Hafs verse row
    // matches a Hafs selection, a rewayah verse row one of its own rewayah.
    const selectionRewayah = unitRow ? unitRow.rewayah : 'hafs';
    const isSelected = useVerseSelectionStore(
      useCallback(
        s =>
          s.selectedVerseKey === verseKey &&
          (s.selectedRewayah ?? 'hafs') === selectionRewayah,
        [verseKey, selectionRewayah],
      ),
    );
    // @ai-end
    const selectVerse = useVerseSelectionStore(s => s.selectVerse);

    // @ai — a rewayah verse row is marked by every stored row that maps to
    // its verse in its rewayah (contract section 3: rows keep the rewayah
    // they were saved in, so a Hafs row of a split Hafs verse marks both
    // parts). selectUnitAnnotations is memoized per units and rows.
    const isBookmarked = useVerseAnnotationsStore(
      useCallback(
        s =>
          unitRow
            ? unitRow.unit !== null &&
              selectUnitAnnotations(s, unitRow.units).bookmarkedUnitKeys.has(
                unitRow.unit.key,
              )
            : s.bookmarkedVerseKeys.has(verseKey),
        [verseKey, unitRow],
      ),
    );
    const hasNote = useVerseAnnotationsStore(
      useCallback(
        s =>
          unitRow
            ? unitRow.unit !== null &&
              selectUnitAnnotations(s, unitRow.units).notedUnitKeys.has(
                unitRow.unit.key,
              )
            : s.notedVerseKeys.has(verseKey),
        [verseKey, unitRow],
      ),
    );
    // Fetch tajweed data directly from store — granular selector means only
    // the ~10 visible VerseItems re-render when tajweed finishes loading
    const processedTajweedAyahData = useTajweedStore(
      s => s.indexedTajweedData?.[verseKey],
    );

    const isQPCSelected = true;

    const [activeFootnote, setActiveFootnote] = useState<FootnoteData | null>(
      null,
    );

    // Width for Skia canvas (measured via onLayout)
    const [arabicContainerWidth, setArabicContainerWidth] = useState(0);
    const handleArabicLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setArabicContainerWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
    }, []);

    // Track which WBW word is highlighted (cleared when sheet closes)
    const [selectedWordPosition, setSelectedWordPosition] = useState<
      number | null
    >(null);
    // @ai — the same for a verse row's grids (one per Hafs verse it holds)
    const [selectedUnitWord, setSelectedUnitWord] =
      useState<UnitRowWord | null>(null);

    // Reset footnote and word highlight when cell is recycled by FlashList
    useEffect(() => {
      setActiveFootnote(null);
      setSelectedWordPosition(null);
      setSelectedUnitWord(null); // @ai
    }, [verseKey]);

    // Batch all Color() derivations — only recomputed on theme or highlight change
    const derivedColors = useMemo(
      () => ({
        bg: Color(textColor).alpha(0.08).toString(),
        footnoteBg: Color(textColor).alpha(0.1).toString(),
        selectedBg: Color(textColor).alpha(0.06).toString(),
        optionsIcon: Color(textColor).alpha(0.5).toString(),
        translationSource: Color(textColor).alpha(0.6).toString(),
        activeBg: Color(textColor).alpha(0.12).toString(),
      }),
      [textColor],
    );

    // Handle footnote press - uses module-scope cached data or translationLookup
    // @ai — `footnoteVerseKey`: the Hafs verse whose translation holds the
    // footnote (a verse row passes each of its Hafs verses' own).
    const toggleFootnote = useCallback(
      (
        footnoteVerseKey: string,
        footnoteId: string,
        footnoteNumber: string,
      ) => {
        // If tapping the same footnote again, close it
        if (activeFootnote && activeFootnote.id === footnoteId) {
          setActiveFootnote(null);
          return;
        }

        // For bundled translations, use translationLookup; for remote, no footnotes
        const effectiveId = translationId ?? 'saheeh';
        const footnotes = isBundledTranslation(effectiveId)
          ? getBundledFootnotes(footnoteVerseKey, effectiveId) // @ai
          : undefined;

        if (footnotes) {
          const footnoteContent = footnotes[footnoteId];
          setActiveFootnote({
            id: footnoteId,
            number: footnoteNumber,
            content: footnoteContent ?? 'Footnote content not available',
          });
        } else {
          setActiveFootnote({
            id: footnoteId,
            number: footnoteNumber,
            content: 'Footnote data not available',
          });
        }
      },
      [activeFootnote, translationId], // @ai
    );
    // A Hafs verse row: the footnotes of its own verse. @ai
    const handleFootnotePress = useCallback(
      (footnoteId: string, footnoteNumber: string) =>
        toggleFootnote(verseKey, footnoteId, footnoteNumber),
      [toggleFootnote, verseKey],
    );

    // Close the footnote display
    const closeFootnote = useCallback(() => {
      setActiveFootnote(null);
    }, []);

    // @ai-start
    // A verse row of a rewayah acts on the rewayah's own verse: it selects
    // the unit (in its rewayah's numbering) and opens the verse actions with
    // the unit (contract 4.1). The unnumbered Fatiha basmala is no verse
    // there: nothing to select, no actions.
    const openUnitActions = useCallback(
      (withHaptics: boolean) => {
        if (!unitRow?.unit) return;
        const payload = unitVerseActionsPayload(unitRow, source ?? 'player');
        if (!payload) return;
        if (withHaptics) mediumHaptics();
        selectVerse(
          unitRow.unit.key,
          unitRow.unit.surah,
          unitRow.unit.ayah,
          unitRow.rewayah,
        );
        SheetManager.show('verse-actions', {payload});
      },
      [unitRow, source, selectVerse],
    );
    // @ai-end

    // Long press → open verse actions sheet
    const handleLongPress = useCallback(() => {
      // @ai-start
      if (unitRow) {
        openUnitActions(true);
        return;
      }
      // @ai-end
      mediumHaptics();
      selectVerse(verseKey, verse.surah_number, verse.ayah_number);
      SheetManager.show('verse-actions', {
        payload: {
          verseKey,
          surahNumber: verse.surah_number,
          ayahNumber: verse.ayah_number,
          // arabicText omitted — the sheet reads from DK so it always
          // matches the current rewayah instead of the static Hafs
          // text on this VerseItem prop.
          translation: verse.translation || '',
          transliteration: verse.transliteration || '',
          source: source ?? 'player',
          rewayah,
        },
      });
    }, [
      verseKey,
      verse,
      selectVerse,
      source,
      rewayah,
      unitRow,
      openUnitActions,
    ]); // @ai

    // Options button → same as long press
    const handleOptionsPress = useCallback(() => {
      // @ai-start
      if (unitRow) {
        openUnitActions(false);
        return;
      }
      // @ai-end
      selectVerse(verseKey, verse.surah_number, verse.ayah_number);
      SheetManager.show('verse-actions', {
        payload: {
          verseKey,
          surahNumber: verse.surah_number,
          ayahNumber: verse.ayah_number,
          // arabicText omitted — the sheet reads from DK so it always
          // matches the current rewayah instead of the static Hafs
          // text on this VerseItem prop.
          translation: verse.translation || '',
          transliteration: verse.transliteration || '',
          source: source ?? 'player',
          rewayah,
        },
      });
    }, [
      verseKey,
      verse,
      selectVerse,
      source,
      rewayah,
      unitRow,
      openUnitActions,
    ]); // @ai

    const handleWordPress = useCallback(
      (position: number) => {
        setSelectedWordPosition(position);
        SheetManager.show('word-detail', {
          payload: {verseKey, position},
        }).then(() => {
          setSelectedWordPosition(null);
        });
      },
      [verseKey],
    );

    // @ai-start
    // A verse row's word-by-word word: word detail of its HAFS verse (word
    // by word is Hafs data, keyed by Hafs verse and word position).
    const handleUnitWordPress = useCallback((word: UnitRowWord) => {
      setSelectedUnitWord(word);
      SheetManager.show('word-detail', {
        payload: {verseKey: word.hafsKey, position: word.position},
      }).then(() => {
        setSelectedUnitWord(null);
      });
    }, []);
    // @ai-end

    const handlePress = useCallback(() => {
      onVersePress(verseKey);
    }, [onVersePress, verseKey]);

    // --- Build Tajweed Nodes (Only if QPC and data available) ---
    const tajweedNodes = useMemo(() => {
      if (!isQPCSelected || !processedTajweedAyahData) return null;
      return (processedTajweedAyahData as ProcessedTajweedWord[]).flatMap(
        (wordData, wordIndex) => {
          const segments = wordData.segments.map((segment, segIndex) => {
            // Apply color based on showTajweed state from store
            const color =
              showTajweed && segment.rule
                ? tajweedColors[segment.rule] || textColor // Tajweed color or default
                : textColor; // Default color if tajweed off or no rule
            return (
              <TajweedSegment
                key={`${wordData.location}-${wordIndex}-${segIndex}`}
                text={segment.text}
                color={color}
              />
            );
          });
          // Add space between words
          if (
            wordIndex <
            (processedTajweedAyahData as ProcessedTajweedWord[]).length - 1
          ) {
            segments.push(<Text key={`${wordData.location}-space`}> </Text>);
          }
          return segments;
        },
      );
    }, [isQPCSelected, processedTajweedAyahData, showTajweed, textColor]);
    // --- End Building Nodes ---

    // Memoize container style — avoids Pressable function-form re-evaluation every frame
    const containerStyle = useMemo(
      () => [
        styles.container,
        {borderBottomColor: borderColor},
        isActive && {
          backgroundColor: derivedColors.activeBg,
          borderRadius: moderateScale(8),
        },
        isSelected && {
          backgroundColor: derivedColors.selectedBg,
          borderRadius: moderateScale(8),
        },
      ],
      [
        borderColor,
        isActive,
        derivedColors.activeBg,
        isSelected,
        derivedColors.selectedBg,
      ],
    );

    // Memoize inline text styles — only change on theme/settings switch, never during scroll
    const arabicStyle = useMemo(
      () => [
        styles.arabicText,
        {
          color: textColor,
          fontSize: moderateScale(arabicFontSize),
          fontFamily: arabicFontFamily,
        },
      ],
      [textColor, arabicFontSize, arabicFontFamily],
    );

    const arabicStyleNoColor = useMemo(
      () => [
        styles.arabicText,
        {
          fontSize: moderateScale(arabicFontSize),
          fontFamily: arabicFontFamily,
        },
      ],
      [arabicFontSize, arabicFontFamily],
    );

    const transliterationStyle = useMemo(
      () => [
        styles.transliterationText,
        {color: textColor, fontSize: moderateScale(transliterationFontSize)},
      ],
      [textColor, transliterationFontSize],
    );

    const translationStyle = useMemo(
      () => [
        styles.translationText,
        {color: textColor, fontSize: moderateScale(translationFontSize)},
      ],
      [textColor, translationFontSize],
    );

    const translationSourceStyle = useMemo(
      () => [
        styles.translationSource,
        {color: derivedColors.translationSource},
      ],
      [derivedColors.translationSource],
    );

    // @ai — notes under a verse row's Hafs content (a translation the
    // rewayah divides between verses, the transliteration's Hafs disclosure)
    const unitNoteStyle = useMemo(
      () => [styles.unitNote, {color: derivedColors.translationSource}],
      [derivedColors.translationSource],
    );

    // @ai-start
    // Neutral stand-in for the Arabic line while the rewayah's own text
    // cannot be drawn yet (fonts loading, row not measured, words loading):
    // about one line high, no text. If the words fail to load, say so rather
    // than show nothing (or another rewayah's text).
    const placeholderStyle = useMemo(
      () => ({height: Math.round(moderateScale(arabicFontSize) * 1.9)}),
      [arabicFontSize],
    );
    const renderTextPlaceholder = useCallback(
      (status: RewayahWordsStatus) =>
        status === 'error' || status === 'unavailable' ? (
          <Text
            style={[
              styles.textUnavailable,
              {color: derivedColors.translationSource},
            ]}>
            {TEXT_UNAVAILABLE_MESSAGE}
          </Text>
        ) : (
          <View
            style={placeholderStyle}
            accessibilityLabel="Loading verse text"
            testID="verse-text-placeholder"
          />
        ),
      [placeholderStyle, derivedColors.translationSource],
    );
    // @ai-end

    return (
      <Pressable
        style={containerStyle}
        onPress={handlePress}
        onLongPress={handleLongPress}>
        {/* @ai — the unnumbered basmala row: no number, no actions */}
        {isUnnumbered ? null : (
          <View style={styles.verseInfoContainer}>
            <View style={styles.verseInfoRow}>
              <View
                style={[
                  styles.verseInfoPill,
                  {backgroundColor: derivedColors.bg},
                ]}>
                {/* @ai — a verse row's surah_number / ayah_number are its
                 *  rewayah's own numbers: the pill reads '1:6' of Warsh. */}
                <Text style={[styles.verseInfo, {color: textColor}]}>
                  {verse.surah_number}:{verse.ayah_number}
                </Text>
              </View>
              {isBookmarked && (
                <Feather
                  name="bookmark"
                  size={moderateScale(12)}
                  color={textColor}
                  style={styles.annotationIcon}
                />
              )}
              {hasNote && (
                <Feather
                  name="file-text"
                  size={moderateScale(12)}
                  color={textColor}
                  style={styles.annotationIcon}
                />
              )}
              <Pressable
                onPress={handleOptionsPress}
                hitSlop={8}
                style={styles.optionsButton}>
                <Feather
                  name="more-horizontal"
                  size={moderateScale(18)}
                  color={derivedColors.optionsIcon}
                />
              </Pressable>
            </View>
          </View>
        )}
        {/* ---> Arabic Text Rendering <-- */}
        {showWBW && unitRow ? (
          // @ai — a verse row: one Hafs grid per Hafs verse it holds, each
          // cut to the row's own words
          <UnitRowWordByWord
            row={unitRow}
            textColor={textColor}
            arabicFontSize={arabicFontSize}
            dkFontFamily={wbwFontFamily ?? dkFontFamily}
            fontMgr={fontMgr}
            showTranslation={wbwShowTranslation ?? true}
            showTransliteration={wbwShowTransliteration ?? false}
            selectedWord={selectedUnitWord}
            onWordPress={handleUnitWordPress}
            showTajweed={showTajweed}
            indexedTajweedData={indexedTajweedData}
            onTap={handlePress}
            onLongPress={handleLongPress}
            arabicTextWeight={arabicTextWeight}
            showAllahNameHighlight={showAllahNameHighlight}
            allahNameHighlightColor={allahNameHighlightColor}
          />
        ) : showWBW ? (
          <WBWVerseView
            verseKey={verseKey}
            textColor={textColor}
            arabicFontSize={arabicFontSize}
            dkFontFamily={wbwFontFamily ?? dkFontFamily} // @ai
            fontMgr={fontMgr}
            showTranslation={wbwShowTranslation ?? true}
            showTransliteration={wbwShowTransliteration ?? false}
            onWordPress={handleWordPress}
            selectedWordPosition={selectedWordPosition}
            showTajweed={showTajweed}
            indexedTajweedData={indexedTajweedData}
            onTap={handlePress}
            onLongPress={handleLongPress}
            arabicTextWeight={arabicTextWeight}
            showAllahNameHighlight={showAllahNameHighlight}
            allahNameHighlightColor={allahNameHighlightColor}
            rewayah={rewayah}
          />
        ) : (
          <View onLayout={handleArabicLayout}>
            {fontMgr && arabicContainerWidth > 0 ? (
              // DK Skia Rendering (Uthmani with Digital Khatt font)
              <SkiaVerseText
                // @ai — a verse row draws exactly its own slots (`words`);
                // its key only names a Hafs verse when the row is Hafs.
                verseKey={unitRow ? unitRow.unit?.key : verseKey}
                fontMgr={fontMgr}
                fontFamily={dkFontFamily}
                fontSize={moderateScale(arabicFontSize)}
                textColor={textColor}
                showTajweed={showTajweed}
                width={arabicContainerWidth}
                indexedTajweedData={indexedTajweedData}
                arabicTextWeight={arabicTextWeight}
                showAllahNameHighlight={showAllahNameHighlight}
                allahNameHighlightColor={allahNameHighlightColor}
                rewayah={textRewayah} // @ai
                words={unitRow?.words} // @ai
                renderPlaceholder={
                  isHafsText ? undefined : renderTextPlaceholder // @ai
                }
              />
            ) : !isHafsText ? (
              // @ai — never Hafs text in a non-Hafs context
              renderTextPlaceholder('loading')
            ) : isQPCSelected && tajweedNodes ? (
              // QPC Rendering: Always use generated tajweedNodes
              <Text style={arabicStyleNoColor}>{tajweedNodes}</Text>
            ) : (
              // Fallback (e.g., data is loading/missing)
              <Text style={arabicStyle}>{verse.text || 'Loading...'}</Text>
            )}
          </View>
        )}
        {/* ---> End Conditional Rendering <--- */}
        {/* RFC-018 — inline community-reflections slot, directly under the
         *  Arabic line. Default-noop for Bayaan (no
         *  branding.ayahCommunityReflectionsComponent wired → returns null).
         *  Mounted unconditionally here, which means it appears in ALL THREE
         *  VerseItem callers (player QuranView, ContinuousListView,
         *  ReadingPageView) — intentional: a fork's reflections surface in
         *  every verse-list context. The noop + the toggle/provider gates
         *  inside the component keep it free for forks that don't opt in. */}
        <VerseRowReflections // @ai — a verse row: per Hafs verse it owns
          unitRow={unitRow} // @ai
          surahNumber={verse.surah_number}
          ayahNumber={verse.ayah_number}
        />
        {/* @ai — the transliteration spells the Hafs reading: never under a
         *  rewayah's text, where it would read as that rewayah's. */}
        {showTransliteration && isHafsText && verse.transliteration && (
          <FormattedTextRenderer
            text={verse.transliteration}
            baseStyle={transliterationStyle}
          />
        )}
        {showTranslation && verse.translation && (
          <View>
            <FormattedTextRenderer
              text={verse.translation}
              baseStyle={translationStyle}
              onFootnotePress={handleFootnotePress}
            />

            {/* Display Translation Source */}
            {verse.translation && (
              <Text style={translationSourceStyle}>
                {translationName ?? 'Saheeh International'}
              </Text>
            )}
          </View>
        )}
        {unitRow ? (
          // @ai — a verse row carries no transliteration / translation of
          // its own ('', so the two blocks above render nothing): the
          // translation of each Hafs verse it owns and the shared-translation
          // notes come here (verseUnitRows.ts, contract 4.6).
          <UnitRowTranslations
            row={unitRow}
            showTranslation={!!showTranslation}
            showTransliteration={!!showTransliteration}
            translationStyle={translationStyle}
            transliterationStyle={transliterationStyle}
            translationSourceStyle={translationSourceStyle}
            noteStyle={unitNoteStyle}
            translationName={translationName}
            onFootnotePress={toggleFootnote}
          />
        ) : null}

        {/* Footnote Display */}
        {activeFootnote && (
          <View
            style={[
              styles.footnoteContainer,
              {backgroundColor: derivedColors.footnoteBg},
            ]}>
            <View style={styles.footnoteHeader}>
              <Text style={[styles.footnoteTitle, {color: textColor}]}>
                Footnote
              </Text>
              <Pressable
                onPress={closeFootnote}
                style={({pressed}) => [
                  styles.closeButton,
                  {opacity: pressed ? 0.7 : 1},
                ]}>
                <Ionicons name="close" size={20} color={textColor} />
              </Pressable>
            </View>
            <Text style={[styles.footnoteContent, {color: textColor}]}>
              {activeFootnote.content}
            </Text>
          </View>
        )}
      </Pressable>
    );
  },
);

VerseItem.displayName = 'VerseItem';

const styles = StyleSheet.create({
  container: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(8),
  },
  optionsButton: {
    marginLeft: 'auto',
    padding: moderateScale(4),
  },
  verseInfoContainer: {
    marginBottom: verticalScale(6),
  },
  verseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  verseInfoPill: {
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(6),
  },
  annotationIcon: {
    opacity: 0.7,
  },
  verseInfo: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
  },
  arabicText: {
    fontSize: moderateScale(24),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  // @ai-start
  textUnavailable: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(12),
    marginVertical: verticalScale(6),
  },
  unitNote: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(4),
    textAlign: 'left',
  },
  // @ai-end
  transliterationText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(8),
    textAlign: 'left',
  },
  translationText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(8),
    textAlign: 'left',
  },
  translationSource: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(2),
    marginBottom: verticalScale(4),
    textAlign: 'left',
    fontStyle: 'italic',
  },
  footnoteContainer: {
    marginTop: verticalScale(8),
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
  },
  footnoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  footnoteTitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
  },
  closeButton: {
    padding: moderateScale(4),
  },
  footnoteContent: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(20),
  },
});
