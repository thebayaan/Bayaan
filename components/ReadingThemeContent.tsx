import React, {useMemo, useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useColorScheme,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import {
  Canvas,
  Paragraph,
  Group,
  Skia,
  BlendMode,
  TextDirection,
  TextAlign,
  type SkTypefaceFontProvider,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {useTheme} from '@/hooks/useTheme';
import {Theme, ThemeMode} from '@/utils/themeUtils';
import Color from 'color';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  LIGHT_READING_THEMES,
  DARK_READING_THEMES,
  getReadingThemeById,
  type ReadingTheme,
} from '@/constants/readingThemes';
import {
  SURAH_DIVIDER_CHAR,
  getQCFSurahNameChar,
} from '@/constants/surahNameGlyphs';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
} from '@/services/mushaf/DigitalKhattDataService';

const PREVIEW_BA = '\u0628';

const SEGMENT_OPTIONS = ['System', 'Light', 'Dark'] as const;
const SEGMENT_TO_MODE: Record<string, ThemeMode> = {
  System: 'system',
  Light: 'light',
  Dark: 'dark',
};
const MODE_TO_INDEX: Record<ThemeMode, number> = {
  system: 0,
  light: 1,
  dark: 2,
};

// Surah An-Nas verse keys for preview
const PREVIEW_VERSE_KEYS = ['114:1', '114:2', '114:3', '114:4', '114:5', '114:6'];

// Share-card style constants for mushaf preview (reference coordinate system)
const REF_CONTENT_WIDTH = 960;
const REF_VERSE_FONT_SIZE = 48;
const REF_BASMALLAH_RATIO = 0.85;
const REF_HEADER_NAME_RATIO = 0.4;
const REF_HEADER_BOTTOM_GAP = 30;
const REF_BASMALLAH_BOTTOM_GAP = 10;
const REF_VERSE_LINE_HEIGHT = 1.8;
const FONTSIZE = 1000;
const SPACEWIDTH = 100;

interface ReadingThemeContentProps {
  onBack: () => void;
}

export const ReadingThemeContent: React.FC<ReadingThemeContentProps> = ({
  onBack,
}) => {
  const {theme, themeMode, setThemeMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {lightThemeId, darkThemeId, setReadingTheme, mushafRenderer} =
    useMushafSettingsStore();
  const systemColorScheme = useColorScheme();

  // Resolve the effective mode (for system, use device appearance)
  const effectiveMode = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  // Determine which chips to show
  const visibleThemes = useMemo(() => {
    return effectiveMode === 'dark'
      ? DARK_READING_THEMES
      : LIGHT_READING_THEMES;
  }, [effectiveMode]);

  // Which chip is selected
  const selectedThemeId = useMemo(() => {
    return effectiveMode === 'dark' ? darkThemeId : lightThemeId;
  }, [effectiveMode, lightThemeId, darkThemeId]);

  // Resolve the selected reading theme for preview
  const selectedReadingTheme = useMemo(
    () => getReadingThemeById(selectedThemeId),
    [selectedThemeId],
  );

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      setReadingTheme(themeId);
    },
    [setReadingTheme],
  );

  // Position-based auto-pairing when the effective mode changes
  const autoPairAndSwitchMode = useCallback(
    (newMode: ThemeMode) => {
      const newEffectiveMode =
        newMode === 'system'
          ? systemColorScheme === 'dark'
            ? 'dark'
            : 'light'
          : newMode;

      if (newEffectiveMode !== effectiveMode) {
        // Find current position in the old mode's list
        const oldThemes =
          effectiveMode === 'dark' ? DARK_READING_THEMES : LIGHT_READING_THEMES;
        const currentId = effectiveMode === 'dark' ? darkThemeId : lightThemeId;
        const currentIndex = oldThemes.findIndex(t => t.id === currentId);

        // Select same position in the new mode's list
        const newThemes =
          newEffectiveMode === 'dark'
            ? DARK_READING_THEMES
            : LIGHT_READING_THEMES;
        const targetIndex = Math.min(
          currentIndex >= 0 ? currentIndex : 0,
          newThemes.length - 1,
        );
        setReadingTheme(newThemes[targetIndex].id);
      }

      setThemeMode(newMode);
    },
    [
      setThemeMode,
      setReadingTheme,
      effectiveMode,
      lightThemeId,
      darkThemeId,
      systemColorScheme,
    ],
  );

  // Segment changes the whole app's theme mode
  const handleSegmentChange = useCallback(
    (event: {nativeEvent: {selectedSegmentIndex: number}}) => {
      const label = SEGMENT_OPTIONS[event.nativeEvent.selectedSegmentIndex];
      autoPairAndSwitchMode(SEGMENT_TO_MODE[label]);
    },
    [autoPairAndSwitchMode],
  );

  // Android fallback for segment press
  const handleSegmentPress = useCallback(
    (seg: ThemeMode) => {
      autoPairAndSwitchMode(seg);
    },
    [autoPairAndSwitchMode],
  );

  // Skia font setup for the preview
  const dkFontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';
  const fontsReady =
    mushafPreloadService.initialized && digitalKhattDataService.initialized;
  const fontMgr = fontsReady ? mushafPreloadService.fontMgr : null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {/* Miniature preview */}
      {fontsReady && selectedReadingTheme ? (
        <MiniaturePreview
          readingTheme={selectedReadingTheme}
          fontMgr={fontMgr}
          dkFontFamily={dkFontFamily}
        />
      ) : (
        <View style={styles.loadingPreview}>
          <ActivityIndicator
            size="small"
            color={Color(theme.colors.text).alpha(0.4).toString()}
          />
        </View>
      )}

      {/* Segmented control: System | Light | Dark */}
      <Text style={styles.disclosureText}>
        Changing appearance mode applies to the entire app
      </Text>
      {Platform.OS === 'ios' ? (
        <SegmentedControl
          values={[...SEGMENT_OPTIONS]}
          selectedIndex={MODE_TO_INDEX[themeMode]}
          onChange={handleSegmentChange}
          style={styles.segmentedControl}
        />
      ) : (
        <AndroidSegment
          themeMode={themeMode}
          onPress={handleSegmentPress}
          theme={theme}
        />
      )}

      {/* Color chips grid */}
      <View style={styles.chipGrid}>
        {visibleThemes.map(t => {
          const isSelected = t.id === selectedThemeId;
          const brightness =
            parseInt(t.colors.background.slice(1, 3), 16) +
            parseInt(t.colors.background.slice(3, 5), 16) +
            parseInt(t.colors.background.slice(5, 7), 16);
          const needsBorder = brightness < 120;

          return (
            <Pressable
              key={t.id}
              onPress={() => handleThemeSelect(t.id)}
              style={[
                styles.colorChip,
                {
                  backgroundColor: t.colors.background,
                  borderColor: isSelected ? t.colors.text : 'transparent',
                },
                needsBorder &&
                  !isSelected && {
                    borderColor: Color('#ffffff').alpha(0.12).toString(),
                  },
                isSelected && styles.colorChipSelected,
              ]}>
              <Text style={[styles.colorChipLetter, {color: t.colors.text}]}>
                {PREVIEW_BA}
              </Text>
              <Text
                style={[
                  styles.colorChipLabel,
                  {color: Color(t.colors.text).alpha(0.7).toString()},
                ]}
                numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

// --- Android Segment Fallback ---

const AndroidSegment: React.FC<{
  themeMode: ThemeMode;
  onPress: (mode: ThemeMode) => void;
  theme: Theme;
}> = ({themeMode, onPress, theme}) => {
  const segBg = Color(theme.colors.text).alpha(0.06).toString();
  const segActiveBg = Color(theme.colors.text).alpha(0.12).toString();
  const segActiveText = theme.colors.text;
  const segInactiveText = Color(theme.colors.text).alpha(0.4).toString();

  return (
    <View style={[androidStyles.segmentContainer, {backgroundColor: segBg}]}>
      {(['system', 'light', 'dark'] as const).map(seg => {
        const isActive = themeMode === seg;
        return (
          <Pressable
            key={seg}
            style={[
              androidStyles.segmentButton,
              isActive && {backgroundColor: segActiveBg},
            ]}
            onPress={() => onPress(seg)}>
            <Text
              style={[
                androidStyles.segmentText,
                {color: isActive ? segActiveText : segInactiveText},
              ]}>
              {seg === 'system' ? 'System' : seg === 'light' ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const androidStyles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: moderateScale(10),
    padding: moderateScale(3),
    gap: moderateScale(2),
    marginBottom: moderateScale(16),
  },
  segmentButton: {
    flex: 1,
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(8),
    alignItems: 'center',
  },
  segmentText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
  },
});

// --- Miniature Preview ---

interface MiniaturePreviewProps {
  readingTheme: ReadingTheme;
  fontMgr: SkTypefaceFontProvider | null;
  dkFontFamily: string;
}

const MiniaturePreview: React.FC<MiniaturePreviewProps> = React.memo(
  ({readingTheme, fontMgr, dkFontFamily}) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const handleLayout = useCallback(
      (e: {nativeEvent: {layout: {width: number}}}) => {
        setContainerWidth(e.nativeEvent.layout.width);
      },
      [],
    );

    const innerWidth = containerWidth - moderateScale(24);

    return (
      <View
        onLayout={handleLayout}
        style={[
          previewStyles.container,
          {backgroundColor: readingTheme.colors.background},
        ]}>
        {containerWidth > 0 && fontMgr && (
          <MushafPreviewCanvas
            width={innerWidth}
            fontMgr={fontMgr}
            fontFamily={dkFontFamily}
            textColor={readingTheme.colors.text}
            dividerColor={readingTheme.colors.textSecondary}
          />
        )}
      </View>
    );
  },
);

// --- Mushaf Preview (share-card approach: single Canvas with divider + basmallah + verses) ---

interface MushafPreviewCanvasProps {
  width: number;
  fontMgr: SkTypefaceFontProvider;
  fontFamily: string;
  textColor: string;
  dividerColor: string;
}

/** Compute the font size that makes the divider glyph span exactly `targetWidth`. */
function computeDividerFontSize(
  typeface: SkTypeface,
  targetWidth: number,
): number {
  const refSize = 100;
  const refFont = Skia.Font(typeface, refSize);
  const ids = refFont.getGlyphIDs(SURAH_DIVIDER_CHAR);
  const widths = refFont.getGlyphWidths(ids);
  const measuredW = widths[0] || 1;
  return (targetWidth / measuredW) * refSize;
}

const MushafPreviewCanvas: React.FC<MushafPreviewCanvasProps> = React.memo(
  ({width, fontMgr, fontFamily, textColor, dividerColor}) => {
    const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;

    const elements = useMemo(() => {
      const scale = width / REF_CONTENT_WIDTH;
      const verseFontSize = REF_VERSE_FONT_SIZE * scale;
      const basmallahFontSize = verseFontSize * REF_BASMALLAH_RATIO;
      const headerBottomGap = REF_HEADER_BOTTOM_GAP * scale;
      const basmallahBottomGap = REF_BASMALLAH_BOTTOM_GAP * scale;

      const color = Skia.Color(textColor);
      const divColor = Skia.Color(dividerColor);

      // --- Divider ---
      const dividerFontSize = quranCommonTypeface
        ? computeDividerFontSize(quranCommonTypeface, width)
        : verseFontSize * 1.8;
      const divBuilder = Skia.ParagraphBuilder.Make(
        {textAlign: TextAlign.Center},
        fontMgr,
      );
      divBuilder.pushStyle({
        color: divColor,
        fontFamilies: ['QuranCommon'],
        fontSize: dividerFontSize,
      });
      divBuilder.addText(SURAH_DIVIDER_CHAR);
      divBuilder.pop();
      const dividerParagraph = divBuilder.build();
      dividerParagraph.layout(width);
      const dividerHeight = dividerParagraph.getHeight();

      // --- QCF surah name (overlaid on divider) ---
      const qcfChar = getQCFSurahNameChar(114);
      const nameBuilder = Skia.ParagraphBuilder.Make(
        {textAlign: TextAlign.Center},
        fontMgr,
      );
      nameBuilder.pushStyle({
        color,
        fontFamilies: ['SurahNameQCF'],
        fontSize: dividerFontSize * REF_HEADER_NAME_RATIO,
      });
      nameBuilder.addText(qcfChar);
      nameBuilder.pop();
      const nameParagraph = nameBuilder.build();
      nameParagraph.layout(width);
      const nameHeight = nameParagraph.getHeight();

      // --- Basmallah ---
      const basmBuilder = Skia.ParagraphBuilder.Make(
        {textDirection: TextDirection.RTL, textAlign: TextAlign.Center},
        fontMgr,
      );
      basmBuilder.pushStyle({
        color,
        fontFamilies: [fontFamily],
        fontSize: basmallahFontSize,
        fontFeatures: [{name: 'basm', value: 1}],
      });
      basmBuilder.addText(BASMALLAH_TEXT);
      basmBuilder.pop();
      const basmallahParagraph = basmBuilder.build();
      basmallahParagraph.layout(width);
      const basmallahHeight = basmallahParagraph.getHeight();

      // --- Verse text (with aya spacing like share card) ---
      const verseTexts = PREVIEW_VERSE_KEYS.map(vk =>
        digitalKhattDataService.getVerseText(vk),
      );
      const allVerseText = verseTexts.join(' ');
      const fontScale = verseFontSize / FONTSIZE;
      const ayaLetterSpacing = SPACEWIDTH * fontScale;

      const textStyle = {
        color,
        fontFamilies: [fontFamily],
        fontSize: verseFontSize,
      };

      const verseBuilder = Skia.ParagraphBuilder.Make(
        {textDirection: TextDirection.RTL, textAlign: TextAlign.Center},
        fontMgr,
      );
      verseBuilder.pushStyle({
        ...textStyle,
        heightMultiplier: REF_VERSE_LINE_HEIGHT,
      });

      for (let i = 0; i < allVerseText.length; i++) {
        const char = allVerseText.charAt(i);
        if (char === ' ') {
          const prevCode = i > 0 ? allVerseText.charCodeAt(i - 1) : 0;
          const nextCode =
            i < allVerseText.length - 1 ? allVerseText.charCodeAt(i + 1) : 0;
          const isAyaSpace =
            (prevCode >= 0x0660 && prevCode <= 0x0669) || nextCode === 0x06dd;
          verseBuilder.pushStyle({
            ...textStyle,
            letterSpacing: isAyaSpace ? ayaLetterSpacing : 0,
          });
          verseBuilder.addText(' ');
          verseBuilder.pop();
        } else {
          verseBuilder.addText(char);
        }
      }

      verseBuilder.pop();
      const verseParagraph = verseBuilder.build();
      verseParagraph.layout(width);
      const verseHeight = verseParagraph.getHeight();

      // --- Compute total height ---
      const totalHeight =
        dividerHeight +
        headerBottomGap +
        basmallahHeight +
        basmallahBottomGap +
        verseHeight;

      return {
        dividerParagraph,
        dividerHeight,
        nameParagraph,
        nameHeight,
        basmallahParagraph,
        basmallahHeight,
        verseParagraph,
        verseHeight,
        headerBottomGap,
        basmallahBottomGap,
        totalHeight,
      };
    }, [
      width,
      fontMgr,
      fontFamily,
      textColor,
      dividerColor,
      quranCommonTypeface,
    ]);

    // QCF name recolor paint (hardcoded black SVG fills → SrcIn)
    const nameColorPaint = useMemo(() => {
      const paint = Skia.Paint();
      paint.setColorFilter(
        Skia.ColorFilter.MakeBlend(Skia.Color(textColor), BlendMode.SrcIn),
      );
      return paint;
    }, [textColor]);

    let y = 0;

    // Divider
    const dividerY = y;
    const nameY = y + (elements.dividerHeight - elements.nameHeight) / 2;
    y += elements.dividerHeight + elements.headerBottomGap;

    // Basmallah
    const basmallahY = y;
    y += elements.basmallahHeight + elements.basmallahBottomGap;

    // Verses
    const verseY = y;

    return (
      <Canvas
        pointerEvents="none"
        style={{width, height: elements.totalHeight}}>
        {/* Ornamental divider */}
        <Paragraph
          paragraph={elements.dividerParagraph}
          x={0}
          y={dividerY}
          width={width}
        />
        {/* QCF surah name overlaid */}
        <Group layer={nameColorPaint}>
          <Paragraph
            paragraph={elements.nameParagraph}
            x={0}
            y={nameY}
            width={width}
          />
        </Group>
        {/* Basmallah */}
        <Paragraph
          paragraph={elements.basmallahParagraph}
          x={0}
          y={basmallahY}
          width={width}
        />
        {/* Verse text with aya spacing */}
        <Paragraph
          paragraph={elements.verseParagraph}
          x={0}
          y={verseY}
          width={width}
        />
      </Canvas>
    );
  },
);

const PREVIEW_HEIGHT = moderateScale(240);

const previewStyles = StyleSheet.create({
  container: {
    height: PREVIEW_HEIGHT,
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    marginBottom: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    disclosureText: {
      textAlign: 'center',
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginBottom: moderateScale(8),
    },
    segmentedControl: {
      marginBottom: moderateScale(16),
      height: moderateScale(36),
    },
    loadingPreview: {
      height: PREVIEW_HEIGHT,
      borderRadius: moderateScale(14),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: moderateScale(12),
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(10),
    },
    colorChip: {
      width: moderateScale(60),
      height: moderateScale(72),
      borderRadius: moderateScale(14),
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(2),
    },
    colorChipSelected: {
      transform: [{scale: 1.06}],
    },
    colorChipLetter: {
      fontFamily: 'ScheherazadeNew-Regular',
      fontSize: moderateScale(18),
    },
    colorChipLabel: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(8),
    },
  });
