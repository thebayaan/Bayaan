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
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import ShareCardPreview from '@/components/share/ShareCardPreview';
import {captureShareCard} from '@/components/share/captureShareCard';
import {lightHaptics} from '@/utils/haptics';
import {
  getDkFontFamily, // @ai
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {ScrollView} from 'react-native-actions-sheet';
import {SheetManager} from 'react-native-actions-sheet';
import {getTranslationTextRaw} from '@/utils/translationLookup';
import {verseShareUrl, shareUrl as nativeShareUrl} from '@/utils/shareUtils';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
// @ai-start
import {showToast} from '@/utils/toastUtils';
import {
  formatQuranCitation,
  hasNoOwnText,
  joinVerseTexts,
  noOwnTextMessage,
} from '@/components/share/rewayahVerseText';
import {
  joinTranslationParts,
  resolveSelectionTexts,
  selectionTranslationParts,
  type ReadyVerseSelection,
  type VerseSelectionRequest,
} from '@/components/share/rewayahVerseSelection';
import {
  useRequireSelection,
  useSelectionVerseTexts,
  useVerseSelection,
} from '@/components/share/useVerseSelection';
// @ai-end
import type {RewayahId} from '@/store/mushafSettingsStore';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
}>;

const NO_KEYS: readonly string[] = []; // @ai

interface ShareContentProps {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  // @ai-start
  /**
   * The selected verses in `rewayah`'s own numbering (verse-units contract
   * 4.1). verseKey / surahNumber / ayahNumber / verseKeys keep their Hafs
   * meaning; without unitKeys another rewayah shares its verses holding
   * those Hafs verses. Text, card, translation, reference and link all
   * follow these verses (see components/share/rewayahVerseSelection.ts).
   */
  unitKeys?: readonly string[];
  // @ai-end
  rewayah?: RewayahId;
  onDone: () => void;
}

export const ShareContent: React.FC<ShareContentProps> = ({
  verseKey,
  surahNumber,
  ayahNumber,
  verseKeys: verseKeysProp,
  unitKeys, // @ai
  rewayah: rewayahProp,
  onDone,
}) => {
  const {theme, isDarkMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {width: screenWidth} = useWindowDimensions();
  const captureCanvasRef = useCanvasRef();

  const [showWatermark, setShowWatermark] = useState(true);
  const [showBasmallah, setShowBasmallah] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  // @ai-start
  const [isPreparingText, setIsPreparingText] = useState(false);
  // @ai-end
  const fontMgr = useMushafFontMgr();
  const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;

  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const rewayah: RewayahId = rewayahProp ?? mushafRewayah;
  const rewayahLabel = getRewayahShortLabel(rewayah);
  // @ai-start
  const fontFamily = getDkFontFamily(mushafRenderer, rewayah);

  // The verses to share, in the rewayah's own numbering (decision 3): the
  // unit keys, or the rewayah verses holding the Hafs verses. Hafs: the Hafs
  // keys, exactly as before.
  const selectionRequest = useMemo<VerseSelectionRequest>(
    () => ({
      rewayah,
      verseKey,
      surahNumber,
      ayahNumber,
      verseKeys: verseKeysProp,
      unitKeys,
    }),
    [rewayah, verseKey, surahNumber, ayahNumber, verseKeysProp, unitKeys],
  );
  const selection = useVerseSelection(selectionRequest);
  const requireSelection = useRequireSelection(selection, selectionRequest);
  // The share card groups the selected verses by surah (surah numbers are
  // the same in every numbering).
  const verseKeys = selection.status === 'ready' ? selection.keys : NO_KEYS;

  // The card and the shared text use this rewayah's words only: each
  // selected verse exactly as the mushaf shows it, with its own marker.
  // While they load (a reciter's rewayah that is not the active mushaf one)
  // the preview shows a spinner; if they cannot be loaded the sheet says so
  // instead of substituting Hafs.
  const verseTexts = useSelectionVerseTexts(selection);
  // The card needs words to draw; a selection with no words of its own in
  // this rewayah gets an explanation instead.
  const cardTexts =
    verseTexts.status === 'ready' && !hasNoOwnText(verseTexts.texts)
      ? verseTexts.texts
      : null;
  // @ai-end

  const previewWidth = screenWidth - moderateScale(48);
  const captureLogicalWidth = 1080 / PixelRatio.get();

  // @ai-start
  // Translation and reference of the shared verses. Translations are
  // Hafs-aligned (verse-units contract 4.6): every Hafs verse the selection
  // reads, once, with a note under a Hafs verse the rewayah divides. The
  // reference is in the selection's own numbering ("Al-Fatihah 1:6"). Hafs:
  // the selected verses' translations and Hafs reference, as before. A
  // verse link opens one verse (the URL scheme has no ranges), so the
  // message sent with it cites that verse (linkRefText), not the whole
  // selection.
  const shareRefs = useCallback(
    (ready: ReadyVerseSelection) => {
      const surah = surahData.find(s => s.id === ready.surahNumber);
      const surahName = surah?.name ?? '';
      return {
        translation: joinTranslationParts(
          selectionTranslationParts(ready),
          hafsKey => getTranslationTextRaw(hafsKey, selectedTranslationId),
        ),
        verseRefText: `${surahName} ${ready.label}`,
        linkRefText: `${surahName} ${ready.linkLabel}`,
      };
    },
    [selectedTranslationId],
  );
  // @ai-end

  const handleShareAsImage = useCallback(async () => {
    if (isCapturing || !cardTexts) return; // @ai
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
  }, [isCapturing, captureCanvasRef, cardTexts]); // @ai

  // @ai-start
  const handleShareAsText = useCallback(async () => {
    if (isPreparingText) return;
    lightHaptics();
    setIsPreparingText(true);
    try {
      // @ai-start
      // Waits (bounded) for another rewayah's verse units and words while
      // they load; says why when they cannot be named.
      const ready = await requireSelection('shared');
      if (!ready) return;
      const result =
        ready === selection && verseTexts.status === 'ready'
          ? verseTexts
          : await resolveSelectionTexts(ready);
      const {translation, verseRefText} = shareRefs(ready);
      // @ai-end
      if (result.status !== 'ready') {
        showToast(
          `Couldn't load the ${rewayahLabel} text`,
          'Nothing was shared. Please try again.',
          'error',
        );
        return;
      }
      if (hasNoOwnText(result.texts)) {
        showToast(
          'Nothing to share',
          noOwnTextMessage(result.rewayah),
          'error',
        );
        return;
      }
      // The layout shared before Release 1, so Hafs text is shared byte for
      // byte as before: the translation paragraph stays (empty) when there
      // is no translation.
      const message = [
        joinVerseTexts(result.texts),
        translation,
        `-- ${formatQuranCitation(verseRefText, result.rewayah)}`,
      ].join('\n\n');
      await Share.share({message});
      SheetManager.hideAll();
    } finally {
      setIsPreparingText(false);
    }
  }, [
    isPreparingText,
    requireSelection, // @ai
    selection, // @ai
    verseTexts,
    shareRefs, // @ai
    rewayahLabel,
  ]);

  const handleShareLink = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = await requireSelection('shared');
    if (!ready) return;
    // The link carries the rewayah and the page renders its own text, so no
    // local text is needed here. The web reader behind verseShareUrl
    // resolves Hafs verses only (it checks the ayah against the Hafs verse
    // count and ignores the rewayah's numbering), so the link names the Hafs
    // verse holding the first selected verse's first word (Hafs: the
    // payload's verse, as before); the message cites the selection in its
    // own numbering.
    const url = verseShareUrl(
      ready.linkVerse.surah,
      ready.linkVerse.ayah,
      isDarkMode ? 'dark' : 'light',
      rewayah,
    );
    await nativeShareUrl(
      url,
      formatQuranCitation(shareRefs(ready).linkRefText, rewayah),
    );
    // @ai-end
    SheetManager.hideAll();
  }, [requireSelection, shareRefs, isDarkMode, rewayah]); // @ai
  // @ai-end

  if (!fontMgr) return null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
      {/* Visible preview */}
      <View style={styles.previewContent}>
        {/* @ai-start */}
        {cardTexts ? (
          <ShareCardPreview
            verseKeys={verseKeys}
            verseTexts={cardTexts}
            isDarkMode={isDarkMode}
            showWatermark={showWatermark}
            showBasmallah={showBasmallah}
            fontMgr={fontMgr}
            quranCommonTypeface={quranCommonTypeface}
            fontFamily={fontFamily}
            width={previewWidth}
            rewayah={verseTexts.rewayah}
          />
        ) : (
          <View style={[styles.previewPlaceholder, {width: previewWidth}]}>
            {verseTexts.status === 'loading' ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.previewPlaceholderText}>
                  Loading the {rewayahLabel} text
                </Text>
              </>
            ) : verseTexts.status === 'ready' ? (
              <Text style={styles.previewPlaceholderText}>
                {noOwnTextMessage(verseTexts.rewayah)}
              </Text>
            ) : (
              <>
                <Text style={styles.previewPlaceholderText}>
                  Couldn&apos;t load the {rewayahLabel} text.
                </Text>
                <Pressable
                  onPress={verseTexts.retry}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({pressed}) => [
                    styles.retryButton,
                    pressed && {opacity: 0.7},
                  ]}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
        {/* @ai-end */}
      </View>

      {/* Hidden capture canvas */}
      {/* @ai-start */}
      {cardTexts && (
        <View style={styles.hiddenCanvas} pointerEvents="none">
          <ShareCardPreview
            canvasRef={captureCanvasRef}
            verseKeys={verseKeys}
            verseTexts={cardTexts}
            isDarkMode={isDarkMode}
            showWatermark={showWatermark}
            showBasmallah={showBasmallah}
            fontMgr={fontMgr}
            quranCommonTypeface={quranCommonTypeface}
            fontFamily={fontFamily}
            width={captureLogicalWidth}
            rewayah={verseTexts.rewayah}
          />
        </View>
      )}
      {/* @ai-end */}

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
            (isCapturing || !cardTexts) && {opacity: 0.6}, // @ai
            pressed && !isCapturing && {opacity: 0.85},
          ]}
          onPress={handleShareAsImage}
          disabled={isCapturing || !cardTexts}>
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
            isPreparingText && {opacity: 0.6}, // @ai
            pressed && {opacity: 0.85},
          ]}
          onPress={handleShareAsText}
          // @ai-start
          disabled={isPreparingText}>
          {isPreparingText ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <Feather
              name="type"
              size={moderateScale(16)}
              color={theme.colors.text}
            />
          )}
          {/* @ai-end */}
          <Text style={styles.secondaryButtonText}>Share as Text</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [
            styles.secondaryButton,
            pressed && {opacity: 0.85},
          ]}
          onPress={handleShareLink}>
          <Feather
            name="link"
            size={moderateScale(16)}
            color={theme.colors.text}
          />
          <Text style={styles.secondaryButtonText}>Share Link</Text>
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
    // @ai-start
    previewPlaceholder: {
      minHeight: verticalScale(140),
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(10),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      paddingHorizontal: moderateScale(16),
    },
    previewPlaceholderText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.6).toString(),
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(6),
      borderRadius: moderateScale(8),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    retryButtonText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    // @ai-end
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
