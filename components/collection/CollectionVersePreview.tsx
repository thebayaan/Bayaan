// @ai-generated
import React, {useMemo, useState} from 'react';
import {View, Text} from 'react-native';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import {
  getDkFontFamily,
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import type {SavedVerseDescription} from '@/services/verse-annotations/unitAnnotations';

interface CollectionVersePreviewProps {
  /** How the row reads in its saved rewayah (useSavedVerseDescription). */
  description: SavedVerseDescription;
  /** The row's stored verse_key / verse_keys and rewayah, as saved. */
  verseKey: string;
  verseKeys?: string[];
  rewayah?: RewayahId;
  numberOfLines?: number;
}

/**
 * Arabic preview of a bookmark or note in the rewayah it was saved in.
 *
 * - Hafs rows (and legacy rows without rewayah): SkiaVersePreview of the
 *   stored keys, exactly as before.
 * - Rows of another rewayah: the text of the rewayah's own verses the row
 *   names (RewayahVerseUnits.unitText: exactly their slots, each with its own
 *   marker), so Warsh 1:7 ("1:7:5") previews only Warsh 1:7, not the whole
 *   Hafs 1:7. Nothing is drawn while the rewayah's verses load.
 * - A row no rewayah verse names (the unnumbered Fatiha basmala, or units
 *   refused): the rewayah's text of the Hafs verse(s), as before.
 *
 * The unit branch draws like SkiaVersePreview. After the verse-units
 * integration it can use SkiaVersePreview's unit-key input instead.
 */
export function CollectionVersePreview({
  description,
  verseKey,
  verseKeys,
  rewayah,
  numberOfLines,
}: CollectionVersePreviewProps) {
  switch (description.kind) {
    case 'hafs':
      return (
        <SkiaVersePreview
          verseKey={verseKey}
          verseKeys={verseKeys}
          numberOfLines={numberOfLines}
          rewayah={rewayah}
        />
      );
    case 'unnumbered': {
      const keys = description.hafsKeys;
      return (
        <SkiaVersePreview
          verseKey={keys[0] ?? verseKey}
          verseKeys={keys.length > 1 ? [...keys] : undefined}
          numberOfLines={numberOfLines}
          rewayah={rewayah}
        />
      );
    }
    case 'units':
      return (
        <UnitTextPreview
          text={description.text}
          rewayah={rewayah}
          numberOfLines={numberOfLines}
        />
      );
    default:
      return (
        <UnitTextPreview
          text=""
          rewayah={rewayah}
          numberOfLines={numberOfLines}
        />
      );
  }
}

/** SkiaVersePreview's drawing of a given verse text, in `rewayah`'s font. */
function UnitTextPreview({
  text,
  rewayah: rewayahOverride,
  numberOfLines = 2,
}: {
  text: string;
  rewayah?: RewayahId;
  numberOfLines?: number;
}) {
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
  // IndoPak cannot draw non-Hafs marks: a Madani DigitalKhatt font is used.
  const fontFamily = getDkFontFamily(mushafRenderer, rewayah);
  const fontMgr = useMushafFontMgr();

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
}
