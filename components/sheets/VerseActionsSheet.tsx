import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {lightHaptics} from '@/utils/haptics';
import {PlayIcon, RepeatIcon} from '@/components/Icons';
import Color from 'color';

const surahData = require('@/data/surahData.json');
const quranVerses = require('@/data/quran.json');
const saheehData = require('@/data/SaheehInternational.translation-with-footnote-tags.json');
const transliterationData = require('@/data/transliteration.json');

export const VerseActionsSheet = (props: SheetProps<'verse-actions'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [pressedOption, setPressedOption] = useState<string | null>(null);

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const surahNumber = payload?.surahNumber ?? 0;
  const ayahNumber = payload?.ayahNumber ?? 0;
  const verseKeys = payload?.verseKeys;
  const isRange = verseKeys && verseKeys.length > 1;

  const {arabicText, translation, transliteration} = useMemo(() => {
    if (isRange) {
      const arabicParts: string[] = [];
      const translationParts: string[] = [];
      const transliterationParts: string[] = [];
      for (const vk of verseKeys) {
        const arabic = (
          Object.values(quranVerses) as Array<{
            verse_key: string;
            text: string;
          }>
        ).find(v => v.verse_key === vk)?.text;
        if (arabic) arabicParts.push(arabic);
        const trans = saheehData[vk]?.t;
        if (trans) translationParts.push(trans);
        const translit = transliterationData[vk]?.t;
        if (translit) transliterationParts.push(translit);
      }
      return {
        arabicText: arabicParts.join('\n'),
        translation: translationParts.join('\n'),
        transliteration: transliterationParts.join('\n'),
      };
    }

    const resolvedArabic =
      payload?.arabicText ||
      (
        Object.values(quranVerses) as Array<{verse_key: string; text: string}>
      ).find(v => v.verse_key === verseKey)?.text ||
      '';
    const resolvedTranslation =
      payload?.translation || saheehData[verseKey]?.t || '';
    const resolvedTransliteration =
      payload?.transliteration || transliterationData[verseKey]?.t || '';
    return {
      arabicText: resolvedArabic as string,
      translation: resolvedTranslation as string,
      transliteration: resolvedTransliteration as string,
    };
  }, [
    verseKey,
    verseKeys,
    isRange,
    payload?.arabicText,
    payload?.translation,
    payload?.transliteration,
  ]);

  const surah = surahData.find(
    (s: {id: number; name: string}) => s.id === surahNumber,
  );
  const surahName = surah?.name ?? '';

  // Compute display range for multi-verse selection
  const verseRefText = useMemo(() => {
    if (!isRange) return `${surahNumber}:${ayahNumber}`;
    const firstKey = verseKeys[0];
    const lastKey = verseKeys[verseKeys.length - 1];
    const [firstSurah, firstAyah] = firstKey.split(':');
    const [lastSurah, lastAyah] = lastKey.split(':');
    if (firstSurah === lastSurah) {
      return `${firstSurah}:${firstAyah}-${lastAyah}`;
    }
    return `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
  }, [isRange, verseKeys, surahNumber, ayahNumber]);

  const isBookmarked = useVerseAnnotationsStore(state => {
    const keys = isRange ? verseKeys : [verseKey];
    return keys.every(vk => state.isBookmarked(vk));
  });
  const isHighlighted = useVerseAnnotationsStore(
    state => !!state.highlights[verseKey],
  );

  const handleToggleBookmark = useCallback(async () => {
    lightHaptics();
    const keys = isRange ? verseKeys : [verseKey];
    const store = useVerseAnnotationsStore.getState();
    if (isBookmarked) {
      for (const vk of keys) {
        await verseAnnotationService.removeBookmark(vk);
        store.removeBookmark(vk);
      }
    } else {
      for (const vk of keys) {
        const [s, a] = vk.split(':');
        await verseAnnotationService.addBookmark(
          vk,
          parseInt(s, 10),
          parseInt(a, 10),
        );
        store.addBookmark(vk);
      }
    }
    SheetManager.hideAll();
  }, [verseKey, verseKeys, isRange, isBookmarked]);

  const handleHighlight = useCallback(async () => {
    if (isHighlighted) {
      lightHaptics();
      const keys = isRange ? verseKeys : [verseKey];
      const store = useVerseAnnotationsStore.getState();
      for (const vk of keys) {
        await verseAnnotationService.removeHighlight(vk);
        store.removeHighlight(vk);
      }
      SheetManager.hideAll();
    } else {
      SheetManager.show('verse-highlight', {
        payload: {verseKey, surahNumber, ayahNumber, verseKeys},
      });
    }
  }, [verseKey, verseKeys, isRange, surahNumber, ayahNumber, isHighlighted]);

  const handleNote = useCallback(() => {
    SheetManager.show('verse-note', {
      payload: {verseKey, surahNumber, ayahNumber, verseKeys},
    });
  }, [verseKey, surahNumber, ayahNumber, verseKeys]);

  const handleCopy = useCallback(() => {
    SheetManager.show('verse-copy', {
      payload: {
        verseKey,
        surahNumber,
        ayahNumber,
        verseKeys,
        arabicText,
        translation,
        transliteration,
      },
    });
  }, [
    verseKey,
    surahNumber,
    ayahNumber,
    verseKeys,
    arabicText,
    translation,
    transliteration,
  ]);

  const handleShare = useCallback(() => {
    lightHaptics();
    SheetManager.show('verse-share', {
      payload: {
        verseKey,
        surahNumber,
        ayahNumber,
        verseKeys,
        arabicText,
        translation,
      },
    });
  }, [verseKey, surahNumber, ayahNumber, verseKeys, arabicText, translation]);

  const handleTranslation = useCallback(() => {
    SheetManager.show('verse-translation', {
      payload: {verseKey, surahNumber, ayahNumber, verseKeys, arabicText},
    });
  }, [verseKey, surahNumber, ayahNumber, verseKeys, arabicText]);

  // QUL data: theme label and per-feature availability
  const [hasSimilarVerses, setHasSimilarVerses] = useState(false);
  const [hasSharedPhrases, setHasSharedPhrases] = useState(false);

  useEffect(() => {
    if (!surahNumber || !ayahNumber || isRange) return;
    let cancelled = false;
    const vk = `${surahNumber}:${ayahNumber}`;

    (async () => {
      const [similar, phrases] = await Promise.all([
        qulDataService.hasSimilarVerses(vk),
        qulDataService.hasSharedPhrases(vk),
      ]);
      if (cancelled) return;
      setHasSimilarVerses(similar);
      setHasSharedPhrases(phrases);
    })();

    return () => {
      cancelled = true;
    };
  }, [surahNumber, ayahNumber, isRange]);

  const handleSimilarVerses = useCallback(() => {
    SheetManager.show('similar-verses', {
      payload: {verseKey, surahNumber, ayahNumber, section: 'similar'},
    });
  }, [verseKey, surahNumber, ayahNumber]);

  const handleSharedPhrases = useCallback(() => {
    SheetManager.show('similar-verses', {
      payload: {verseKey, surahNumber, ayahNumber, section: 'phrases'},
    });
  }, [verseKey, surahNumber, ayahNumber]);

  const startPlaybackForSelection = useCallback(
    (loop: boolean) => {
      lightHaptics();
      const store = useMushafPlayerStore.getState();

      // Need a reciter — fall back to options sheet if none selected
      if (!store.rewayatId) {
        const keys = isRange ? verseKeys! : [verseKey];
        const firstKey = keys[0];
        const page =
          digitalKhattDataService.getPageForVerse(firstKey) ||
          store.currentPage ||
          1;
        useMushafPlayerStore.setState({
          currentPage: page,
          pendingStartVerseKey: firstKey,
        });
        SheetManager.hideAll();
        setTimeout(() => {
          SheetManager.show('mushaf-player-options', {
            payload: {currentPage: page},
          });
        }, 300);
        return;
      }

      const keys = isRange ? verseKeys! : [verseKey];
      const firstKey = keys[0];
      const lastKey = keys[keys.length - 1];
      const [startS, startA] = firstKey.split(':').map(Number);
      const [endS, endA] = lastKey.split(':').map(Number);

      const page =
        digitalKhattDataService.getPageForVerse(firstKey) ||
        store.currentPage ||
        1;

      store.stop();
      store.setRange({surah: startS, ayah: startA}, {surah: endS, ayah: endA});

      if (loop) {
        store.setVerseRepeatCount(isRange ? 1 : 0);
        store.setRangeRepeatCount(0);
      } else {
        // Reset repeat settings so previous loop mode doesn't carry over
        store.setVerseRepeatCount(1);
        store.setRangeRepeatCount(1);
      }

      SheetManager.hideAll();
      store.startPlayback(page, firstKey);
    },
    [verseKey, verseKeys, isRange],
  );

  const handlePlaySelection = useCallback(
    () => startPlaybackForSelection(false),
    [startPlaybackForSelection],
  );

  const handleRepeatSelection = useCallback(
    () => startPlaybackForSelection(true),
    [startPlaybackForSelection],
  );

  const handleOnClose = useCallback(() => {
    useVerseSelectionStore.getState().clearSelection();
    useMushafVerseSelectionStore.getState().clearSelection();
  }, []);

  if (!payload) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onClose={handleOnClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.surahName}>{surahName}</Text>
          <Text style={styles.verseRef}>{verseRefText}</Text>
        </View>

        <View style={styles.optionsGrid}>
          <Pressable
            style={[
              styles.option,
              pressedOption === 'play-selection' && styles.optionPressed,
            ]}
            onPress={handlePlaySelection}
            onPressIn={() => setPressedOption('play-selection')}
            onPressOut={() => setPressedOption(null)}>
            <PlayIcon size={moderateScale(20)} color={theme.colors.text} />
            <Text style={styles.optionText}>
              {isRange ? 'Play Selection' : 'Play from Here'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'repeat-selection' && styles.optionPressed,
            ]}
            onPress={handleRepeatSelection}
            onPressIn={() => setPressedOption('repeat-selection')}
            onPressOut={() => setPressedOption(null)}>
            <RepeatIcon size={moderateScale(20)} color={theme.colors.text} />
            <Text style={styles.optionText}>Repeat</Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'bookmark' && styles.optionPressed,
            ]}
            onPress={handleToggleBookmark}
            onPressIn={() => setPressedOption('bookmark')}
            onPressOut={() => setPressedOption(null)}>
            <Feather
              name={isBookmarked ? 'trash-2' : 'bookmark'}
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>
              {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'highlight' && styles.optionPressed,
            ]}
            onPress={handleHighlight}
            onPressIn={() => setPressedOption('highlight')}
            onPressOut={() => setPressedOption(null)}>
            {isHighlighted ? (
              <Feather
                name="trash-2"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            ) : (
              <Ionicons
                name="brush-outline"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            )}
            <Text style={styles.optionText}>
              {isHighlighted ? 'Remove Highlight' : 'Highlight'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'note' && styles.optionPressed,
            ]}
            onPress={handleNote}
            onPressIn={() => setPressedOption('note')}
            onPressOut={() => setPressedOption(null)}>
            <Feather
              name="file-text"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Add Note</Text>
          </Pressable>

          {hasSimilarVerses && !isRange ? (
            <Pressable
              style={[
                styles.option,
                pressedOption === 'similar' && styles.optionPressed,
              ]}
              onPress={handleSimilarVerses}
              onPressIn={() => setPressedOption('similar')}
              onPressOut={() => setPressedOption(null)}>
              <Feather
                name="layers"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              <Text style={styles.optionText}>Similar Verses</Text>
            </Pressable>
          ) : null}

          {hasSharedPhrases && !isRange ? (
            <Pressable
              style={[
                styles.option,
                pressedOption === 'phrases' && styles.optionPressed,
              ]}
              onPress={handleSharedPhrases}
              onPressIn={() => setPressedOption('phrases')}
              onPressOut={() => setPressedOption(null)}>
              <Feather
                name="link"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              <Text style={styles.optionText}>Shared Phrases</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.option,
              pressedOption === 'copy' && styles.optionPressed,
            ]}
            onPress={handleCopy}
            onPressIn={() => setPressedOption('copy')}
            onPressOut={() => setPressedOption(null)}>
            <Feather
              name="copy"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Copy</Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'share' && styles.optionPressed,
            ]}
            onPress={handleShare}
            onPressIn={() => setPressedOption('share')}
            onPressOut={() => setPressedOption(null)}>
            <Feather
              name="share"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Share</Text>
          </Pressable>

          <Pressable
            style={[
              styles.option,
              pressedOption === 'translation' && styles.optionPressed,
            ]}
            onPress={handleTranslation}
            onPressIn={() => setPressedOption('translation')}
            onPressOut={() => setPressedOption(null)}>
            <Feather
              name="book-open"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Translation</Text>
          </Pressable>
        </View>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(20),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseRef: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
  });
