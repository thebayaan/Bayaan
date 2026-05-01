import React, {useMemo, useState, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import Color from 'color';
import {ScrollView} from 'react-native-actions-sheet';
import {WBWVerseView} from '@/components/player/v2/PlayerContent/QuranView/WBWVerseView';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useTajweedStore} from '@/store/tajweedStore';

interface WBWContentProps {
  surahNumber: number;
  ayahNumber: number;
  onBack: () => void;
}

export const WBWContent: React.FC<WBWContentProps> = ({
  surahNumber,
  ayahNumber,
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

  const dkFontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

  const isDK =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const fontMgr = isDK ? mushafPreloadService.fontMgr : null;

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
          verseKey={verseKey}
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
