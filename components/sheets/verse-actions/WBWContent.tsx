import React, {
  useMemo,
  useState,
  useCallback,
  useSyncExternalStore, // @ai
} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import Color from 'color';
import {ScrollView} from 'react-native-actions-sheet';
import {WBWVerseView} from '@/components/player/v2/PlayerContent/QuranView/WBWVerseView';
// @ai-start
import {
  getDkFontFamily,
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
// @ai-end
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useTajweedStore} from '@/store/tajweedStore';
import {wbwParts, type UnitStart} from './verseUnitScreens'; // @ai

interface WBWContentProps {
  surahNumber: number;
  ayahNumber: number;
  // @ai-start
  /** Rewayah of the verse the sheet was opened for. Word-by-word data is
   *  Hafs-only, so this only drives the "shown in Hafs" notice. */
  rewayah?: RewayahId;
  /** Another rewayah's verse: one view per Hafs verse holding its words.
   *  Absent for Hafs (unchanged). */
  unitStart?: UnitStart;
  // @ai-end
  onBack: () => void;
}

export const WBWContent: React.FC<WBWContentProps> = ({
  surahNumber,
  ayahNumber,
  rewayah, // @ai
  unitStart, // @ai
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = `${surahNumber}:${ayahNumber}`;

  // Inherit mushaf font settings
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

  // @ai-start
  // The grid always draws Hafs words (word-by-word data is Hafs-aligned).
  const dkFontFamily = getDkFontFamily(mushafRenderer, 'hafs');

  // The Hafs words come from the data service's side cache when the mushaf
  // is on another rewayah. WBWVerseView memoizes them per verse, so remount
  // it once they arrive instead of leaving the grid empty. Readiness is the
  // service's load state, not a non-empty word list.
  const hafsWordsReady = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    () => digitalKhattDataService.isRewayahReady('hafs'),
  );
  // @ai-end

  const isDK =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;

  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  // @ai-start
  const parts = useMemo(
    () => wbwParts(verseKey, unitStart),
    [verseKey, unitStart],
  );

  // Track selected word (for tap highlight), per Hafs verse shown
  const [selectedWord, setSelectedWord] = useState<{
    verseKey: string;
    position: number;
  } | null>(null);

  const wordPressHandlers = useMemo(
    () =>
      new Map(
        parts.map(part => [
          part.verseKey,
          (position: number) =>
            setSelectedWord(prev =>
              prev?.verseKey === part.verseKey && prev.position === position
                ? null
                : {verseKey: part.verseKey, position},
            ),
        ]),
      ),
    [parts],
  );
  // @ai-end

  // no-op handlers (not needed in sheet context)
  const noop = useCallback(() => undefined, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      {/* @ai-start */}
      {parts.map(part => (
        <React.Fragment key={part.verseKey}>
          {part.caption !== null && (
            <Text style={styles.partCaption}>{part.caption}</Text>
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
              showTranslation={true}
              showTransliteration={true}
              onWordPress={wordPressHandlers.get(part.verseKey) ?? noop}
              selectedWordPosition={
                selectedWord?.verseKey === part.verseKey
                  ? selectedWord.position
                  : null
              }
              showTajweed={showTajweed}
              indexedTajweedData={indexedTajweedData}
              arabicTextWeight={arabicTextWeight}
              showAllahNameHighlight={showAllahNameHighlight}
              allahNameHighlightColor={allahNameHighlightColor}
              onTap={noop}
            />
          </View>
        </React.Fragment>
      ))}
      {/* @ai-end */}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: moderateScale(4),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(20),
    },
    // @ai-start
    partCaption: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      letterSpacing: 0.3,
      marginTop: verticalScale(6),
      marginBottom: verticalScale(6),
      marginLeft: moderateScale(4),
    },
    // @ai-end
    wbwWrapper: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      paddingHorizontal: moderateScale(10),
      paddingVertical: verticalScale(8),
    },
  });
