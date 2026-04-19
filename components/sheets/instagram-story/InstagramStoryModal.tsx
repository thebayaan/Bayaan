import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import {useCanvasRef} from '@shopify/react-native-skia';
import * as Burnt from 'burnt';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {verseShareUrl} from '@/utils/shareUtils';
import {lightHaptics, mediumHaptics, heavyHaptics} from '@/utils/haptics';
import {shareVerseToInstagramStory} from '@/utils/instagramStoryShare';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
} from '@/components/share/instagram-story/templates';
import {
  IG_STORY_HEIGHT,
  StoryBackgroundCanvas,
} from '@/components/share/instagram-story/StoryBackgroundCanvas';
import {StoryStickerCanvas} from '@/components/share/instagram-story/StoryStickerCanvas';
import {StoryPreviewCanvas} from '@/components/share/instagram-story/StoryPreviewCanvas';
import {captureStoryImages} from '@/components/share/instagram-story/captureStoryImages';
import {TemplateThumbnail} from './TemplateThumbnail';
import type {
  TemplateId,
  RenderContext,
} from '@/components/share/instagram-story/types';

const CAPTURE_LOCK_MS = 150;

export const InstagramStoryModal = (
  props: SheetProps<'instagram-story'>,
): React.ReactElement => {
  const {verseKeys} = props.payload ?? {verseKeys: []};
  const {width: screenWidth} = useWindowDimensions();
  const bgRef = useCanvasRef();
  const stickerRef = useCanvasRef();

  const fontMgr = mushafPreloadService.fontMgr;
  const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';

  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE_ID);
  // Translation rendering is deferred to Phase 1.1 — kept here as a
  // static false so RenderContext stays stable for future toggle wiring.
  const translationEnabled = false;
  const [isSharing, setIsSharing] = useState(false);
  const [captureLocked, setCaptureLocked] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = getTemplate(templateId);

  // Safety margin so the sticker has breathing room on IG's 9:16 canvas.
  const MAX_STICKER_HEIGHT = IG_STORY_HEIGHT - 160;

  const ctx: RenderContext | null = useMemo(() => {
    if (!fontMgr) return null;
    return {
      verseKeys,
      rewayah,
      translationEnabled,
      fontMgr,
      quranCommonTypeface,
      fontFamily,
    };
  }, [
    verseKeys,
    rewayah,
    translationEnabled,
    fontMgr,
    quranCommonTypeface,
    fontFamily,
  ]);

  React.useEffect(() => {
    if (verseKeys.length > 0) {
      analyticsService.trackInstagramStoryOpened({
        verse_range: formatRange(verseKeys),
      });
    }
  }, [verseKeys]);

  const handleTemplateChange = useCallback(
    (nextId: TemplateId): void => {
      if (nextId === templateId) return;
      analyticsService.trackInstagramStoryTemplateSwitched({
        from: templateId,
        to: nextId,
      });
      setTemplateId(nextId);
      setCaptureLocked(true);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(
        () => setCaptureLocked(false),
        CAPTURE_LOCK_MS,
      );
    },
    [templateId],
  );

  const handleShare = useCallback(async (): Promise<void> => {
    if (!ctx || captureLocked || isSharing) return;
    mediumHaptics();
    setIsSharing(true);
    try {
      const {backgroundUri, stickerUri} = await captureStoryImages({
        backgroundRef: bgRef,
        stickerRef,
      });
      const [firstSurah, firstAyah] = verseKeys[0].split(':').map(Number);
      const attributionUrl = verseShareUrl(firstSurah, firstAyah);
      const result = await shareVerseToInstagramStory({
        backgroundUri,
        stickerUri,
        attributionUrl,
      });
      if (result.shared) {
        analyticsService.trackInstagramStoryShare({
          template: templateId,
          translation_shown: translationEnabled,
          content_type: 'verse',
          surah_id: firstSurah,
          verse_range: formatRange(verseKeys),
        });
      } else if (result.reason === 'not-installed') {
        heavyHaptics();
        Burnt.toast({title: 'Instagram isn’t installed', preset: 'error'});
        analyticsService.trackInstagramStoryFailed({
          template: templateId,
          reason: 'not-installed',
        });
      } else if (result.reason === 'cancelled') {
        analyticsService.trackInstagramStoryCancelled({template: templateId});
      } else {
        heavyHaptics();
        Burnt.toast({title: 'Couldn’t share to Instagram', preset: 'error'});
        analyticsService.trackInstagramStoryFailed({
          template: templateId,
          reason: result.reason ?? 'share-error',
        });
      }
    } catch {
      heavyHaptics();
      Burnt.toast({title: 'Failed to render share', preset: 'error'});
      analyticsService.trackInstagramStoryFailed({
        template: templateId,
        reason: 'render-failed',
      });
    } finally {
      setIsSharing(false);
    }
  }, [
    ctx,
    captureLocked,
    isSharing,
    bgRef,
    stickerRef,
    verseKeys,
    templateId,
    translationEnabled,
  ]);

  const previewWidth = Math.min(
    moderateScale(260),
    screenWidth - moderateScale(48),
  );

  const tooLong = useMemo(() => {
    if (!ctx) return false;
    const {height} = template.getStickerDimensions(ctx);
    return height > MAX_STICKER_HEIGHT;
  }, [ctx, template, MAX_STICKER_HEIGHT]);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheet}
      gestureEnabled>
      <View style={styles.header}>
        <Text style={styles.title}>Share to Instagram</Text>
      </View>

      {!ctx ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loaderText}>Loading fonts…</Text>
        </View>
      ) : (
        <>
          <View style={styles.previewWrap}>
            <StoryPreviewCanvas
              template={template}
              ctx={ctx}
              width={previewWidth}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbsRow}>
            {TEMPLATES.map(t => (
              <TemplateThumbnail
                key={t.id}
                template={t}
                ctx={ctx}
                isActive={t.id === templateId}
                onPress={handleTemplateChange}
              />
            ))}
          </ScrollView>

          {/* Translation toggle deferred to Phase 1.1 — see plan §Task 22
              follow-up. Fit cascade logic in fitCascade.ts exists but awaits
              translation integration in buildShareCardParagraphs. */}

          {tooLong && (
            <Text style={styles.warning}>
              This verse range is too long to share — try a shorter selection.
            </Text>
          )}

          <Pressable
            style={[
              styles.shareBtn,
              (captureLocked || isSharing || tooLong) && styles.shareBtnDisabled,
            ]}
            onPress={handleShare}
            disabled={captureLocked || isSharing || tooLong}
            accessibilityRole="button"
            accessibilityLabel="Share to Instagram Story">
            {isSharing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="instagram" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share to Story</Text>
              </>
            )}
          </Pressable>

          {/* Hidden off-screen capture canvases — pre-mounted for fast capture */}
          <StoryBackgroundCanvas ref={bgRef} template={template} ctx={ctx} />
          <StoryStickerCanvas ref={stickerRef} template={template} ctx={ctx} />
        </>
      )}
    </ActionSheet>
  );
};

function formatRange(verseKeys: string[]): string {
  if (verseKeys.length === 0) return '';
  if (verseKeys.length === 1) return verseKeys[0];
  return `${verseKeys[0]} — ${verseKeys[verseKeys.length - 1]}`;
}

const styles = ScaledSheet.create({
  sheet: {
    backgroundColor: '#050b10',
    borderTopLeftRadius: '20@ms',
    borderTopRightRadius: '20@ms',
    paddingBottom: '24@ms',
  },
  header: {paddingVertical: '16@ms', alignItems: 'center'},
  title: {color: '#fff', fontSize: '16@ms', fontWeight: '600'},
  loader: {padding: '32@ms', alignItems: 'center'},
  loaderText: {color: '#aaa', marginTop: '12@ms', fontSize: '12@ms'},
  previewWrap: {alignItems: 'center', paddingVertical: '12@ms'},
  thumbsRow: {paddingHorizontal: '16@ms', paddingVertical: '8@ms'},
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '20@ms',
    paddingVertical: '12@ms',
  },
  toggleLabel: {color: '#e8e8e8', fontSize: '14@ms'},
  toggleDot: {
    width: '36@ms',
    height: '20@ms',
    borderRadius: '10@ms',
    backgroundColor: '#2a3340',
  },
  toggleDotOn: {backgroundColor: '#38bdf8'},
  shareBtn: {
    marginHorizontal: '16@ms',
    marginTop: '12@ms',
    paddingVertical: '14@ms',
    borderRadius: '14@ms',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2743',
  },
  shareBtnDisabled: {opacity: 0.5},
  shareBtnText: {color: '#fff', fontSize: '14@ms', fontWeight: '600'},
  warning: {
    marginHorizontal: '16@ms',
    marginTop: '8@ms',
    color: '#f59e0b',
    fontSize: '12@ms',
    textAlign: 'center',
  },
});
