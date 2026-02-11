import React, {memo, useCallback, useState} from 'react';
import {StyleSheet, Pressable, Text, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';
import Color from 'color';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';

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

// Load Saheeh data at module scope (require() is cached — zero cost since QuranView already loaded it)
const saheehDataForFootnotes =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as SaheehData;

interface VerseItemProps {
  verse: Verse & {translation?: string; transliteration?: string};
  onPress: () => void;
  textColor: string;
  borderColor: string;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
  isSelected?: boolean;
  highlightColor?: string | null;
  hasBookmark?: boolean;
  hasNote?: boolean;
  onLongPress?: () => void;
  onOptionsPress?: () => void;
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
    onPress,
    textColor,
    borderColor,
    showTranslation: propShowTranslation,
    showTransliteration: propShowTransliteration,
    transliterationFontSize: propTransliterationFontSize,
    translationFontSize: propTranslationFontSize,
    arabicFontSize: propArabicFontSize,
    isSelected,
    highlightColor,
    hasBookmark,
    hasNote,
    onLongPress,
    onOptionsPress,
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

    // Fetch tajweed data directly from store — granular selector means only
    // the ~10 visible VerseItems re-render when tajweed finishes loading
    const processedTajweedAyahData = useTajweedStore(
      s => s.indexedTajweedData?.[verse.verse_key],
    );

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

    const bgColor = Color(textColor).alpha(0.08).toString();
    const footnoteBgColor = Color(textColor).alpha(0.1).toString();

    // Handle footnote press - uses module-scope cached data
    const handleFootnotePress = useCallback(
      (footnoteId: string, footnoteNumber: string) => {
        // If tapping the same footnote again, close it
        if (activeFootnote && activeFootnote.id === footnoteId) {
          setActiveFootnote(null);
          return;
        }

        const verseData = saheehDataForFootnotes[verse.verse_key];

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
      [verse.verse_key, activeFootnote],
    );

    // Close the footnote display
    const closeFootnote = useCallback(() => {
      setActiveFootnote(null);
    }, []);

    // --- Build Tajweed Nodes (Only if QPC and data available) ---
    const tajweedNodes =
      isQPCSelected && processedTajweedAyahData
        ? (processedTajweedAyahData as ProcessedTajweedWord[]).flatMap(
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
                segments.push(
                  <Text key={`${wordData.location}-space`}> </Text>,
                );
              }
              return segments;
            },
          )
        : null;
    // --- End Building Nodes ---

    // ---> Get Indopak text if applicable (lazy-loaded)
    const indopakText = isIndopakSelected
      ? getIndopakData()?.[verse.verse_key]?.text
      : null;
    // <--- End Get Indopak text

    const highlightBgColor = highlightColor
      ? Color(highlightColor).alpha(0.3).toString()
      : undefined;

    return (
      <Pressable
        style={() => [
          styles.container,
          {borderBottomColor: borderColor},
          isSelected && {
            backgroundColor: Color(textColor).alpha(0.06).toString(),
            borderRadius: moderateScale(8),
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}>
        <View style={styles.verseInfoContainer}>
          <View style={styles.verseInfoRow}>
            <View style={[styles.verseInfoPill, {backgroundColor: bgColor}]}>
              <Text style={[styles.verseInfo, {color: textColor}]}>
                {verse.surah_number}:{verse.ayah_number}
              </Text>
            </View>
            {hasBookmark && (
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
              onPress={onOptionsPress}
              hitSlop={8}
              style={({pressed}) => [
                styles.optionsButton,
                {opacity: pressed ? 0.5 : 1},
              ]}>
              <Feather
                name="more-horizontal"
                size={moderateScale(18)}
                color={Color(textColor).alpha(0.5).toString()}
              />
            </Pressable>
          </View>
        </View>
        {/* ---> Simplified Arabic Text Rendering <-- */}
        <View
          style={
            highlightBgColor
              ? [styles.highlightContainer, {backgroundColor: highlightBgColor}]
              : undefined
          }>
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
        </View>
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
  highlightContainer: {
    borderRadius: moderateScale(4),
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(2),
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
