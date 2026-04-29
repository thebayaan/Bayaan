import React, {useEffect, useMemo, useReducer, useState} from 'react';
import {View, Text} from 'react-native';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useTheme} from '@/hooks/useTheme';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';

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
  const activeRewayah = useMushafSettingsStore(s => s.rewayah);
  const rewayah: RewayahId = rewayahOverride ?? activeRewayah;
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

  const fontMgr = mushafPreloadService.fontMgr;

  // Lazy-load the override rewayah's DB if it's not the active one.
  const [, bump] = useReducer(x => x + 1, 0);
  useEffect(() => {
    if (rewayah === digitalKhattDataService.rewayah) return;
    let cancelled = false;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).then(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
    };
  }, [rewayah]);

  const text = useMemo(() => {
    const keys = verseKeys && verseKeys.length > 1 ? verseKeys : [verseKey];
    return keys
      .map(vk => digitalKhattDataService.getVerseText(vk, rewayah))
      .filter(Boolean)
      .join(' ');
  }, [verseKey, verseKeys, rewayah]);

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
        />
      ) : null}
    </View>
  );
};

export default React.memo(SkiaVersePreview);
