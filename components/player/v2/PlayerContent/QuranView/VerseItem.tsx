import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Pressable, Text, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';
import Color from 'color';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useTajweedStore} from '@/store/tajweedStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import {SheetManager} from 'react-native-actions-sheet';
import {mediumHaptics} from '@/utils/haptics';
import {tajweedColors} from '@/constants/tajweedColors';

// ---> Lazy-load Indopak JSON data (1.7MB — only loaded when Indopak font is selected)
interface IndopakNastaleeqData {
  [verseKey: string]: {text: string};
}
let indopakNastaleeqDataCache: IndopakNastaleeqData | null = null;
function getIndopakData(): IndopakNastaleeqData | null {
  if (!indopakNastaleeqDataCache) {
    try {
      indopakNastaleeqDataCache = require('@/data/IndopakNastaleeq.json');
    } catch (error) {
      console.error('[VerseItem] Error loading Indopak data:', error);
    }
  }
  return indopakNastaleeqDataCache;
}
// <--- End Indopak lazy loader

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
  arabicFontFamily: 'QPC' | 'Indopak';
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
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
  }) => {
    const verseKey = verse.verse_key;

    // Per-verse-key annotation selectors — Zustand skips re-render when
    // THIS verse's specific value didn't change
    const isSelected = useVerseSelectionStore(
      useCallback(s => s.selectedVerseKey === verseKey, [verseKey]),
    );
    const selectVerse = useVerseSelectionStore(s => s.selectVerse);

    const isBookmarked = useVerseAnnotationsStore(
      useCallback(s => s.bookmarkedVerseKeys.has(verseKey), [verseKey]),
    );
    const hasNote = useVerseAnnotationsStore(
      useCallback(s => s.notedVerseKeys.has(verseKey), [verseKey]),
    );
    const highlightColorKey = useVerseAnnotationsStore(
      useCallback(s => s.highlights[verseKey] ?? null, [verseKey]),
    );
    const highlightColor = highlightColorKey
      ? HIGHLIGHT_COLORS[highlightColorKey]
      : null;

    // Fetch tajweed data directly from store — granular selector means only
    // the ~10 visible VerseItems re-render when tajweed finishes loading
    const processedTajweedAyahData = useTajweedStore(
      s => s.indexedTajweedData?.[verseKey],
    );

    // Determine font selection
    const isIndopakSelected = arabicFontFamily === 'Indopak';
    const isQPCSelected = arabicFontFamily === 'Uthmani';

    const [activeFootnote, setActiveFootnote] = useState<FootnoteData | null>(
      null,
    );

    // Reset footnote when cell is recycled by FlashList
    useEffect(() => {
      setActiveFootnote(null);
    }, [verseKey]);

    // Batch all Color() derivations — only recomputed on theme or highlight change
    const derivedColors = useMemo(
      () => ({
        bg: Color(textColor).alpha(0.08).toString(),
        footnoteBg: Color(textColor).alpha(0.1).toString(),
        selectedBg: Color(textColor).alpha(0.06).toString(),
        optionsIcon: Color(textColor).alpha(0.5).toString(),
        translationSource: Color(textColor).alpha(0.6).toString(),
        highlightBg: highlightColor
          ? Color(highlightColor).alpha(0.3).toString()
          : undefined,
      }),
      [textColor, highlightColor],
    );

    // Handle footnote press - uses module-scope cached data
    const handleFootnotePress = useCallback(
      (footnoteId: string, footnoteNumber: string) => {
        // If tapping the same footnote again, close it
        if (activeFootnote && activeFootnote.id === footnoteId) {
          setActiveFootnote(null);
          return;
        }

        const verseData = saheehDataForFootnotes[verseKey];

        if (verseData?.f) {
          const footnoteContent = verseData.f[footnoteId];

          if (footnoteContent) {
            setActiveFootnote({
              id: footnoteId,
              number: footnoteNumber,
              content: footnoteContent,
            });
          } else {
            setActiveFootnote({
              id: footnoteId,
              number: footnoteNumber,
              content: 'Footnote content not available',
            });
          }
        } else {
          setActiveFootnote({
            id: footnoteId,
            number: footnoteNumber,
            content: 'Footnote data structure issue',
          });
        }
      },
      [verseKey, activeFootnote],
    );

    // Close the footnote display
    const closeFootnote = useCallback(() => {
      setActiveFootnote(null);
    }, []);

    // Long press → open verse actions sheet
    const handleLongPress = useCallback(() => {
      mediumHaptics();
      selectVerse(verseKey, verse.surah_number, verse.ayah_number);
      SheetManager.show('verse-actions', {
        payload: {
          verseKey,
          surahNumber: verse.surah_number,
          ayahNumber: verse.ayah_number,
          arabicText: verse.text,
          translation: verse.translation || '',
          transliteration: verse.transliteration || '',
        },
      });
    }, [verseKey, verse, selectVerse]);

    // Options button → same as long press
    const handleOptionsPress = useCallback(() => {
      selectVerse(verseKey, verse.surah_number, verse.ayah_number);
      SheetManager.show('verse-actions', {
        payload: {
          verseKey,
          surahNumber: verse.surah_number,
          ayahNumber: verse.ayah_number,
          arabicText: verse.text,
          translation: verse.translation || '',
          transliteration: verse.transliteration || '',
        },
      });
    }, [verseKey, verse, selectVerse]);

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

    // ---> Get Indopak text if applicable (lazy-loaded)
    const indopakText = isIndopakSelected
      ? getIndopakData()?.[verseKey]?.text
      : null;
    // <--- End Get Indopak text

    // Memoize container style — avoids Pressable function-form re-evaluation every frame
    const containerStyle = useMemo(
      () => [
        styles.container,
        {borderBottomColor: borderColor},
        isSelected && {
          backgroundColor: derivedColors.selectedBg,
          borderRadius: moderateScale(8),
        },
        derivedColors.highlightBg && {
          backgroundColor: derivedColors.highlightBg,
          borderRadius: moderateScale(8),
        },
      ],
      [
        borderColor,
        isSelected,
        derivedColors.selectedBg,
        derivedColors.highlightBg,
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

    return (
      <Pressable
        style={containerStyle}
        onPress={handlePress}
        onLongPress={handleLongPress}>
        <View style={styles.verseInfoContainer}>
          <View style={styles.verseInfoRow}>
            <View
              style={[
                styles.verseInfoPill,
                {backgroundColor: derivedColors.bg},
              ]}>
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
        {/* ---> Simplified Arabic Text Rendering <-- */}
        <View>
          {isIndopakSelected ? (
            // Indopak Rendering
            <Text style={arabicStyle}>
              {indopakText || 'Loading Indopak...'}
            </Text>
          ) : isQPCSelected && tajweedNodes ? (
            // QPC Rendering: Always use generated tajweedNodes
            <Text style={arabicStyleNoColor}>{tajweedNodes}</Text>
          ) : (
            // Fallback (e.g., QPC selected but data is loading/missing)
            <Text style={arabicStyle}>{verse.text || 'Loading...'}</Text>
          )}
        </View>
        {/* ---> End Conditional Rendering <--- */}
        {showTransliteration && verse.transliteration && (
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
              <Text style={translationSourceStyle}>Saheeh International</Text>
            )}
          </View>
        )}

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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
