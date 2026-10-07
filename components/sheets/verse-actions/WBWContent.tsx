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

interface WBWContentProps {
  surahNumber: number;
  ayahNumber: number;
  // @ai-start
  /** Rewayah of the verse the sheet was opened for. Word-by-word data is
   *  Hafs-only, so this only drives the "shown in Hafs" notice. */
  rewayah?: RewayahId;
  // @ai-end
  onBack: () => void;
}

export const WBWContent: React.FC<WBWContentProps> = ({
  surahNumber,
  ayahNumber,
  rewayah, // @ai
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
  // it once they arrive instead of leaving the grid empty.
  const hafsWordsReady = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    () => digitalKhattDataService.getVerseWords(verseKey, 'hafs').length > 0,
  );
  // @ai-end

  const isDK =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr = isDK ? subscribedFontMgr : null;

  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  // Track selected word (for tap highlight)
  const [selectedWordPosition, setSelectedWordPosition] = useState<
    number | null
  >(null);

  const handleWordPress = useCallback((position: number) => {
    setSelectedWordPosition(prev => (prev === position ? null : position));
  }, []);

  // no-op handlers (not needed in sheet context)
  const noop = useCallback(() => undefined, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <View style={styles.wbwWrapper}>
        <WBWVerseView
          // @ai-start
          key={`${verseKey}:${hafsWordsReady ? 'ready' : 'loading'}`}
          verseKey={verseKey}
          rewayah={rewayah}
          // @ai-end
          textColor={theme.colors.text}
          arabicFontSize={arabicFontSize}
          dkFontFamily={dkFontFamily}
          fontMgr={fontMgr}
          showTranslation={true}
          showTransliteration={true}
          onWordPress={handleWordPress}
          selectedWordPosition={selectedWordPosition}
          showTajweed={showTajweed}
          indexedTajweedData={indexedTajweedData}
          arabicTextWeight={arabicTextWeight}
          showAllahNameHighlight={showAllahNameHighlight}
          allahNameHighlightColor={allahNameHighlightColor}
          onTap={noop}
        />
      </View>
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
