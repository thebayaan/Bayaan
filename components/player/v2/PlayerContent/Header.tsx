import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Entypo, Feather} from '@expo/vector-icons';
import {
  Canvas,
  Paragraph,
  Group,
  Skia,
  BlendMode,
  useFonts,
} from '@shopify/react-native-skia';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getQCFSurahNameChar} from '@/constants/surahNameGlyphs';

const fallbackSurahNames: Record<number, string> = {};
(
  require('@/data/surahData.json') as Array<{id: number; name_arabic: string}>
).forEach(s => {
  fallbackSurahNames[s.id] = s.name_arabic;
});

const QCF_FONT_SIZE = moderateScale(20);
const CANVAS_MAX_WIDTH = moderateScale(200);

interface HeaderProps {
  onOptionsPress: () => void;
}

export const Header: React.FC<HeaderProps> = ({onOptionsPress}) => {
  const {theme} = useTheme();
  const {setSheetMode} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;

  const fontMgr = useFonts({
    SurahNameQCF: [require('@/data/mushaf/surah-name-qcf.ttf')],
  });

  const qcfChar = useMemo(
    () => (surahNumber ? getQCFSurahNameChar(surahNumber) : ''),
    [surahNumber],
  );

  const qcfParagraph = useMemo(() => {
    if (!qcfChar || !fontMgr) return null;
    const builder = Skia.ParagraphBuilder.Make({}, fontMgr);
    builder.pushStyle({
      color: Skia.Color(theme.colors.text),
      fontFamilies: ['SurahNameQCF'],
      fontSize: QCF_FONT_SIZE,
    });
    builder.addText(qcfChar);
    builder.pop();
    const p = builder.build();
    p.layout(CANVAS_MAX_WIDTH);
    return p;
  }, [qcfChar, fontMgr, theme.colors.text]);

  const qcfLayout = useMemo(() => {
    if (!qcfParagraph) return null;
    const w = qcfParagraph.getLongestLine();
    const h = qcfParagraph.getHeight();
    return {w: Math.ceil(w), h: Math.ceil(h)};
  }, [qcfParagraph]);

  const qcfColorPaint = useMemo(() => {
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeBlend(
        Skia.Color(theme.colors.text),
        BlendMode.SrcIn,
      ),
    );
    return paint;
  }, [theme.colors.text]);

  const handleClose = () => {
    setSheetMode('hidden');
  };

  const renderSurahName = () => {
    if (qcfParagraph && qcfLayout) {
      return (
        <Canvas style={{width: qcfLayout.w, height: qcfLayout.h}}>
          <Group layer={qcfColorPaint}>
            <Paragraph
              paragraph={qcfParagraph}
              x={0}
              y={0}
              width={qcfLayout.w}
            />
          </Group>
        </Canvas>
      );
    }
    if (surahNumber) {
      return (
        <Text style={[styles.fallbackName, {color: theme.colors.text}]}>
          {fallbackSurahNames[surahNumber] || ''}
        </Text>
      );
    }
    return null;
  };

  return (
    <View style={styles.header}>
      <Pressable style={styles.closeButton} onPress={handleClose}>
        <Entypo
          name="chevron-thin-down"
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      </Pressable>

      {renderSurahName()}

      <Pressable style={styles.optionsButton} onPress={onOptionsPress}>
        <Feather
          name="more-horizontal"
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: moderateScale(15),
    zIndex: 1,
    padding: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsButton: {
    position: 'absolute',
    right: moderateScale(15),
    zIndex: 1,
    padding: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackName: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
  },
});
