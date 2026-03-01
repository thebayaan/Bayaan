import React, {useMemo, useState} from 'react';
import {View, Text} from 'react-native';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useTheme} from '@/hooks/useTheme';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';

interface SkiaVersePreviewProps {
  verseKey: string;
  verseKeys?: string[];
  numberOfLines?: number;
}

const SkiaVersePreview: React.FC<SkiaVersePreviewProps> = ({
  verseKey,
  verseKeys,
  numberOfLines = 2,
}) => {
  const {theme} = useTheme();
  const [width, setWidth] = useState(0);

  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';

  const fontMgr = mushafPreloadService.fontMgr;

  const text = useMemo(() => {
    const keys = verseKeys && verseKeys.length > 1 ? verseKeys : [verseKey];
    return keys
      .map(vk => digitalKhattDataService.getVerseText(vk))
      .filter(Boolean)
      .join(' ');
  }, [verseKey, verseKeys]);

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
        />
      ) : null}
    </View>
  );
};

export default React.memo(SkiaVersePreview);
