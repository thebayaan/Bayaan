import React, {memo, useCallback, useState, useEffect, useRef} from 'react';
import {StyleSheet, TouchableOpacity, Text, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';
import Color from 'color';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {Ionicons} from '@expo/vector-icons';

// Interface for the structure of a word entry in the tajweed JSON data
interface TajweedWordData {
  word_index: number;
  location: string; // e.g., "1:1:1"
  text: string; // The word text, potentially containing <rule> tags
}

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

/**
 * Legacy function to parse tajweed words at render time
 * This is kept for backward compatibility
 */
function parseTajweedWord(
  wordText: string,
  defaultColor: string,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const ruleStack: string[] = [];
  let currentIndex = 0;
  let keyIndex = 0;

  // Regex to find opening or closing rule tags
  const tagRegex = /<rule class=([^>]+)>|<\/rule>/g;
  let match: RegExpExecArray | null;

  while (currentIndex < wordText.length) {
    // Find the next tag
    tagRegex.lastIndex = currentIndex; // Start search from current position
    match = tagRegex.exec(wordText);

    const nextTagIndex = match ? match.index : wordText.length;

    // Process text segment before the next tag (or to the end)
    if (nextTagIndex > currentIndex) {
      const textSegment = wordText.substring(currentIndex, nextTagIndex);
      const currentRule =
        ruleStack.length > 0 ? ruleStack[ruleStack.length - 1] : null;
      const color = currentRule
        ? tajweedColors[currentRule] || defaultColor
        : defaultColor;

      result.push(
        <Text key={`word-segment-${keyIndex++}`} style={{color}}>
          {textSegment}
        </Text>,
      );
    }

    // If no more tags found, we're done
    if (!match) {
      break;
    }

    // Process the found tag
    if (match[1]) {
      // Opening tag: <rule class=...>
      const ruleName = match[1];
      ruleStack.push(ruleName);
      currentIndex = tagRegex.lastIndex; // Move past the opening tag
    } else {
      // Closing tag: </rule>
      ruleStack.pop();
      currentIndex = tagRegex.lastIndex; // Move past the closing tag
    }
  }

  return result;
}

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
  verse: Verse;
  onPress: () => void;
  textColor: string;
  borderColor: string;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
  tajweedAyahData?: TajweedWordData[]; // Original tajweed data
  processedTajweedAyahData?: ProcessedTajweedWord[]; // Pre-processed tajweed data
}

/**
 * Pre-render optimized tajweed segment
 * This component is memoized to prevent re-renders when parent re-renders
 */
const TajweedSegment = memo(({text, color}: {text: string; color: string}) => (
  <Text style={{color}}>{text}</Text>
));
TajweedSegment.displayName = 'TajweedSegment';

/**
 * Pre-render optimized tajweed word
 * This component is memoized to prevent re-renders when parent re-renders
 */
const TajweedWord = memo(
  ({
    wordData,
    index,
    textColor,
    arabicFontSize,
  }: {
    wordData: ProcessedTajweedWord;
    index: number;
    textColor: string;
    arabicFontSize: number;
  }) => (
    <Text
      style={[
        styles.arabicText,
        {
          fontSize: moderateScale(arabicFontSize),
          marginLeft: index > 0 ? moderateScale(3) : 0,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
      ]}>
      {wordData.segments.map((segment, segIndex) => {
        const color = segment.rule
          ? tajweedColors[segment.rule] || textColor
          : textColor;
        return (
          <TajweedSegment
            key={`${wordData.location}-${index}-${segIndex}`}
            text={segment.text}
            color={color}
          />
        );
      })}
    </Text>
  ),
);
TajweedWord.displayName = 'TajweedWord';

export const VerseItem = memo<VerseItemProps>(
  ({
    verse,
    onPress,
    textColor,
    borderColor,
    showTranslation = false,
    showTransliteration = false,
    transliterationFontSize,
    translationFontSize,
    arabicFontSize,
    tajweedAyahData,
    processedTajweedAyahData,
  }) => {
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
      [verse.verse_key, isSaheehDataLoaded],
    );

    // Close the footnote display
    const closeFootnote = useCallback(() => {
      setActiveFootnote(null);
    }, []);

    // Build the tajweed text nodes for the entire verse
    const tajweedNodes = processedTajweedAyahData
      ? processedTajweedAyahData.flatMap((wordData, wordIndex) => {
          const segments = wordData.segments.map((segment, segIndex) => {
            const color = segment.rule
              ? tajweedColors[segment.rule] || textColor
              : textColor;
            return (
              <TajweedSegment
                key={`${wordData.location}-${wordIndex}-${segIndex}`}
                text={segment.text}
                color={color}
              />
            );
          });
          // Add a space after each word except the last one
          if (wordIndex < processedTajweedAyahData.length - 1) {
            segments.push(<Text key={`${wordData.location}-space`}> </Text>);
          }
          return segments;
        })
      : null;

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
        {processedTajweedAyahData ? (
          // Render the entire verse within a single Text component
          <Text
            style={[
              styles.arabicText,
              {fontSize: moderateScale(arabicFontSize)},
            ]}>
            {tajweedNodes}
          </Text>
        ) : tajweedAyahData ? (
          // Fallback to legacy method (might still have alignment issues)
          <View style={styles.tajweedContainer}>
            {tajweedAyahData.map((wordData, index) => (
              <Text
                key={`${wordData.location}-${index}`}
                style={[
                  styles.arabicText,
                  {
                    color: textColor,
                    fontSize: moderateScale(arabicFontSize),
                    marginLeft: index > 0 ? moderateScale(3) : 0,
                  },
                ]}>
                {parseTajweedWord(wordData.text, textColor)}
              </Text>
            ))}
          </View>
        ) : (
          // Plain text fallback
          <Text
            style={[
              styles.arabicText,
              {
                color: textColor,
                fontSize: moderateScale(arabicFontSize),
              },
            ]}>
            {verse.text}
          </Text>
        )}
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
  tajweedContainer: {
    flexDirection: 'row-reverse', // Right-to-left flow
    flexWrap: 'wrap', // Allow words to wrap to the next line
    justifyContent: 'flex-end', // Align words to the right
    alignItems: 'center', // Align text baselines
  },
  arabicText: {
    fontSize: moderateScale(24),
    fontFamily: 'QPC',
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
