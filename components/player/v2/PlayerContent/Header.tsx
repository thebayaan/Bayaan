import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {moderateScale} from '@/utils/scale';
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
import {useResponsive} from '@/hooks/useResponsive';

const fallbackSurahNames: Record<number, string> = {};
(
  require('@/data/surahData.json') as Array<{id: number; name_arabic: string}>
).forEach(s => {
  fallbackSurahNames[s.id] = s.name_arabic;
});

interface HeaderProps {
  onOptionsPress: () => void;
}

export const Header: React.FC<HeaderProps> = ({onOptionsPress}) => {
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  const glassColorScheme = useGlassColorScheme();
  const {setSheetMode} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);

  const iconSize = moderateScale(isTablet ? 15 : 18);
  const pillSize = moderateScale(isTablet ? 36 : 44);
  const pillRadius = pillSize / 2;
  const edgeInset = moderateScale(isTablet ? 8 : 10);
  const qcfFontSize = moderateScale(isTablet ? 17 : 20);
  const canvasMaxWidth = moderateScale(isTablet ? 172 : 200);
  const fallbackNameSize = moderateScale(isTablet ? 15 : 18);
  const headerMinH = moderateScale(isTablet ? 46 : 54);

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
      fontSize: qcfFontSize,
    });
    builder.addText(qcfChar);
    builder.pop();
    const p = builder.build();
    p.layout(canvasMaxWidth);
    return p;
  }, [qcfChar, fontMgr, theme.colors.text, qcfFontSize, canvasMaxWidth]);

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
        <Text
          style={[
            styles.fallbackName,
            {color: theme.colors.text, fontSize: fallbackNameSize},
          ]}>
          {fallbackSurahNames[surahNumber] || ''}
        </Text>
      );
    }
    const fallbackLabel = currentTrack?.uploadCategory || '';
    return (
      <Text
        style={[
          styles.fallbackName,
          {color: theme.colors.text, fontSize: fallbackNameSize},
        ]}
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

  const pillStyle = {
    width: pillSize,
    height: pillSize,
    borderRadius: pillRadius,
  };

  return (
    <View style={[styles.header, {minHeight: headerMinH}]}>
      <PillWrapper
        style={[styles.closeButton, pillStyle, {left: edgeInset}]}
        {...pillProps}>
        <Pressable style={styles.glassButtonInner} onPress={handleClose}>
          {USE_GLASS ? (
            <SymbolView
              name="xmark"
              size={iconSize}
              tintColor={theme.colors.text}
              weight="medium"
            />
          ) : (
            <Entypo
              name="chevron-thin-down"
              size={iconSize}
              color={theme.colors.text}
            />
          )}
        </Pressable>
      </PillWrapper>

      {renderSurahName()}

      <PillWrapper
        style={[styles.optionsButton, pillStyle, {right: edgeInset}]}
        {...pillProps}>
        <Pressable style={styles.glassButtonInner} onPress={onOptionsPress}>
          {USE_GLASS ? (
            <SymbolView
              name="ellipsis"
              size={iconSize}
              tintColor={theme.colors.text}
              weight="medium"
            />
          ) : (
            <Feather
              name="more-horizontal"
              size={iconSize}
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
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    zIndex: 1,
    overflow: 'hidden',
  },
  optionsButton: {
    position: 'absolute',
    zIndex: 1,
    overflow: 'hidden',
  },
  glassButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackName: {
    textAlign: 'center',
  },
});
