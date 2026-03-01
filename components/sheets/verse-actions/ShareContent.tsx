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
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import * as Sharing from 'expo-sharing';
import {useCanvasRef} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import ShareCardPreview from '@/components/share/ShareCardPreview';
import {captureShareCard} from '@/components/share/captureShareCard';
import {lightHaptics} from '@/utils/haptics';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {ScrollView} from 'react-native-actions-sheet';
import {SheetManager} from 'react-native-actions-sheet';
import {getTranslationTextRaw} from '@/utils/translationLookup';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
}>;

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

interface ShareContentProps {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  arabicText: string;
  translation: string;
  onDone: () => void;
}

export const ShareContent: React.FC<ShareContentProps> = ({
  verseKey,
  verseKeys: verseKeysProp,
  onDone,
}) => {
  const {theme, isDarkMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {width: screenWidth} = useWindowDimensions();
  const captureCanvasRef = useCanvasRef();

  const [showWatermark, setShowWatermark] = useState(true);
  const [showBasmallah, setShowBasmallah] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const verseKeys = verseKeysProp ?? [verseKey];
  const fontMgr = mushafPreloadService.fontMgr;
  const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;

  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';

  const previewWidth = screenWidth - moderateScale(48);
  const captureLogicalWidth = 1080 / PixelRatio.get();

  const {arabicText, translation, verseRefText} = useMemo(() => {
    const arabicParts: string[] = [];
    const translationParts: string[] = [];
    for (const vk of verseKeys) {
      const arabic = textByKey[vk];
      if (arabic) arabicParts.push(arabic);
      const trans = getTranslationTextRaw(vk, selectedTranslationId);
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
  }, [verseKeys, selectedTranslationId]);

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
      console.warn('[ShareContent] Image capture failed:', error);
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

  if (!fontMgr) return null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
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

      {/* Hidden capture canvas */}
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

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show Basmallah</Text>
        <Switch
          trackColor={{
            false: Color(theme.colors.text).alpha(0.1).toString(),
            true: Color(theme.colors.text).alpha(0.65).toString(),
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={Color(theme.colors.text).alpha(0.1).toString()}
          onValueChange={() => setShowBasmallah(!showBasmallah)}
          value={showBasmallah}
          style={{transform: [{scaleX: 0.8}, {scaleY: 0.8}]}}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show Watermark</Text>
        <Switch
          trackColor={{
            false: Color(theme.colors.text).alpha(0.1).toString(),
            true: Color(theme.colors.text).alpha(0.65).toString(),
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={Color(theme.colors.text).alpha(0.1).toString()}
          onValueChange={() => setShowWatermark(!showWatermark)}
          value={showWatermark}
          style={{transform: [{scaleX: 0.8}, {scaleY: 0.8}]}}
        />
      </View>

      <View style={styles.buttonsContainer}>
        <Pressable
          style={({pressed}) => [
            styles.primaryButton,
            isCapturing && {opacity: 0.6},
            pressed && !isCapturing && {opacity: 0.85},
          ]}
          onPress={handleShareAsImage}
          disabled={isCapturing}>
          {isCapturing ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <Feather
              name="image"
              size={moderateScale(16)}
              color={theme.colors.text}
            />
          )}
          <Text style={styles.primaryButtonText}>Share as Image</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [
            styles.secondaryButton,
            pressed && {opacity: 0.85},
          ]}
          onPress={handleShareAsText}>
          <Feather
            name="type"
            size={moderateScale(16)}
            color={theme.colors.text}
          />
          <Text style={styles.secondaryButtonText}>Share as Text</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    previewContent: {
      alignItems: 'center',
      marginBottom: moderateScale(4),
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
      paddingVertical: verticalScale(10),
      paddingHorizontal: moderateScale(2),
      marginBottom: moderateScale(4),
    },
    toggleLabel: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    buttonsContainer: {
      gap: moderateScale(10),
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.1).toString(),
      paddingVertical: verticalScale(13),
      gap: moderateScale(8),
    },
    primaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      paddingVertical: verticalScale(13),
      gap: moderateScale(8),
    },
    secondaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.7).toString(),
    },
  });
