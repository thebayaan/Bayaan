import React from 'react';
import {useWindowDimensions} from 'react-native';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {moderateScale} from '@/utils/scale';
import {useHifzStyles} from './HifzUi';

const AYAH_MARKER = '۝';

/**
 * One Hafs ayah from the app's own Digital Khatt text, centred. `words`
 * draws only its first words (a "continue" prompt).
 */
export function HafsAyah({
  verseKey,
  words,
  inset = 64,
}: {
  verseKey: string;
  words?: number;
  /** Horizontal space around the text, in points. */
  inset?: number;
}): React.JSX.Element | null {
  const {theme} = useHifzStyles();
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const fontMgr = useMushafFontMgr();
  const {width} = useWindowDimensions();
  if (!fontMgr) return null;
  const firstWords =
    words === undefined
      ? undefined
      : (digitalKhattDataService.tryGetVerseWords(verseKey, 'hafs') ?? [])
          .filter(word => !word.text.trimStart().startsWith(AYAH_MARKER))
          .slice(0, words);
  return (
    <SkiaVerseText
      verseKey={verseKey}
      rewayah="hafs"
      words={firstWords}
      fontMgr={fontMgr}
      fontFamily={getDkFontFamily(mushafRenderer, 'hafs')}
      fontSize={moderateScale(22)}
      textColor={theme.colors.text}
      showTajweed={false}
      width={Math.max(width - moderateScale(inset), 100)}
      indexedTajweedData={null}
      arabicTextWeight={arabicTextWeight}
      textAlign="center"
    />
  );
}
