/**
 * A Quran passage inside an adhkar row, drawn with Digital Khatt from the
 * Hafs words its span names (utils/adhkarQuran.ts). The words are always the
 * Hafs ones, whatever rewayah the mushaf is on: for Warsh and the others they
 * come from the data service's async side cache. While they load, the row's
 * own text keeps the place invisible (same height, no adhkar-font flash);
 * if they cannot load, or the fonts are missing, that text is shown instead.
 */
import React, {useMemo, useState} from 'react';
import {Text, View, type StyleProp, type TextStyle} from 'react-native';
import SkiaVerseText, {
  type SkiaVerseTextAlign,
} from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {useRewayahVerseTexts} from '@/components/share/useRewayahVerseTexts';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {
  joinSpanText,
  spanVerseKeys,
  type AdhkarQuranSpan,
} from '@/utils/adhkarQuran';

// Adhkar audio and the mapped word positions are Hafs.
const REWAYAH = 'hafs';

interface AdhkarQuranPassageProps {
  span: AdhkarQuranSpan;
  /** The row's own text of the passage, shown until DK words are ready. */
  fallbackText: string;
  fallbackStyle: StyleProp<TextStyle>;
  fontSize: number;
  color: string;
  horizontalPadding: number;
  textAlign: SkiaVerseTextAlign;
}

export function AdhkarQuranPassage({
  span,
  fallbackText,
  fallbackStyle,
  fontSize,
  color,
  horizontalPadding,
  textAlign,
}: AdhkarQuranPassageProps): React.ReactElement {
  const {theme} = useTheme();
  const [width, setWidth] = useState(0);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
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
  const fontFamily = getDkFontFamily(mushafRenderer, REWAYAH);
  const fontMgr = useMushafFontMgr();

  const verseKeys = useMemo(() => spanVerseKeys(span), [span]);
  const verseTexts = useRewayahVerseTexts(verseKeys, REWAYAH);
  const text = useMemo(
    () =>
      verseTexts.status === 'ready'
        ? joinSpanText(span, verseKey =>
            digitalKhattDataService.getVerseWords(verseKey, REWAYAH),
          )
        : '',
    [verseTexts, span],
  );

  // Nothing to draw with: show the row's own text.
  if (!fontMgr || verseTexts.status === 'unavailable') {
    return <Text style={fallbackStyle}>{fallbackText}</Text>;
  }
  if (verseTexts.status === 'ready' && !text) {
    return <Text style={fallbackStyle}>{fallbackText}</Text>;
  }

  // Words still loading, or the width not measured yet: an invisible copy of
  // the row text holds the place, so the passage never paints in the adhkar
  // font first and then swaps to Digital Khatt.
  const drawable = text.length > 0 && width > 0;

  return (
    <View
      // The canvas has no text of its own; screen readers read the passage.
      accessible
      accessibilityRole="text"
      accessibilityLabel={fallbackText}
      style={{
        width: '100%',
        direction: 'rtl',
        paddingHorizontal: horizontalPadding,
      }}
      onLayout={e =>
        setWidth(e.nativeEvent.layout.width - horizontalPadding * 2)
      }>
      {drawable ? (
        <SkiaVerseText
          text={text}
          fontMgr={fontMgr}
          fontFamily={fontFamily}
          fontSize={fontSize}
          textColor={color}
          showTajweed={false}
          width={width}
          indexedTajweedData={null}
          arabicTextWeight={arabicTextWeight}
          showAllahNameHighlight={showAllahNameHighlight}
          allahNameHighlightColor={allahNameHighlightColor}
          textAlign={textAlign}
        />
      ) : (
        <Text
          style={[fallbackStyle, {opacity: 0}]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {fallbackText}
        </Text>
      )}
    </View>
  );
}
