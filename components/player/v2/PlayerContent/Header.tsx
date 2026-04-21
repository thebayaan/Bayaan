import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {moderateScale} from 'react-native-size-matters';
import {SymbolView} from 'expo-symbols';
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
  const glassColorScheme = useGlassColorScheme();
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
    // Fallback for uploads without a surah — show category or [Untagged]
    const fallbackLabel = currentTrack?.uploadCategory || '';
    return (
      <Text
        style={[styles.fallbackName, {color: theme.colors.text}]}
        numberOfLines={1}>
        {fallbackLabel}
      </Text>
    );
  };

  const PillWrapper = USE_GLASS ? GlassView : FrostedView;
  const pillProps = USE_GLASS
    ? {
        glassEffectStyle: 'regular' as const,
        colorScheme: glassColorScheme,
        isInteractive: true,
      }
    : {};

  return (
    <View style={styles.header}>
      <PillWrapper style={styles.closeButton} {...pillProps}>
        <Pressable style={styles.glassButtonInner} onPress={handleClose}>
          {USE_GLASS ? (
            <SymbolView
              name="xmark"
              size={moderateScale(18)}
              tintColor={theme.colors.text}
              weight="medium"
            />
          ) : (
            <Entypo
              name="chevron-thin-down"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          )}
        </Pressable>
      </PillWrapper>

      {renderSurahName()}

      <PillWrapper style={styles.optionsButton} {...pillProps}>
        <Pressable style={styles.glassButtonInner} onPress={onOptionsPress}>
          {USE_GLASS ? (
            <SymbolView
              name="ellipsis"
              size={moderateScale(18)}
              tintColor={theme.colors.text}
              weight="medium"
            />
          ) : (
            <Feather
              name="more-horizontal"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          )}
        </Pressable>
      </PillWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: moderateScale(54),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: moderateScale(10),
    zIndex: 1,
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    overflow: 'hidden',
  },
  optionsButton: {
    position: 'absolute',
    right: moderateScale(10),
    zIndex: 1,
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    overflow: 'hidden',
  },
  glassButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackName: {
    fontSize: moderateScale(18),
    textAlign: 'center',
  },
});
