import React, {useMemo, useState} from 'react';
import {View, Text} from 'react-native';
import {
  getDkFontFamily, // @ai
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {useRewayahVerseTexts} from './useRewayahVerseTexts'; // @ai

interface SkiaVersePreviewProps {
  verseKey: string;
  verseKeys?: string[];
  numberOfLines?: number;
  /** Override rewayah the preview renders in. Defaults to the active
   *  mushaf rewayah. Player-context callers pass the currently-playing
   *  track's rewayah so the preview matches what the user is listening to. */
  rewayah?: RewayahId;
}

const SkiaVersePreview: React.FC<SkiaVersePreviewProps> = ({
  verseKey,
  verseKeys,
  numberOfLines = 2,
  rewayah: rewayahOverride,
}) => {
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
  const activeRewayah = useMushafSettingsStore(s => s.rewayah);
  const allahNameHighlightColor = useMemo(
    () =>
      getAllahNameHighlightColorHex(
        allahNameHighlightColorSetting,
        theme.isDarkMode,
      ),
    [allahNameHighlightColorSetting, theme.isDarkMode],
  );
  const rewayah: RewayahId = rewayahOverride ?? activeRewayah;
  // @ai-start
  // IndoPak cannot draw non-Hafs marks, so a bookmark or track in another
  // rewayah is drawn with a Madani DigitalKhatt font.
  const fontFamily = getDkFontFamily(mushafRenderer, rewayah);
  // @ai-end

  const fontMgr = useMushafFontMgr();

  // @ai-start
  // Reactive read: loads the rewayah's side cache when it is not the active
  // one and re-renders when it lands (a plain memo stayed empty until the
  // preview remounted). Shows nothing while loading or if the load fails,
  // never another rewayah's text.
  const keys = verseKeys && verseKeys.length > 1 ? verseKeys : [verseKey];
  const verseTexts = useRewayahVerseTexts(keys, rewayah);
  const text = useMemo(
    () =>
      verseTexts.status === 'ready'
        ? verseTexts.texts.filter(Boolean).join(' ')
        : '',
    [verseTexts],
  );
  // @ai-end

  if (!fontMgr || !text) {
    return (
      <Text
        style={{
          fontFamily: 'Uthmani',
          fontSize: 18,
          color: theme.colors.text,
          textAlign: 'right',
          writingDirection: 'rtl',
          lineHeight: 34,
        }}
        numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <View
      style={{width: '100%', direction: 'rtl'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <SkiaVerseText
          text={text}
          fontMgr={fontMgr}
          fontFamily={fontFamily}
          fontSize={22}
          textColor={theme.colors.text}
          showTajweed={false}
          width={width}
          indexedTajweedData={null}
          arabicTextWeight={arabicTextWeight}
          showAllahNameHighlight={showAllahNameHighlight}
          allahNameHighlightColor={allahNameHighlightColor}
        />
      ) : null}
    </View>
  );
};

export default React.memo(SkiaVersePreview);
