import React, {memo, useCallback, useState, useEffect, useRef} from 'react';
import {StyleSheet, TouchableOpacity, Text, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';
import Color from 'color';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {Ionicons} from '@expo/vector-icons';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

// ---> Load Indopak JSON data
interface IndopakNastaleeqData {
  [verseKey: string]: {text: string};
}
let indopakNastaleeqDataCache: IndopakNastaleeqData | null = null;
try {
  indopakNastaleeqDataCache = require('@/data/IndopakNastaleeq.json');
  console.log('[VerseItem] IndopakNastaleeq data pre-cached');
} catch (error) {
  console.error('[VerseItem] Error pre-caching Indopak data:', error);
}
// <--- End Load Indopak JSON data

// Define colors for Tajweed rules (adjust these as needed)
const tajweedColors: {[key: string]: string} = {
  // Red - Necessary Prolongation (Madd: 6)
  madda_necessary: '#DD0000',
  // Pink - Obligatory Prolongation (Madd: 4 or 5)
  madda_obligatory_mottasel: '#FF00FF',
  madda_obligatory_monfasel: '#FF00FF',
  // Orange - Permissible Prolongation (Madd: 2, 4, or 6)
  madda_permissible: '#FF7F00',
  // Gold/Yellow - Normal Prolongation (Madd: 2)
  madda_normal: '#DDAA00',
  'custom-alef-maksora': '#DDAA00',
  // Green - Nasalization (Ghunnah)
  ghunnah: '#00CC00',
  idgham_ghunnah: '#00CC00',
  idgham_shafawi: '#00CC00',
  ikhafa: '#00CC00',
  ikhafa_shafawi: '#00CC00',
  iqlab: '#00CC00',
  // Light Blue - Qalqala (Echoing Sound)
  qalaqah: '#66CCFF',
  // Dark Blue - Tafkhim (Emphatic Pronunciation)
  idgham_mutajanisayn: '#0066FF',
  idgham_mutaqaribayn: '#0066FF',
  idgham_wo_ghunnah: '#0066FF',
  // Gray - Silent (Unannounced Pronunciation)
  slnt: '#AAAAAA',
  ham_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
};

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

interface VerseItemProps {
  verse: Verse & {processedTajweedAyahData?: ProcessedTajweedWord[]}; // Combine Verse and optional processed data
  onPress: () => void;
  textColor: string;
  borderColor: string;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
  // Remove legacy tajweedAyahData prop if it exists
  processedTajweedAyahData?: ProcessedTajweedWord[]; // Keep this prop as it's now passed from QuranView
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
    verse, // Contains processedTajweedAyahData if available
    onPress,
    textColor,
    borderColor,
    showTranslation: propShowTranslation,
    showTransliteration: propShowTransliteration,
    transliterationFontSize: propTransliterationFontSize,
    translationFontSize: propTranslationFontSize,
    arabicFontSize: propArabicFontSize,
    // processedTajweedAyahData prop is now part of the verse object
  }) => {
    // Get settings from the store
    const {
      showTranslation: storeShowTranslation,
      showTransliteration: storeShowTransliteration,
      showTajweed, // Used for conditional coloring
      arabicFontSize: storeArabicFontSize,
      translationFontSize: storeTranslationFontSize,
      transliterationFontSize: storeTransliterationFontSize,
      arabicFontFamily,
    } = useMushafSettingsStore();

    // Use prop values if provided, otherwise use store values
    const showTranslation =
      propShowTranslation !== undefined
        ? propShowTranslation
        : storeShowTranslation;
    const showTransliteration =
      propShowTransliteration !== undefined
        ? propShowTransliteration
        : storeShowTransliteration;

    const transliterationFontSize =
      propTransliterationFontSize || storeTransliterationFontSize;

    const translationFontSize =
      propTranslationFontSize || storeTranslationFontSize;
    const arabicFontSize = propArabicFontSize || storeArabicFontSize;

    // Determine font selection
    const isIndopakSelected = arabicFontFamily === 'Indopak';
    const isQPCSelected = arabicFontFamily === 'QPC';

    const [activeFootnote, setActiveFootnote] = useState<FootnoteData | null>(
      null,
    );
    // Cache for the Saheeh International data
    const saheehDataCache = useRef<SaheehData | null>(null);
    const [isSaheehDataLoaded, setIsSaheehDataLoaded] = useState(false);

    // Load Saheeh International data once
    useEffect(() => {
      if (!saheehDataCache.current) {
        try {
          saheehDataCache.current = require('@/data/SaheehInternational.translation-with-footnote-tags.json');
          setIsSaheehDataLoaded(true);
          console.log('[VerseItem] Saheeh International data loaded.');
        } catch (error) {
          console.error(
            '[VerseItem] Failed to load Saheeh International data:',
            error,
          );
        }
      }
    }, []);

    const bgColor = Color(textColor).alpha(0.08).toString();
    const footnoteBgColor = Color(textColor).alpha(0.1).toString();

    // Handle footnote press - now uses cached data
    const handleFootnotePress = useCallback(
      (footnoteId: string, footnoteNumber: string) => {
        // If tapping the same footnote again, close it
        if (activeFootnote && activeFootnote.id === footnoteId) {
          setActiveFootnote(null);
          return;
        }
        console.log(
          `[Footnote Press] Verse Key: ${verse.verse_key}, Footnote ID: ${footnoteId}, Number: ${footnoteNumber}`,
        );

        if (!isSaheehDataLoaded || !saheehDataCache.current) {
          console.error(
            '[VerseItem] Saheeh data not loaded yet when trying to access footnote.',
          );
          setActiveFootnote({
            id: footnoteId,
            number: footnoteNumber,
            content: 'Error: Footnote data not ready',
          });
          return;
        }

        const verseData = saheehDataCache.current[verse.verse_key];
        console.log(
          '[Footnote Press] Found verseData:',
          verseData ? 'Yes' : 'No',
        );

        // --- Start: Additional Logging ---
        if (verseData) {
          console.log('[Footnote Press] Inspecting verseData:', verseData);
          console.log('[Footnote Press] Inspecting verseData.f:', verseData.f);
          console.log(
            `[Footnote Press] Keys in verseData.f: ${verseData.f ? Object.keys(verseData.f).join(', ') : 'N/A'}`,
          );
        }
        // --- End: Additional Logging ---
        if (verseData && verseData.f) {
          const footnoteContent = verseData.f[footnoteId];
          console.log(
            `[Footnote Press] Found footnoteContent for ID ${footnoteId}:`,
            footnoteContent ? 'Yes' : 'No',
          );

          if (footnoteContent) {
            setActiveFootnote({
              id: footnoteId,
              number: footnoteNumber,
              content: footnoteContent,
            });
          } else {
            console.warn(
              `Footnote content for ID ${footnoteId} in verse ${verse.verse_key} not found in footnotes object.`,
            );
            setActiveFootnote({
              id: footnoteId,
              number: footnoteNumber,
              content: 'Footnote content not available',
            });
          }
        } else {
          console.warn(
            `Footnotes object (f) not found for verse ${verse.verse_key}.`,
          );
          setActiveFootnote({
            id: footnoteId,
            number: footnoteNumber,
            content: 'Footnote data structure issue',
          });
        }
      },
      [verse.verse_key, isSaheehDataLoaded, activeFootnote],
    );

    // Close the footnote display
    const closeFootnote = useCallback(() => {
      setActiveFootnote(null);
    }, []);

    // Access processed data from the verse object
    const processedTajweedAyahData = verse.processedTajweedAyahData;

    // --- Build Tajweed Nodes (Only if QPC and data available) ---
    const tajweedNodes =
      isQPCSelected && processedTajweedAyahData
        ? processedTajweedAyahData.flatMap((wordData, wordIndex) => {
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
            if (wordIndex < processedTajweedAyahData.length - 1) {
              segments.push(<Text key={`${wordData.location}-space`}> </Text>);
            }
            return segments;
          })
        : null;
    // --- End Building Nodes ---

    // ---> Get Indopak text if applicable
    const indopakText =
      isIndopakSelected && indopakNastaleeqDataCache
        ? indopakNastaleeqDataCache[verse.verse_key]?.text
        : null;
    // <--- End Get Indopak text

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.container, {borderBottomColor: borderColor}]}
        onPress={onPress}>
        <View style={styles.verseInfoContainer}>
          <View style={[styles.verseInfoPill, {backgroundColor: bgColor}]}>
            <Text style={[styles.verseInfo, {color: textColor}]}>
              {verse.surah_number}:{verse.ayah_number}
            </Text>
          </View>
        </View>
        {/* ---> Simplified Arabic Text Rendering <-- */}
        {isIndopakSelected ? (
          // Indopak Rendering
          <Text
            style={[
              styles.arabicText,
              {
                color: textColor,
                fontSize: moderateScale(arabicFontSize),
                fontFamily: arabicFontFamily, // 'Indopak'
              },
            ]}>
            {indopakText || 'Loading Indopak...'}
          </Text>
        ) : isQPCSelected && tajweedNodes ? (
          // QPC Rendering: Always use generated tajweedNodes
          <Text
            style={[
              styles.arabicText,
              {
                fontSize: moderateScale(arabicFontSize),
                fontFamily: arabicFontFamily, // 'QPC'
              },
            ]}>
            {tajweedNodes}
          </Text>
        ) : (
          // Fallback (e.g., QPC selected but data is loading/missing)
          <Text
            style={[
              styles.arabicText,
              {
                color: textColor,
                fontSize: moderateScale(arabicFontSize),
                fontFamily: arabicFontFamily, // Should be QPC here ideally
              },
            ]}>
            {/* Display plain text or loading indicator */}
            {verse.text || 'Loading...'}
          </Text>
        )}
        {/* ---> End Conditional Rendering <--- */}
        {showTransliteration && verse.transliteration && (
          <FormattedTextRenderer
            text={verse.transliteration}
            baseStyle={[
              styles.transliterationText,
              {
                color: textColor,
                fontSize: moderateScale(transliterationFontSize),
              },
            ]}
          />
        )}
        {showTranslation && verse.translation && (
          <View>
            <FormattedTextRenderer
              text={verse.translation}
              baseStyle={[
                styles.translationText,
                {
                  color: textColor,
                  fontSize: moderateScale(translationFontSize),
                },
              ]}
              onFootnotePress={handleFootnotePress}
            />

            {/* Display Translation Source */}
            {verse.translation && (
              <Text
                style={[
                  styles.translationSource,
                  {color: Color(textColor).alpha(0.6).toString()},
                ]}>
                Saheeh International
              </Text>
            )}
          </View>
        )}

        {/* Footnote Display */}
        {activeFootnote && (
          <View
            style={[
              styles.footnoteContainer,
              {backgroundColor: footnoteBgColor},
            ]}>
            <View style={styles.footnoteHeader}>
              <Text style={[styles.footnoteTitle, {color: textColor}]}>
                Footnote
              </Text>
              <TouchableOpacity
                onPress={closeFootnote}
                style={styles.closeButton}>
                <Ionicons name="close" size={20} color={textColor} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.footnoteContent, {color: textColor}]}>
              {activeFootnote.content}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

VerseItem.displayName = 'VerseItem';

const styles = StyleSheet.create({
  container: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  verseInfoContainer: {
    alignSelf: 'flex-start',
    marginBottom: verticalScale(6),
  },
  verseInfoPill: {
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(6),
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
