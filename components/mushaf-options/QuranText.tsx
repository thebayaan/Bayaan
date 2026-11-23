// @ai-generated
import React, {useCallback, useState} from 'react';
import {View, type LayoutChangeEvent} from 'react-native';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import type {
  MushafArabicTextWeight,
  RewayahId,
} from '@/store/mushafSettingsStore';

/**
 * Quran text in a Digital Khatt face, drawn with Skia as the reader draws
 * it (SkiaVerseText), centered in the width it is given. Until the mushaf
 * fonts are ready it keeps its height empty: Quran text is never drawn in
 * a system font.
 */
export function QuranText({
  text,
  verseKey,
  words,
  rewayah,
  fontFamily,
  fontSize,
  color,
  weight = 'normal',
  showTajweed = false,
  indexedTajweedData = null,
  allahHighlightColor,
}: {
  text?: string;
  verseKey?: string;
  words?: readonly DKWordInfo[];
  rewayah?: RewayahId;
  /** A Digital Khatt family (DkFontFamily), or a registered QCF page font. */
  fontFamily: string;
  fontSize: number;
  color: string;
  weight?: MushafArabicTextWeight;
  showTajweed?: boolean;
  indexedTajweedData?: IndexedTajweedData | null;
  /** Colors Allah and Rabb when set. */
  allahHighlightColor?: string;
}): React.JSX.Element {
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr =
    mushafPreloadService.initialized && digitalKhattDataService.initialized
      ? subscribedFontMgr
      : null;
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.floor(event.nativeEvent.layout.width));
  }, []);
  const placeholder = <View style={{height: fontSize * 1.7}} />;
  return (
    <View onLayout={onLayout} style={{alignSelf: 'stretch'}}>
      {fontMgr && width > 0 ? (
        <SkiaVerseText
          text={text}
          verseKey={verseKey}
          words={words}
          rewayah={rewayah}
          fontMgr={fontMgr}
          fontFamily={fontFamily}
          fontSize={fontSize}
          textColor={color}
          showTajweed={showTajweed}
          width={width}
          indexedTajweedData={indexedTajweedData}
          arabicTextWeight={weight}
          showAllahNameHighlight={allahHighlightColor !== undefined}
          allahNameHighlightColor={allahHighlightColor}
          textAlign="center"
          renderPlaceholder={() => placeholder}
        />
      ) : (
        placeholder
      )}
    </View>
  );
}
