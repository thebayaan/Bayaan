import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  Share,
  Switch,
  useWindowDimensions,
  ActivityIndicator,
  PixelRatio,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import {useCanvasRef} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import ShareCardPreview from '@/components/share/ShareCardPreview';
import {captureShareCard} from '@/components/share/captureShareCard';
import {lightHaptics} from '@/utils/haptics';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
}>;
const saheehData =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    {t?: string}
  >;

interface QuranEntry {
  verse_key: string;
  text: string;
}
const quranRaw = require('@/data/quran.json') as Record<string, QuranEntry>;
const textByKey: Record<string, string> = {};
for (const key of Object.keys(quranRaw)) {
  const entry = quranRaw[key];
  if (entry?.verse_key) textByKey[entry.verse_key] = entry.text;
}

export const VerseShareSheet = (props: SheetProps<'verse-share'>) => {
  const {theme, isDarkMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {width: screenWidth} = useWindowDimensions();
  const captureCanvasRef = useCanvasRef();

  const [showWatermark, setShowWatermark] = useState(true);
  const [showBasmallah, setShowBasmallah] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const verseKeys = payload?.verseKeys ?? [verseKey];

  const fontMgr = mushafPreloadService.fontMgr;
  const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;

  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';

  // Preview width (sheet padding = 16*2, small inset = 8*2)
  const previewWidth = screenWidth - moderateScale(48);

  // Capture canvas: target 1080 physical pixels
  const captureLogicalWidth = 1080 / PixelRatio.get();

  // Build text for "Share as Text" fallback
  const {arabicText, translation, verseRefText} = useMemo(() => {
    const arabicParts: string[] = [];
    const translationParts: string[] = [];
    for (const vk of verseKeys) {
      const arabic = textByKey[vk];
      if (arabic) arabicParts.push(arabic);
      const trans = saheehData[vk]?.t;
      if (trans) translationParts.push(trans);
    }

    const firstKey = verseKeys[0];
    const lastKey = verseKeys[verseKeys.length - 1];
    const [firstSurah, firstAyah] = firstKey.split(':');
    const [lastSurah, lastAyah] = lastKey.split(':');
    const surah = surahData.find(s => s.id === parseInt(firstSurah, 10));
    const surahName = surah?.name ?? '';

    let ref: string;
    if (firstSurah === lastSurah) {
      ref =
        firstAyah === lastAyah
          ? `${firstSurah}:${firstAyah}`
          : `${firstSurah}:${firstAyah}-${lastAyah}`;
    } else {
      ref = `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
    }

    return {
      arabicText: arabicParts.join('\n'),
      translation: translationParts.join('\n'),
      verseRefText: `${surahName} ${ref}`,
    };
  }, [verseKeys]);

  const handleShareAsImage = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    lightHaptics();

    try {
      const uri = await captureShareCard(captureCanvasRef);
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error) {
      console.warn('[VerseShareSheet] Image capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, captureCanvasRef]);

  const handleShareAsText = useCallback(async () => {
    lightHaptics();
    const message = `${arabicText}\n\n${translation}\n\n-- Quran ${verseRefText}`;
    await Share.share({message});
    SheetManager.hideAll();
  }, [arabicText, translation, verseRefText]);

  if (!payload || !fontMgr) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        <Text style={styles.title}>Share Verse</Text>

        {/* Visible preview */}
        <View style={styles.previewContent}>
          <ShareCardPreview
            verseKeys={verseKeys}
            isDarkMode={isDarkMode}
            showWatermark={showWatermark}
            showBasmallah={showBasmallah}
            fontMgr={fontMgr}
            quranCommonTypeface={quranCommonTypeface}
            fontFamily={fontFamily}
            width={previewWidth}
          />
        </View>

        {/* Hidden capture canvas — 1080px physical, positioned off-screen */}
        <View style={styles.hiddenCanvas} pointerEvents="none">
          <ShareCardPreview
            canvasRef={captureCanvasRef}
            verseKeys={verseKeys}
            isDarkMode={isDarkMode}
            showWatermark={showWatermark}
            showBasmallah={showBasmallah}
            fontMgr={fontMgr}
            quranCommonTypeface={quranCommonTypeface}
            fontFamily={fontFamily}
            width={captureLogicalWidth}
          />
        </View>

        {/* Basmallah toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Basmallah</Text>
          <Switch
            trackColor={{
              false: Color(theme.colors.textSecondary).alpha(0.3).toString(),
              true: theme.colors.text,
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={Color(theme.colors.textSecondary)
              .alpha(0.3)
              .toString()}
            onValueChange={() => setShowBasmallah(!showBasmallah)}
            value={showBasmallah}
            style={{transform: [{scaleX: 0.8}, {scaleY: 0.8}]}}
          />
        </View>

        {/* Watermark toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Watermark</Text>
          <Switch
            trackColor={{
              false: Color(theme.colors.textSecondary).alpha(0.3).toString(),
              true: theme.colors.text,
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={Color(theme.colors.textSecondary)
              .alpha(0.3)
              .toString()}
            onValueChange={() => setShowWatermark(!showWatermark)}
            value={showWatermark}
            style={{transform: [{scaleX: 0.8}, {scaleY: 0.8}]}}
          />
        </View>

        {/* Share buttons */}
        <View style={styles.buttonsContainer}>
          <Pressable
            style={[styles.primaryButton, isCapturing && styles.buttonDisabled]}
            onPress={handleShareAsImage}
            disabled={isCapturing}>
            {isCapturing ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Feather
                name="image"
                size={moderateScale(18)}
                color={theme.colors.background}
              />
            )}
            <Text style={styles.primaryButtonText}>Share as Image</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleShareAsText}>
            <Feather
              name="type"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
            <Text style={styles.secondaryButtonText}>Share as Text</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: verticalScale(12),
    },
    previewContent: {
      alignItems: 'center',
    },
    hiddenCanvas: {
      position: 'absolute',
      left: -99999,
      top: 0,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: verticalScale(14),
      paddingHorizontal: moderateScale(4),
    },
    toggleLabel: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    buttonsContainer: {
      gap: moderateScale(10),
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(14),
      gap: moderateScale(8),
    },
    primaryButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.background,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(14),
      gap: moderateScale(8),
    },
    secondaryButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
